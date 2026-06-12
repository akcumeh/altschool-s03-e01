import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

let app: INestApplication;

async function bootstrap(): Promise<INestApplication> {
    if (!app) {
        app = await NestFactory.create(AppModule, { rawBody: true });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.enableCors();
        await app.init();
    }
    return app;
}

export default async (req: any, res: any) => {
    const server = await bootstrap();
    server.getHttpAdapter().getInstance()(req, res);
};
