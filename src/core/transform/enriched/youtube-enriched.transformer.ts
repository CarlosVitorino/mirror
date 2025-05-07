import { EnrichedTransformer, EnrichedPayload } from './enriched-transformer';
import { DataSource }   from '../../../shared/data-source';
import { Digest }       from '../../digest/digest.types';
import { DirectStats }  from '../direct/direct-transformer';

import { SentimentAnalyzer }             from './utils/sentiment-analyzer';
import { analyzeEngagementPatterns,
         analyzeContentPreferences }     from './utils/engagement-utils';
import { extractVideoId }                from '../../../shared/video-utils';
import { YoutubeApi }                    from './utils/youtube-api.adapter';

export class YoutubeEnrichedTransformer implements EnrichedTransformer {
  constructor(
    private readonly youtubeApi: YoutubeApi,
    private readonly sentiment: SentimentAnalyzer = new SentimentAnalyzer(),
  ) {}

  accepts(source: DataSource) {
    return source === DataSource.YouTube;
  }

  async run({
    digest,
    direct,
  }: {
    digest: Digest;
    direct: DirectStats;
  }): Promise<EnrichedPayload> {

    /* ── 1. Prepare watch-history array ──────────────────────────────── */
    const rawWatch: any[] = (digest.payload as any).watch ?? [];
    const videos = rawWatch
      .filter(v => v.titleUrl || v.url)
      .map(v => ({
        title: (v.title ?? '').replace(/^Watched\s+/i, '').trim(),
        url:   v.titleUrl ?? v.url,
        videoId:   extractVideoId(v.titleUrl ?? v.url),
        time:      v.time,
        duration:  v.duration ?? '',
        category:  v.category ?? '',
        subtitles: v.subtitles ?? [],
        /* to be filled by API ───────────────────────────── */
        description:  '',
        channelTitle: '',
        categoryId:   '',
      }));

    /* ── 2. Enrich via YouTube API (cached) ──────────────────────────── */
    const ids       = videos.map(v => v.videoId).filter(Boolean);
    const metaMap   = await this.youtubeApi.getVideoMetadata(ids);   // id → metadata

    for (const [id, meta] of Object.entries(metaMap)) {
      const v = videos.find(x => x.videoId === id);
      if (v) Object.assign(v, meta);
    }

    /* ── 3. Translate categoryId → name ─────────────────────────────── */
    const categoryIds = Array.from(
      new Set(Object.values(metaMap).map((m: any) => m.categoryId).filter(Boolean)),
    );
    const categoryNames = await this.youtubeApi.getCategoryNames(categoryIds);

    videos.forEach(v => {
      v.category = categoryNames[v.categoryId] ?? v.category ?? 'Unknown';
    });

    /* ── 4. Aggregates (cats, sentiment, engagement …) ──────────────── */
    const videoCategories: Record<string, number> = {};
    for (const v of videos) {
      videoCategories[v.category] = (videoCategories[v.category] ?? 0) + 1;
    }

    const topCategories = Object.entries(videoCategories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: +(count / videos.length * 100).toFixed(1),
      }));

    const sentimentAnalysis  = this.sentiment.analyzeVideos(videos);
    const engagementPatterns = analyzeEngagementPatterns(videos);
    const contentPreferences = analyzeContentPreferences(videos);

    /* ── 5. Compose payload ─────────────────────────────────────────── */
    return {
      enrichedWatchHistory: videos,
      videoCategories: {
        categoryDistribution: videoCategories,
        topCategories,
      },
      sentimentAnalysis,
      engagementPatterns,
      contentPreferences,
    };


  }
}
