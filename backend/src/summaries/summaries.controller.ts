import { Controller, Get, Post, Put, Param, Body, ParseIntPipe } from '@nestjs/common';
import { SummariesService } from './summaries.service';
import { VideosService } from '../videos/videos.service';
import { UpdateSummaryDto } from './dto/update-summary.dto';

// TODO(Phase 4): replace with the authenticated user from the JWT guard.
const VIEWER_ID = 1;

@Controller('summaries')
export class SummariesController {
  constructor(
    private readonly summaries: SummariesService,
    private readonly videos: VideosService,
  ) {}

  @Get('video/:videoId')
  async getSummary(@Param('videoId', ParseIntPipe) videoId: number) {
    await this.videos.findForViewer(videoId, VIEWER_ID);
    const summary = await this.summaries.findByVideoId(videoId);
    return { success: true, data: summary };
  }

  @Post('video/:videoId/generate')
  async generateSummary(@Param('videoId', ParseIntPipe) videoId: number) {
    await this.videos.findForViewer(videoId, VIEWER_ID);
    await this.summaries.generate(videoId);
    return { success: true, message: 'Summary generation started' };
  }

  @Put('video/:videoId')
  async updateSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: UpdateSummaryDto,
  ) {
    await this.videos.findForViewer(videoId, VIEWER_ID);
    await this.summaries.update(videoId, dto);
    return { success: true, message: 'Summary updated successfully' };
  }
}
