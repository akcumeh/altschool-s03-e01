import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    constructor(
        private users: UsersService,
        private jwt: JwtService,
    ) {}

    async register(dto: RegisterDto) {
        const existing = await this.users.findByEmail(dto.email);
        if (existing) throw new ConflictException('Email already in use');

        const password_hash = await bcrypt.hash(dto.password, 12);
        const user = await this.users.create({
            name: dto.name,
            email: dto.email,
            password_hash,
            role: dto.role,
        });
        return user;
    }

    async login(dto: LoginDto) {
        const user = await this.users.findByEmail(dto.email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const valid = await bcrypt.compare(dto.password, user.password_hash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        const payload = { sub: user.id, email: user.email, role: user.role };
        return { access_token: await this.jwt.signAsync(payload) };
    }
}
