import { describe, expect, it } from "vitest";
import {
  buildTempoMap,
  getBpmAtTick,
  getChartDurationTicks,
  secondsToTick,
  snapDivisionToTicks,
  snapToGrid,
  tickToSeconds,
} from "./tempo-utils";
import { emptyChart } from "./test-helpers";

const chart = emptyChart({
  bpmEvents: [
    { tick: 0, bpm: 120 },
    { tick: 768, bpm: 60 },
  ],
});

describe("tempo map", () => {
  const map = buildTempoMap(chart);

  it("converts ticks to seconds across a tempo change", () => {
    // 192 ticks per beat: 768 ticks = 4 beats at 120 BPM = 2s, then 1 beat at 60 BPM = 1s
    expect(tickToSeconds(0, map)).toBeCloseTo(0);
    expect(tickToSeconds(768, map)).toBeCloseTo(2);
    expect(tickToSeconds(960, map)).toBeCloseTo(3);
  });

  it("round-trips seconds and ticks", () => {
    for (const tick of [0, 100, 768, 1000, 5000]) {
      expect(secondsToTick(tickToSeconds(tick, map), map)).toBeCloseTo(tick);
    }
  });

  it("reports the BPM in effect at a tick", () => {
    expect(getBpmAtTick(0, map)).toBe(120);
    expect(getBpmAtTick(767, map)).toBe(120);
    expect(getBpmAtTick(768, map)).toBe(60);
  });
});

describe("grid", () => {
  it("converts a snap division to ticks", () => {
    expect(snapDivisionToTicks(192, 4)).toBe(192);
    expect(snapDivisionToTicks(192, 16)).toBe(48);
    expect(snapDivisionToTicks(1, 64)).toBe(1);
  });

  it("snaps to the nearest grid line", () => {
    expect(snapToGrid(100, 48)).toBe(96);
    expect(snapToGrid(121, 48)).toBe(144);
  });
});

describe("getChartDurationTicks", () => {
  it("adds a four-bar tail after the last note", () => {
    const c = emptyChart({ bpmEvents: [{ tick: 0, bpm: 120 }] });
    expect(getChartDurationTicks(c)).toBe(192 * 16);
    c.tracks.ExpertSingle = {
      difficulty: "Expert",
      instrument: "Single",
      notes: [{ id: "n1", tick: 1000, length: 200, lane: 0 }],
      phrases: [],
    } as never;
    expect(getChartDurationTicks(c)).toBe(1200 + 192 * 16);
  });
});
