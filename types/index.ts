// Database Types
export interface IMusic {
  _id?: string;
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  downloadUrl: string;
  source: 'enchor' | 'rhythmverse';
  sourceUpdatedAt?: Date;
  instruments: {
    drums?: number;
    bass?: number;
    guitar?: number;
    prokeys?: number;
    vocals?: number;
  };
  genre?: string;
  year?: number;
  charter?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  _id?: string;
  deviceId: string;
  deviceName: string;
  collections: ICollection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICollection {
  _id?: string;
  name: string;
  musicIds: string[];
  createdAt: Date;
}

// API Types
export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'artist' | 'album' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  genre?: string;
  instrument?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  source?: 'enchor' | 'rhythmverse';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Provider Types
export interface ProviderJobStatus {
  id: string;
  source: 'enchor' | 'rhythmverse' | 'all';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: string[];
  startedAt?: Date;
  completedAt?: Date;
}

export interface ProviderMusic {
  name: string;
  artist: string;
  album: string;
  coverUrl: string;
  downloadUrl: string;
  sourceUpdatedAt?: Date;
  instruments: {
    drums?: number;
    bass?: number;
    guitar?: number;
    prokeys?: number;
    vocals?: number;
  };
  genre?: string;
  year?: number;
  charter?: string;
}

// Socket Types
export interface ShareCollectionPayload {
  fromDeviceId: string;
  toDeviceId: string;
  collection: ICollection;
}

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  socketId: string;
}
