import type { ProviderMusic } from "@/types";

const ENCHOR_BASE_URL = "https://www.enchor.us";
const ENCHOR_API_URL = "https://api.enchor.us/search/advanced";
const ENCHOR_FILES_URL = "https://files.enchor.us";

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
        `Enchor fetch attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

export interface EnchorResponse {
  found: number;
  out_of: number;
  page: number;
  data: EnchorSong[];
}

export interface EnchorSong {
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
  drivePath: string;
  modifiedTime: string; // "2018-06-10T23:15:40.717Z"
}

export function parseEnchorData(songs: EnchorSong[]): ProviderMusic[] {
  return songs.map((song) => {
    const downloadUrl = `${ENCHOR_BASE_URL}/download?md5=${song.md5}&isSng=false&downloadNovideoVersion=false&filename=${song.drivePath} (${song.charter})`;
    const coverUrl = `${ENCHOR_FILES_URL}/${song.albumArtMd5}.jpg`;
    const parsedYear = Number.isNaN(Number.parseInt(song.year, 10))
      ? null
      : Number.parseInt(song.year, 10);

    if (!song.modifiedTime) {
      console.log("Missing modifiedTime for song:", song.name, song.artist);
    }

    return {
      name: song.name,
      artist: song.artist,
      album: song.album || null,
      coverUrl: coverUrl,
      downloadUrls: [{ url: downloadUrl, source: "enchor" }],
      sourceUpdatedAt: song.modifiedTime ? new Date(song.modifiedTime) : null,
      year: parsedYear,
      genre: song.genre || null,
      charter: song.charter || null,
      vocalParts: null,
      instruments: {
        drums: song.diff_drums !== -1 ? song.diff_drums : null,
        bass: song.diff_bass !== -1 ? song.diff_bass : null,
        guitar: song.diff_guitar !== -1 ? song.diff_guitar : null,
        keys: song.diff_keys !== -1 ? song.diff_keys : null,
        vocals: song.diff_vocals !== -1 ? song.diff_vocals : null,
      },
    };
  });
}

export async function fetchEnchor(
  page: number,
  pageSize: number,
  latestSourceUpdatedAt?: Date,
): Promise<{ songs: ProviderMusic[]; shouldStop: boolean }> {
  try {
    console.log(`Fetching Enchor API page ${page} (size: ${pageSize})...`);

    const response = await fetchWithRetry(ENCHOR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
      },
      body: JSON.stringify({
        instrument: "bass",
        difficulty: null,
        drumType: null,
        drumsReviewed: false,
        sort: { type: "modifiedTime", direction: "desc" },
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
        per_page: pageSize,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Enchor API: ${response.status}`);
    }

    const json = (await response.json()) as EnchorResponse;
    const { data } = json;
    if (!Array.isArray(data)) {
      throw new Error(
        `Enchor API returned unexpected data type: ${typeof data}`,
      );
    }

    const results = parseEnchorData(data);

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
      } else {
        shouldStop = true;
        console.log(
          `Error on Enchor API page ${page}, missing oldestSongInPage`,
        );
      }
    }

    console.log(
      `Fetched ${results.length} songs from Enchor API page ${page}, shouldStop: ${shouldStop}`,
    );

    return { songs: results, shouldStop };
  } catch (error) {
    console.error("Error fetching Enchor API:", error);
    throw error;
  }
}
