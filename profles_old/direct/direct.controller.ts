import {
    Controller, Get, Post, Param, Delete, Req, UseGuards,
  } from '@nestjs/common';
  import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
  import { DirectService } from './direct.service';
  
  @UseGuards(JwtAuthGuard)
  @Controller('profiles/level1')
  export class DirectController {
    constructor(private readonly svc: DirectService) {}
  
    /** crunch & persist */
    @Post(':rawId/build')
    build(@Param('rawId') rawId: string, @Req() req: any) {
      return this.svc.buildFromRaw(rawId, req.user.userId);
    }
  
    @Get()
    list(@Req() req: any) {
      return this.svc.findAll(req.user.userId);
    }
  
    @Get(':id')
    get(@Param('id') id: string, @Req() req: any) {
      return this.svc.findOne(id, req.user.userId);
    }
  
    @Delete(':id')
    delete(@Param('id') id: string, @Req() req: any) {
      return this.svc.delete(id, req.user.userId);
    }
  }
  