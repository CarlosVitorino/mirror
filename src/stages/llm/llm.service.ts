// Placeholder: Adapted from profles_old/llm/llm.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmEntity } from './llm.entity';
import { EnrichedEntity } from '../enriched/enriched.entity';
import { LlmOrchestrator } from '../../core/transform/llm/llm-orchestrator';
import { YoutubeLlmTransformer } from '../../core/transform/llm/youtube-llm.transformer';
import { OpenAIUtil } from '../../core/transform/llm/utils/openai-util';
import { Digest } from '../../core/digest/digest.types';

export type publicLlmEntity = Omit<LlmEntity, 'enriched'>;

@Injectable()
export class LlmStageService {
  private readonly orchestrator: LlmOrchestrator;

  constructor(
    @InjectRepository(LlmEntity)
    private readonly llmRepo: Repository<LlmEntity>,
    @InjectRepository(EnrichedEntity)
    private readonly enrichedRepo: Repository<EnrichedEntity>,
    private readonly openaiUtil: OpenAIUtil,
  ) {
    this.orchestrator = new LlmOrchestrator([
      new YoutubeLlmTransformer(this.openaiUtil),
    ]);
  }

  async createFromEnriched(enrichedId: string): Promise<publicLlmEntity> {
    const enriched = await this.enrichedRepo.findOne({ where: { id: enrichedId }, relations: ['user'] });

    if (!enriched) throw new Error('EnrichedEntity not found');
    // Assuming direct is not needed for LLM, only enriched.payload and source
    const digest: Digest = {
      id: enriched.id,
      userId: enriched.user.id,
      source: enriched.source,
      payload: enriched.payload,
      createdAt: enriched.createdAt,
    };
    const enrichedPayload = enriched.payload as any;
    const llmPayload = await this.orchestrator.run(digest, enrichedPayload);
    const entity = this.llmRepo.create({
      enriched,
      radarTraits: llmPayload.traits,
      narrativeSummary: llmPayload.narrativeSummary,
      suggestedShifts: llmPayload.suggestedShifts,
      faqs: llmPayload.faq,
      visualMetaphor: llmPayload.visualMetaphor,
    });
    const saved = await this.llmRepo.save(entity);
    // remove enriched before return 
    const { enriched: _hidden, ...publicLlmEntity } = saved;

    return publicLlmEntity;
  }
}
