import { describe, expect, it } from "vitest";
import { parseChart } from "./parser-chart";
import { serializeChart } from "./serializer-chart";

const SAMPLE = `[Song]
{
  Name = "Test Song"
  Artist = "Test Band"
  Resolution = 192
}
[SyncTrack]
{
  0 = TS 4
  0 = B 120000
  768 = B 90000
}
[Events]
{
  0 = E "section Intro"
}
[ExpertSingle]
{
  192 = N 0 0
  384 = N 1 96
  384 = N 2 0
}
`;

describe(".chart parsing", () => {
  const chart = parseChart(SAMPLE);

  it("reads the metadata", () => {
    expect(chart.metadata.name).toBe("Test Song");
    expect(chart.metadata.artist).toBe("Test Band");
    expect(chart.metadata.resolution).toBe(192);
  });

  it("reads the tempo track", () => {
    expect(chart.syncTrack.bpmEvents.map((e) => [e.tick, e.bpm])).toEqual([
      [0, 120],
      [768, 90],
    ]);
  });

  it("reads the notes of a track", () => {
    const notes = chart.tracks.ExpertSingle?.notes ?? [];
    expect(notes.map((n) => [n.tick, n.length])).toEqual([
      [192, 0],
      [384, 96],
      [384, 0],
    ]);
  });
});

describe(".chart serialization", () => {
  it("survives a parse → serialize → parse round trip", () => {
    const once = parseChart(SAMPLE);
    const twice = parseChart(serializeChart(once));
    const strip = (c: typeof once) => ({
      metadata: c.metadata,
      bpm: c.syncTrack.bpmEvents.map((e) => [e.tick, e.bpm]),
      notes: (c.tracks.ExpertSingle?.notes ?? []).map((n) => [n.tick, n.length]),
    });
    expect(strip(twice)).toEqual(strip(once));
  });
});
