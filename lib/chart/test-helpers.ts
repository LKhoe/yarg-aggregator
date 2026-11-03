import type { ChartData } from "./types";

/** A chart with no tracks, 192 ticks per beat, and the given tempo events. */
export function emptyChart(syncTrack: Partial<ChartData["syncTrack"]> = {}): ChartData {
  return {
    metadata: { name: "Test", artist: "Band", album: "", year: "", charter: "", resolution: 192, offset: 0, genre: "" },
    syncTrack: { bpmEvents: [], timeSignatures: [], ...syncTrack },
    events: [],
    sections: [],
    lyrics: [],
    tracks: {},
  };
}
