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

import { LlmProfile } from './llm/llm.entity';
import { LlmProfileService } from './llm/llm.service';
import { LlmProfileController } from './llm/llm.controller';

import { UsersModule } from '../users/user.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RawProfile,
      DirectProfile,
      EnrichedProfile,
      LlmProfile,
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
    LlmProfileService,
  ],
  controllers: [
    RawController,
    DirectController,
    EnrichedController,
    LlmProfileController,
  ],
  exports: [
    RawService,
    DirectService,
    EnrichedService,
    LlmProfileService,
  ],
})
export class ProfileModule {}
