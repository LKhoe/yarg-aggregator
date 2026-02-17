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
  tracks: { total: number };
  owner: { display_name: string };
}

interface SpotifyPlaylistTrackRaw {
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

export async function getUserPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let nextUrl: string | null = `${SPOTIFY_API}/me/playlists?limit=50`;

  while (nextUrl) {
    const data: SpotifyPaginatedResponse<SpotifyPlaylistRaw> = await fetchWithAuth(nextUrl, accessToken);

    for (const item of data.items) {
      playlists.push({
        id: item.id,
        name: item.name,
        imageUrl: item.images?.[0]?.url ?? null,
        trackCount: item.tracks.total,
        owner: item.owner.display_name,
      });
    }

    nextUrl = data.next;
  }

  return playlists;
}

export async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyTrackInfo[]> {
  const tracks: SpotifyTrackInfo[] = [];
  let nextUrl: string | null = `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=100&fields=items(track(name,artists(name),album(name))),next`;

  while (nextUrl) {
    const data: SpotifyPaginatedResponse<SpotifyPlaylistTrackRaw> = await fetchWithAuth(nextUrl, accessToken);

    for (const item of data.items) {
      // Skip null tracks (local files)
      if (!item.track) continue;
      tracks.push({
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
        album: item.track.album.name,
      });
    }

    nextUrl = data.next;
  }

  return tracks;
}
