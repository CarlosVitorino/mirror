// Placeholder: Adapted from profles_old/llm/llm.controller.ts

import { Controller, Post, Param, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { LlmStageService, publicLlmEntity } from './llm.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles/llm')
export class LlmStageController {
  constructor(private readonly llmService: LlmStageService) {}

  @Post(':enrichedId/build')
  build(@Param('enrichedId') enrichedId: string): Promise<publicLlmEntity> {
    return this.llmService.createFromEnriched(enrichedId);

  }


}