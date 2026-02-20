const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

export interface YouTubePublicTrackInfo {
  title: string;
  artist: string;
}

interface YouTubePagedResponse<T> {
  items: T[];
  nextPageToken?: string;
}

interface YouTubePlaylistItemRaw {
  snippet: {
    title: string;
    videoOwnerChannelTitle?: string;
  };
}

interface YouTubePlaylistMetaRaw {
  items: {
    snippet: { title: string };
  }[];
}

function stripTopicSuffix(channelTitle: string): string {
  return channelTitle.replace(/ - Topic$/, "");
}

export function parseYouTubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "music.youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      return parsed.searchParams.get("list");
    }
  } catch {
    // Invalid URL
  }
  return null;
}

export async function getPublicPlaylistTracks(
  url: string,
  apiKey: string,
): Promise<{ tracks: YouTubePublicTrackInfo[]; playlistName: string }> {
  const playlistId = parseYouTubePlaylistId(url);
  if (!playlistId) {
    throw new Error("Invalid YouTube playlist URL");
  }

  // Fetch playlist metadata for the name
  const metaParams = new URLSearchParams({
    part: "snippet",
    id: playlistId,
    key: apiKey,
  });
  const metaResponse = await fetch(`${YOUTUBE_API}/playlists?${metaParams}`);
  if (!metaResponse.ok) {
    throw new Error(`YouTube API error: ${metaResponse.status}`);
  }
  const meta = (await metaResponse.json()) as YouTubePlaylistMetaRaw;
  const playlistName = meta.items?.[0]?.snippet?.title ?? "YouTube Playlist";

  // Paginate playlist items
  const tracks: YouTubePublicTrackInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const response = await fetch(`${YOUTUBE_API}/playlistItems?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }
    const data = (await response.json()) as YouTubePagedResponse<YouTubePlaylistItemRaw>;

    for (const item of data.items) {
      const title = item.snippet.title;

      // Skip deleted/private videos
      if (title === "Deleted video" || title === "Private video") continue;

      const artist = item.snippet.videoOwnerChannelTitle
        ? stripTopicSuffix(item.snippet.videoOwnerChannelTitle)
        : "";

      tracks.push({ title, artist });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { tracks, playlistName };
}
