import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSummaryDto } from './dto/update-summary.dto';

@Injectable()
export class SummariesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByVideoId(videoId: number) {
    const summary = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!summary) throw new NotFoundException('Summary not found');
    return summary;
  }

  /** Stub for now — real trigger (BullMQ enqueue) wired in Phase 3. */
  async generate(videoId: number) {
    const existing = await this.prisma.summary.findUnique({ where: { videoId } });
    if (existing) throw new BadRequestException('Summary already exists');
  }

  async update(videoId: number, dto: UpdateSummaryDto) {
    const existing = await this.prisma.summary.findUnique({ where: { videoId } });
    if (!existing) throw new NotFoundException('Summary not found');

    return this.prisma.summary.update({
      where: { videoId },
      data: {
        summaryText: dto.summaryText,
        keyPoints: dto.keyPoints as any,
        actionItems: dto.actionItems as any,
      },
    });
  }
}
