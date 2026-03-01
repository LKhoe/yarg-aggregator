const SPOTIFY_API = "https://api.spotify.com/v1";

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
  owner: string;
}

export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  album: string;
}

interface SpotifyPaginatedResponse<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SpotifyPlaylistRaw {
  id: string;
  name: string;
  images: { url: string }[];
  items: { total: number };
  owner: { display_name: string };
}

interface SpotifyPlaylistTrackRaw {
  item: {
    name: string;
    artists: { name: string }[];
    album: { name: string };
  } | null;
}

interface SpotifySavedTrackRaw {
  track: {
    name: string;
    artists: { name: string }[];
    album: { name: string };
  } | null;
}

async function fetchWithAuth<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getUserPlaylists(
  accessToken: string,
): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let nextUrl: string | null = `${SPOTIFY_API}/me/playlists?limit=50`;

  while (nextUrl) {
    const data: SpotifyPaginatedResponse<SpotifyPlaylistRaw> =
      await fetchWithAuth(nextUrl, accessToken);

    for (const item of data.items) {
      playlists.push({
        id: item.id,
        name: item.name,
        imageUrl: item.images?.[0]?.url ?? null,
        trackCount: item.items.total,
        owner: item.owner.display_name,
      });
    }

    nextUrl = data.next;
  }

  return playlists;
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrackInfo[]> {
  const tracks: SpotifyTrackInfo[] = [];
  let nextUrl: string | null =
    `${SPOTIFY_API}/playlists/${playlistId}/items?limit=100&fields=items(item(name, artists(name), album(name)))`;

  while (nextUrl) {
    const data: SpotifyPaginatedResponse<SpotifyPlaylistTrackRaw> =
      await fetchWithAuth(nextUrl, accessToken);

    for (const item of data.items) {
      // Skip null tracks (local files)
      if (!item.item) continue;
      tracks.push({
        title: item.item.name,
        artist: item.item.artists[0].name,
        // Test the strategy bellow, to check which one is better on the matching
        // artist: item.item.artists.map((a) => a.name).join(", "),
        album: item.item.album.name,
      });
    }

    nextUrl = data.next;
  }

  return tracks;
}

export async function getLikedTracksCount(
  accessToken: string,
): Promise<number> {
  const data: SpotifyPaginatedResponse<SpotifySavedTrackRaw> =
    await fetchWithAuth(`${SPOTIFY_API}/me/tracks?limit=1`, accessToken);
  return data.total;
}

export async function getLikedTracks(
  accessToken: string,
): Promise<SpotifyTrackInfo[]> {
  const tracks: SpotifyTrackInfo[] = [];
  let nextUrl: string | null = `${SPOTIFY_API}/me/tracks?limit=50`;

  while (nextUrl) {
    const data: SpotifyPaginatedResponse<SpotifySavedTrackRaw> =
      await fetchWithAuth(nextUrl, accessToken);

    for (const item of data.items) {
      if (!item.track) continue;
      tracks.push({
        title: item.track.name,
        artist: item.track.artists[0].name,
        album: item.track.album.name,
      });
    }

    nextUrl = data.next;
  }

  return tracks;
}
