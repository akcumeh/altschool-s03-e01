import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private transporter: nodemailer.Transporter;

    constructor(
        private config: ConfigService,
        private supabase: SupabaseService,
    ) {
        this.transporter = nodemailer.createTransport({
            host: this.config.get('MAIL_HOST', 'smtp.gmail.com'),
            port: this.config.get<number>('MAIL_PORT', 587),
            secure: false,
            auth: {
                user: this.config.getOrThrow('MAIL_USER'),
                pass: this.config.getOrThrow('MAIL_PASS'),
            },
        });
    }

    async sendEmail(opts: {
        to: string;
        subject: string;
        html: string;
    }): Promise<void> {
        await this.transporter.sendMail({
            from: this.config.get('MAIL_FROM', this.config.get('MAIL_USER')),
            ...opts,
        });
    }

    async sendTicketEmail(opts: {
        to: string;
        name: string;
        eventTitle: string;
        startsAt: string;
        location?: string;
        qrCode: string;
    }): Promise<void> {
        const date = new Date(opts.startsAt).toLocaleString('en-NG', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        await this.sendEmail({
            to: opts.to,
            subject: `Your ticket for ${opts.eventTitle}`,
            html: `
        <h2>Hi ${opts.name},</h2>
        <p>Your ticket for <strong>${opts.eventTitle}</strong> is confirmed!</p>
        <p><strong>Date:</strong> ${date}</p>
        ${opts.location ? `<p><strong>Location:</strong> ${opts.location}</p>` : ''}
        <p>Show this QR code at the entrance:</p>
        <img src="${opts.qrCode}" alt="QR Code" style="width:200px;height:200px;" />
        <p>See you there!</p>
      `,
        });
    }

    async sendReminderEmail(opts: {
        to: string;
        name: string;
        eventTitle: string;
        startsAt: string;
        location?: string;
        qrCode?: string | null;
        eventId?: string;
        ticketStatus?: string;
        source?: 'creator' | 'eventee';
    }): Promise<void> {
        const date = new Date(opts.startsAt).toLocaleString('en-NG', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        const hoursLeft = Math.max(
            1,
            Math.round(
                (new Date(opts.startsAt).getTime() - Date.now()) / 3600000,
            ),
        );
        const countdown =
            hoursLeft >= 48
                ? `${Math.round(hoursLeft / 24)} days`
                : `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`;

        const frontendUrl = this.config.get(
            'FRONTEND_URL',
            'http://localhost:3001',
        );
        const eventLink = opts.eventId
            ? `${frontendUrl}/events/${opts.eventId}`
            : frontendUrl;

        const isOwnReminder = opts.source === 'eventee';
        const isPaid = opts.ticketStatus !== 'pending';

        const intro = isOwnReminder
            ? `<p>You asked to be reminded about <strong>${opts.eventTitle}</strong>, which starts in ${countdown}.</p>`
            : `<p><strong>${opts.eventTitle}</strong> starts in ${countdown}. See you soon!</p>`;

        const ticketBlock = isPaid
            ? opts.qrCode
                ? `<p>Your QR code for entry:</p>
        <img src="${opts.qrCode}" alt="QR Code" style="width:200px;height:200px;" />`
                : ''
            : `<p>You haven't got your ticket yet. <a href="${eventLink}">Here's how to get one</a>.</p>`;

        await this.sendEmail({
            to: opts.to,
            subject: isOwnReminder
                ? `Your reminder: ${opts.eventTitle} starts in ${countdown}`
                : `Reminder: ${opts.eventTitle} is coming up!`,
            html: `
        <h2>Hi ${opts.name},</h2>
        ${intro}
        <p><strong>Date:</strong> ${date}</p>
        ${opts.location ? `<p><strong>Location:</strong> ${opts.location}</p>` : ''}
        ${ticketBlock}
        <p><a href="${eventLink}">View the event</a></p>
        <p>See you there!</p>
      `,
        });
    }

    @Cron(CronExpression.EVERY_HOUR)
    async sendScheduledReminders(): Promise<void> {
        this.logger.log('Running scheduled reminder check...');

        const { data: tickets, error } =
            await this.supabase.db.rpc('get_due_reminders');

        if (error) {
            this.logger.error('Error fetching due reminders', error.message);
            return;
        }

        if (!tickets || tickets.length === 0) return;

        for (const t of tickets) {
            try {
                await this.sendReminderEmail({
                    to: t.email,
                    name: t.name,
                    eventTitle: t.title,
                    startsAt: t.starts_at,
                    location: t.location,
                    qrCode: t.qr_code,
                    eventId: t.event_id,
                    ticketStatus: t.ticket_status,
                    source: t.source,
                });

                await this.supabase.db
                    .from('reminder_logs')
                    .insert({
                        ticket_id: t.ticket_id,
                        source: t.source ?? 'creator',
                    });

                this.logger.log(
                    `Reminder (${t.source}) sent for ticket ${t.ticket_id}`,
                );
            } catch (err) {
                this.logger.error(
                    `Failed to send reminder for ticket ${t.ticket_id}`,
                    err,
                );
            }
        }
    }
}
