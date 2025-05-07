import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn,
  } from 'typeorm';
  import { User } from '../../users/user.entity';
  import { RawProfile } from '../raw/raw.entity';
  
  @Entity()
  export class DirectProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    /** parent raw row */
    @ManyToOne(() => RawProfile, { eager: false })
    raw: RawProfile;
  
    @ManyToOne(() => User, { eager: false })
    user: User;
  
    /* ---------- direct aggregates ---------- */
    @Column({ type: 'jsonb' }) topChannels: { channel: string; count: number }[];
  
    @Column({ type: 'jsonb' }) frequentQueries: { term: string; count: number }[];
  
    @Column({ type: 'jsonb' }) hourlyHistogram: number[]; // length 24
  
    @Column({ type: 'jsonb' })
    videoActivity: {
      totalVideos: number;
      videosByCategory: Record<string, number>;
      mostWatchedVideos: Array<{
        title: string;
        url: string;
        videoId: string;
        views: number;
        lastWatched: string;
        channel: string;
      }>;
    };

    @Column({ type: 'jsonb' })
    likedVideos: Array<{
      title: string;
      url: string;
      timestamp: string;
    }>;

    @Column({ type: 'jsonb' })
    subscriptions: Array<{
      channel: string;
      subscriptionDate: string;
    }>;

    @Column({ type: 'jsonb' })
    viewingPatterns: {
      dailyDistribution: number[]; // 24-hour distribution
      weeklyDistribution: number[]; // 7-day distribution
      monthlyDistribution: number[]; // 30-day distribution
      contentDuration: {
        average: number;
        total: number;
      };
    };

    @Column({ type: 'jsonb' })
    searchPatterns: {
      totalSearches: number;
      searchesByTime: number[]; // 24-hour distribution
      searchesByDay: number[]; // 7-day distribution
      searchCategories: Record<string, number>;
    };

    @Column({ type: 'jsonb' })
    directWatchHistory: Array<{
      title: string;
      url: string;
      videoId: string;
      time: string;
      duration: string;
      category: string;
      subtitles: Array<{
        name: string;
        url: string;
      }>;
    }>;

    @CreateDateColumn() createdAt: Date;
  }