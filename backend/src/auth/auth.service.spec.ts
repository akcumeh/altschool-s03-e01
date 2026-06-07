import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { UserRole } from './dto/register.dto';

const mockUser = {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    password_hash: '',
    role: UserRole.creator,
    created_at: new Date().toISOString(),
};

describe('AuthService', () => {
    let service: AuthService;
    let users: jest.Mocked<UsersService>;
    let jwt: jest.Mocked<JwtService>;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: { findByEmail: jest.fn(), create: jest.fn() },
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn().mockResolvedValue('token'),
                    },
                },
            ],
        }).compile();

        service = module.get(AuthService);
        users = module.get(UsersService);
        jwt = module.get(JwtService);
    });

    describe('register', () => {
        it('creates a user with hashed password', async () => {
            users.findByEmail.mockResolvedValue(null);
            users.create.mockResolvedValue({ ...mockUser });

            const result = await service.register({
                name: 'Alice',
                email: 'alice@example.com',
                password: 'password123',
                role: UserRole.creator,
            });

            expect(users.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'alice@example.com',
                    role: UserRole.creator,
                }),
            );
            expect(result).toHaveProperty('id');
        });

        it('throws ConflictException if email already exists', async () => {
            users.findByEmail.mockResolvedValue(mockUser as any);

            await expect(
                service.register({
                    name: 'Alice',
                    email: 'alice@example.com',
                    password: 'password123',
                    role: UserRole.creator,
                }),
            ).rejects.toThrow(ConflictException);
        });

        it('hashes the password before storing', async () => {
            users.findByEmail.mockResolvedValue(null);
            users.create.mockResolvedValue({ ...mockUser });

            await service.register({
                name: 'Alice',
                email: 'alice@example.com',
                password: 'mypassword',
                role: UserRole.creator,
            });

            const call = users.create.mock.calls[0][0];
            const isHashed = await bcrypt.compare(
                'mypassword',
                call.password_hash,
            );
            expect(isHashed).toBe(true);
        });
    });

    describe('login', () => {
        it('returns access_token on valid credentials', async () => {
            const hash = await bcrypt.hash('password123', 12);
            users.findByEmail.mockResolvedValue({
                ...mockUser,
                password_hash: hash,
            } as any);

            const result = await service.login({
                email: 'alice@example.com',
                password: 'password123',
            });

            expect(result).toHaveProperty('access_token', 'token');
            expect(jwt.signAsync).toHaveBeenCalled();
        });

        it('throws UnauthorizedException for wrong password', async () => {
            const hash = await bcrypt.hash('correctpass', 12);
            users.findByEmail.mockResolvedValue({
                ...mockUser,
                password_hash: hash,
            } as any);

            await expect(
                service.login({
                    email: 'alice@example.com',
                    password: 'wrongpass',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException for unknown email', async () => {
            users.findByEmail.mockResolvedValue(null);

            await expect(
                service.login({
                    email: 'unknown@example.com',
                    password: 'pass',
                }),
            ).rejects.toThrow(UnauthorizedException);
        });
    });
});
