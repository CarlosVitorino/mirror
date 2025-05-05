// enriched.service.ts (fixing typed label assignment in formatTimeData)
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnrichedProfile } from './enriched.entity';
import { DirectProfile } from '../direct/direct.entity';
import { YouTubeEnricher } from './youtube.enricher';
import { SentimentAnalyzer } from './sentiment.utils';
import { DirectService } from '../direct/direct.service';

@Injectable()
export class EnrichedService {
  constructor(
    @InjectRepository(EnrichedProfile) private repo: Repository<EnrichedProfile>,
    private readonly youtubeEnricher: YouTubeEnricher,
    private readonly sentimentAnalyzer: SentimentAnalyzer,
    private readonly directService: DirectService,
  ) {}

  async buildFromDirect(directId: string, userId: string): Promise<EnrichedProfile> {
    try {
      const direct = await this.directService.findOne(directId, userId);
      if (!direct) throw new NotFoundException(`Direct profile ${directId} not found`);

      const { enrichedWatchHistory, videoCategories, categoriesByVideo } =
        await this.youtubeEnricher.enrichDirectProfile(direct);

      const sentimentAnalysis = this.sentimentAnalyzer.analyzeVideos(enrichedWatchHistory);
      const engagementPatterns = this.analyzeEngagementPatterns(enrichedWatchHistory, categoriesByVideo);
      const contentPreferences = this.analyzeContentPreferences(enrichedWatchHistory, categoriesByVideo);

      const enriched = this.repo.create({
        direct,
        user: direct.user,
        enrichedWatchHistory,
        videoCategories,
        sentimentAnalysis,
        engagementPatterns,
        contentPreferences,
      });

      return this.repo.save(enriched);
    } catch (error) {
      throw new BadRequestException(`Failed to build enriched profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private analyzeEngagementPatterns(
    videos: EnrichedProfile['enrichedWatchHistory'],
    categoriesByVideo: Record<string, string>
  ): EnrichedProfile['engagementPatterns'] {
    const categoryCount: Record<string, number> = {};
    const daily: Record<number, { count: number; totalDuration: number }> = {};
    const weekly: Record<number, { count: number; totalDuration: number }> = {};
    const monthly: Record<number, { count: number; totalDuration: number }> = {};
    const totalDurations: number[] = [];

    const bingeSessions: any[] = [];
    let session: any = null;
    const maxGap = 1000 * 60 * 60;

    const sortedVideos = [...videos].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (const video of sortedVideos) {
      const duration = this.parseDuration(video.duration);
      const time = new Date(video.time);
      const hour = time.getHours();
      const day = time.getDay();
      const week = Math.floor(time.getDate() / 7);
      const category = video.category || 'Unknown';

      categoryCount[category] = (categoryCount[category] || 0) + 1;

      daily[hour] = daily[hour] || { count: 0, totalDuration: 0 };
      daily[hour].count++;
      daily[hour].totalDuration += duration;

      weekly[day] = weekly[day] || { count: 0, totalDuration: 0 };
      weekly[day].count++;
      weekly[day].totalDuration += duration;

      monthly[week] = monthly[week] || { count: 0, totalDuration: 0 };
      monthly[week].count++;
      monthly[week].totalDuration += duration;

      totalDurations.push(duration);

      const timestamp = time.getTime();
      if (!session) {
        session = {
          startTime: video.time,
          endTime: video.time,
          videoCount: 1,
          totalDuration: duration,
          videos: [video],
          categoryDistribution: { [category]: 1 },
        };
      } else {
        const lastTimestamp = new Date(session.endTime).getTime();
        if (timestamp - lastTimestamp <= maxGap) {
          session.endTime = video.time;
          session.videoCount++;
          session.totalDuration += duration;
          session.videos.push(video);
          session.categoryDistribution[category] = (session.categoryDistribution[category] || 0) + 1;
        } else {
          bingeSessions.push(session);
          session = null;
        }
      }
    }
    if (session) bingeSessions.push(session);

    const formatTimeData = (
      data: Record<number, { count: number; totalDuration: number }>,
      label: 'hour' | 'day' | 'week'
    ): any[] =>
      Object.entries(data).map(([key, val]) => {
        const timeUnit = parseInt(key);
        return {
          [label]: timeUnit,
          count: val.count,
          averageWatchTime: val.totalDuration / val.count,
          topCategories: Object.entries(categoryCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([c]) => c),
        };
      });

    const peakHours = Object.entries(daily)
      .map(([h, val]) => ({ hour: parseInt(h), count: val.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const averageSessionLength = totalDurations.length
      ? totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length
      : 0;

    return {
      bingeSessions,
      peakActivity: {
        daily: formatTimeData(daily, 'hour'),
        weekly: formatTimeData(weekly, 'day'),
        monthly: formatTimeData(monthly, 'week'),
      },
      categoryEngagement: {
        totalWatchTime: totalDurations.reduce((a, b) => a + b, 0),
        averageSessionLength,
        peakHours,
        categoryDistribution: Object.fromEntries(
          Object.entries(categoryCount).map(([cat, count]) => [cat, {
            watchCount: count,
            totalDuration: 0,
            averageSessionLength,
            peakHours,
          }])
        ),
      },
    };
  }

  private analyzeContentPreferences(
    videos: EnrichedProfile['enrichedWatchHistory'],
    categoriesByVideo: Record<string, string>
  ): EnrichedProfile['contentPreferences'] {
    const categoryStats: Record<string, { time: number; count: number }> = {};
    const channelStats: Record<string, { time: number; count: number }> = {};
    const daily = Array(24).fill(0);
    const weekly = Array(7).fill(0);
    const monthly = Array(4).fill(0);

    for (const video of videos) {
      const duration = this.parseDuration(video.duration);
      const hour = new Date(video.time).getHours();
      const day = new Date(video.time).getDay();
      const week = Math.floor(new Date(video.time).getDate() / 7);

      const category = video.category || 'Unknown';
      const channel = video.channelTitle || 'Unknown';

      categoryStats[category] = categoryStats[category] || { time: 0, count: 0 };
      categoryStats[category].time += duration;
      categoryStats[category].count++;

      channelStats[channel] = channelStats[channel] || { time: 0, count: 0 };
      channelStats[channel].time += duration;
      channelStats[channel].count++;

      daily[hour]++;
      weekly[day]++;
      monthly[week]++;
    }

    const preferredCategories = Object.entries(categoryStats).map(([category, { time, count }]) => ({
      category,
      watchTime: time,
      videoCount: count,
      averageDuration: time / count,
      peakHours: [],
      topChannels: [],
    }));

    const channelPreferences = Object.entries(channelStats).map(([channel, { time, count }]) => ({
      channel,
      watchTime: time,
      videoCount: count,
      averageDuration: time / count,
      peakHours: [],
      topCategories: [],
    }));

    return {
      preferredCategories,
      channelPreferences,
      timeDistribution: {
        daily: daily.map((count, hour) => ({ hour, count, averageWatchTime: 0 })),
        weekly: weekly.map((count, day) => ({ day, count, averageWatchTime: 0 })),
        monthly: monthly.map((count, week) => ({ week, count, averageWatchTime: 0 })),
      },
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  }
}
