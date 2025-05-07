import { parse } from 'csv-parse/sync';
import { IngestionStrategy } from '../ingestion-strategy';
import { DataSource } from '../../../shared/data-source';

export interface YoutubeTakeoutPayload {
  watch: any[];
  search: any[];
  likes?: any[];
  subs?: any[];
}

export class YoutubeTakeoutStrategy implements IngestionStrategy<YoutubeTakeoutPayload> {
  readonly source = DataSource.YouTube;

  validate(files: Express.Multer.File[]) {
    if (!files.length) throw new Error('No files uploaded');
    // loose rule of thumb – tighten as you like
    const names = files.map((f) => f.originalname);
    if (!names.some((n) => n.includes('watch-history')))
      throw new Error('watch-history.* file missing');
  }

  async extract(files: Express.Multer.File[]): Promise<YoutubeTakeoutPayload> {
    const byName = (needle: string) => files.find((f) => f.originalname.includes(needle));

    const parseFile = (f?: Express.Multer.File): any[] | undefined => {
      if (!f) return undefined;
      if (f.mimetype === 'text/csv')
        return parse(f.buffer.toString(), { columns: true, skip_empty_lines: true });
      return JSON.parse(f.buffer.toString());
    };

    return {
      watch:       parseFile(byName('watch-history'))   ?? [],
      search:      parseFile(byName('search-history'))  ?? [],
      likes:       parseFile(byName('likes'))           ?? [],
      subs:        parseFile(byName('subscriptions'))   ?? [],
    };
  }
}
