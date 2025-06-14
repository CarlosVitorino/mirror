import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  create(email: string, passwordHash: string) {
    return this.repo.save(this.repo.create({ email, passwordHash }));
  }
  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }
  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }
}
