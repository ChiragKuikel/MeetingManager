import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActionItemStatus } from '../generated/prisma/enums';

@Injectable()
export class ActionItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number, status?: ActionItemStatus) {
    return this.prisma.actionItem.findMany({
      where: {
        video: { userId },
        ...(status && { status }),
      },
      include: { video: { select: { id: true, title: true } } },
      orderBy: [{ dueDate: 'asc' }],
    });
  }
}
