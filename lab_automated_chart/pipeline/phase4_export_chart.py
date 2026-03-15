"""
Phase 4 — Export to .chart (Clone Hero format)
Assembles all processed MIDI tracks into a single .chart file
compatible with Clone Hero / YARG.

.chart format reference:
  https://github.com/TheNathannator/GuitarGame__ChartFormats/blob/main/doc/FileFormats/.chart/Core%20Infrastructure.md
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Sequence

import pretty_midi

from .config import CHART_DIR, CHART_RESOLUTION


# ── Instrument track names in .chart format ───────────────────────────────────
INSTRUMENT_SECTION = {
    "guitar":  "Single",
    "bass":    "DoubleBass",
    "drums":   "Drums",
    "vocals":  "Vocals",
    "keys":    "Keyboard",
}

DIFFICULTY_ORDER = ["Expert", "Hard", "Medium", "Easy"]


def export_chart(
    song_name: str,
    artist: str,
    bpm_events: list[dict],
    midi_files: dict[str, Path],
    output_dir: Path | None = None,
    lyrics: list[dict] | None = None,
) -> Path:
    """
    Build a .chart file from the processed MIDI tracks.

    Args:
        song_name:   Song title string.
        artist:      Artist name string.
        bpm_events:  List of {"time_s": float, "bpm": float} from phase1_beats.
        midi_files:  Dict mapping instrument label → lane-mapped MIDI Path.
                     e.g. {"guitar": Path("..."), "drums": Path("...")}
        output_dir:  Where to write the .chart. Defaults to CHART_DIR.
        lyrics:      Optional list of {"time_s": float, "end_s": float, "text": str}
                     phrase dicts to emit as lyric events in [Events].

    Returns:
        Path to the written .chart file.
    """
    output_dir = Path(output_dir or CHART_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in song_name)
    chart_path = output_dir / f"{safe_name}.chart"

    lines: list[str] = []

    # ── [Song] metadata ───────────────────────────────────────────────────────
    lines += [
        "[Song]",
        "{",
        f'  Name = "{song_name}"',
        f'  Artist = "{artist}"',
        f"  Resolution = {CHART_RESOLUTION}",
        f'  Charter = "AutoChart"',
        f'  Offset = 0',
        f'  Player2 = bass',
        f'  Difficulty = 0',
        f'  PreviewStart = 0',
        f'  PreviewEnd = 0',
        f'  Genre = "rock"',
        f'  MediaType = "cd"',
        "}",
        "",
    ]

    # ── [SyncTrack] BPM events ────────────────────────────────────────────────
    lines += ["[SyncTrack]", "{"]

    # Always start with a 4/4 time signature at tick 0
    lines.append(f"  0 = TS 4")

    if not bpm_events:
        lines.append(f"  0 = B 120000")  # 120 BPM fallback
    else:
        # Always emit the first BPM at tick 0, then the rest at their positions
        first_bpm_milli = int(round(bpm_events[0]["bpm"] * 1000))
        lines.append(f"  0 = B {first_bpm_milli}")
        for ev in bpm_events[1:]:
            tick = _seconds_to_tick(ev["time_s"], bpm_events)
            if tick == 0:
                continue  # already emitted at 0
            bpm_milli = int(round(ev["bpm"] * 1000))
            lines.append(f"  {tick} = B {bpm_milli}")

    lines += ["}", ""]

    # ── [Events] practice sections + lyrics (sorted by tick) ─────────────────
    events: list[tuple[int, str]] = []

    section_ticks = _generate_practice_sections(bpm_events, interval_s=30.0)
    for i, tick in enumerate(section_ticks):
        label = "Intro" if i == 0 else f"Section_{i}"
        events.append((tick, f'"section {label}"'))

    if lyrics:
        for phrase in lyrics:
            tick_start = _seconds_to_tick(phrase["time_s"], bpm_events)
            tick_end = _seconds_to_tick(phrase["end_s"], bpm_events)
            text = phrase["text"].replace('"', '\\"')
            events.append((tick_start, '"phrase_start"'))
            events.append((tick_start, f'"lyric {text}"'))
            events.append((tick_end, '"phrase_end"'))
        print(f"[export] Added {len(lyrics)} lyric phrases")

    lines += ["[Events]", "{"]
    for tick, payload in sorted(events, key=lambda x: x[0]):
        lines.append(f"  {tick} = E {payload}")
    lines += ["}", ""]

    # ── Instrument tracks ─────────────────────────────────────────────────────
    for label, midi_path in midi_files.items():
        section_name = INSTRUMENT_SECTION.get(label, label)
        is_vocals = (label == "vocals")
        notes = _load_notes_from_midi(midi_path, bpm_events, preserve_pitch=is_vocals)

        if not notes:
            print(f"[export] No notes for {label}, skipping track.")
            continue

        # Write Expert difficulty only (the chart editor handles reduction)
        difficulty = "Expert"
        lines += [f"[{difficulty}{section_name}]", "{"]

        for tick, fret, length in notes:
            lines.append(f"  {tick} = N {fret} {length}")

        # Star power every ~8 measures
        all_ticks = [t for t, _, _ in notes]
        if all_ticks:
            sp_interval = CHART_RESOLUTION * 4 * 8  # 8 measures
            sp_len = CHART_RESOLUTION * 4            # 1 measure
            tick = all_ticks[0] + sp_interval
            while tick + sp_len < all_ticks[-1]:
                lines.append(f"  {tick} = S 2 {sp_len}")
                tick += sp_interval

        lines += ["}", ""]

    chart_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[export] Chart written to {chart_path}")
    return chart_path


def _load_notes_from_midi(
    midi_path: Path,
    bpm_events: list[dict],
    preserve_pitch: bool = False,
) -> list[tuple[int, int, int]]:
    """
    Read a lane-mapped MIDI file and return a list of (tick, pitch, length) tuples.

    Args:
        preserve_pitch: When True (vocals), keep the raw MIDI pitch (36–83)
                        instead of clamping to the 5-lane range (0–4).
    """
    try:
        pm = pretty_midi.PrettyMIDI(str(midi_path))
    except Exception as e:
        print(f"[export] Failed to load {midi_path}: {e}")
        return []

    # Minimum sustain: 1/32 note = CHART_RESOLUTION // 8.
    # Notes shorter than this are written as non-sustained (length = 0).
    min_sustain = CHART_RESOLUTION // 8

    seen: set[tuple[int, int]] = set()  # (tick, pitch) de-dup
    notes: list[tuple[int, int, int]] = []
    for inst in pm.instruments:
        for note in inst.notes:
            tick_start = _seconds_to_tick(note.start, bpm_events)
            tick_end = _seconds_to_tick(note.end, bpm_events)
            length = max(0, tick_end - tick_start)
            # Clamp short sustains to 0 (strum note, no tail)
            if length < min_sustain:
                length = 0
            if preserve_pitch:
                # Vocal highway: real MIDI pitch, clamped to C1–B4 (36–83)
                pitch = max(36, min(83, int(note.pitch)))
            else:
                # Instrument highway: 5-lane fret index (0–4)
                pitch = max(0, min(4, int(note.pitch)))
            key = (tick_start, pitch)
            if key in seen:
                continue
            seen.add(key)
            notes.append((tick_start, pitch, length))

    notes.sort(key=lambda x: x[0])
    return notes


def _seconds_to_tick(
    time_s: float,
    bpm_events: list[dict],
    resolution: int = CHART_RESOLUTION,
) -> int:
    """
    Convert absolute time in seconds to chart ticks using the BPM event list.
    """
    if not bpm_events:
        return int(round(time_s * 2.0 * resolution))  # assume 120 BPM

    tick = 0.0
    prev_time = 0.0
    prev_bpm = bpm_events[0]["bpm"]

    for ev in bpm_events[1:]:
        ev_time = ev["time_s"]
        if time_s <= ev_time:
            break
        elapsed = ev_time - prev_time
        tick += elapsed * (prev_bpm / 60.0) * resolution
        prev_time = ev_time
        prev_bpm = ev["bpm"]

    # Remaining time after last event
    elapsed = time_s - prev_time
    tick += elapsed * (prev_bpm / 60.0) * resolution

    return max(0, int(round(tick)))


def _generate_practice_sections(
    bpm_events: list[dict],
    interval_s: float = 30.0,
) -> list[int]:
    """
    Generate practice section ticks at regular time intervals.
    Always includes tick 0 (Intro). Additional sections every *interval_s* seconds.
    """
    ticks = [0]
    if not bpm_events:
        return ticks

    # Estimate max song time from last BPM event + generous buffer
    last_event_time = bpm_events[-1]["time_s"] if bpm_events else 0
    max_time = last_event_time + 120.0  # extend 2 min past last BPM event
    t = interval_s
    while t < max_time:
        tick = _seconds_to_tick(t, bpm_events)
        if tick > 0:
            ticks.append(tick)
        t += interval_s

    return ticks
