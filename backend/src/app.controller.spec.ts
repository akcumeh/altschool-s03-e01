import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
    let controller: AppController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
        }).compile();

        controller = module.get(AppController);
    });

    it('health() returns status ok', () => {
        const result = controller.health();
        expect(result.status).toBe('ok');
        expect(typeof result.uptime).toBe('number');
        expect(result).toHaveProperty('timestamp');
    });
});
