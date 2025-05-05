import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './user.service';
import { JwtAuthGuard } from '../shared/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
