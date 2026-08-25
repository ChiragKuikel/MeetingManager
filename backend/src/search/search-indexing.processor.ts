import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SEARCH_INDEXING_QUEUE, SearchIndexingJob } from './search-indexing.module';

interface TextRow {
  sourceType: 'decision' | 'action_item' | 'open_question';
  sourceId: number;
  text: string;
}

@Processor(SEARCH_INDEXING_QUEUE)
export class SearchIndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService
  ) {
    super();
  }

  async process(job: Job<SearchIndexingJob>): Promise<void> {
    const { videoId } = job.data;
    const video = await this.prisma.video.findUniqueOrThrow({ where: { id: videoId } });

    await this.prisma.searchItem.deleteMany({ where: { videoId } });

    const rows = await this.buildTextRows(videoId);

    for (const row of rows) {
      const vector = await this.embedding.embed(row.text);
      const vectorLiteral = `[${vector.join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO search_items (organization_id, video_id, source_type, source_id, text, embedding)
        VALUES (${video.organizationId}, ${videoId}, ${row.sourceType}::"SearchSourceType", ${row.sourceId}, ${row.text}, ${vectorLiteral}::vector)
      `;
    }

    this.logger.log(`Indexed ${rows.length} search item(s) for video ${videoId}`);
  }

  private async buildTextRows(videoId: number): Promise<TextRow[]> {
    const [decisions, actionItems, openQuestions] = await Promise.all([
      this.prisma.decision.findMany({ where: { videoId } }),
      this.prisma.actionItem.findMany({ where: { videoId } }),
      this.prisma.openQuestion.findMany({ where: { videoId } }),
    ]);

    return [
      ...decisions.map((d) => ({
        sourceType: 'decision' as const,
        sourceId: d.id,
        text: d.description,
      })),
      ...actionItems.map((a) => ({
        sourceType: 'action_item' as const,
        sourceId: a.id,
        text: `${a.task} (assignee: ${a.assignee ?? 'unassigned'})`,
      })),
      ...openQuestions.map((q) => ({
        sourceType: 'open_question' as const,
        sourceId: q.id,
        text: q.question,
      })),
    ];
  }
}
