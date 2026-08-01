import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VideoStatus } from '../generated/prisma/enums';

interface CreateVideoInput {
  userId: number;
  title: string;
  filename: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a video for a user, inheriting the user's organizationId (multi-tenancy). */
  async create(input: CreateVideoInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { organizationId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.video.create({
      data: {
        organizationId: user.organizationId,
        userId: input.userId,
        title: input.title,
        filename: input.filename,
        filePath: input.filePath,
        fileSize: input.fileSize != null ? BigInt(input.fileSize) : null,
        mimeType: input.mimeType,
        status: VideoStatus.processing,
      },
    });
  }

  async listByUser(userId: number, page: number, limit: number) {
    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where: { userId },
        include: { summary: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.video.count({ where: { userId } }),
    ]);
    return { videos, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: number) {
    return this.prisma.video.findUnique({
      where: { id },
      include: { summary: true },
    });
  }

  /** Fetch a video and enforce that the viewer owns it. Throws 404/403 otherwise. */
  async findForViewer(id: number, viewerId: number) {
    const video = await this.findById(id);
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== viewerId) throw new ForbiddenException('Access denied');
    return video;
  }

  async getStatus(id: number) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!video) throw new NotFoundException('Video not found');
    return video.status;
  }

  async updateTitle(id: number, viewerId: number, title: string) {
    await this.findForViewer(id, viewerId);
    await this.prisma.video.update({ where: { id }, data: { title } });
  }

  /** Delete a video (cascades to summary + queue entry). Returns filePath for fs cleanup. */
  async remove(id: number, viewerId: number): Promise<string> {
    const video = await this.findForViewer(id, viewerId);
    await this.prisma.video.delete({ where: { id } });
    return video.filePath;
  }
}
