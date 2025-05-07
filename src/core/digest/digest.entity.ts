import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { DataSource } from '../../shared/data-source';

@Entity()
export class DigestEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @ManyToOne(() => User)          user!: User;

  @Column({ type: 'enum', enum: DataSource }) source!: DataSource;
  @Column({ type: 'jsonb' })                  payload!: unknown;

  @CreateDateColumn() createdAt!: Date;
}