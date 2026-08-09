import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ActionItemsService } from './action-items.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ActionItemStatus } from '../generated/prisma/enums';

@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly actionItems: ActionItemsService) {}

  @Get()
  async list(@Query('status') status: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    let parsedStatus: ActionItemStatus | undefined;
    if (status !== undefined) {
      if (status !== 'open' && status !== 'done') {
        throw new BadRequestException('status must be "open" or "done"');
      }
      parsedStatus = status;
    }

    const data = await this.actionItems.listForUser(user.id, parsedStatus);
    return { success: true, data };
  }
}
