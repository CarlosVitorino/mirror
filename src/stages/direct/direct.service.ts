import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DirectEntity } from './direct.entity';
import { DigestEntity } from '../../core/digest/digest.entity';
import { DirectOrchestrator } from '../../core/transform/direct/direct-orchestrator';
import { DirectTransformer } from '../../core/transform/direct/direct-transformer';
import { Digest } from '../../core/digest/digest.types';
import { UsersService } from '../../users/user.service';

@Injectable()
export class DirectStageService {
  private readonly orchestrator: DirectOrchestrator;

  constructor(
    @InjectRepository(DirectEntity)  private readonly repo:   Repository<DirectEntity>,
    @InjectRepository(DigestEntity)  private readonly digests: Repository<DigestEntity>,
    private readonly users: UsersService,
    @Inject('DIRECT_TRANSFORMERS') private readonly transformers: DirectTransformer[],
  ) {
    this.orchestrator = new DirectOrchestrator(transformers);
  }

  /** build one Direct row from a specific digest */
  async build(digestId: string, userId: string) {
    const digest = await this.digests.findOne({ where: { id: digestId, user: { id: userId } }, relations: ['user'] });
    if (!digest) throw new NotFoundException('Digest not found');

    // Adapt TypeORM entity → core Digest type
    const coreDigest: Digest = {
      id:        digest.id,
      userId:    digest.user.id,
      source:    digest.source,
      payload:   digest.payload as any,
      createdAt: digest.createdAt,
    };

    const stats  = await this.orchestrator.run(coreDigest);
    const entity = this.repo.create({ user: digest.user, digest, source: digest.source, payload: stats });
    return this.repo.save(entity);
  }

  /** list / get helpers --------------------------------------------------- */
  list(userId: string) {
    return this.repo.find({ where: { user: { id: userId } }, order: { createdAt: 'DESC' } });
  }
  get(id: string, userId: string) {
    return this.repo.findOne({ where: { id, user: { id: userId } } });
  }
  delete(id: string, userId: string) {
    return this.repo.delete({ id, user: { id: userId } });
  }
}