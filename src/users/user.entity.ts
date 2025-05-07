import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { DigestEntity } from '../core/digest/digest.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ unique: true }) email!: string;
  @Column()               passwordHash!: string;

  @CreateDateColumn() createdAt!: Date;

  @OneToMany(() => DigestEntity, (d) => d.user)
  digests!: DigestEntity[];
}
