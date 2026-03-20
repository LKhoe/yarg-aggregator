import type { ProviderMusic } from "@/types";
import { decode } from "he";

const RHYTHMVERSE_BASE_URL = "https://rhythmverse.co";
const RHYTHMVERSE_API_URL = "https://rhythmverse.co/api/yarg/songfiles/list";

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.warn(
        `Rhythmverse fetch attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

export interface RhythmVerseResponse {
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
    vocal_parts: string | null;
    charter?: string;
    album_art: string | null;
    record_updated: string; // timestamp
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
    record_updated: string; // "2023-01-06 22:14:46"
    update_date: string; // "2023-01-06 22:14:46"
    author?: {
      name: string;
    };
    diff_drums?: number | null;
    diff_guitar?: number | null;
    diff_bass?: number | null;
    diff_vocals?: number | null;
    diff_keys?: number | null;
    diff_prokeys?: number | null;
    vocal_parts_authored?: string | null;
  };
}

export function parseRhythmverseData(
  songs: RhythmVerseSongEntry[],
): ProviderMusic[] {
  return songs.map((entry) => {
    const { data, file } = entry;
    // Prefer file data, fallback to data
    const name = decode(file.file_title || data.title);
    const artist = decode(file.file_artist || data.artist);
    const album = decode(file.file_album || data.album || "") || null;
    const genre = decode(file.file_genre || "") || null;
    const charter = decode(file.author?.name || "") || null;

    const downloadUrl = file.download_page_url_full;
    const coverUrl = `${RHYTHMVERSE_BASE_URL}${data.album_art}`;

    // Parse difficulties once to avoid duplicate function calls
    const drums =
      parseDifficulty(data.diff_drums) ?? parseDifficulty(file.diff_drums);
    const bass =
      parseDifficulty(data.diff_bass) ?? parseDifficulty(file.diff_bass);
    const guitar =
      parseDifficulty(data.diff_guitar) ?? parseDifficulty(file.diff_guitar);
    const keys =
      parseDifficulty(data.diff_prokeys) ??
      parseDifficulty(data.diff_keys) ??
      parseDifficulty(file.diff_prokeys) ??
      parseDifficulty(data.diff_keys);
    const vocals =
      parseDifficulty(data.diff_vocals) ?? parseDifficulty(file.diff_vocals);
    const vocalParts =
      parseDifficulty(data.vocal_parts) ??
      parseDifficulty(file.vocal_parts_authored);

    return {
      name,
      artist,
      album,
      coverUrl,
      downloadUrls: [{ url: downloadUrl, source: "rhythmverse" }],
      sourceUpdatedAt: file.update_date ? new Date(file.update_date) : null,
      year: file.file_year || null,
      genre,
      charter,
      vocalParts,
      instruments: {
        drums,
        bass,
        guitar,
        keys,
        vocals,
      },
    };
  });
}

export async function fetchRhythmverse(
  page: number,
  pageSize: number,
  latestSourceUpdatedAt?: Date,
): Promise<{ songs: ProviderMusic[]; shouldStop: boolean }> {
  try {
    console.log(`Fetching RhythmVerse API page ${page} (size: ${pageSize})...`);

    const body = new URLSearchParams();
    body.append("instrument[]", "bass");
    body.append("instrument[]", "drums");
    body.append("instrument[]", "guitar");
    body.append("instrument[]", "vocals");
    body.append("sort[0][sort_by]", "update_date");
    body.append("sort[0][sort_order]", "DESC");
    body.append("data_type", "full");
    body.append("page", page.toString());
    body.append("records", pageSize.toString());

    const response = await fetchWithRetry(RHYTHMVERSE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RhythmVerse API: ${response.status}`);
    }

    const json = (await response.json()) as RhythmVerseResponse;

    if (json.status !== "success") {
      throw new Error(`RhythmVerse API returned status: ${json.status}`);
    }
    if (!json.data?.songs || !Array.isArray(json.data.songs)) {
      throw new Error(
        `RhythmVerse API returned unexpected songs type: ${typeof json.data?.songs}`,
      );
    }

    const { songs } = json.data;
    const results = parseRhythmverseData(songs);

    // Check if we should stop fetching based on sourceUpdatedAt
    let shouldStop = false;
    if (latestSourceUpdatedAt) {
      const oldestSongInPage = results[results.length - 1];
      if (oldestSongInPage && oldestSongInPage.sourceUpdatedAt) {
        console.log(
          "Checking if should stop for page",
          page,
          "oldestSongInPage",
          oldestSongInPage.sourceUpdatedAt.toISOString(),
          "latestSourceUpdatedAt",
          latestSourceUpdatedAt.toISOString(),
          "shouldStop",
          oldestSongInPage.sourceUpdatedAt <= latestSourceUpdatedAt,
        );
        shouldStop = oldestSongInPage.sourceUpdatedAt <= latestSourceUpdatedAt;
      }
    }

    console.log(
      `Fetched ${results.length} songs from RhythmVerse API page ${page}, shouldStop: ${shouldStop}`,
    );

    return { songs: results, shouldStop };
  } catch (error) {
    console.error("Error fetching RhythmVerse API:", error);
    throw error;
  }
}

function parseDifficulty(
  diff: string | null | number | undefined,
): number | null {
  // Return a number [1-7] or null
  if (diff === null || diff === undefined) return null;
  if (typeof diff === "number") return diff === -1 || diff === 0 ? null : diff;
  const parsed = parseInt(diff, 10);
  return isNaN(parsed) || parsed === -1 || parsed === 0 ? null : parsed;
}
