"""
Phase 3a — MIDI Quantization
Snaps all note start times to the nearest grid division (default: 1/16 note)
using the detected BPM map from Phase 1b.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence

import numpy as np
import pretty_midi

from .config import MIDI_DIR, DEFAULT_SNAP, MIDI_RESOLUTION


def quantize_midi(
    midi_path: Path,
    beats_data: dict,
    snap: int = DEFAULT_SNAP,
) -> Path:
    """
    Load *midi_path*, snap every note to the nearest *snap* grid division,
    and write a new MIDI file with the suffix ``_quantized``.

    Args:
        midi_path:   Path to the raw MIDI file (output of Phase 2).
        beats_data:  Dict returned by phase1_beats.detect_beats().
        snap:        Divisions per beat: 4=quarter, 8=eighth, 16=sixteenth.

    Returns:
        Path to the quantized MIDI file.
    """
    midi_path = Path(midi_path)
    out_path = midi_path.with_stem(midi_path.stem.replace("_raw", "") + "_quantized")

    if out_path.exists():
        print(f"[quantize] Found existing: {out_path.name}, skipping.")
        return out_path

    beat_times = np.array([b["time_s"] for b in beats_data["beats"]], dtype=float)
    if len(beat_times) < 2:
        print(f"[quantize] Not enough beats to quantize; copying as-is.")
        import shutil
        shutil.copy(midi_path, out_path)
        return out_path

    pm = pretty_midi.PrettyMIDI()
    # Copy all tempo / time-sig changes from original
    src = pretty_midi.PrettyMIDI(str(midi_path))

    grid_step_s = _median_beat_len(beat_times) / snap

    for inst in src.instruments:
        new_inst = pretty_midi.Instrument(
            program=inst.program,
            is_drum=inst.is_drum,
            name=inst.name,
        )
        # Track (snapped_start, pitch) pairs to de-duplicate
        seen: set[tuple[float, int]] = set()

        for note in inst.notes:
            snapped_start = _snap_time(note.start, beat_times, snap)
            snapped_end = _snap_time(note.end, beat_times, snap)

            # If the note snapped to zero length, give it exactly one grid step
            if snapped_end <= snapped_start:
                snapped_end = snapped_start + grid_step_s

            # De-duplicate: skip notes that snapped to the same slot
            key = (snapped_start, note.pitch)
            if key in seen:
                continue
            seen.add(key)

            new_note = pretty_midi.Note(
                velocity=note.velocity,
                pitch=note.pitch,
                start=snapped_start,
                end=snapped_end,
            )
            new_inst.notes.append(new_note)

        new_inst.notes.sort(key=lambda n: n.start)
        pm.instruments.append(new_inst)

    # Set BPM from beats_data (use median for single-tempo estimate)
    if beats_data.get("bpm_events"):
        first_bpm = beats_data["bpm_events"][0]["bpm"]
    else:
        first_bpm = beats_data.get("estimated_bpm", 120.0)

    pm._tick_scales = [(0, 60.0 / first_bpm / MIDI_RESOLUTION)]

    pm.write(str(out_path))
    total_notes = sum(len(i.notes) for i in pm.instruments)
    print(f"[quantize] {total_notes} notes quantized to 1/{snap} → {out_path.name}")

    return out_path


def _median_beat_len(beat_times: np.ndarray) -> float:
    return float(np.median(np.diff(beat_times)))


def _snap_time(t: float, beat_times: np.ndarray, snap: int) -> float:
    """
    Snap time *t* (seconds) to the nearest 1/*snap* subdivision.

    Finds which beat *t* falls in, then snaps within that beat.
    """
    # Clamp to range
    if t <= beat_times[0]:
        return float(beat_times[0])
    if t >= beat_times[-1]:
        # Extrapolate last beat interval
        last_beat_len = float(beat_times[-1] - beat_times[-2])
        grid_step = last_beat_len / snap
        offset = t - float(beat_times[-1])
        return float(beat_times[-1]) + round(offset / grid_step) * grid_step

    # Find containing beat
    idx = int(np.searchsorted(beat_times, t, side="right")) - 1
    idx = max(0, min(idx, len(beat_times) - 2))

    beat_start = float(beat_times[idx])
    beat_end = float(beat_times[idx + 1])
    beat_len = beat_end - beat_start
    grid_step = beat_len / snap

    offset = t - beat_start
    snapped_offset = round(offset / grid_step) * grid_step
    return beat_start + snapped_offset
