import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export enum UserRole {
    creator = 'creator',
    eventee = 'eventee',
}

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsEnum(UserRole)
    role: UserRole;
}
