
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EnrichedEntity } from './enriched.entity';
import { DirectEntity } from '../direct/direct.entity';
import { DigestEntity } from '../../core/digest/digest.entity';
import { EnrichedOrchestrator } from '../../core/transform/enriched/enriched-orchestrator';
import { EnrichedTransformer } from '../../core/transform/enriched/enriched-transformer';
import { Digest } from '../../core/digest/digest.types';
import { UsersService } from '../../users/user.service';
import { DirectStats } from '../../core/transform/direct/direct-transformer';

@Injectable()
export class EnrichedStageService {
  private readonly orchestrator: EnrichedOrchestrator;

  constructor(
    @InjectRepository(EnrichedEntity) private readonly repo: Repository<EnrichedEntity>,
    @InjectRepository(DirectEntity)   private readonly directs: Repository<DirectEntity>,
    @InjectRepository(DigestEntity)   private readonly digests: Repository<DigestEntity>,
    private readonly users: UsersService,
    @Inject('ENRICHED_TRANSFORMERS') private readonly transformers: EnrichedTransformer[],
  ) {
    this.orchestrator = new EnrichedOrchestrator(transformers);
  }

  async build(directId: string, userId: string) {
    const direct = await this.directs.findOne({ where: { id: directId, user: { id: userId } }, relations: ['user','digest'] });
    if (!direct) throw new NotFoundException('Direct profile not found');

    // adapt DigestEntity → plain Digest
    const digest: Digest = {
      id:        direct.digest.id,
      userId:    userId,
      source:    direct.source,
      payload:   direct.digest.payload as any,
      createdAt: direct.digest.createdAt,
    };

    const directStats = direct.payload as DirectStats;
    const payload = await this.orchestrator.run(digest, directStats);

    const row = this.repo.create({ user: direct.user, direct, source: direct.source, payload });
    const saved = await this.repo.save(row);
    // Remove enrichedWatchHistory from the returned payload
    if (saved && typeof saved === 'object' && saved.payload && typeof saved.payload === 'object') {
      const { enrichedWatchHistory, ...restPayload } = saved.payload as any;
      return { ...saved, payload: restPayload };
    }
    return saved;
  }

  list(userId: string) {
    return this.repo.find({ where: { user: { id: userId } }, order: { createdAt: 'DESC' } });
  }

  async get(id: string, userId: string) {
    const found = await this.repo.findOne({ where: { id, user: { id: userId } } });
    if (!found) return null;
    if (found.payload && typeof found.payload === 'object') {
      const { enrichedWatchHistory, ...restPayload } = found.payload as any;
      return { ...found, payload: restPayload };
    }
    return found;
  }
}