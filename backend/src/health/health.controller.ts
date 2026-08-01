import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import fileService from '../services/fileService';
import { env } from '../config/environment';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
      uploadDir: fileService.getUploadDir(),
    };
  }
}
