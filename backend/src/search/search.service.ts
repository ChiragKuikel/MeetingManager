import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

interface SearchRow {
  id: number;
  source_type: 'decision' | 'action_item' | 'open_question';
  text: string;
  video_id: number;
  video_title: string;
}

export interface SearchResult {
  sourceType: 'decision' | 'action_item' | 'open_question';
  text: string;
  videoId: number;
  videoTitle: string;
  score: number;
}

const RRF_K = 60;
const RESULT_LIMIT = 20;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService
  ) {}

  async search(query: string, userId: number): Promise<SearchResult[]> {
    const queryVector = await this.embedding.embed(query);
    const vectorLiteral = `[${queryVector.join(',')}]`;

    const [fullText, vector] = await Promise.all([
      this.prisma.$queryRaw<SearchRow[]>`
        SELECT si.id, si.source_type, si.text, si.video_id, v.title AS video_title
        FROM search_items si
        JOIN videos v ON v.id = si.video_id
        WHERE v.user_id = ${userId}
          AND si.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(si.search_vector, plainto_tsquery('english', ${query})) DESC
        LIMIT ${RESULT_LIMIT}
      `,
      this.prisma.$queryRaw<SearchRow[]>`
        SELECT si.id, si.source_type, si.text, si.video_id, v.title AS video_title
        FROM search_items si
        JOIN videos v ON v.id = si.video_id
        WHERE v.user_id = ${userId}
        ORDER BY si.embedding <=> ${vectorLiteral}::vector
        LIMIT ${RESULT_LIMIT}
      `,
    ]);

    return this.mergeRRF(fullText, vector);
  }

  private mergeRRF(fullText: SearchRow[], vector: SearchRow[]): SearchResult[] {
    const scored = new Map<number, { row: SearchRow; score: number }>();

    const addRanked = (rows: SearchRow[]) => {
      rows.forEach((row, index) => {
        const rankScore = 1 / (RRF_K + index + 1);
        const existing = scored.get(row.id);
        scored.set(row.id, {
          row: existing?.row ?? row,
          score: (existing?.score ?? 0) + rankScore,
        });
      });
    };

    addRanked(fullText);
    addRanked(vector);

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, RESULT_LIMIT)
      .map(({ row, score }) => ({
        sourceType: row.source_type,
        text: row.text,
        videoId: row.video_id,
        videoTitle: row.video_title,
        score,
      }));
  }
}
