import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { LlmProfileService } from './llm.service';
import { EnrichedProfile } from '../enriched/enriched.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@UseGuards(JwtAuthGuard)
@Controller('profiles/level3')
export class LlmProfileController {
  constructor(
    private readonly LlmProfileService: LlmProfileService,
    @InjectRepository(EnrichedProfile) private enrichedRepo: Repository<EnrichedProfile>,
  ) {}

  @Post(':enrichedId/build')
  async build(@Param('enrichedId') id: string, @Req() req: any) {
    const enriched = await this.enrichedRepo.findOne({ where: { id }, relations: ['user'] });
    if (!enriched || enriched.user.id !== req.user.userId) throw new Error('Forbidden');
    const llmProfile = await this.LlmProfileService.generateFromEnriched(enriched, {
        age: 37,
        country: 'DE',
        occupation: 'Software Engineer',
        languages: ['en', 'pt'],
        hobbies: ['cycling', 'bouldering','cooking', 'my baby'],
      });
    return llmProfile;
  }
}