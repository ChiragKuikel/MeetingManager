import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async get(@Query('q') q: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!q || !q.trim()) {
      throw new BadRequestException('q query parameter is required');
    }

    const data = await this.search.search(q.trim(), user.id);
    return { success: true, data };
  }
}
