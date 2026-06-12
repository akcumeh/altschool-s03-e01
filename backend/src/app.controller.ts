import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    private readonly startedAt = new Date().toISOString();

    @Get()
    healthRoot() {
        return this.health();
    }

    @Get('health')
    health() {
        return {
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            started_at: this.startedAt,
            timestamp: new Date().toISOString(),
        };
    }
}
