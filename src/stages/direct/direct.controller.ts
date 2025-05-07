import { Controller, Post, Param, Get, Delete, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { DirectStageService } from './direct.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/direct')
export class DirectStageController {
  constructor(private readonly svc: DirectStageService) {}

  /** crunch & persist (any source) */
  @Post(':digestId/build')
  build(@Param('digestId') digestId: string, @Req() req: any) {
    return this.svc.build(digestId, req.user.userId);
  }

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.svc.get(id, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.svc.delete(id, req.user.userId);
  }
}