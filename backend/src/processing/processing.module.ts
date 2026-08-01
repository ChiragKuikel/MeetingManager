import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [ProcessingService],
  exports: [ProcessingService],
})
export class ProcessingModule {}
