import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { QrService } from '../qr/qr.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private readonly paystackBase = 'https://api.paystack.co';

    constructor(
        private config: ConfigService,
        private supabase: SupabaseService,
        private tickets: TicketsService,
        private qr: QrService,
        private notifications: NotificationsService,
    ) {}

    async initializePayment(eventId: string, eventeeId: string) {
        const { data: ticket } = await this.supabase.db
            .from('tickets')
            .select(
                'id, status, event_id, eventee_id, events(title, ticket_price), eventful_users(email)',
            )
            .eq('event_id', eventId)
            .eq('eventee_id', eventeeId)
            .single();

        if (!ticket)
            throw new NotFoundException('Register for the event first');
        if (ticket.status === 'paid')
            throw new BadRequestException('Ticket already paid');

        const event = ticket.events as any;
        const user = ticket.eventful_users as any;
        const amountKobo = Math.round(Number(event.ticket_price) * 100);

        const reference = `EVT-${ticket.id}-${Date.now()}`;

        const { data: response } = await axios.post(
            `${this.paystackBase}/transaction/initialize`,
            {
                email: user.email,
                amount: amountKobo,
                reference,
                metadata: { ticket_id: ticket.id },
            },
            {
                headers: {
                    Authorization: `Bearer ${this.config.getOrThrow('PAYSTACK_SECRET_KEY')}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        await this.supabase.db
            .from('tickets')
            .update({ paystack_reference: reference })
            .eq('id', ticket.id);

        return {
            authorization_url: response.data.authorization_url,
            reference: response.data.reference,
        };
    }

    async verifyPayment(eventId: string, eventeeId: string, reference: string) {
        let verifyRes: any;
        try {
            const response = await axios.get(
                `${this.paystackBase}/transaction/verify/${reference}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.config.getOrThrow('PAYSTACK_SECRET_KEY')}`,
                    },
                },
            );
            verifyRes = response.data;
        } catch (err: any) {
            const paystackMessage: string =
                err?.response?.data?.message ?? 'Could not verify payment reference';
            throw new NotFoundException(paystackMessage);
        }

        if (verifyRes.data?.status !== 'success') {
            throw new BadRequestException('Payment not successful');
        }

        const ticket = await this.tickets.findByPaystackReference(reference);
        if (!ticket) throw new NotFoundException('Ticket not found for this reference');
        if (ticket.status === 'paid') return { message: 'Already processed', ticket };

        if (ticket.eventee_id !== eventeeId)
            throw new BadRequestException('Reference does not belong to you');

        const amountPaid = verifyRes.data.amount / 100;
        const qrCode = await this.qr.generate(ticket.id);

        const updated = await this.tickets.updateAfterPayment({
            ticketId: ticket.id,
            reference,
            amountPaid,
            qrCode,
        });

        const eventData = updated.events as any;
        const userData = updated.eventful_users as any;

        try {
            await this.notifications.sendTicketEmail({
                to: userData.email,
                name: userData.name,
                eventTitle: eventData.title,
                startsAt: eventData.starts_at,
                location: eventData.location,
                qrCode,
            });
        } catch (err) {
            this.logger.error('Failed to send ticket confirmation email', err);
        }

        return updated;
    }

    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
        const secret = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
        const hash = crypto
            .createHmac('sha512', secret)
            .update(rawBody)
            .digest('hex');
        return hash === signature;
    }

    async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
        if (!this.verifyWebhookSignature(rawBody, signature)) {
            throw new BadRequestException('Invalid webhook signature');
        }

        const payload = JSON.parse(rawBody.toString());
        if (payload.event !== 'charge.success') return;

        const reference: string = payload.data?.reference;
        if (!reference) return;

        const ticket = await this.tickets.findByPaystackReference(reference);
        if (!ticket || ticket.status === 'paid') return;

        const amountPaid = payload.data.amount / 100;
        const qrCode = await this.qr.generate(ticket.id);

        const updated = await this.tickets.updateAfterPayment({
            ticketId: ticket.id,
            reference,
            amountPaid,
            qrCode,
        });

        const eventData = updated.events as any;
        const userData = updated.eventful_users as any;

        try {
            await this.notifications.sendTicketEmail({
                to: userData.email,
                name: userData.name,
                eventTitle: eventData.title,
                startsAt: eventData.starts_at,
                location: eventData.location,
                qrCode,
            });
        } catch (err) {
            this.logger.error('Failed to send ticket confirmation email', err);
        }
    }
}
