import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheEntry } from './cache.entity';

@Injectable()
export class CacheService {
  constructor(
    @InjectRepository(CacheEntry)
    private readonly repo: Repository<CacheEntry>
  ) {}

  async get<T = any>(key: string): Promise<T | null> {
    const entry = await this.repo.findOne({ where: { key } });
    return entry ? entry.data : null;
  }

  async set(key: string, data: any): Promise<void> {
    const exists = await this.repo.findOne({ where: { key } });
    if (exists) {
      exists.data = data as CacheEntry['data'];
      await this.repo.save(exists);
    } else {
      await this.repo.insert({ key, data });
    }
  }

  async getOrSet<T = any>(key: string, callback: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const result = await callback();
    await this.set(key, result);
    return result;
  }
}
