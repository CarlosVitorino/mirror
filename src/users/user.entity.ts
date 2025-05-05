import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, OneToMany,
  } from 'typeorm';
  import { RawProfile } from '../profiles/raw/raw.entity';
  
  @Entity()
  export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ unique: true })
    email: string;
  
    @Column()
    passwordHash: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @OneToMany(() => RawProfile, (p) => p.user)
    rawProfiles: RawProfile[];
  }
  