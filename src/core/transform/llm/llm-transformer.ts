import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';
import { EnrichedPayload } from '../enriched/enriched-transformer';

export interface LlmPayload {
  narrativeSummary: string;                         // 1-3 rich paragraphs
  traits: { name: string; score: number }[];        // 5-7 radar points (0-1)
  suggestedShifts: string[];                        // 3-5 tips
  faq: { question: string; answer: string }[];      // 3-5 Q&A pairs
  visualMetaphor?: string;                          // optional short description
}

export interface LlmTransformer {
  accepts(source: DataSource): boolean;
  /** Takes Digest + EnrichedPayload (already computed) */
  run(params: { digest: Digest; enriched: EnrichedPayload }): Promise<LlmPayload>;
}
