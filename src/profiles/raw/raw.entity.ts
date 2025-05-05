import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne,
    CreateDateColumn,
  } from 'typeorm';
  import { User } from '../../users/user.entity';
  
  @Entity()
  export class RawProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, (u) => u.rawProfiles, { eager: false })
    user: User;
  
    @Column({ type: 'jsonb' })
    watchHistory: any[];
  
    @Column({ type: 'jsonb' })
    searchHistory: any[];
  
    @Column({ type: 'jsonb', nullable: true })
    likedVideos?: any[];
  
    @Column({ type: 'jsonb', nullable: true })
    subscriptions?: any[];
  
    @CreateDateColumn()
    createdAt: Date;
  }
  