import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentModule } from './payment/payment.module';
import { QrModule } from './qr/qr.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
        ScheduleModule.forRoot(),
        CacheModule.register({ isGlobal: true, ttl: 60000 }),
        SupabaseModule,
        UsersModule,
        AuthModule,
        EventsModule,
        TicketsModule,
        PaymentModule,
        QrModule,
        NotificationsModule,
        AnalyticsModule,
    ],
})
export class AppModule {}
