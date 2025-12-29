import type { ProviderMusic } from '@/types';
import fs from 'fs';
import path from 'path';

const RHYTHMVERSE_BASE_URL = 'https://rhythmverse.co';
const RHYTHMVERSE_API_URL = 'https://rhythmverse.co/api/yarg/songfiles/list';

interface RhythmVerseResponse {
  status: string;
  data: {
    records: {
      total_available: number;
      total_filtered: number;
      returned: number;
    };
    pagination: {
      start: number;
      records: string;
      page: string;
    };
    songs: RhythmVerseSongEntry[];
  };
}


export interface RhythmVerseSongEntry {
  data: {
    song_id: number;
    title: string;
    artist: string;
    album: string;
    diff_drums: string | null;
    diff_guitar: string | null;
    diff_bass: string | null;
    diff_vocals: string | null;
    diff_keys: string | null;
    diff_prokeys: string | null;
    update_date: string;
    charter?: string;
    album_art: string | null;
  };
  file: {
    file_title: string;
    file_artist: string;
    file_album: string;
    file_year: number;
    file_genre: string;
    file_name: string;
    file_url: string;
    download_page_url_full: string;
    download_url: string;
    author?: {
      name: string;
    };
  };
}

export function parseRhythmverseData(songs: RhythmVerseSongEntry[]): ProviderMusic[] {
  return songs.map((entry) => {
    const { data, file } = entry;
    // Prefer file data, fallback to data
    const name = file.file_title || data.title;
    const artist = file.file_artist || data.artist;
    const album = file.file_album || data.album;

    const downloadUrl = file.download_page_url_full;
    const coverUrl = `${RHYTHMVERSE_BASE_URL}${data.album_art}`;

    return {
      name,
      artist,
      album,
      coverUrl,
      downloadUrl,
      sourceUpdatedAt: !isNaN(Date.parse(data.update_date)) ? new Date(data.update_date) : new Date(),
      year: file.file_year || undefined,
      genre: file.file_genre || undefined,
      charter: file.author?.name || undefined,
      instruments: {
        drums: parseDifficulty(data.diff_drums),
        bass: parseDifficulty(data.diff_bass),
        guitar: parseDifficulty(data.diff_guitar),
        prokeys: parseDifficulty(data.diff_prokeys) || parseDifficulty(data.diff_keys),
        vocals: parseDifficulty(data.diff_vocals),
      },
      rawData: entry,
    };
  });
}

export async function fetchRhythmverse(
  page: number,
  pageSize: number,
  sortDirection: 'asc' | 'desc',
): Promise<{ songs: ProviderMusic[] }> {
  try {
    console.log(`Fetching RhythmVerse API page ${page} (size: ${pageSize}, sort: ${sortDirection})...`);

    const body = new URLSearchParams();
    body.append('instrument[]', 'bass');
    body.append('instrument[]', 'drums');
    body.append('instrument[]', 'guitar');
    body.append('instrument[]', 'vocals');
    body.append('sort[0][sort_by]', 'update_date');
    body.append('sort[0][sort_order]', sortDirection.toUpperCase());
    body.append('data_type', 'full');
    body.append('page', page.toString());
    body.append('records', pageSize.toString());

    const response = await fetch(RHYTHMVERSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RhythmVerse API: ${response.status}`);
    }

    const json = (await response.json()) as RhythmVerseResponse;

    try {
      const logPath = path.join(process.cwd(), 'rhythmverse-debug.json');
      await fs.promises.appendFile(logPath, JSON.stringify(json, null, 2) + '\n\n');
      console.log(`Logged response to ${logPath}`);
    } catch (err) {
      console.error('Failed to write log file:', err);
    }

    if (json.status !== 'success') {
      throw new Error(`RhythmVerse API returned status: ${json.status}`);
    }

    const { songs } = json.data;
    const results = parseRhythmverseData(songs);

    console.log(`Fetched ${results.length} songs from RhythmVerse API page ${page}`);

    return { songs: results };
  } catch (error) {
    console.error('Error fetching RhythmVerse API:', error);
    throw error;
  }
}

function parseDifficulty(diff: string | null | number): number | undefined {
  if (diff === null || diff === undefined) return undefined;
  if (typeof diff === 'number') return diff === -1 ? undefined : diff;
  const parsed = parseInt(diff, 10);
  return isNaN(parsed) || parsed === -1 ? undefined : parsed;
}

export async function getTotalSongs(): Promise<number> {
  try {
    const body = new URLSearchParams();
    body.append('instrument[]', 'bass');
    body.append('instrument[]', 'drums');
    body.append('instrument[]', 'guitar');
    body.append('instrument[]', 'vocals');
    body.append('sort[0][sort_by]', 'update_date');
    body.append('sort[0][sort_order]', 'ASC');
    body.append('data_type', 'full');
    body.append('page', '1');
    body.append('records', '25');

    const response = await fetch(RHYTHMVERSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
    });

    if (!response.ok) return 1;

    const json = (await response.json()) as RhythmVerseResponse;
    if (json.status !== 'success') return 1;

    const totalFiltered = json.data.records.total_filtered;

    return totalFiltered;
  } catch {
    return 1;
  }
}

