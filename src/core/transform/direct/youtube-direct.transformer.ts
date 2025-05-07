import { DirectTransformer, DirectStats } from './direct-transformer';
import { DataSource } from '../../../shared/data-source';
import { Digest } from '../../digest/digest.types';

export class YoutubeDirectTransformer implements DirectTransformer {
  accepts(source: DataSource) {
    return source === DataSource.YouTube;
  }

  async run(digest: Digest): Promise<DirectStats> {
    const payload = digest.payload as any; // YoutubeTakeoutPayload
    const channelCounts: Record<string, number> = {};
    const hourCounts = Array(24).fill(0) as number[];
    const queryCounts: Record<string, number> = {};

    for (const item of payload.watch ?? []) {
      const channel = item.subtitles?.[0]?.name ?? 'Unknown';
      channelCounts[channel] = (channelCounts[channel] ?? 0) + 1;
      const h = new Date(item.time).getHours();
      hourCounts[h]++;
    }
    for (const q of payload.search ?? []) {
      const term = q.query ?? q.search ?? q.title ?? 'unknown';
      queryCounts[term] = (queryCounts[term] ?? 0) + 1;
    }

    const toSorted = (obj: Record<string, number>, take: number) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, take)
        .map(([k, c]) => ({ channel: k, term: k, count: c } as any));

    return {
      topChannels:      toSorted(channelCounts, 20) as any,
      frequentQueries:  toSorted(queryCounts, 30)   as any,
      hourlyHistogram:  hourCounts,
    };
  }
}