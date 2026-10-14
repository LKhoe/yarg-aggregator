import type { ProviderMusic } from "@/types";
import { decode } from "he";
import { InvalidResponseError } from "./http";
import {
  EntryError,
  optionalText,
  parseDate,
  parseEntries,
  requireText,
  toFiniteNumber,
  type ProviderAdapter,
} from "./types";

const RHYTHMVERSE_BASE_URL = "https://rhythmverse.co";
const RHYTHMVERSE_API_URL = "https://rhythmverse.co/api/yarg/songfiles/list";

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

const text = (value: unknown) => {
  const raw = optionalText(value);
  return raw === null ? null : optionalText(decode(raw));
};

function coverUrl(albumArt: unknown) {
  const path = optionalText(albumArt);
  if (!path) return "";
  return /^https?:\/\//.test(path) ? path : `${RHYTHMVERSE_BASE_URL}${path}`;
}

export function parseRhythmverseSong(entry: RhythmVerseSongEntry): ProviderMusic {
  if (!entry || typeof entry !== "object") throw new EntryError("Not an object");
  const data = entry.data ?? ({} as RhythmVerseSongEntry["data"]);
  const file = entry.file;
  if (!file || typeof file !== "object") throw new EntryError("Missing file data");

  // Prefer file data, fallback to data
  const name = requireText(text(file.file_title) ?? text(data.title), "title");
  const artist = requireText(text(file.file_artist) ?? text(data.artist), "artist");
  const downloadUrl = requireText(file.download_page_url_full, "download link");

  const drums = parseDifficulty(data.diff_drums) ?? parseDifficulty(file.diff_drums);
  const bass = parseDifficulty(data.diff_bass) ?? parseDifficulty(file.diff_bass);
  const guitar =
    parseDifficulty(data.diff_guitar) ?? parseDifficulty(file.diff_guitar);
  const keys =
    parseDifficulty(data.diff_prokeys) ??
    parseDifficulty(data.diff_keys) ??
    parseDifficulty(file.diff_prokeys) ??
    parseDifficulty(file.diff_keys);
  const vocals =
    parseDifficulty(data.diff_vocals) ?? parseDifficulty(file.diff_vocals);
  const vocalParts =
    parseDifficulty(data.vocal_parts) ??
    parseDifficulty(file.vocal_parts_authored);

  return {
    name,
    artist,
    album: text(file.file_album) ?? text(data.album),
    coverUrl: coverUrl(data.album_art),
    downloadUrls: [{ url: downloadUrl, source: "rhythmverse" }],
    sourceUpdatedAt: parseDate(file.update_date) ?? parseDate(file.record_updated),
    year: toFiniteNumber(file.file_year) || null,
    genre: text(file.file_genre),
    charter: text(file.author?.name),
    vocalParts,
    instruments: { drums, bass, guitar, keys, vocals },
  };
}

const describeRhythmverseSong = (entry: RhythmVerseSongEntry) => ({
  title: optionalText(entry?.file?.file_title ?? entry?.data?.title) ?? undefined,
  artist:
    optionalText(entry?.file?.file_artist ?? entry?.data?.artist) ?? undefined,
});

/** Lenient bulk parse (ZIP upload): entries that cannot be parsed are skipped */
export function parseRhythmverseData(
  songs: RhythmVerseSongEntry[],
): ProviderMusic[] {
  return parseEntries(songs, parseRhythmverseSong, describeRhythmverseSong).items;
}

export const rhythmverseAdapter: ProviderAdapter = {
  source: "rhythmverse",
  label: "Rhythmverse",
  pageSize: 100,
  buildRequest(page) {
    const body = new URLSearchParams();
    body.append("instrument[]", "bass");
    body.append("instrument[]", "drums");
    body.append("instrument[]", "guitar");
    body.append("instrument[]", "vocals");
    body.append("sort[0][sort_by]", "update_date");
    body.append("sort[0][sort_order]", "DESC");
    body.append("data_type", "full");
    body.append("page", page.toString());
    body.append("records", this.pageSize.toString());

    return {
      url: RHYTHMVERSE_API_URL,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: body.toString(),
      },
    };
  },
  parsePage(json) {
    const body = json as Partial<RhythmVerseResponse> | null;
    if (!body || typeof body !== "object") {
      throw new InvalidResponseError("RhythmVerse returned an empty body");
    }
    if (body.status !== "success") {
      throw new InvalidResponseError(
        `RhythmVerse returned status: ${String(body.status)}`,
      );
    }
    const songs = body.data?.songs;
    if (!Array.isArray(songs)) {
      throw new InvalidResponseError(
        `RhythmVerse returned an unexpected songs type: ${typeof songs}`,
      );
    }
    const { items, issues } = parseEntries(
      songs,
      parseRhythmverseSong,
      describeRhythmverseSong,
    );
    return {
      items,
      issues,
      total: toFiniteNumber(body.data?.records?.total_filtered),
      rawCount: songs.length,
    };
  },
};

function parseDifficulty(
  diff: string | null | number | undefined,
): number | null {
  // Return a number [1-7] or null
  if (diff === null || diff === undefined) return null;
  if (typeof diff === "number") return diff === -1 || diff === 0 ? null : diff;
  const parsed = parseInt(diff, 10);
  return isNaN(parsed) || parsed === -1 || parsed === 0 ? null : parsed;
}
