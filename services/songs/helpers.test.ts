import { describe, expect, it, vi } from "vitest";

// helpers.ts also holds the database queries; only the pure functions are exercised here.
vi.mock("@/lib/db", () => ({ db: {} }));

import type { ProviderMusic } from "@/types";
import {
  deduplicateSongs,
  getInstrumentCountFromDBSong,
  getInstrumentCountFromProviderMusic,
  normalizeProviderSongs,
  normalizedSongKey,
  normalizeText,
} from "./helpers";

describe("normalizeText", () => {
  it("drops accents, case, punctuation and bracketed text", () => {
    expect(normalizeText("Café  Tacvba!")).toBe("cafe tacvba");
    expect(normalizeText("Song (Remastered) [2011]")).toBe("song");
  });

  it("drops featured artists and version suffixes", () => {
    expect(normalizeText("Hello feat. Someone")).toBe("hello");
    expect(normalizeText("Hello - Radio Edit")).toBe("hello");
  });

  it("treats & as 'and'", () => {
    expect(normalizeText("Simon & Garfunkel")).toBe("simon and garfunkel");
  });
});

describe("normalizedSongKey", () => {
  it("is the same for the same song written differently", () => {
    expect(normalizedSongKey("Hello (Live)", "ADELE")).toBe(normalizedSongKey("hello", "Adele"));
  });
});

describe("deduplicateSongs", () => {
  const song = (over: Partial<ProviderMusic>) =>
    ({ name: "Hello", artist: "Adele", instruments: {}, ...over }) as ProviderMusic;
  const dedupe = (songs: ProviderMusic[]) => deduplicateSongs(normalizeProviderSongs(songs));

  it("keeps one entry per normalized title and artist", () => {
    expect(dedupe([song({}), song({ name: "HELLO" }), song({ name: "Other" })])).toHaveLength(2);
  });

  it("prefers the version with more instruments", () => {
    const [kept] = dedupe([
      song({ instruments: { guitar: 3 }, charter: "a" } as never),
      song({ instruments: { guitar: 3, drums: 4 }, charter: "b" } as never),
    ]);
    expect((kept as unknown as { charter: string }).charter).toBe("b");
  });

  it("breaks instrument ties with the version that has more metadata", () => {
    const [kept] = dedupe([
      song({ instruments: { guitar: 3 }, album: "", charter: "a" } as never),
      song({ instruments: { guitar: 3 }, album: "25", genre: "Pop", charter: "b" } as never),
    ]);
    expect((kept as unknown as { charter: string }).charter).toBe("b");
  });
});

describe("instrument counts", () => {
  it("counts the instruments present on a provider entry", () => {
    expect(getInstrumentCountFromProviderMusic({ guitar: 1, bass: null, drums: 2 } as never)).toBe(2);
  });

  it("counts the instruments with a difficulty on a stored song", () => {
    const base = { diffGuitar: null, diffBass: null, diffDrums: null, diffKeys: null, diffVocals: null };
    expect(getInstrumentCountFromDBSong({ ...base, diffGuitar: 3, diffVocals: 0 })).toBe(2);
  });
});
