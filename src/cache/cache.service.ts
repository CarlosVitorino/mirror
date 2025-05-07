// src/cache/cache.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheEntry } from './cache.entity';

@Injectable()
export class CacheService {
  constructor(
    @InjectRepository(CacheEntry)
    private readonly repo: Repository<CacheEntry>,
  ) {}

  /** read ------------------------------------------------------------------ */
  async get<T = any>(key: string): Promise<T | null> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? (row.data as T) : null;
  }

  /** write (atomic) -------------------------------------------------------- */
  async set(key: string, data: any): Promise<void> {
    await this.repo.upsert(
      { key, data },           // row to insert / update
      ['key'],                 // conflict column(s)
    );
  }

  /** convenience helper ---------------------------------------------------- */
  async getOrSet<T = any>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fn();
    await this.set(key, fresh);
    return fresh;
  }
}
