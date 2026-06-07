import { IsInt, Min } from 'class-validator';

export class SetReminderDto {
    @IsInt()
    @Min(1)
    reminder_hours_before: number;
}
