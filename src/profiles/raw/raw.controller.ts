import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
  } from '@nestjs/common';
  import * as multer from 'multer';
  import { FilesInterceptor } from '@nestjs/platform-express';
  import { RawService } from './raw.service';
  import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
  import { mapTakeoutFiles, rawCounts } from '../../shared/helpers';
  
  const MAX_UPLOAD = 50 * 1024 * 1024;    // 50 MB  (or read from .env)

  @UseGuards(JwtAuthGuard)
  @Controller('profiles/level0')
  export class RawController {
    constructor(private readonly svc: RawService) {}
  
    /** CREATE (multipart upload) */
    @Post('upload')
    @UseInterceptors(
        FilesInterceptor('files', 4, {
            storage: multer.memoryStorage(),    // keep using RAM for now
            limits: { fileSize: MAX_UPLOAD },
            fileFilter: (_, f, cb) =>
              ['application/json', 'text/csv'].includes(f.mimetype)
                ? cb(null, true)
                : cb(new BadRequestException('Only JSON files'), false),
          }),
    )
    async upload(@Req() req: any, @UploadedFiles() files: Express.Multer.File[]) {
        const dto = mapTakeoutFiles(files);
        const row = await this.svc.create(req.user.userId, dto); // row: RawProfile
        return { id: row.id, counts: rawCounts(row) };
      }
  
    /** READ list */
    @Get()
    list(@Req() req: any) {
      return this.svc.findAll(req.user.userId);
    }
  
    /** READ one */
    @Get(':id')
    get(@Param('id') id: string, @Req() req: any) {
      return this.svc.findOne(id, req.user.userId);
    }
  
    /** UPDATE (re-upload raw files) */
    @Patch(':id')
    @UseInterceptors(
      FilesInterceptor('files', 4, {
        limits: { fileSize: 10_000_000 },
        fileFilter: (_, f, cb) =>
          ['application/json', 'text/csv'].includes(f.mimetype)
            ? cb(null, true)
            : cb(new BadRequestException('Only JSON'), false),
      }),
    )
    update(
      @Param('id') id: string,
      @Req() req: any,
      @UploadedFiles() files: Express.Multer.File[],
    ) {
      return this.svc.update(id, req.user.userId, mapTakeoutFiles(files));
    }
  
    /** DELETE */
    @Delete(':id')
    delete(@Param('id') id: string, @Req() req: any) {
      return this.svc.delete(id, req.user.userId);
    }
  }
  