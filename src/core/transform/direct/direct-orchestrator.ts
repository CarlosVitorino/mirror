import { Digest } from '../../digest/digest.types';
import { DirectTransformer, DirectStats } from './direct-transformer';
import { DataSource } from '../../../shared/data-source';

export class DirectOrchestrator {
  constructor(private readonly transformers: DirectTransformer[]) {}

  /**
   * Build DirectStats for one digest row – pick matching transformer.
   * Throw if no transformer supports that source.
   */
  run(digest: Digest): Promise<DirectStats> {
    const tx = this.transformers.find((t) => t.accepts(digest.source));
    if (!tx) throw new Error(`No DirectTransformer for ${digest.source}`);
    return tx.run(digest);
  }

  /** Convenience: crunch *all* digests of one user → map by digestId */
  runMany(digests: Digest[]): Record<string, Promise<DirectStats>> {
    return Object.fromEntries(digests.map((d) => [d.id, this.run(d)]));
  }
}