// youtube.enricher.ts (refined per-video caching + logging)
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { DirectProfile } from '../direct/direct.entity';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class YouTubeEnricher {
  private youtube: any;

  constructor(
    private configService: ConfigService,
    private readonly cacheService: CacheService
  ) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.configService.get('YOUTUBE_API_KEY'),
    });
  }

  async getVideoCategories(videoIds: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const uncachedIds: string[] = [];

    console.log(`[YouTubeEnricher] Checking cache for ${videoIds.length} videos...`);

    await Promise.all(
      videoIds.map(async (id) => {
        const cached = await this.cacheService.get(`youtube:video:${id}`);
        if (cached) results[id] = cached;
        else uncachedIds.push(id);
      })
    );

    console.log(`[YouTubeEnricher] Cache hit for ${videoIds.length - uncachedIds.length}, miss for ${uncachedIds.length}`);

    const batchSize = 50;
    const batches = Array.from({ length: Math.ceil(uncachedIds.length / batchSize) }, (_, i) =>
      uncachedIds.slice(i * batchSize, i * batchSize + batchSize)
    );

    console.log(`[YouTubeEnricher] Fetching ${uncachedIds.length} uncached videos in ${batches.length} batches`);

    for (const [idx, batch] of batches.entries()) {
      console.log(`[YouTubeEnricher] Fetching batch ${idx + 1}/${batches.length} (${batch.length} videos)`);
      try {
        const res = await this.youtube.videos.list({
          part: ['snippet', 'contentDetails'],
          id: batch.join(',')
        });

        const items = res.data?.items || [];
        const cacheSetPromises = [];

        for (const item of items) {
          if (!item?.id || !item?.snippet || !item?.contentDetails) continue;

          const videoData = {
            title: item.snippet.title,
            description: item.snippet.description,
            categoryId: item.snippet.categoryId,
            channelTitle: item.snippet.channelTitle,
            duration: item.contentDetails.duration,
          };
          results[item.id] = videoData;
          cacheSetPromises.push(
            this.cacheService.set(`youtube:video:${item.id}`, videoData)
          );
        }

        await Promise.all(cacheSetPromises);
        console.log(`[YouTubeEnricher] Batch ${idx + 1} cached ${cacheSetPromises.length} videos.`);
      } catch (err) {
        console.error(`[YouTubeEnricher] Error in batch ${idx + 1}:`, err);
      }
    }

    return results;
  }

  async getCategoryNames(categoryIds: string[]): Promise<Record<string, string>> {
    const cacheKey = `youtube:categories:${categoryIds.sort().join(',')}`;
    return this.cacheService.getOrSet(cacheKey, async () => {
      const response = await this.youtube.videoCategories.list({
        part: 'snippet',
        id: categoryIds.join(',')
      });
      return response.data.items.reduce((acc: Record<string, string>, item: any) => {
        acc[item.id] = item.snippet.title;
        return acc;
      }, {});
    });
  }

  async enrichVideos(videos: Array<{
    title: string;
    url: string;
    videoId: string;
    time: string;
    duration: string;
    category: string;
    subtitles: { name: string; url: string }[];
  }>): Promise<any[]> {
    const videoIds = videos.map(v => v.videoId);
    const videoData = await this.getVideoCategories(videoIds);

    const categoryIds = [...new Set(Object.values(videoData).map(v => v.categoryId))];
    const categoryNames = await this.getCategoryNames(categoryIds);

    const enriched = videos
      .map(video => {
        const data = videoData[video.videoId];
        if (!data) return null;
        return {
          ...video,
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          category: categoryNames[data.categoryId] || 'Unknown',
          channelTitle: data.channelTitle,
          duration: data.duration,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const skipped = videos.length - enriched.length;
    if (skipped > 0) {
      console.warn(`[YouTubeEnricher] Skipped ${skipped} videos with missing metadata.`);
    }

    return enriched;
  }

  async enrichDirectProfile(profile: DirectProfile) {
    const enrichedVideos = await this.enrichVideos(profile.directWatchHistory);
    const categoryDistribution: Record<string, number> = {};
    const categoriesByVideo: Record<string, string> = {};

    for (const video of enrichedVideos) {
      if (video.category) {
        categoryDistribution[video.category] = (categoryDistribution[video.category] || 0) + 1;
        categoriesByVideo[video.url] = video.category;
      }
    }

    const topCategories = Object.entries(categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / enrichedVideos.length) * 100,
      }));

    return {
      enrichedWatchHistory: enrichedVideos,
      videoCategories: { categoryDistribution, topCategories },
      categoriesByVideo,
    };
  }
}
