import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { EnrichedEntity } from '../enriched/enriched.entity';

@Entity()
export class LlmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => EnrichedEntity, { eager: false })
  enriched!: EnrichedEntity;

  /** 5-7 entries like { trait: 'Curiosity', score: 0.83 } */
  @Column({ type: 'jsonb' })
  radarTraits!: { trait: string; score: number }[];

  /** 1-3 rich paragraphs in first-person */
  @Column({ type: 'text' })
  narrativeSummary!: string;

  /** 3-5 bullet-style tips */
  @Column({ type: 'jsonb' })
  suggestedShifts!: string[];

  /** 3-5 Q&A pairs */
  @Column({ type: 'jsonb' })
  faqs!: { question: string; answer: string }[];

  /** Optional one-sentence metaphor */
  @Column({ type: 'text', nullable: true })
  visualMetaphor?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
