// src/ingestion/ingestion.service.ts
import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigestEntity } from '../digest/digest.entity';
import { UsersService } from '../../users/user.service';
import { DataSource } from '../../shared/data-source';
import { IngestionStrategy } from './ingestion-strategy';

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(DigestEntity) private readonly repo: Repository<DigestEntity>,
    private readonly users: UsersService,
    /** every concrete strategy is provided under this token */
    @Inject('INGEST_STRATEGIES') private readonly strategies: IngestionStrategy[],
  ) {}

  /** upload & persist one digest row */
  async ingest(
    userId: string,
    source: DataSource,
    files: Express.Multer.File[],
  ) {
    const strat = this.strategies.find((s) => s.source === source);
    if (!strat) throw new BadRequestException('Unsupported source');

    strat.validate(files);
    const payload = await strat.extract(files);

    const user = await this.users.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const row = this.repo.create({ user, source, payload });
    return this.repo.save(row);
  }

  /* simple read helpers ---------------------------------------------------- */
  findAll(userId: string) {
    return this.repo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(id: string, userId: string) {
    return this.repo.findOne({
      where: { id, user: { id: userId } },
    });
  }
}
