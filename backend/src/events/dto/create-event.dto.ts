import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateIf,
} from 'class-validator';
import { IsAfter } from '../../common/validators/is-after.validator';

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    @IsNotEmpty()
    location: string;

    @IsDateString()
    starts_at: string;

    @ValidateIf((o: CreateEventDto) => !!o.ends_at)
    @IsDateString()
    @IsAfter('starts_at', { message: 'ends_at must be after starts_at' })
    ends_at?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    capacity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    ticket_price?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    reminder_hours_before?: number;
}
