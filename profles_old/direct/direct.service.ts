import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DirectProfile } from './direct.entity';
import { RawService } from '../raw/raw.service';
import { UsersService } from '../../users/user.service';

interface EnrichedVideo {
  title: string;
  url: string;
  videoId: string;
  time: string;
  duration: string;
  category: string;
  subtitles: any[];
}

interface MostWatchedVideo {
  title: string;
  url: string;
  videoId: string;
  views: number;
  lastWatched: string;
  channel: string;
}

@Injectable()
export class DirectService {
  constructor(
    @InjectRepository(DirectProfile) private repo: Repository<DirectProfile>,
    private readonly rawSvc: RawService,
    private readonly users: UsersService,
  ) {}

  /* crunch one raw profile and persist */
  async buildFromRaw(rawId: string, userId: string): Promise<DirectProfile> {
    const raw = await this.rawSvc.findOne(rawId, userId);

    /* ---- aggregate helpers ---- */
    const channelCounts: Record<string, number> = {};
    const hourCounts = Array(24).fill(0) as number[];
    const dayOfWeekCounts = Array(7).fill(0) as number[];
    const monthCounts = Array(30).fill(0) as number[];
    const queryCounts: Record<string, number> = {};
    const videoCategories: Record<string, number> = {};
    const likedVideos: Array<{ title: string; url: string; timestamp: string }> = [];
    const subscriptions: Array<{ channel: string; subscriptionDate: string }> = [];
    
    let totalContentDuration = 0;
    let totalVideos = 0;

    // Process watch history
    for (const item of raw.watchHistory) {
      const channel = item.subtitles?.[0]?.name ?? 'Unknown';
      channelCounts[channel] = (channelCounts[channel] ?? 0) + 1;
    
      const date = new Date(item.time);
      hourCounts[date.getHours()]++;
      dayOfWeekCounts[date.getDay()]++;
      monthCounts[date.getDate() - 1]++;

      // Process video duration if available
      if (item.duration) {
        totalContentDuration += parseInt(item.duration);
      }

      // Process video categories if available
      if (item.category) {
        videoCategories[item.category] = (videoCategories[item.category] ?? 0) + 1;
      }

      // Track individual video views
      const link = item.titleUrl || item.url || '';
      const videoId = this.extractVideoId(link);
      item.videoId = videoId;
      item.title = item.title.replace(/^Watched\s+/i, '').trim();
      totalVideos++;
    }

    // Process search history
    for (const q of raw.searchHistory) {
      const term = q.query || q.search || q.title || 'unknown';
      queryCounts[term] = (queryCounts[term] ?? 0) + 1;
    }

    // Process liked videos
    for (const like of raw.likedVideos || []) {
      likedVideos.push({
        title: like.title,
        url: like.url,
        timestamp: like.timestamp,
      });
    }

    // Process subscriptions
    for (const sub of raw.subscriptions || []) {
      subscriptions.push({
        channel: sub.channel,
        subscriptionDate: sub.subscriptionDate,
      });
    }

    // Filter and enrich watch history
    const directWatchHistory: EnrichedVideo[] = raw.watchHistory
      .filter(item => item && item.titleUrl && !/ads/i.test(item.title) && item.videoId)
      .map(item => ({
        title: item.title.replace(/^Watched\s+/i, '').trim(),
        url: item.titleUrl,
        videoId: item.videoId,
        time: item.time,
        duration: item.duration || '',
        category: item.category || '',
        subtitles: item.subtitles || [],
      }))
      .filter((video): video is NonNullable<typeof video> => video !== null && video !== undefined);

    // Calculate most watched videos from enriched history
    const videoCounts = directWatchHistory
      .reduce((acc, video) => {
        acc[video.videoId] = (acc[video.videoId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const mostWatchedVideos: MostWatchedVideo[] = Object.entries(videoCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([videoId, count]) => {
        const video = directWatchHistory.find(v => v.videoId === videoId);
        if (!video) {
          return null;
        }
        return {
          title: video.title,
          url: video.url,
          videoId,
          views: count,
          lastWatched: video.time,
          channel: video.subtitles?.[0]?.name ?? 'Unknown',
        };
      })
      .filter((video): video is NonNullable<typeof video> => video !== null);

    // Calculate top channels
    const topChannels = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([channel, count]) => ({ channel, count }));

    // Calculate frequent queries
    const frequentQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([term, count]) => ({ term, count }));

    // Calculate search patterns
    const searchPatterns = {
      totalSearches: Object.values(queryCounts).reduce((a, b) => a + b, 0),
      searchesByTime: hourCounts,
      searchesByDay: dayOfWeekCounts,
      searchCategories: videoCategories,
    };

    // Calculate viewing patterns
    const viewingPatterns = {
      dailyDistribution: hourCounts,
      weeklyDistribution: dayOfWeekCounts,
      monthlyDistribution: monthCounts,
      contentDuration: {
        average: totalVideos > 0 ? totalContentDuration / totalVideos : 0,
        total: totalContentDuration,
      },
    };

    /* persist */
    const dp = this.repo.create({
      raw,
      user: raw.user,
      topChannels,
      frequentQueries,
      hourlyHistogram: hourCounts,
      videoActivity: {
        totalVideos,
        videosByCategory: videoCategories,
        mostWatchedVideos,
      },
      likedVideos,
      subscriptions,
      viewingPatterns,
      searchPatterns,
      directWatchHistory,
    });
    return this.repo.save(dp);
  }

  private extractVideoId(link: string): string {
    if (!link) return '';
    // most robust:  youtu.be/ID   or  watch?v=ID   or  embed/ID  etc.
    const match = link.match(
      /(?:youtu\.be\/|watch\?v=|embed\/|v\/)([0-9A-Za-z_-]{11})/
    );
    return match ? match[1] : '';
  }

  /* ---------- CRUD ---------- */
  findAll(userId: string) {
    return this.repo.find({ where: { user: { id: userId } } });
  }
  async findOne(id: string, userId: string) {
    const row = await this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: ['user','raw'],  
    });
    if (!row) throw new NotFoundException('Level-1 profile not found');
    return row;
  }
  delete(id: string, userId: string) {
    return this.repo.delete({ id, user: { id: userId } });
  }
}
