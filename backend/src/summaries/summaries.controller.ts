import { Controller, Get, Post, Put, Param, Body, ParseIntPipe } from '@nestjs/common';
import { SummariesService } from './summaries.service';
import { VideosService } from '../videos/videos.service';
import { UpdateSummaryDto } from './dto/update-summary.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('summaries')
export class SummariesController {
  constructor(
    private readonly summaries: SummariesService,
    private readonly videos: VideosService,
  ) {}

  @Get('video/:videoId')
  async getSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    const summary = await this.summaries.findByVideoId(videoId);
    return { success: true, data: summary };
  }

  @Post('video/:videoId/generate')
  async generateSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    await this.summaries.generate(videoId);
    return { success: true, message: 'Summary generation started' };
  }

  @Put('video/:videoId')
  async updateSummary(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: UpdateSummaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.findForViewer(videoId, user.id);
    await this.summaries.update(videoId, dto);
    return { success: true, message: 'Summary updated successfully' };
  }
}
