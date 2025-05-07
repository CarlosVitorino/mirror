// src/modules/profile.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DigestEntity }   from '../core/digest/digest.entity';
import { DirectEntity }   from '../stages/direct/direct.entity';
import { EnrichedEntity } from '../stages/enriched/enriched.entity';
import { LlmEntity } from '../stages/llm/llm.entity';

import { DirectStageService }   from '../stages/direct/direct.service';
import { EnrichedStageService } from '../stages/enriched/enriched.service';
import { LlmStageService } from '../stages/llm/llm.service';

import { DirectStageController }   from '../stages/direct/direct.controller';
import { EnrichedStageController } from '../stages/enriched/enriched.controller';
import { LlmStageController } from '../stages/llm/llm.controller';

import { YoutubeDirectTransformer }   from '../core/transform/direct/youtube-direct.transformer';
import { YoutubeEnrichedTransformer } from '../core/transform/enriched/youtube-enriched.transformer';
import { YoutubeLlmTransformer } from '../core/transform/llm/youtube-llm.transformer';
import { OpenAIUtil } from '../core/transform/llm/utils/openai-util';
import { YoutubeApi }                 from '../core/transform/enriched/utils/youtube-api.adapter';

import { UsersModule }    from '../users/user.module';
import { CacheModule }    from '../cache/cache.module';
import { CacheService }   from '../cache/cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([DigestEntity, DirectEntity, EnrichedEntity, LlmEntity]),
    UsersModule,
    CacheModule,
    ConfigModule,
  ],

  controllers: [
    DirectStageController,
    EnrichedStageController,
    LlmStageController,
  ],

  providers: [
    /* ─────────────── DIRECT (STAGE 1) ─────────────── */
    YoutubeDirectTransformer,
    {
      provide: 'DIRECT_TRANSFORMERS',
      useFactory: (yt: YoutubeDirectTransformer) => [yt],
      inject: [YoutubeDirectTransformer],
    },
    DirectStageService,

    /* ─────────────── ENRICHED (STAGE 2) ────────────── */
    {
      // singleton wrapper around googleapis + cache
      provide: YoutubeApi,
      useFactory: (cfg: ConfigService, cache: CacheService) => {
        const apiKey = cfg.get<string>('YOUTUBE_API_KEY');
        if (!apiKey) {
          throw new Error('Environment variable YOUTUBE_API_KEY is missing');
        }
        if (!cache) {
          throw new Error('CacheService is not available');
        }
        return new YoutubeApi(apiKey, cache);
      },
      inject: [ConfigService, CacheService],
    },
    {
      provide: YoutubeEnrichedTransformer,
      useFactory: (api: YoutubeApi) =>
        new YoutubeEnrichedTransformer(api),
      inject: [YoutubeApi],
    },
    {
      provide: 'ENRICHED_TRANSFORMERS',
      useFactory: (yt: YoutubeEnrichedTransformer) => [yt],
      inject: [YoutubeEnrichedTransformer],
    },
    EnrichedStageService,

    /* ─────────────── LLM (STAGE 3) ───────────────── */
    // Provide OpenAIUtil using ConfigService
    {
      provide: OpenAIUtil,
      useFactory: (cfg: ConfigService) => {
        const apiKey = cfg.get<string>('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
        return new OpenAIUtil(apiKey);
      },
      inject: [ConfigService],
    },

    // Provide YoutubeLlmTransformer with OpenAIUtil injected
    {
      provide: YoutubeLlmTransformer,
      useFactory: (openaiUtil: OpenAIUtil) => new YoutubeLlmTransformer(openaiUtil),
      inject: [OpenAIUtil],
    },
    {
      provide: 'LLM_TRANSFORMERS',
      useFactory: (yt: YoutubeLlmTransformer) => [yt],
      inject: [YoutubeLlmTransformer],
    },
    LlmStageService,
  ],

  exports: [DirectStageService, EnrichedStageService],
})
export class ProfileModule {}
