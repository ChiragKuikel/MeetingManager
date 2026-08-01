import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { ProcessingProcessor } from './processing/processing.processor';

@Module({
  imports: [PrismaModule, QueueModule],
  providers: [ProcessingProcessor],
})
export class WorkerModule {}
