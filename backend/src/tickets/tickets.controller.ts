import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SetReminderDto } from './dto/set-reminder.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
    constructor(private tickets: TicketsService) {}

    @Post(':eventId')
    @UseGuards(RolesGuard)
    @Roles('eventee')
    create(@Param('eventId') eventId: string, @CurrentUser() user: any) {
        return this.tickets.create(eventId, user.id);
    }

    @Get('mine')
    @UseGuards(RolesGuard)
    @Roles('eventee')
    findMine(@CurrentUser() user: any) {
        return this.tickets.findMine(user.id);
    }

    @Patch(':ticketId/reminder')
    @UseGuards(RolesGuard)
    @Roles('eventee')
    setReminder(
        @Param('ticketId') ticketId: string,
        @Body() dto: SetReminderDto,
        @CurrentUser() user: any,
    ) {
        return this.tickets.setReminder(
            ticketId,
            user.id,
            dto.reminder_hours_before,
        );
    }

    @Post(':ticketId/scan')
    @UseGuards(RolesGuard)
    @Roles('creator')
    scan(@Param('ticketId') ticketId: string, @CurrentUser() user: any) {
        return this.tickets.scan(ticketId, user.id);
    }
}
