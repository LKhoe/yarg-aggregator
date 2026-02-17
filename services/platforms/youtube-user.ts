const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export interface YouTubePlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface YouTubeTrackInfo {
  title: string;
  artist: string;
}

interface YouTubePagedResponse<T> {
  items: T[];
  nextPageToken?: string;
  pageInfo: { totalResults: number };
}

interface YouTubePlaylistRaw {
  id: string;
  snippet: {
    title: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
  };
  contentDetails: {
    itemCount: number;
  };
}

interface YouTubePlaylistItemRaw {
  snippet: {
    title: string;
    videoOwnerChannelTitle?: string;
  };
}

async function fetchWithAuth<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function stripTopicSuffix(channelTitle: string): string {
  return channelTitle.replace(/ - Topic$/, "");
}

export async function getUserPlaylists(accessToken: string): Promise<YouTubePlaylist[]> {
  const playlists: YouTubePlaylist[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const data = await fetchWithAuth<YouTubePagedResponse<YouTubePlaylistRaw>>(
      `${YOUTUBE_API}/playlists?${params}`,
      accessToken,
    );

    for (const item of data.items) {
      playlists.push({
        id: item.id,
        name: item.snippet.title,
        imageUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? null,
        trackCount: item.contentDetails.itemCount,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return playlists;
}

export async function getPlaylistItems(accessToken: string, playlistId: string): Promise<YouTubeTrackInfo[]> {
  const tracks: YouTubeTrackInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const data = await fetchWithAuth<YouTubePagedResponse<YouTubePlaylistItemRaw>>(
      `${YOUTUBE_API}/playlistItems?${params}`,
      accessToken,
    );

    for (const item of data.items) {
      const title = item.snippet.title;
      const artist = item.snippet.videoOwnerChannelTitle
        ? stripTopicSuffix(item.snippet.videoOwnerChannelTitle)
        : "";

      // Skip deleted/private videos
      if (title === "Deleted video" || title === "Private video") continue;

      tracks.push({ title, artist });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return tracks;
}
