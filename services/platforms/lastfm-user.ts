const LASTFM_API = "https://ws.audioscrobbler.com/2.0/";
const MAX_PAGES = 10; // cap at 10 pages to avoid huge imports

export interface LastfmTrack {
  title: string;
  artist: string;
}

export async function getLovedTracks(
  apiKey: string,
  username: string,
): Promise<LastfmTrack[]> {
  const tracks: LastfmTrack[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const params = new URLSearchParams({
      method: "user.getLovedTracks",
      user: username,
      api_key: apiKey,
      format: "json",
      limit: "50",
      page: String(page),
    });

    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) break;

    const data = await res.json();
    const lovedtracks = data.lovedtracks;
    if (!lovedtracks) break;

    const attr = lovedtracks["@attr"];
    totalPages = parseInt(attr?.totalPages ?? "1", 10);

    const trackList = lovedtracks.track;
    if (!trackList) break;

    const items = Array.isArray(trackList) ? trackList : [trackList];
    for (const t of items) {
      if (t.name && t.artist?.name) {
        tracks.push({ title: t.name, artist: t.artist.name });
      }
    }

    page++;
  }

  return tracks;
}

export async function getRecentTracks(
  apiKey: string,
  username: string,
): Promise<LastfmTrack[]> {
  const tracks: LastfmTrack[] = [];
  const seen = new Set<string>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const params = new URLSearchParams({
      method: "user.getRecentTracks",
      user: username,
      api_key: apiKey,
      format: "json",
      limit: "200",
      page: String(page),
    });

    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) break;

    const data = await res.json();
    const recenttracks = data.recenttracks;
    if (!recenttracks) break;

    const attr = recenttracks["@attr"];
    totalPages = parseInt(attr?.totalPages ?? "1", 10);

    const trackList = recenttracks.track;
    if (!trackList) break;

    const items = Array.isArray(trackList) ? trackList : [trackList];
    for (const t of items) {
      // Skip currently-playing entry (no date field)
      if (t["@attr"]?.nowplaying === "true") continue;

      const artist: string = t.artist?.["#text"] || t.artist?.name || "";
      const title: string = t.name || "";
      if (!title || !artist) continue;

      // Deduplicate: recent tracks can have the same song many times
      const key = `${title.toLowerCase()}|||${artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({ title, artist });
      }
    }

    page++;
  }

  return tracks;
}

export async function getPersonalTagTracks(
  apiKey: string,
  username: string,
  tag: string,
): Promise<LastfmTrack[]> {
  const tracks: LastfmTrack[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const params = new URLSearchParams({
      method: "user.getPersonalTags",
      user: username,
      tag,
      taggingtype: "track",
      api_key: apiKey,
      format: "json",
      limit: "50",
      page: String(page),
    });

    const res = await fetch(`${LASTFM_API}?${params}`);
    if (!res.ok) break;

    const data = await res.json();
    const taggings = data.taggings;
    if (!taggings) break;

    const attr = taggings["@attr"];
    totalPages = parseInt(attr?.totalPages ?? "1", 10);

    const trackList = taggings.tracks?.track;
    if (!trackList) break;

    const items = Array.isArray(trackList) ? trackList : [trackList];
    for (const t of items) {
      if (t.name && t.artist?.name) {
        tracks.push({ title: t.name, artist: t.artist.name });
      }
    }

    page++;
  }

  return tracks;
}
