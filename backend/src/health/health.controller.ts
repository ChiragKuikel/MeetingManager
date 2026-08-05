import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/environment';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let dbConnected = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbConnected = false;
    }

    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbConnected ? 'connected' : 'disconnected',
    };
  }
}
