import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleOptions,
  TypeOrmOptionsFactory,
} from '@nestjs/typeorm';

@Injectable()
export class AppConfig implements TypeOrmOptionsFactory {
  constructor(private readonly cfg: ConfigService) {}

  private dbOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.cfg.get<string>('POSTGRES_HOST'),
      port: this.cfg.get<number>('POSTGRES_PORT'),
      username: this.cfg.get<string>('POSTGRES_USER'),
      password: this.cfg.get<string>('POSTGRES_PASSWORD'),
      database: this.cfg.get<string>('POSTGRES_DB'),
      autoLoadEntities: true,
      synchronize: true, // dev only
      logging: false,
    };
  }

  /** required by TypeOrmOptionsFactory */
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return this.dbOptions();
  }

  jwt() {
    return {
      secret: this.cfg.get<string>('JWT_SECRET'),
      signOptions: {
        expiresIn: this.cfg.get<string>('JWT_EXPIRY') ?? '1d',
      },
    };
  }
}
