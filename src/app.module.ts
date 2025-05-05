import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from './config/config.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/user.module';
import { ProfileModule } from './profiles/profile.module';

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
    ProfileModule,
  ],
})
export class AppModule {}
