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
        qrCode: string;
    }): Promise<void> {
        const date = new Date(opts.startsAt).toLocaleString('en-NG', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        await this.sendEmail({
            to: opts.to,
            subject: `Reminder: ${opts.eventTitle} is coming up!`,
            html: `
        <h2>Hi ${opts.name},</h2>
        <p>This is a reminder that <strong>${opts.eventTitle}</strong> is coming up soon.</p>
        <p><strong>Date:</strong> ${date}</p>
        ${opts.location ? `<p><strong>Location:</strong> ${opts.location}</p>` : ''}
        <p>Your QR code for entry:</p>
        <img src="${opts.qrCode}" alt="QR Code" style="width:200px;height:200px;" />
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
                });

                await this.supabase.db
                    .from('reminder_logs')
                    .insert({ ticket_id: t.ticket_id });

                this.logger.log(`Reminder sent for ticket ${t.ticket_id}`);
            } catch (err) {
                this.logger.error(
                    `Failed to send reminder for ticket ${t.ticket_id}`,
                    err,
                );
            }
        }
    }
}
