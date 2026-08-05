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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import fileService from '../services/fileService';

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videos: VideosService,
    private readonly processing: ProcessingService,
  ) {}

  @Post('upload')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('video', videoMulterOptions))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('No video file uploaded');

    const video = await this.videos.create({
      userId: user.id,
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
  async list(@Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.videos.listByUser(user.id, pagination.page, pagination.limit);
    return { success: true, data };
  }

  @Get(':id/status')
  async status(@Param('id', ParseIntPipe) id: number) {
    const status = await this.videos.getStatus(id);
    return { success: true, data: { status } };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    const video = await this.videos.findForViewer(id, user.id);
    return { success: true, data: video };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.videos.updateTitle(id, user.id, title);
    return { success: true, message: 'Video updated successfully' };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    const filePath = await this.videos.remove(id, user.id);
    if (filePath) await fileService.deleteFile(filePath);
    return { success: true, message: 'Video deleted successfully' };
  }
}
