import { Digest } from '../../digest/digest.types';
import { LlmTransformer, LlmPayload } from './llm-transformer';
import { EnrichedPayload } from '../enriched/enriched-transformer';
import { DataSource } from '../../../shared/data-source';

export class LlmOrchestrator {
  constructor(private readonly transformers: LlmTransformer[]) {}

  async run(digest: Digest, enriched: EnrichedPayload): Promise<LlmPayload> {
    const tx = this.transformers.find(t => t.accepts(digest.source));
    if (!tx) throw new Error(`No LlmTransformer for ${digest.source}`);
    return tx.run({ digest, enriched });
  }
}
