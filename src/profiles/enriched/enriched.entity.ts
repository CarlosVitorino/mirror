// enriched.entity.ts (synced with current logic)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { DirectProfile } from '../direct/direct.entity';

@Entity()
export class EnrichedProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DirectProfile, { eager: false })
  direct: DirectProfile;

  @ManyToOne(() => User, { eager: false })
  user: User;

  @Column({ type: 'jsonb' })
  enrichedWatchHistory: Array<{
    title: string;
    url: string;
    videoId: string;
    time: string;
    duration: string;
    category: string;
    categoryId: string;
    channelTitle: string;
    description: string;
    subtitles: { name: string; url: string }[];
  }>;

  @Column({ type: 'jsonb' })
  videoCategories: {
    categoryDistribution: Record<string, number>;
    topCategories: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
  };

  @Column({ type: 'jsonb' })
  sentimentAnalysis: {
    titleSentiment: {
      positive: number;
      neutral: number;
      negative: number;
      byCategory: Record<string, {
        positive: number;
        neutral: number;
        negative: number;
        averageScore: number;
        sentimentTrend: Array<{
          date: string;
          positive: number;
          neutral: number;
          negative: number;
        }>;
      }>;
    };
    descriptionSentiment: {
      positive: number;
      neutral: number;
      negative: number;
      byCategory: Record<string, {
        positive: number;
        neutral: number;
        negative: number;
        averageScore: number;
        sentimentTrend: Array<{
          date: string;
          positive: number;
          neutral: number;
          negative: number;
        }>;
      }>;
    };
    channelSentiment: Record<string, {
      positive: number;
      neutral: number;
      negative: number;
      averageScore: number;
      sentimentTrend: Array<{
        date: string;
        positive: number;
        neutral: number;
        negative: number;
      }>;
    }>;
    timeBasedSentiment: {
      daily: Array<{
        hour: number;
        positive: number;
        neutral: number;
        negative: number;
        averageScore: number;
      }>;
      weekly: Array<{
        day: number;
        positive: number;
        neutral: number;
        negative: number;
        averageScore: number;
      }>;
      monthly: Array<{
        week: number;
        positive: number;
        neutral: number;
        negative: number;
        averageScore: number;
      }>;
    };
  };

  @Column({ type: 'jsonb' })
  engagementPatterns: {
    bingeSessions: Array<{
      startTime: string;
      endTime: string;
      videoCount: number;
      totalDuration: number;
      videos: Array<{
        title: string;
        duration: number;
        channelTitle: string;
        category: string;
      }>;
      categoryDistribution: Array<{
        category: string;
        count: number;
        percentage: number;
      }>;
    }>;
    peakActivity: {
      daily: Array<{
        hour: number;
        count: number;
        averageWatchTime: number;
        topCategories: string[];
      }>;
      weekly: Array<{
        day: number;
        count: number;
        averageWatchTime: number;
        topCategories: string[];
      }>;
      monthly: Array<{
        week: number;
        count: number;
        averageWatchTime: number;
        topCategories: string[];
      }>;
    };
    categoryEngagement: {
      totalWatchTime: number;
      averageSessionLength: number;
      peakHours: Array<{
        hour: number;
        count: number;
      }>;
      categoryDistribution: Record<string, {
        watchCount: number;
        totalDuration: number;
        averageSessionLength: number;
        peakHours: Array<{
          hour: number;
          count: number;
        }>;
      }>;
    };
  };

  @Column({ type: 'jsonb' })
  contentPreferences: {
    preferredCategories: Array<{
      category: string;
      watchTime: number;
      videoCount: number;
      averageDuration: number;
      peakHours: Array<{
        hour: number;
        count: number;
      }>;
      topChannels: string[];
    }>;
    channelPreferences: Array<{
      channel: string;
      watchTime: number;
      videoCount: number;
      averageDuration: number;
      peakHours: Array<{
        hour: number;
        count: number;
      }>;
      topCategories: string[];
    }>;
    timeDistribution: {
      daily: Array<{
        hour: number;
        count: number;
        averageWatchTime: number;
      }>;
      weekly: Array<{
        day: number;
        count: number;
        averageWatchTime: number;
      }>;
      monthly: Array<{
        week: number;
        count: number;
        averageWatchTime: number;
      }>;
    };
  };

  @CreateDateColumn()
  createdAt: Date;
}
