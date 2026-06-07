import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('creator')
export class AnalyticsController {
    constructor(private analytics: AnalyticsService) {}

    @Get('overview')
    getOverview(@CurrentUser() user: any) {
        return this.analytics.getOverview(user.id);
    }

    @Get('events/:eventId')
    getEventStats(@Param('eventId') eventId: string, @CurrentUser() user: any) {
        return this.analytics.getEventStats(eventId, user.id);
    }
}
