// Database Types
export interface IMusic {
  _id?: string;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  downloadUrl: string;
  source: "enchor" | "rhythmverse";
  sourceUpdatedAt?: Date;
  instruments: {
    drums?: number;
    bass?: number;
    guitar?: number;
    keys?: number;
    vocals?: number;
  };
  genre?: string;
  year?: number;
  charter?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// Provider Types
export interface ProviderJobStatus {
  id: string;
  source: "enchor" | "rhythmverse" | "all";
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}
