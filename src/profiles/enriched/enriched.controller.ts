import {
    Controller, Post, Param, Delete, Req, UseGuards,
  } from '@nestjs/common';
  import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { EnrichedService } from './enriched.service';
import { EnrichedProfile } from './enriched.entity';

@UseGuards(JwtAuthGuard)
@Controller('profiles/level2')
export class EnrichedController {
  constructor(private readonly enrichedService: EnrichedService) {}

  @Post(':directId/build')
  async build(@Param('directId') directId: string, @Req() req: any): Promise<EnrichedProfile> {
    return this.enrichedService.buildFromDirect(directId, req.user.userId);
  }
}