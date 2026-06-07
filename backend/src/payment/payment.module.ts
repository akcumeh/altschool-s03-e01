import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QrModule } from '../qr/qr.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
    imports: [TicketsModule, QrModule, NotificationsModule],
    providers: [PaymentService],
    controllers: [PaymentController],
})
export class PaymentModule {}
