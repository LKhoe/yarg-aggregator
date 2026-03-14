"""
Phase 2b — Drum Transcription
Uses librosa onset detection on the drum stem to produce a MIDI drum track.
Each onset is classified into a Rock Band pad using frequency-band energy.
"""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np
import pretty_midi

from .config import MIDI_DIR, DRUM_NOTE_TO_PAD


# GM MIDI drum note numbers for each RB pad
# (used when writing MIDI — these are standard GM drum notes)
PAD_TO_GM_NOTE = {
    0: 36,  # Kick         → Bass Drum 1
    1: 38,  # Red (Snare)  → Acoustic Snare
    2: 42,  # Yellow (HH)  → Closed Hi-Hat
    3: 47,  # Blue (Tom)   → Low-Mid Tom
    4: 49,  # Green (Crash)→ Crash Cymbal 1
}


def transcribe_drums(drum_stem_path: Path) -> Path:
    """
    Detect onsets from *drum_stem_path* and classify them into Rock Band pads.
    Writes a GM-compatible MIDI file.

    Strategy:
    - Split the drum stem into 5 frequency bands.
    - Detect onsets per band.
    - Map band → Rock Band pad.
    - Write each onset as a short MIDI note.

    Returns:
        Path to generated MIDI file.
    """
    drum_stem_path = Path(drum_stem_path)
    out_dir = Path(MIDI_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    midi_path = out_dir / f"{drum_stem_path.stem}_drums_raw.mid"

    if midi_path.exists():
        print(f"[drums] Found existing MIDI: {midi_path.name}, skipping.")
        return midi_path

    print(f"[drums] Loading drum stem: {drum_stem_path.name}")
    y, sr = librosa.load(str(drum_stem_path), sr=None, mono=True)

    # Define band → RB pad mappings
    bands = [
        # (label, low_hz, high_hz, rb_pad)
        ("kick",    20,   120,  0),
        ("snare",  120,   500,  1),
        ("hihat",  500,  4000,  2),
        ("tom_lo", 120,   350,  3),
        ("crash", 4000, 16000,  4),
    ]

    pm = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    drum_inst = pretty_midi.Instrument(program=0, is_drum=True, name="Drums")

    total_onsets = 0
    for label, lo, hi, rb_pad in bands:
        onsets = _detect_band_onsets(y, sr, lo_hz=lo, hi_hz=hi)
        gm_note = PAD_TO_GM_NOTE[rb_pad]
        for t in onsets:
            note = pretty_midi.Note(
                velocity=100,
                pitch=gm_note,
                start=float(t),
                end=float(t) + 0.05,   # 50ms note — enough to register
            )
            drum_inst.notes.append(note)
        total_onsets += len(onsets)
        print(f"[drums]   {label:8s}: {len(onsets):4d} onsets")

    drum_inst.notes.sort(key=lambda n: n.start)
    pm.instruments.append(drum_inst)
    pm.write(str(midi_path))
    print(f"[drums] Total {total_onsets} drum hits → {midi_path.name}")

    return midi_path


def _detect_band_onsets(
    y: np.ndarray,
    sr: int,
    lo_hz: float,
    hi_hz: float,
    pre_max: int = 3,
    post_max: int = 3,
    pre_avg: int = 10,
    post_avg: int = 10,
    delta: float = 0.04,
    wait: int = 5,
) -> np.ndarray:
    """
    Band-pass the signal, compute spectral flux, return onset times in seconds.
    """
    # Band-pass filter using librosa's STFT
    D = librosa.stft(y)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2 * (D.shape[0] - 1))

    band_mask = (freqs >= lo_hz) & (freqs <= hi_hz)
    D_band = D.copy()
    D_band[~band_mask, :] = 0

    # Reconstruct band-limited signal
    y_band = librosa.istft(D_band, length=len(y))

    # Compute onset strength
    onset_env = librosa.onset.onset_strength(y=y_band, sr=sr)

    # Pick onset frames
    onset_frames = librosa.util.peak_pick(
        onset_env,
        pre_max=pre_max,
        post_max=post_max,
        pre_avg=pre_avg,
        post_avg=post_avg,
        delta=delta,
        wait=wait,
    )

    return librosa.frames_to_time(onset_frames, sr=sr)
