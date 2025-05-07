// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfig } from './config/config.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/user.module';
import { ProfileModule } from './profiles/profile.module';
import { IngestionModule } from './core/ingestion/ingestion.module';      // ⬅︎ new

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfig],
      useClass: AppConfig,
    }),
    AuthModule,
    UsersModule,
    IngestionModule,     // ⬅︎ must come **before** ProfileModule if profiles depend on digests
    ProfileModule,
  ],
})
export class AppModule {}
