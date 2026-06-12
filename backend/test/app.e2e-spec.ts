import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';
import { SupabaseService } from '../src/supabase/supabase.service';

// ─────────────────────────────────────────────────────────────────────────────
// Test JWT strategy — identical secret, no DB lookup.
// The real JwtStrategy calls UsersService.findById() on every request which
// hits Supabase. Replacing it here removes that dependency from e2e tests.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'e2e-test-jwt-secret-long-enough-for-hs256';

class TestJwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: TEST_JWT_SECRET,
        });
    }

    validate(payload: { sub: string; email: string; role: string }) {
        return { id: payload.sub, email: payload.email, role: payload.role };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase chain mock helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a thenable fluent-chain object that resolves to `result` when awaited.
 * Every chainable Supabase method returns the same chain, so the whole builder
 * resolves to `result` regardless of what terminal method was last called.
 */
function makeChain(result: any) {
    const chain: any = {};
    [
        'select', 'insert', 'update', 'delete',
        'eq', 'neq', 'in', 'order', 'single', 'head',
    ].forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then    = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
    chain.catch   = (fn: any)            => Promise.resolve(result).catch(fn);
    chain.finally = (fn: any)            => Promise.resolve(result).finally(fn);
    return chain;
}

/** Per-table FIFO response queues. Tests call enqueue() to stage results. */
const queues: Record<string, any[]> = {};

function enqueue(table: string, result: any) {
    (queues[table] ??= []).push(result);
}

function clearQueues() {
    Object.keys(queues).forEach((k) => { queues[k] = []; });
}

const mockDb = {
    from: jest.fn().mockImplementation((table: string) => {
        const q = queues[table];
        const result = q?.length ? q.shift() : { data: null, error: null };
        return makeChain(result);
    }),
    rpc: jest.fn().mockReturnValue(makeChain({ data: [], error: null })),
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared test fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CREATOR_ID    = 'creator-id-001';
const EVENTEE_ID    = 'eventee-id-001';
const OTHER_CREATOR = 'other-creator-002';
const EVENT_ID      = 'event-id-001';
const TICKET_ID     = 'ticket-id-001';
const SHARE_TOKEN   = 'abc123sharetoken';

const mockEvent = {
    id: EVENT_ID,
    title: 'Tech Summit 2025',
    description: 'Annual technology conference',
    starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    ends_at: null,
    location: 'Lagos, Nigeria',
    capacity: 100,
    ticket_price: '5000',
    status: 'published',
    creator_id: CREATOR_ID,
    share_token: SHARE_TOKEN,
    created_at: new Date().toISOString(),
};

/** Safe user row — no password_hash (mirrors what UsersService.create selects). */
const mockUserPublic = {
    id: CREATOR_ID,
    name: 'Alice Creator',
    email: 'creator@test.com',
    role: 'creator',
    created_at: new Date().toISOString(),
};

const mockTicket = {
    id: TICKET_ID,
    event_id: EVENT_ID,
    eventee_id: EVENTEE_ID,
    status: 'pending',
    paystack_reference: null,
    amount_paid: null,
    qr_code: null,
    paid_at: null,
    qr_scanned_at: null,
    reminder_hours_before: null,
    created_at: new Date().toISOString(),
};

const mockPaidTicket = {
    ...mockTicket,
    status: 'paid',
    amount_paid: 5000,
    qr_scanned_at: null,
    events: { title: mockEvent.title, starts_at: mockEvent.starts_at, location: mockEvent.location },
    eventful_users: { name: 'Bob Eventee', email: 'bob@test.com' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Eventful API (e2e)', () => {
    let app: INestApplication;
    let creatorToken: string;
    let eventeeToken: string;

    beforeAll(async () => {
        process.env.SUPABASE_URL              = 'http://localhost:54321';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role';
        process.env.JWT_SECRET                = TEST_JWT_SECRET;
        process.env.PAYSTACK_SECRET_KEY       = 'sk_test_mock_paystack_key';
        process.env.MAIL_HOST                 = 'localhost';
        process.env.MAIL_PORT                 = '587';
        process.env.MAIL_USER                 = 'test@example.com';
        process.env.MAIL_PASS                 = 'testpass';
        process.env.MAIL_FROM                 = 'noreply@eventful.test';

        const fixture = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(JwtStrategy)
            .useClass(TestJwtStrategy)
            .overrideProvider(SupabaseService)
            .useValue({ db: mockDb })
            .overrideProvider(NotificationsService)
            .useValue({
                sendTicketEmail:        jest.fn().mockResolvedValue(undefined),
                sendReminderEmail:      jest.fn().mockResolvedValue(undefined),
                sendScheduledReminders: jest.fn().mockResolvedValue(undefined),
            })
            .compile();

        // rawBody: true required for Paystack webhook HMAC verification
        app = fixture.createNestApplication({ rawBody: true });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();

        const jwt = fixture.get(JwtService);
        creatorToken = await jwt.signAsync({ sub: CREATOR_ID, email: 'creator@test.com', role: 'creator' });
        eventeeToken = await jwt.signAsync({ sub: EVENTEE_ID, email: 'eventee@test.com', role: 'eventee' });
    });

    afterAll(async () => { await app.close(); });

    beforeEach(() => {
        clearQueues();
        jest.clearAllMocks();
        mockDb.rpc.mockReturnValue(makeChain({ data: [], error: null }));
    });

    // ── Health ────────────────────────────────────────────────────────────────

    describe('GET /', () => {
        it('200 – health check responds without auth', async () => {
            const res = await request(app.getHttpServer()).get('/');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('uptime');
        });

        it('200 – /health alias works the same way', async () => {
            const res = await request(app.getHttpServer()).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    // ── Auth ──────────────────────────────────────────────────────────────────

    describe('POST /auth/register', () => {
        it('201 – registers a new user and omits password_hash', async () => {
            enqueue('eventful_users', { data: null, error: null });        // findByEmail → not found
            enqueue('eventful_users', { data: mockUserPublic, error: null }); // create → new user

            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({ name: 'Alice', email: 'alice@test.com', password: 'pass1234', role: 'creator' });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).not.toHaveProperty('password_hash');
        });

        it('409 – duplicate email', async () => {
            enqueue('eventful_users', { data: { ...mockUserPublic, password_hash: 'hash' }, error: null });

            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({ name: 'Alice', email: 'creator@test.com', password: 'pass1234', role: 'creator' });

            expect(res.status).toBe(409);
        });

        it('400 – missing required fields', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({ email: 'nope@test.com' });
            expect(res.status).toBe(400);
        });

        it('400 – invalid role value', async () => {
            const res = await request(app.getHttpServer())
                .post('/auth/register')
                .send({ name: 'X', email: 'x@test.com', password: 'pass1234', role: 'admin' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /auth/login', () => {
        it('200 – returns access_token on valid credentials', async () => {
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash('pass1234', 12);
            enqueue('eventful_users', { data: { ...mockUserPublic, password_hash: hash }, error: null });

            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'creator@test.com', password: 'pass1234' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('access_token');
            expect(typeof res.body.access_token).toBe('string');
        });

        it('401 – wrong password', async () => {
            const bcrypt = require('bcrypt');
            const hash = await bcrypt.hash('correctpass', 12);
            enqueue('eventful_users', { data: { ...mockUserPublic, password_hash: hash }, error: null });

            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'creator@test.com', password: 'wrongpass' });

            expect(res.status).toBe(401);
        });

        it('401 – unknown email', async () => {
            enqueue('eventful_users', { data: null, error: null });

            const res = await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'ghost@test.com', password: 'pass1234' });

            expect(res.status).toBe(401);
        });
    });

    // ── Events ────────────────────────────────────────────────────────────────

    describe('GET /events', () => {
        it('200 – returns published events without auth', async () => {
            enqueue('events', { data: [mockEvent], error: null });

            const res = await request(app.getHttpServer()).get('/events');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /events', () => {
        const validBody = {
            title: 'Tech Summit',
            description: 'Annual event',
            starts_at: new Date(Date.now() + 86_400_000 * 7).toISOString(),
            location: 'Lagos',
            ticket_price: 5000,
        };

        it('401 – requires auth token', async () => {
            const res = await request(app.getHttpServer()).post('/events').send(validBody);
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot create an event', async () => {
            const res = await request(app.getHttpServer())
                .post('/events')
                .set('Authorization', `Bearer ${eventeeToken}`)
                .send(validBody);
            expect(res.status).toBe(403);
        });

        it('201 – creator creates an event', async () => {
            enqueue('events', { data: mockEvent, error: null });

            const res = await request(app.getHttpServer())
                .post('/events')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send(validBody);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('creator_id', CREATOR_ID);
        });

        it('400 – missing required fields', async () => {
            const res = await request(app.getHttpServer())
                .post('/events')
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ title: 'No Date Event' });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /events/mine', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).get('/events/mine');
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot access', async () => {
            const res = await request(app.getHttpServer())
                .get('/events/mine')
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it("200 – returns creator's events", async () => {
            enqueue('events', { data: [mockEvent], error: null });

            const res = await request(app.getHttpServer())
                .get('/events/mine')
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /events/share/:token', () => {
        it('200 – returns event by share token', async () => {
            enqueue('events', { data: mockEvent, error: null });

            const res = await request(app.getHttpServer())
                .get(`/events/share/${SHARE_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('share_token', SHARE_TOKEN);
        });

        it('404 – unknown share token', async () => {
            enqueue('events', { data: null, error: { code: 'PGRST116' } });

            const res = await request(app.getHttpServer()).get('/events/share/badtoken');

            expect(res.status).toBe(404);
        });
    });

    describe('GET /events/:id/attendees', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .get(`/events/${EVENT_ID}/attendees`);
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot view attendees', async () => {
            const res = await request(app.getHttpServer())
                .get(`/events/${EVENT_ID}/attendees`)
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('403 – creator who does not own the event is rejected', async () => {
            enqueue('events', { data: { ...mockEvent, creator_id: OTHER_CREATOR }, error: null });

            const res = await request(app.getHttpServer())
                .get(`/events/${EVENT_ID}/attendees`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(403);
        });

        it('200 – event owner sees attendee list', async () => {
            enqueue('events',  { data: mockEvent, error: null });
            enqueue('tickets', { count: 1, error: null }); // findOne's ticket-count sub-query
            enqueue('tickets', {
                data: [{
                    id: TICKET_ID,
                    status: 'paid',
                    amount_paid: 5000,
                    paid_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    eventful_users: { id: EVENTEE_ID, name: 'Bob Eventee', email: 'bob@test.com' },
                }],
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get(`/events/${EVENT_ID}/attendees`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('eventful_users');
        });

        it('200 – returns empty array when no one has registered', async () => {
            enqueue('events',  { data: mockEvent, error: null });
            enqueue('tickets', { count: 0, error: null }); // findOne's ticket-count sub-query
            enqueue('tickets', { data: [], error: null });

            const res = await request(app.getHttpServer())
                .get(`/events/${EVENT_ID}/attendees`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('GET /events/:id', () => {
        it('200 – returns event by ID', async () => {
            enqueue('events', { data: mockEvent, error: null });

            const res = await request(app.getHttpServer()).get(`/events/${EVENT_ID}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id', EVENT_ID);
        });

        it('404 – unknown event ID', async () => {
            enqueue('events', { data: null, error: { code: 'PGRST116' } });

            const res = await request(app.getHttpServer()).get('/events/nonexistent');

            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /events/:id', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/events/${EVENT_ID}`)
                .send({ title: 'New' });
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot update', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`)
                .send({ title: 'New' });
            expect(res.status).toBe(403);
        });

        it('400 – empty body is rejected', async () => {
            enqueue('events', { data: mockEvent, error: null });

            const res = await request(app.getHttpServer())
                .patch(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('message', 'Request body cannot be empty');
        });

        it('200 – owner updates their event', async () => {
            enqueue('events', { data: mockEvent, error: null });
            enqueue('events', { data: { ...mockEvent, title: 'Updated' }, error: null });

            const res = await request(app.getHttpServer())
                .patch(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ title: 'Updated' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('title', 'Updated');
        });

        it('403 – non-owner cannot update', async () => {
            enqueue('events', { data: { ...mockEvent, creator_id: OTHER_CREATOR }, error: null });

            const res = await request(app.getHttpServer())
                .patch(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ title: 'Hijacked' });

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /events/:id', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).delete(`/events/${EVENT_ID}`);
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot delete', async () => {
            const res = await request(app.getHttpServer())
                .delete(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('200 – owner deletes their event', async () => {
            enqueue('events', { data: mockEvent, error: null });
            enqueue('events', { data: null, error: null });

            const res = await request(app.getHttpServer())
                .delete(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Event deleted');
        });

        it('403 – non-owner cannot delete', async () => {
            enqueue('events', { data: { ...mockEvent, creator_id: OTHER_CREATOR }, error: null });

            const res = await request(app.getHttpServer())
                .delete(`/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ── Tickets ───────────────────────────────────────────────────────────────

    describe('POST /tickets/:eventId', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).post(`/tickets/${EVENT_ID}`);
            expect(res.status).toBe(401);
        });

        it('403 – creator role cannot register for an event', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`);
            expect(res.status).toBe(403);
        });

        it('201 – eventee registers for a published event', async () => {
            enqueue('events',  { data: mockEvent, error: null });       // event lookup
            enqueue('tickets', { count: 5, error: null });              // capacity count
            enqueue('tickets', { data: mockTicket, error: null });      // insert

            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body).toHaveProperty('status', 'pending');
        });

        it('409 – duplicate registration', async () => {
            enqueue('events',  { data: mockEvent, error: null });
            enqueue('tickets', { count: 5, error: null });
            enqueue('tickets', { data: null, error: { code: '23505' } });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);

            expect(res.status).toBe(409);
        });

        it('409 – event at full capacity', async () => {
            enqueue('events',  { data: { ...mockEvent, capacity: 10 }, error: null });
            enqueue('tickets', { count: 10, error: null });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);

            expect(res.status).toBe(409);
        });

        it('403 – draft / cancelled events are not open for registration', async () => {
            enqueue('events', { data: { ...mockEvent, status: 'draft' }, error: null });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('GET /tickets/mine', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).get('/tickets/mine');
            expect(res.status).toBe(401);
        });

        it('403 – creator cannot view eventee tickets', async () => {
            const res = await request(app.getHttpServer())
                .get('/tickets/mine')
                .set('Authorization', `Bearer ${creatorToken}`);
            expect(res.status).toBe(403);
        });

        it('200 – returns tickets for authenticated eventee', async () => {
            enqueue('tickets', {
                data: [{
                    ...mockTicket,
                    events: {
                        title: 'Tech Summit',
                        starts_at: mockEvent.starts_at,
                        location: 'Lagos',
                        status: 'published',
                    },
                }],
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get('/tickets/mine')
                .set('Authorization', `Bearer ${eventeeToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('events');
        });
    });

    describe('PATCH /tickets/:ticketId/reminder', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/tickets/${TICKET_ID}/reminder`)
                .send({ reminder_hours_before: 24 });
            expect(res.status).toBe(401);
        });

        it('403 – creator cannot set a reminder', async () => {
            const res = await request(app.getHttpServer())
                .patch(`/tickets/${TICKET_ID}/reminder`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ reminder_hours_before: 24 });
            expect(res.status).toBe(403);
        });

        it('200 – eventee sets a reminder', async () => {
            enqueue('tickets', {
                data: {
                    ...mockTicket,
                    events: { title: 'Tech Summit', starts_at: mockEvent.starts_at, location: 'Lagos' },
                    eventful_users: { name: 'Bob', email: 'bob@test.com' },
                },
                error: null,
            }); // findById
            enqueue('tickets', {
                data: { ...mockTicket, reminder_hours_before: 24 },
                error: null,
            }); // update

            const res = await request(app.getHttpServer())
                .patch(`/tickets/${TICKET_ID}/reminder`)
                .set('Authorization', `Bearer ${eventeeToken}`)
                .send({ reminder_hours_before: 24 });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('reminder_hours_before', 24);
        });

        it('403 – eventee cannot set a reminder on someone else\'s ticket', async () => {
            enqueue('tickets', {
                data: { ...mockTicket, eventee_id: 'someone-else' },
                error: null,
            });

            const res = await request(app.getHttpServer())
                .patch(`/tickets/${TICKET_ID}/reminder`)
                .set('Authorization', `Bearer ${eventeeToken}`)
                .send({ reminder_hours_before: 24 });

            expect(res.status).toBe(403);
        });
    });

    describe('POST /tickets/:ticketId/scan', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${TICKET_ID}/scan`);
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot scan a ticket', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${TICKET_ID}/scan`)
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('201 – creator scans a paid ticket', async () => {
            enqueue('tickets', { data: mockPaidTicket, error: null });
            enqueue('events',  { data: { creator_id: CREATOR_ID }, error: null });
            enqueue('tickets', {
                data: { ...mockPaidTicket, qr_scanned_at: new Date().toISOString() },
                error: null,
            });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${TICKET_ID}/scan`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('qr_scanned_at');
            expect(res.body.qr_scanned_at).not.toBeNull();
        });

        it('409 – already-scanned ticket is rejected', async () => {
            enqueue('tickets', {
                data: { ...mockPaidTicket, qr_scanned_at: new Date().toISOString() },
                error: null,
            });
            enqueue('events', { data: { creator_id: CREATOR_ID }, error: null });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${TICKET_ID}/scan`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(409);
        });

        it('403 – creator cannot scan tickets for another creator\'s event', async () => {
            enqueue('tickets', { data: mockPaidTicket, error: null });
            enqueue('events',  { data: { creator_id: OTHER_CREATOR }, error: null });

            const res = await request(app.getHttpServer())
                .post(`/tickets/${TICKET_ID}/scan`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ── Analytics ─────────────────────────────────────────────────────────────

    describe('GET /analytics/overview', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).get('/analytics/overview');
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot access analytics', async () => {
            const res = await request(app.getHttpServer())
                .get('/analytics/overview')
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('200 – returns overview stats for creator', async () => {
            enqueue('events', {
                data: [{ id: EVENT_ID, status: 'published', starts_at: mockEvent.starts_at }],
                error: null,
            });
            enqueue('tickets', {
                data: [
                    { status: 'paid', amount_paid: 5000, qr_scanned_at: new Date().toISOString() },
                    { status: 'paid', amount_paid: 5000, qr_scanned_at: null },
                ],
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get('/analytics/overview')
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('total_tickets_sold', 2);
            expect(res.body).toHaveProperty('total_revenue', 10000);
            expect(res.body).toHaveProperty('total_attendees', 1);
            expect(res.body).toHaveProperty('total_events');
        });

        it('200 – returns zeros when creator has no events', async () => {
            enqueue('events', { data: [], error: null });

            const res = await request(app.getHttpServer())
                .get('/analytics/overview')
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                total_tickets_sold: 0,
                total_revenue: 0,
                total_attendees: 0,
            });
        });
    });

    describe('GET /analytics/events', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).get('/analytics/events');
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot access analytics', async () => {
            const res = await request(app.getHttpServer())
                .get('/analytics/events')
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('200 – returns per-event breakdown for creator', async () => {
            enqueue('events', { data: [mockEvent], error: null });
            enqueue('tickets', {
                data: [
                    { event_id: EVENT_ID, status: 'paid', amount_paid: 5000, qr_scanned_at: null },
                    { event_id: EVENT_ID, status: 'pending', amount_paid: null, qr_scanned_at: null },
                ],
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get('/analytics/events')
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('tickets_sold', 1);
            expect(res.body[0]).toHaveProperty('pending_tickets', 1);
            expect(res.body[0]).toHaveProperty('revenue', 5000);
        });

        it('200 – returns empty array when creator has no events', async () => {
            enqueue('events', { data: [], error: null });

            const res = await request(app.getHttpServer())
                .get('/analytics/events')
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('GET /analytics/events/:eventId', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .get(`/analytics/events/${EVENT_ID}`);
            expect(res.status).toBe(401);
        });

        it('403 – eventee cannot access analytics', async () => {
            const res = await request(app.getHttpServer())
                .get(`/analytics/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${eventeeToken}`);
            expect(res.status).toBe(403);
        });

        it('200 – returns per-event stats for owner', async () => {
            enqueue('events', {
                data: { id: EVENT_ID, creator_id: CREATOR_ID, title: 'Tech Summit 2025', capacity: 100, ticket_price: '5000', starts_at: mockEvent.starts_at, status: 'published', reminder_hours_before: null },
                error: null,
            });
            enqueue('tickets', {
                data: [{ status: 'paid', amount_paid: 5000, qr_scanned_at: new Date().toISOString() }],
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get(`/analytics/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('event_id', EVENT_ID);
            expect(res.body).toHaveProperty('tickets_sold', 1);
            expect(res.body).toHaveProperty('revenue', 5000);
            expect(res.body).toHaveProperty('qr_scans', 1);
            expect(res.body).toHaveProperty('attendance_rate');
        });

        it('403 – non-owner creator is denied', async () => {
            enqueue('events', {
                data: { id: EVENT_ID, creator_id: OTHER_CREATOR, title: 'Tech Summit' },
                error: null,
            });

            const res = await request(app.getHttpServer())
                .get(`/analytics/events/${EVENT_ID}`)
                .set('Authorization', `Bearer ${creatorToken}`);

            expect(res.status).toBe(403);
        });
    });

    // ── Payment ───────────────────────────────────────────────────────────────

    describe('POST /tickets/:eventId/pay', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer()).post(`/tickets/${EVENT_ID}/pay`);
            expect(res.status).toBe(401);
        });

        it('403 – creator cannot initialize payment', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}/pay`)
                .set('Authorization', `Bearer ${creatorToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('POST /tickets/:eventId/verify', () => {
        it('401 – requires auth', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}/verify`)
                .send({ reference: 'EVT-abc-123' });
            expect(res.status).toBe(401);
        });

        it('403 – creator cannot verify payment', async () => {
            const res = await request(app.getHttpServer())
                .post(`/tickets/${EVENT_ID}/verify`)
                .set('Authorization', `Bearer ${creatorToken}`)
                .send({ reference: 'EVT-abc-123' });
            expect(res.status).toBe(403);
        });
    });

    describe('POST /payment/webhook', () => {
        const PAYSTACK_SECRET = 'sk_test_mock_paystack_key';

        const webhookPayload = JSON.stringify({
            event: 'charge.success',
            data: { reference: `EVT-${TICKET_ID}-1234567890`, amount: 500_000 },
        });

        function sign(body: string) {
            return crypto.createHmac('sha512', PAYSTACK_SECRET).update(body).digest('hex');
        }

        it('400 – invalid signature is rejected', async () => {
            const res = await request(app.getHttpServer())
                .post('/payment/webhook')
                .set('x-paystack-signature', 'badsignature')
                .set('Content-Type', 'application/json')
                .send(webhookPayload);

            expect(res.status).toBe(400);
        });

        it('200 – valid webhook is processed', async () => {
            const pendingTicket = {
                ...mockTicket,
                paystack_reference: `EVT-${TICKET_ID}-1234567890`,
                status: 'pending',
            };
            enqueue('tickets', { data: pendingTicket, error: null }); // findByPaystackReference
            enqueue('tickets', {
                data: {
                    ...pendingTicket,
                    status: 'paid',
                    amount_paid: 5000,
                    events: { title: 'Tech Summit', starts_at: mockEvent.starts_at, location: 'Lagos' },
                    eventful_users: { name: 'Bob', email: 'bob@test.com' },
                },
                error: null,
            }); // updateAfterPayment

            const res = await request(app.getHttpServer())
                .post('/payment/webhook')
                .set('x-paystack-signature', sign(webhookPayload))
                .set('Content-Type', 'application/json')
                .send(webhookPayload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('received', true);
        });

        it('200 – non charge.success events are silently ignored', async () => {
            const otherPayload = JSON.stringify({ event: 'transfer.success', data: {} });

            const res = await request(app.getHttpServer())
                .post('/payment/webhook')
                .set('x-paystack-signature', sign(otherPayload))
                .set('Content-Type', 'application/json')
                .send(otherPayload);

            expect(res.status).toBe(200);
        });
    });
});
