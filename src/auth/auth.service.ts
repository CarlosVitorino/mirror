import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, plain: string) {
    if (await this.users.findByEmail(email))
      throw new UnauthorizedException('Email exists');

    const hash = await bcrypt.hash(plain, 10);
    const user = await this.users.create(email, hash);
    return this.sign(user.id, email);
  }

  async login(email: string, plain: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(plain, user.passwordHash)))
      throw new UnauthorizedException('Bad credentials');
    return this.sign(user.id, email);
  }

  private sign(sub: string, email: string) {
    return { access_token: this.jwt.sign({ sub, email }) };
  }
}
