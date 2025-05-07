import { EnrichedTransformer, EnrichedPayload } from './enriched-transformer';
import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';
import { DirectStats } from '../direct/direct-transformer';

export class EnrichedOrchestrator {
  constructor(private readonly transformers: EnrichedTransformer[]) {}

  async run(digest: Digest, direct: DirectStats): Promise<EnrichedPayload> {
    const tx = this.transformers.find(t => t.accepts(digest.source));
    if (!tx) throw new Error(`No EnrichedTransformer for ${digest.source}`);
    return tx.run({ digest, direct });
  }
}
