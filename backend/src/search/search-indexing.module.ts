import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const SEARCH_INDEXING_QUEUE = 'search-indexing';

export interface SearchIndexingJob {
  videoId: number;
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: SEARCH_INDEXING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class SearchIndexingModule {}
