import {
    Body,
    Controller,
    Delete,
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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
    constructor(private events: EventsService) {}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('creator')
    create(@Body() dto: CreateEventDto, @CurrentUser() user: any) {
        return this.events.create(dto, user.id);
    }

    @Get()
    findAll() {
        return this.events.findAll();
    }

    @Get('mine')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('creator')
    findMine(@CurrentUser() user: any) {
        return this.events.findMine(user.id);
    }

    @Get('share/:token')
    findByToken(@Param('token') token: string) {
        return this.events.findByShareToken(token);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.events.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('creator')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateEventDto,
        @CurrentUser() user: any,
    ) {
        return this.events.update(id, dto, user.id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('creator')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.events.remove(id, user.id);
    }
}
