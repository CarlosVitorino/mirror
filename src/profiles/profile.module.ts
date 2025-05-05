import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RawProfile } from './raw/raw.entity';
import { RawService } from './raw/raw.service';
import { RawController } from './raw/raw.controller';

import { DirectProfile } from './direct/direct.entity';
import { DirectService } from './direct/direct.service';
import { DirectController } from './direct/direct.controller';

import { EnrichedProfile } from './enriched/enriched.entity';
import { EnrichedService } from './enriched/enriched.service';
import { EnrichedController } from './enriched/enriched.controller';
import { YouTubeEnricher } from './enriched/youtube.enricher';
import { SentimentAnalyzer } from './enriched/sentiment.utils';

import { UserProfile } from './user/user.entity';
import { UserProfileService } from './user/user.service';
import { UserProfileController } from './user/user.controller';

import { UsersModule } from '../users/user.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawProfile,
      DirectProfile,
      EnrichedProfile,
      UserProfile,
    ]),
    UsersModule,
    ConfigModule,
    CacheModule,
  ],
  providers: [
    RawService,
    DirectService,
    EnrichedService,
    YouTubeEnricher,
    SentimentAnalyzer,
    UserProfileService,
  ],
  controllers: [
    RawController,
    DirectController,
    EnrichedController,
    UserProfileController,
  ],
  exports: [
    RawService,
    DirectService,
    EnrichedService,
    UserProfileService,
  ],
})
export class ProfileModule {}
