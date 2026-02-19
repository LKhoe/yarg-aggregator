const APPLE_MUSIC_API = "https://api.music.apple.com/v1";

export interface AppleMusicPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface AppleMusicTrackInfo {
  title: string;
  artist: string;
}

interface AppleMusicResponse<T> {
  data: T[];
  next?: string;
}

interface AppleMusicPlaylistRaw {
  id: string;
  attributes: {
    name: string;
    artwork?: { url: string; width: number; height: number };
    trackCount?: number;
  };
}

interface AppleMusicTrackRaw {
  id: string;
  type: string;
  attributes: {
    name: string;
    artistName: string;
  };
}

async function fetchWithAuth<T>(
  url: string,
  developerToken: string,
  musicUserToken: string,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      "Music-User-Token": musicUserToken,
    },
  });
  if (!response.ok) {
    throw new Error(`Apple Music API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getUserPlaylists(
  developerToken: string,
  musicUserToken: string,
): Promise<AppleMusicPlaylist[]> {
  const playlists: AppleMusicPlaylist[] = [];
  let offset = 0;
  const limit = 25;

  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const data = await fetchWithAuth<AppleMusicResponse<AppleMusicPlaylistRaw>>(
      `${APPLE_MUSIC_API}/me/library/playlists?${params}`,
      developerToken,
      musicUserToken,
    );

    for (const item of data.data) {
      let imageUrl: string | null = null;
      if (item.attributes.artwork?.url) {
        imageUrl = item.attributes.artwork.url
          .replace("{w}", "200")
          .replace("{h}", "200");
      }
      playlists.push({
        id: item.id,
        name: item.attributes.name,
        imageUrl,
        trackCount: item.attributes.trackCount ?? 0,
      });
    }

    if (!data.next || data.data.length < limit) break;
    offset += limit;
  }

  return playlists;
}

export async function getPlaylistTracks(
  developerToken: string,
  musicUserToken: string,
  playlistId: string,
): Promise<AppleMusicTrackInfo[]> {
  const tracks: AppleMusicTrackInfo[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const data = await fetchWithAuth<AppleMusicResponse<AppleMusicTrackRaw>>(
      `${APPLE_MUSIC_API}/me/library/playlists/${playlistId}/tracks?${params}`,
      developerToken,
      musicUserToken,
    );

    for (const item of data.data) {
      tracks.push({
        title: item.attributes.name,
        artist: item.attributes.artistName,
      });
    }

    if (!data.next || data.data.length < limit) break;
    offset += limit;
  }

  return tracks;
}
