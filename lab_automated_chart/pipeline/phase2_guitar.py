"""
Phase 2a — Guitar / Bass Pitch Detection
Uses Spotify's Basic Pitch to transcribe the guitar and bass stems to MIDI.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .config import (
    BASIC_PITCH_CONFIDENCE,
    BASIC_PITCH_MIN_FREQ,
    BASIC_PITCH_MAX_FREQ,
    BASIC_PITCH_MIN_NOTE_LEN,
    MIDI_DIR,
)


def transcribe_instrument(audio_path: Path, instrument_label: str) -> Path:
    """
    Run Basic Pitch on *audio_path* and write a MIDI file.

    Args:
        audio_path:        Path to the stem wav (e.g. guitar.wav).
        instrument_label:  Label used in output filename (e.g. "guitar", "bass").

    Returns:
        Path to the generated MIDI file.
    """
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH
    except ImportError as e:
        raise ImportError("basic-pitch not installed. Run: pip install basic-pitch") from e

    audio_path = Path(audio_path)
    out_dir = Path(MIDI_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    midi_path = out_dir / f"{audio_path.stem}_{instrument_label}_raw.mid"

    if midi_path.exists():
        print(f"[guitar] Found existing MIDI: {midi_path.name}, skipping.")
        return midi_path

    print(f"[guitar] Running Basic Pitch on {audio_path.name} ...")

    model_output, midi_data, note_events = predict(
        str(audio_path),
        ICASSP_2022_MODEL_PATH,
        onset_threshold=BASIC_PITCH_CONFIDENCE,
        frame_threshold=BASIC_PITCH_CONFIDENCE * 0.5,
        minimum_note_length=BASIC_PITCH_MIN_NOTE_LEN,
        minimum_frequency=BASIC_PITCH_MIN_FREQ,
        maximum_frequency=BASIC_PITCH_MAX_FREQ,
        multiple_pitch_bends=False,
        melodia_trick=True,
    )

    midi_data.write(str(midi_path))
    note_count = sum(len(inst.notes) for inst in midi_data.instruments)
    print(f"[guitar] Detected {note_count} notes → {midi_path.name}")

    return midi_path
