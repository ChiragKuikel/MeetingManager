import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VIDEO_PROCESSING_QUEUE, VideoProcessingJob } from '../queue/queue.module';

@Injectable()
export class ProcessingService {
  constructor(@InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly queue: Queue<VideoProcessingJob>) {}

  async enqueue(videoId: number) {
    return this.queue.add('process-video', { videoId });
  }
}
