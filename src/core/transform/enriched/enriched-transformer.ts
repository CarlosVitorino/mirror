import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';
import { DirectStats } from '../direct/direct-transformer';

export interface EnrichedPayload {
  enrichedWatchHistory: any[];
  videoCategories: any;
  sentimentAnalysis: any;
  engagementPatterns: any;
  contentPreferences: any;
}

export interface EnrichedTransformer {
  accepts(source: DataSource): boolean;
  /** Takes Digest + DirectStats (already computed) */
  run(params: { digest: Digest; direct: DirectStats }): Promise<EnrichedPayload>;
}