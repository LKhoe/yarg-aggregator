"""
Phase 2c — Vocal Melody Extraction
Uses torchcrepe (CREPE model in PyTorch) to extract the vocal pitch curve
from the vocal stem, then converts it to MIDI notes.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pretty_midi
import soundfile as sf
import torch

from .config import (
    CREPE_MODEL,
    CREPE_CONFIDENCE_THRESHOLD,
    CREPE_NOTE_MIN_DURATION,
    CREPE_FMIN,
    CREPE_FMAX,
    MIDI_DIR,
)


def transcribe_vocals(vocal_stem_path: Path) -> Path:
    """
    Extract vocal melody from *vocal_stem_path* using torchcrepe.
    Returns path to a MIDI file with a single melodic instrument track.
    """
    try:
        import torchcrepe
    except ImportError as e:
        raise ImportError("torchcrepe not installed. Run: pip install torchcrepe") from e

    vocal_stem_path = Path(vocal_stem_path)
    out_dir = Path(MIDI_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    midi_path = out_dir / f"{vocal_stem_path.stem}_vocals_raw.mid"

    if midi_path.exists():
        print(f"[vocals] Found existing MIDI: {midi_path.name}, skipping.")
        return midi_path

    print(f"[vocals] Loading vocal stem: {vocal_stem_path.name}")
    audio, sr = sf.read(str(vocal_stem_path))

    # torchcrepe expects mono float32 at 16 kHz
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    # Resample to 16 kHz if needed
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    audio_tensor = torch.from_numpy(audio).unsqueeze(0)  # (1, samples)

    print(f"[vocals] Running CREPE ({CREPE_MODEL}) ...")
    hop_length = 160  # 10 ms at 16 kHz

    with torch.no_grad():
        pitch, periodicity = torchcrepe.predict(
            audio_tensor,
            sr,
            hop_length=hop_length,
            fmin=CREPE_FMIN,
            fmax=CREPE_FMAX,
            model=CREPE_MODEL,
            batch_size=512,
            device="cpu",
            return_periodicity=True,
        )

    pitch = pitch.squeeze().numpy()         # shape: (frames,)
    periodicity = periodicity.squeeze().numpy()

    hop_s = hop_length / sr                 # seconds per frame
    times = np.arange(len(pitch)) * hop_s

    # Filter by confidence
    confident_mask = periodicity >= CREPE_CONFIDENCE_THRESHOLD
    # Zero out unconfident frames
    pitch_filtered = np.where(confident_mask, pitch, 0.0)

    notes = _pitch_curve_to_notes(times, pitch_filtered, hop_s)

    pm = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    vocal_inst = pretty_midi.Instrument(program=52, is_drum=False, name="Vocals")  # Choir Aahs

    for start_s, end_s, midi_note in notes:
        vocal_inst.notes.append(pretty_midi.Note(
            velocity=90,
            pitch=int(midi_note),
            start=float(start_s),
            end=float(end_s),
        ))

    pm.instruments.append(vocal_inst)
    pm.write(str(midi_path))
    print(f"[vocals] {len(notes)} vocal notes → {midi_path.name}")

    return midi_path


def _hz_to_midi(hz: float) -> float:
    """Convert frequency in Hz to fractional MIDI note number."""
    if hz <= 0:
        return 0.0
    return 69.0 + 12.0 * np.log2(hz / 440.0)


def _pitch_curve_to_notes(
    times: np.ndarray,
    pitch_hz: np.ndarray,
    hop_s: float,
) -> list[tuple[float, float, int]]:
    """
    Convert a frame-by-frame pitch curve (Hz) to (start_s, end_s, midi_note) tuples.

    Consecutive voiced frames with the same rounded MIDI note are merged.
    Silent frames (pitch == 0) split notes.
    Notes shorter than CREPE_NOTE_MIN_DURATION are discarded.
    """
    notes = []
    i = 0
    n = len(pitch_hz)

    while i < n:
        if pitch_hz[i] <= 0:
            i += 1
            continue

        # Start of a voiced segment
        seg_start = i
        current_midi = round(_hz_to_midi(pitch_hz[i]))

        # Extend while pitch stays within ±0.5 semitone of current note
        j = i + 1
        while j < n and pitch_hz[j] > 0:
            midi_j = round(_hz_to_midi(pitch_hz[j]))
            if abs(midi_j - current_midi) <= 1:
                # Same note (allow ±1 semitone for vibrato/pitch wobble)
                j += 1
            else:
                break

        start_s = float(times[seg_start])
        end_s = float(times[j - 1]) + hop_s
        duration = end_s - start_s

        if duration >= CREPE_NOTE_MIN_DURATION and 36 <= current_midi <= 83:
            notes.append((start_s, end_s, current_midi))

        i = j

    return notes
