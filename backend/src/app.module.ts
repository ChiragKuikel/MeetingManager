import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';
import { SummariesModule } from './summaries/summaries.module';
import { ProcessingModule } from './processing/processing.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, VideosModule, SummariesModule, ProcessingModule, HealthModule],
})
export class AppModule {}
