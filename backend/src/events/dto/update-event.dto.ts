import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateEventDto } from './create-event.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
    @IsOptional()
    @IsEnum(['draft', 'published', 'cancelled'])
    status?: 'draft' | 'published' | 'cancelled';
}
