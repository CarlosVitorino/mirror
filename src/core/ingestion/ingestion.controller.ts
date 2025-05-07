// src/ingestion/ingestion.controller.ts
import {
    Controller, Post, Get, Param, Req, UploadedFiles,
    UseGuards, UseInterceptors, BadRequestException
  } from '@nestjs/common';
  import * as multer from 'multer';
  import { FilesInterceptor } from '@nestjs/platform-express';
  
  import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
  import { IngestionService } from './ingestion.service';
  import { DataSource } from '../../shared/data-source';
  
  const MAX_UPLOAD = 50 * 1024 * 1024;
  
  @UseGuards(JwtAuthGuard)
  @Controller('ingest')
  export class IngestionController {
    constructor(private readonly svc: IngestionService) {}
  
    @Post(':source/upload')
    @UseInterceptors(
      FilesInterceptor('files', 10, {
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_UPLOAD },
        fileFilter: (_, f, cb) =>
          ['application/json', 'text/csv', 'application/zip'].includes(f.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException('Only JSON/CSV/ZIP'), false),
      }),
    )
    async upload(
      @Param('source') sourceParam: string,
      @Req() req: any,
      @UploadedFiles() files: Express.Multer.File[],
    ) {
      const source = sourceParam.toUpperCase() as DataSource;
      const digest = await this.svc.ingest(req.user.userId, source, files);
      return { id: digest.id, source, createdAt: digest.createdAt };
    }
  
    /* read helpers — optional ---------------------------------------------- */
    @Get()
    list(@Req() req: any) {
      return this.svc.findAll(req.user.userId);
    }
  
    @Get(':id')
    get(@Param('id') id: string, @Req() req: any) {
      return this.svc.findOne(id, req.user.userId);
    }
  }
  