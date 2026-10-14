import type { ProviderMusic } from "@/types";
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

const ENCHOR_BASE_URL = "https://www.enchor.us";
const ENCHOR_API_URL = "https://api.enchor.us/search/advanced";
const ENCHOR_FILES_URL = "https://files.enchor.us";

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

function difficulty(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  return parsed === null || parsed === -1 ? null : parsed;
}

export function parseEnchorSong(song: EnchorSong): ProviderMusic {
  if (!song || typeof song !== "object") throw new EntryError("Not an object");
  const name = requireText(song.name, "name");
  const artist = requireText(song.artist, "artist");
  const md5 = requireText(song.md5, "md5 (download id)");
  const charter = optionalText(song.charter);
  const drivePath = optionalText(song.drivePath) ?? name;
  const albumArtMd5 = optionalText(song.albumArtMd5);

  const downloadUrl = `${ENCHOR_BASE_URL}/download?md5=${md5}&isSng=false&downloadNovideoVersion=false&filename=${drivePath} (${charter ?? ""})`;
  const year = Number.parseInt(String(song.year ?? ""), 10);

  return {
    name,
    artist,
    album: optionalText(song.album),
    coverUrl: albumArtMd5 ? `${ENCHOR_FILES_URL}/${albumArtMd5}.jpg` : "",
    downloadUrls: [{ url: downloadUrl, source: "enchor" }],
    sourceUpdatedAt: parseDate(song.modifiedTime),
    year: Number.isNaN(year) ? null : year,
    genre: optionalText(song.genre),
    charter,
    vocalParts: null,
    instruments: {
      drums: difficulty(song.diff_drums),
      bass: difficulty(song.diff_bass),
      guitar: difficulty(song.diff_guitar),
      keys: difficulty(song.diff_keys),
      vocals: difficulty(song.diff_vocals),
    },
  };
}

const describeEnchorSong = (song: EnchorSong) => ({
  title: optionalText(song?.name) ?? undefined,
  artist: optionalText(song?.artist) ?? undefined,
});

/** Lenient bulk parse (ZIP upload): entries that cannot be parsed are skipped */
export function parseEnchorData(songs: EnchorSong[]): ProviderMusic[] {
  return parseEntries(songs, parseEnchorSong, describeEnchorSong).items;
}

function requestBody(page: number, pageSize: number) {
  return {
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
    page,
    per_page: pageSize,
  };
}

export const enchorAdapter: ProviderAdapter = {
  source: "enchor",
  label: "Enchor.us",
  pageSize: 100,
  buildRequest(page) {
    return {
      url: ENCHOR_API_URL,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
        },
        body: JSON.stringify(requestBody(page, this.pageSize)),
      },
    };
  },
  parsePage(json) {
    const body = json as Partial<EnchorResponse> | null;
    if (!body || typeof body !== "object" || !Array.isArray(body.data)) {
      throw new InvalidResponseError(
        `Enchor returned an unexpected body (data: ${typeof body?.data})`,
      );
    }
    const { items, issues } = parseEntries(
      body.data,
      parseEnchorSong,
      describeEnchorSong,
    );
    return {
      items,
      issues,
      total: toFiniteNumber(body.found),
      rawCount: body.data.length,
    };
  },
};
