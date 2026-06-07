import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        config: ConfigService,
        private users: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
        });
    }

    async validate(payload: { sub: string; email: string; role: string }) {
        const user = await this.users.findById(payload.sub);
        if (!user) throw new UnauthorizedException();
        return user;
    }
}
