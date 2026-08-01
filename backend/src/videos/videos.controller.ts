import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';
import { ProcessingService } from '../processing/processing.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { videoMulterOptions } from '../common/multer.config';
import fileService from '../services/fileService';

// TODO(Phase 4): replace with the authenticated user from the JWT guard.
// Matches the pre-migration behavior (auth was disabled, everything ran as user 1).
const VIEWER_ID = 1;

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly processing: ProcessingService,
  ) {}

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('video', videoMulterOptions))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadVideoDto) {
    if (!file) throw new BadRequestException('No video file uploaded');

    const video = await this.videos.create({
      userId: VIEWER_ID,
      title: dto.title || file.originalname.replace(/\.[^/.]+$/, ''),
      filename: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    await this.processing.enqueue(video.id);

    return { success: true, data: { id: video.id, filename: file.filename, status: video.status } };
  }

  @Get()
  async list(@Query() pagination: PaginationDto) {
    const data = await this.videos.listByUser(VIEWER_ID, pagination.page, pagination.limit);
    return { success: true, data };
  }

  @Get(':id/status')
  async status(@Param('id', ParseIntPipe) id: number) {
    const status = await this.videos.getStatus(id);
    return { success: true, data: { status } };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const video = await this.videos.findForViewer(id, VIEWER_ID);
    return { success: true, data: video };
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body('title') title: string) {
    await this.videos.updateTitle(id, VIEWER_ID, title);
    return { success: true, message: 'Video updated successfully' };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const filePath = await this.videos.remove(id, VIEWER_ID);
    if (filePath) await fileService.deleteFile(filePath);
    return { success: true, message: 'Video deleted successfully' };
  }
}
