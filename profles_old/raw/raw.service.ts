import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawProfile } from './raw.entity';
import { UsersService } from '../../users/user.service';
import { Level0DTO } from '../../shared/helpers';

@Injectable()
export class RawService {
  constructor(
    @InjectRepository(RawProfile) private repo: Repository<RawProfile>,
    private readonly users: UsersService,
  ) {}

  async create(userId: string, dto: Level0DTO) {
    const user = await this.users.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const entity = this.repo.create({
      user: user,
      watchHistory: dto.watch,
      searchHistory: dto.search,
      likedVideos: dto.likedVideos,
      subscriptions: dto.subs,
    });
    return this.repo.save(entity);
  }

  async findAll(userId: string) {
    return this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const row = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: ['user'],  
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId); // throws if not owner
    await this.repo.delete(id);
    return { deleted: true };
  }

  // (Optional) replace raw JSON with a new upload
  async update(id: string, userId: string, dto: Level0DTO) {
    const row = await this.findOne(id, userId);
    Object.assign(row, {
      watchHistory: dto.watch,
      searchHistory: dto.search,
      likedVideos: dto.likedVideos,
      subscriptions: dto.subs,
    });
    return this.repo.save(row);
  }
}
