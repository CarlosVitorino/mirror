// src/ingestion/ingestion.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DigestEntity } from '../digest/digest.entity';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

import { YoutubeTakeoutStrategy } from './youtube/youtube.strategy';
import { UsersModule } from '../../users/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DigestEntity]),
    UsersModule,
  ],
  controllers: [IngestionController],
  providers: [
    YoutubeTakeoutStrategy,      // individual provider
    {
      provide: 'INGEST_STRATEGIES',
      useFactory: (yt: YoutubeTakeoutStrategy) => [yt],
      inject:    [YoutubeTakeoutStrategy],
    },
    IngestionService,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
