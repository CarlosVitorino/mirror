import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { DigestEntity } from '../../core/digest/digest.entity';
import { DataSource } from '../../shared/data-source';

@Entity()
export class DirectEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @ManyToOne(() => User)          user!: User;
  @ManyToOne(() => DigestEntity)  digest!: DigestEntity;

  @Column({ type: 'enum', enum: DataSource }) source!: DataSource;
  @Column({ type: 'jsonb' })                  payload!: unknown;   // DirectStats

  @CreateDateColumn() createdAt!: Date;
}