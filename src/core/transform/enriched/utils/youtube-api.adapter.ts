import { google } from 'googleapis';
import { CacheService } from '../../../../cache/cache.service';
3
export class YoutubeApi {
  private youtube: any;
  private cache: CacheService;

  constructor(youtubeApiKey: string, cache: CacheService) {
    this.youtube = google.youtube({
      version: 'v3',
      auth: youtubeApiKey,
    });
    this.cache = cache;
  }

  async getVideoMetadata(videoIds: string[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const uncachedIds: string[] = [];

    console.log(`[YouTubeEnricher] Checking cache for ${videoIds.length} videos...`);

    await Promise.all(
      videoIds.map(async (id) => {
        const cached = await this.cache.get(`youtube:video:${id}`);
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
            this.cache.set(`youtube:video:${item.id}`, videoData)
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
    return this.cache.getOrSet(cacheKey, async () => {
      const response = await this.youtube.videoCategories.list({
        part: 'snippet',
        id: categoryIds,
      });
      return (await response).data.items?.reduce((acc: Record<string, string>, item: any) => {
        acc[item.id] = item.snippet.title;
        return acc;
      }, {}) || {};
    });
  }
}