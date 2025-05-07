import { DataSource } from '../../shared/data-source';

export interface IngestionStrategy<TPayload = unknown> {
  /** identifies the external feed */
  readonly source: DataSource;
  /** validate file set – throw if wrong */
  validate(files: Express.Multer.File[]): void;
  /** convert raw upload(s) → fully normalised JSON */
  extract(files: Express.Multer.File[]): Promise<TPayload>;
}