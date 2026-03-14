"""
Phase 3b — Pitch → 5-Lane Mapping
Converts absolute MIDI pitches from the guitar/bass/keys tracks to
Rock Band 5-lane fret numbers (0=Green … 4=Orange).

Also handles drum MIDI → RB pad remapping using GM note numbers.

Vocal notes are NOT lane-mapped — they keep their real MIDI pitch
(C1=36 to B4=83) since the .chart vocal highway uses pitch for note height.
"""
from __future__ import annotations

from pathlib import Path

import pretty_midi

from .config import MIDI_DIR, PITCH_CLASS_TO_LANE, DRUM_NOTE_TO_PAD


def map_guitar_to_lanes(midi_path: Path, instrument_label: str = "guitar") -> Path:
    """
    Read a melodic MIDI file, map each note's pitch class to a 5-lane fret,
    and write a new MIDI file where note pitch encodes the lane (0-4).

    The resulting MIDI uses:
        pitch 0 = Green  (fret 0)
        pitch 1 = Red    (fret 1)
        pitch 2 = Yellow (fret 2)
        pitch 3 = Blue   (fret 3)
        pitch 4 = Orange (fret 4)

    Args:
        midi_path:         Raw or quantized MIDI from Basic Pitch.
        instrument_label:  "guitar" or "bass" — used for output filename.

    Returns:
        Path to the lane-mapped MIDI file.
    """
    midi_path = Path(midi_path)
    out_path = midi_path.with_stem(
        midi_path.stem.replace("_quantized", "") + f"_{instrument_label}_lanes"
    )

    if out_path.exists():
        print(f"[lanes] Found existing: {out_path.name}, skipping.")
        return out_path

    src = pretty_midi.PrettyMIDI(str(midi_path))
    pm = pretty_midi.PrettyMIDI()

    for inst in src.instruments:
        if inst.is_drum:
            continue
        new_inst = pretty_midi.Instrument(
            program=inst.program,
            is_drum=False,
            name=f"Guitar_{instrument_label}",
        )
        for note in inst.notes:
            pitch_class = note.pitch % 12
            lane = PITCH_CLASS_TO_LANE.get(pitch_class, note.pitch % 5)
            mapped = pretty_midi.Note(
                velocity=note.velocity,
                pitch=lane,         # 0-4 = Green/Red/Yellow/Blue/Orange
                start=note.start,
                end=note.end,
            )
            new_inst.notes.append(mapped)
        pm.instruments.append(new_inst)

    pm.write(str(out_path))
    total = sum(len(i.notes) for i in pm.instruments)
    print(f"[lanes] {total} notes mapped to 5 lanes → {out_path.name}")
    return out_path


def map_drums_to_pads(midi_path: Path) -> Path:
    """
    Remap GM drum MIDI notes to Rock Band pad numbers (0-4).

    Input:  standard GM drum MIDI (e.g. note 36 = kick)
    Output: MIDI where note pitch = RB pad index (0=kick … 4=crash/green)
    """
    midi_path = Path(midi_path)
    out_path = midi_path.with_stem(
        midi_path.stem.replace("_quantized", "").replace("_raw", "") + "_drums_lanes"
    )

    if out_path.exists():
        print(f"[lanes] Found existing drum lanes: {out_path.name}, skipping.")
        return out_path

    src = pretty_midi.PrettyMIDI(str(midi_path))
    pm = pretty_midi.PrettyMIDI()

    drum_inst = pretty_midi.Instrument(program=0, is_drum=True, name="Drums_RB")

    skipped = 0
    for inst in src.instruments:
        for note in inst.notes:
            rb_pad = DRUM_NOTE_TO_PAD.get(note.pitch)
            if rb_pad is None:
                skipped += 1
                continue
            drum_inst.notes.append(pretty_midi.Note(
                velocity=note.velocity,
                pitch=rb_pad,
                start=note.start,
                end=note.end,
            ))

    drum_inst.notes.sort(key=lambda n: n.start)
    pm.instruments.append(drum_inst)
    pm.write(str(out_path))

    total = len(drum_inst.notes)
    print(f"[lanes] {total} drum hits mapped to RB pads (skipped {skipped}) → {out_path.name}")
    return out_path


# ── Vocal pitch passthrough ───────────────────────────────────────────────────

# Authoring range: C1 (36) to B4 (83).
# Note 84 (C5) is excluded — it does not display correctly in Blitz mode.
VOCAL_PITCH_MIN = 36   # C1
VOCAL_PITCH_MAX = 83   # B4


def map_vocals_pitch(midi_path: Path) -> Path:
    """
    Clamp vocal MIDI pitches to the valid authoring range (C1=36 … B4=83)
    without re-mapping to 5-lane numbers.

    The .chart vocal highway uses real MIDI pitch values for note height,
    so this function is a passthrough with range clamping only.

    Returns a new MIDI file with the suffix ``_vocals_lanes``.
    """
    midi_path = Path(midi_path)
    out_path = midi_path.with_stem(
        midi_path.stem.replace("_quantized", "").replace("_raw", "") + "_vocals_lanes"
    )

    if out_path.exists():
        print(f"[lanes] Found existing vocal lanes: {out_path.name}, skipping.")
        return out_path

    src = pretty_midi.PrettyMIDI(str(midi_path))
    pm = pretty_midi.PrettyMIDI()

    vocal_inst = pretty_midi.Instrument(program=52, is_drum=False, name="Vocals")

    kept = 0
    for inst in src.instruments:
        for note in inst.notes:
            clamped = max(VOCAL_PITCH_MIN, min(VOCAL_PITCH_MAX, note.pitch))
            vocal_inst.notes.append(pretty_midi.Note(
                velocity=note.velocity,
                pitch=clamped,
                start=note.start,
                end=note.end,
            ))
            kept += 1

    vocal_inst.notes.sort(key=lambda n: n.start)
    pm.instruments.append(vocal_inst)
    pm.write(str(out_path))
    print(f"[lanes] {kept} vocal notes clamped to MIDI {VOCAL_PITCH_MIN}–{VOCAL_PITCH_MAX} → {out_path.name}")
    return out_path
