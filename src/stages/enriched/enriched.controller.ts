import { Controller, Post, Param, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { EnrichedStageService } from './enriched.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/enriched')
export class EnrichedStageController {
  constructor(private readonly svc: EnrichedStageService) {}

  @Post(':directId/build')
  build(@Param('directId') directId: string, @Req() req: any) {
    return this.svc.build(directId, req.user.userId);
  }

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.svc.get(id, req.user.userId);
  }
}