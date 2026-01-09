import { CacheHandler } from './Song/Cache/CacheHandler';
import { SongEntry } from './Song/Entries/SongEntry';

export default async function deserializeCache(cacheFile: File): Promise<SongEntry[]> {
  const handler = new CacheHandler();
  await CacheHandler.QuickScan(handler, cacheFile, false);
  console.log("Quick scan successful!");
  console.log(`Found ${handler.cacheEntries.length} entries`);
  return handler.cacheEntries;
}
