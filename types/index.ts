// Database Types
export interface IProvider {
  _id?: string;
  name: "enchor" | "rhythmverse";
  lastSuccessfulFetch?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DownloadLink {
  url: string;
  source: string;
}

export interface ProviderMusic {
  id?: string;
  name: string;
  artist: string;
  coverUrl: string;
  downloadUrls: DownloadLink[];
  sourceUpdatedAt: Date | null;
  instruments: {
    drums: number | null;
    bass: number | null;
    guitar: number | null;
    keys: number | null;
    vocals: number | null;
  };
  vocalParts: number | null;
  album: string | null;
  genre: string | null;
  year: number | null;
  charter: string | null;
  installed?: boolean; // Per-installation installed status
  favorited?: boolean; // Whether the song is in the user's favorites
}

// API Types
export interface SearchParams {
  query: string;
  limit: number;
  sortBy: "name" | "artist" | "album" | "createdAt" | "relevance";
  sortOrder: "asc" | "desc";
  genre: string;
  instruments: string[];
  source: "" | "enchor" | "rhythmverse";
  cursor: string | null; // For cursor-based pagination
  installationId?: string | null; // For filtering by installation's installed songs
  installed?: boolean; // For filtering by installed status (true = only installed)
  artist?: string;
  album?: string;
  charter?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null; // Next cursor for infinite scroll
  hasMore: boolean; // Whether there are more items
}

// Platform Types
export type MusicPlatform = "deezer" | "spotify" | "youtube" | "soundcloud";

export interface PlatformLink {
  platform: MusicPlatform;
  url: string;
  previewUrl: string | null;
  videoId: string | null;
}

// Provider fetch runs
export type ProviderSource = "enchor" | "rhythmverse";

export type FetchRunMode = "incremental" | "full";

export type FetchRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled"
  | "interrupted";

export type FetchRunPhase =
  | "queued"
  | "fetching"
  | "retrying_gaps"
  | "finalizing"
  | "done";

/**
 * A stretch of the source listing we could not fetch. Pages shift while a
 * source is updated, so a gap is re-fetched by its timestamp bounds (newest
 * item before it / oldest item after it), not just by its page number.
 */
export interface FetchGap {
  page: number;
  /** sourceUpdatedAt of the last item before the gap (null = top of the list) */
  upperTs: string | null;
  /** sourceUpdatedAt of the first item after the gap (null = unknown / end of the list) */
  lowerTs: string | null;
  attempts: number;
  error: string;
  /** The not-yet-fetched rest of the pass in progress (becomes a real gap if the run stops) */
  pending?: boolean;
}

/** An entry the source returned that could not be turned into a song */
export interface FetchParseIssue {
  page: number;
  index: number;
  reason: string;
  title?: string;
  artist?: string;
}

/** Per-page state, one char per page in FetchRunSnapshot.pageMap */
export type FetchPageState =
  | "."  // pending
  | "d"  // done
  | "f"  // failed (gap)
  | "r"  // recovered by a gap retry
  | "s"; // skipped (beyond the incremental cutoff)

export type FetchLogCode =
  | "run_started"
  | "page_ok"
  | "page_issues"
  | "page_retry"
  | "rate_limited"
  | "page_failed"
  | "processing_failed"
  | "source_shrank"
  | "circuit_open"
  | "resumed"
  | "gap_retry"
  | "gap_recovered"
  | "gap_still_failing"
  | "cancelled"
  | "run_finished";

export interface FetchLogEntry {
  at: string;
  level: "info" | "warn" | "error";
  code: FetchLogCode;
  params?: Record<string, string | number>;
}

export interface FetchWaitState {
  reason: "rate_limit" | "retry" | "cooldown";
  until: string;
  page: number | null;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
}

export interface FetchSongDetail {
  artist: string;
  title: string;
}

/** Live state of a provider fetch run, published over SSE and cached in Redis */
export interface FetchRunSnapshot {
  runId: string;
  source: ProviderSource;
  mode: FetchRunMode;
  status: FetchRunStatus;
  phase: FetchRunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  cutoff: string | null;
  currentPage: number | null;
  totalPages: number | null;
  pageMap: string;
  songsFetched: number;
  stats: { added: number; updated: number; ignored: number };
  parseIssues: number;
  gaps: FetchGap[];
  wait: FetchWaitState | null;
  paceMs: number;
  log: FetchLogEntry[];
  error: string | null;
  /** Only on finished runs: songs the source now has in the library */
  songCount?: number;
  /** Only on finished runs; lists are capped */
  details?: {
    added: FetchSongDetail[];
    updated: FetchSongDetail[];
    ignored: Record<string, FetchSongDetail[]>;
    issues: FetchParseIssue[];
    truncated: boolean;
  };
}

export interface FetchRunSummary {
  id: string;
  source: ProviderSource;
  mode: FetchRunMode;
  status: FetchRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  songsFetched: number;
  added: number;
  updated: number;
  ignored: number;
  parseIssues: number;
  failedPages: number;
  error: string | null;
}
