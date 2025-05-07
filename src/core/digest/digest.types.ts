import { DataSource } from '../../shared/data-source';

export interface Digest<TPayload = unknown> {
  id: string;          // UUID (set by DB layer)
  userId: string;      // foreign key → User
  source: DataSource;  // which external feed
  payload: TPayload;   // fully normalised data
  createdAt: Date;
}