import {
    Body,
    Controller,
    Headers,
    HttpCode,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentService } from './payment.service';

class VerifyPaymentDto {
    @IsString()
    reference: string;
}

@Controller()
export class PaymentController {
    constructor(private payment: PaymentService) {}

    @Post('tickets/:eventId/pay')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('eventee')
    initializePayment(
        @Param('eventId') eventId: string,
        @CurrentUser() user: any,
    ) {
        return this.payment.initializePayment(eventId, user.id);
    }

    @Post('tickets/:eventId/verify')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('eventee')
    verifyPayment(
        @Param('eventId') eventId: string,
        @Body() dto: VerifyPaymentDto,
        @CurrentUser() user: any,
    ) {
        return this.payment.verifyPayment(eventId, user.id, dto.reference);
    }

    @Post('payment/webhook')
    @HttpCode(200)
    async webhook(
        @Req() req: any,
        @Headers('x-paystack-signature') signature: string,
    ) {
        await this.payment.handleWebhook(req.rawBody as Buffer, signature);
        return { received: true };
    }
}
