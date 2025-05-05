import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheEntry } from './cache.entity';
import { CacheService } from './cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([CacheEntry])],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}