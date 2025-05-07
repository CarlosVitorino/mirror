//import { RawProfile } from '../profiles/raw/raw.entity';
import { parse } from 'csv-parse/sync';

export interface Level0DTO {
  watch: any[];
  search: any[];
  likedVideos?: any[];
  subs?: any[];
}

function parseFile(file: Express.Multer.File): any[] {
  if (file.mimetype === 'text/csv') {
    return parse(file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
    });
  }
  return JSON.parse(file.buffer.toString());
}

export function mapTakeoutFiles(files: Express.Multer.File[]): Level0DTO {
  const find = (needle: string) =>
    files.find((f) => f.originalname.includes(needle));

  return {
    watch: find('watch-history') ? parseFile(find('watch-history')!) : [],
    search: find('search-history') ? parseFile(find('search-history')!) : [],
    likedVideos: find('likes') ? parseFile(find('likes')!) : undefined,
    subs: find('subscriptions') ? parseFile(find('subscriptions')!) : undefined,
  };
}

/* export function rawCounts(r: RawProfile) {
  return {
    watch: r.watchHistory.length,
    search: r.searchHistory.length,
    likedVideos: r.likedVideos?.length ?? 0,
    subs: r.subscriptions?.length ?? 0,
  };
}
 */