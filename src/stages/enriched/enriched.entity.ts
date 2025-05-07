import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { DirectEntity } from '../direct/direct.entity';
import { DataSource } from '../../shared/data-source';

@Entity()
export class EnrichedEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @ManyToOne(() => User)         user!: User;
  @ManyToOne(() => DirectEntity) direct!: DirectEntity;

  @Column({ type: 'enum', enum: DataSource }) source!: DataSource;
  @Column({ type: 'jsonb' })                  payload!: unknown;  // EnrichedPayload

  @CreateDateColumn() createdAt!: Date;
}