import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';

export interface DirectStats {
  topChannels: { channel: string; count: number }[];
  frequentQueries: { term: string; count: number }[];
  hourlyHistogram: number[];                       // length 24
  // add more aggregates as needed
}

export interface DirectTransformer {
  accepts(source: DataSource): boolean;
  run(digest: Digest): Promise<DirectStats>;
}