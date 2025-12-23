import type { ProviderMusic } from '@/types';

const ENCHOR_BASE_URL = 'https://www.enchor.us';
const ENCHOR_API_URL = 'https://api.enchor.us/search/advanced';
const ENCHOR_FILES_URL = 'https://files.enchor.us'


interface EnchorResponse {
  found: number;
  out_of: number;
  page: number;
  data: EnchorSong[];
}

interface EnchorSong {
  name: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  charter: string;
  diff_drums: number;
  diff_guitar: number;
  diff_bass: number;
  diff_keys: number;
  diff_vocals: number;
  diff_rhythm: number;
  chartId: number;
  md5: string;
  albumArtMd5: string;
  uploaded_at: string; // "2023-10-27T..."
  drivePath: string;
}

export async function fetchEnchor(
  page: number = 1,
  pageSize: number = 20,
  sortDirection: 'asc' | 'desc' = 'asc',
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal
): Promise<{ songs: ProviderMusic[]; totalFound: number }> {
  try {
    console.log(`Fetching Enchor API page ${page} (size: ${pageSize}, sort: ${sortDirection})...`);

    const response = await fetch(ENCHOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
      },
      signal,
      body: JSON.stringify({
        instrument: "bass",
        difficulty: null,
        drumType: null,
        drumsReviewed: false,
        sort: { type: "modifiedTime", direction: sortDirection },
        source: "website",
        name: { value: "", exact: false, exclude: false },
        artist: { value: "", exact: false, exclude: false },
        album: { value: "", exact: false, exclude: false },
        genre: { value: "", exact: false, exclude: false },
        year: { value: "", exact: false, exclude: false },
        charter: { value: "", exact: false, exclude: false },
        minLength: null,
        maxLength: null,
        minIntensity: null,
        maxIntensity: null,
        minAverageNPS: null,
        maxAverageNPS: null,
        minMaxNPS: null,
        maxMaxNPS: null,
        minYear: null,
        maxYear: null,
        modifiedAfter: "",
        hash: "",
        trackHash: "",
        hasSoloSections: null,
        hasForcedNotes: null,
        hasOpenNotes: null,
        hasTapNotes: null,
        hasLyrics: null,
        hasVocals: true,
        hasRollLanes: null,
        has2xKick: null,
        hasIssues: null,
        hasVideoBackground: null,
        modchart: null,
        page: page,
        pageSize: pageSize
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Enchor API: ${response.status}`);
    }

    const json = (await response.json()) as EnchorResponse;
    const { data, found } = json;

    const results: ProviderMusic[] = data.map((song) => {
      const downloadUrl = `${ENCHOR_BASE_URL}/download?md5=${song.md5}&isSng=false&downloadNovideoVersion=false&filename=${song.drivePath} (${song.charter})`;
      const coverUrl = `${ENCHOR_FILES_URL}/${song.albumArtMd5}.jpg`;

      return {
        name: song.name,
        artist: song.artist,
        album: song.album,
        coverUrl: coverUrl,
        downloadUrl: downloadUrl,
        sourceUpdatedAt: !isNaN(Date.parse(song.uploaded_at)) ? new Date(song.uploaded_at) : new Date(),
        year: parseInt(song.year, 10) || undefined,
        genre: song.genre,
        charter: song.charter,
        instruments: {
          drums: song.diff_drums === -1 ? undefined : song.diff_drums,
          bass: song.diff_bass === -1 ? undefined : song.diff_bass,
          guitar: song.diff_guitar === -1 ? undefined : song.diff_guitar,
          prokeys: song.diff_keys === -1 ? undefined : song.diff_keys, // enchor calls it diff_keys
          vocals: song.diff_vocals === -1 ? undefined : song.diff_vocals,
        },
        rawData: song,
      };
    });

    console.log(`Fetched ${results.length} songs from Enchor API page ${page}`);

    if (onProgress) {
      onProgress(results.length, found);
    }

    return { songs: results, totalFound: found };
  } catch (error) {
    console.error('Error fetching Enchor API:', error);
    throw error;
  }
}

export async function getTotalPages(): Promise<number> {
  try {
    // Make a request for page 1 to get the total count
    const response = await fetch(ENCHOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
      },
      body: JSON.stringify({
        instrument: "bass",
        difficulty: null,
        drumType: null,
        drumsReviewed: false,
        sort: { type: "modifiedTime", direction: "asc" },
        source: "website",
        name: { value: "", exact: false, exclude: false },
        artist: { value: "", exact: false, exclude: false },
        album: { value: "", exact: false, exclude: false },
        genre: { value: "", exact: false, exclude: false },
        year: { value: "", exact: false, exclude: false },
        charter: { value: "", exact: false, exclude: false },
        minLength: null,
        maxLength: null,
        minIntensity: null,
        maxIntensity: null,
        minAverageNPS: null,
        maxAverageNPS: null,
        minMaxNPS: null,
        maxMaxNPS: null,
        minYear: null,
        maxYear: null,
        modifiedAfter: "",
        hash: "",
        trackHash: "",
        hasSoloSections: null,
        hasForcedNotes: null,
        hasOpenNotes: null,
        hasTapNotes: null,
        hasLyrics: null,
        hasVocals: true,
        hasRollLanes: null,
        has2xKick: null,
        hasIssues: null,
        hasVideoBackground: null,
        modchart: null,
        page: 1
      }),
    });

    if (!response.ok) return 1;

    const json = (await response.json()) as EnchorResponse;
    // Assuming 20 items per page? Enchor usually returns 20 or 25.
    // The payload asked for page 1.
    // Let's assume a default page size if not returned. 
    // The response doesn't strictly say "totalPages", but "found".
    // We can calculate: found / results.length

    if (json.data.length === 0) return 1;

    const itemsPerPage = json.data.length; // Approximate
    return Math.ceil(json.found / itemsPerPage);
  } catch {
    return 1;
  }
}

