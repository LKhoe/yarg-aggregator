"""
Phase 2b — Drum Transcription
Uses librosa onset detection on the drum stem to produce a MIDI drum track.
Each onset is classified into a Rock Band pad using frequency-band energy.
Includes cross-band NMS to deduplicate ghost hits from overlapping bands.
"""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np
import pretty_midi

from .config import MIDI_DIR, DRUM_BANDS, DRUM_NMS_WINDOW_S, DRUM_NMS_ALLOW_COMBOS


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
    - Split the drum stem into frequency bands (defined in config.DRUM_BANDS).
    - Detect onsets per band with per-band delta sensitivity.
    - Apply cross-band NMS to remove ghost hits from overlapping bands.
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

    # Collect all onsets across bands: list of (time_s, pad, onset_strength)
    all_onsets: list[tuple[float, int, float]] = []

    for band in DRUM_BANDS:
        label = band["label"]
        lo = band["lo"]
        hi = band["hi"]
        pad = band["pad"]
        delta = band["delta"]

        onsets, strengths = _detect_band_onsets(y, sr, lo_hz=lo, hi_hz=hi, delta=delta)
        for t, s in zip(onsets, strengths):
            all_onsets.append((float(t), pad, float(s)))
        print(f"[drums]   {label:8s}: {len(onsets):4d} onsets (delta={delta})")

    # Sort by time
    all_onsets.sort(key=lambda x: x[0])

    # Cross-band NMS: deduplicate hits from different pads within DRUM_NMS_WINDOW_S
    filtered = _cross_band_nms(all_onsets)

    pm = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    drum_inst = pretty_midi.Instrument(program=0, is_drum=True, name="Drums")

    for t, pad, _ in filtered:
        gm_note = PAD_TO_GM_NOTE[pad]
        note = pretty_midi.Note(
            velocity=100,
            pitch=gm_note,
            start=t,
            end=t + 0.05,   # 50ms note — enough to register
        )
        drum_inst.notes.append(note)

    drum_inst.notes.sort(key=lambda n: n.start)
    pm.instruments.append(drum_inst)
    pm.write(str(midi_path))
    print(f"[drums] {len(filtered)} drum hits after NMS → {midi_path.name}")

    return midi_path


def _cross_band_nms(
    onsets: list[tuple[float, int, float]],
) -> list[tuple[float, int, float]]:
    """
    Non-maximum suppression across bands.
    If two different pads fire within DRUM_NMS_WINDOW_S, keep only the one
    with higher onset strength — unless the pad combo is in the allow list.
    """
    if not onsets:
        return []

    # Mark which onsets to keep
    keep = [True] * len(onsets)

    for i in range(len(onsets)):
        if not keep[i]:
            continue
        t_i, pad_i, s_i = onsets[i]

        for j in range(i + 1, len(onsets)):
            t_j, pad_j, s_j = onsets[j]

            # Past the NMS window — no need to check further (list is sorted)
            if t_j - t_i > DRUM_NMS_WINDOW_S:
                break

            # Same pad — not a cross-band conflict
            if pad_i == pad_j:
                continue

            # Allowed combo — don't suppress
            if frozenset({pad_i, pad_j}) in DRUM_NMS_ALLOW_COMBOS:
                continue

            # Suppress the weaker one
            if s_i >= s_j:
                keep[j] = False
            else:
                keep[i] = False
                break  # i is suppressed, stop comparing from i

    return [o for o, k in zip(onsets, keep) if k]


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
) -> tuple[np.ndarray, np.ndarray]:
    """
    Band-pass the signal, compute spectral flux, return onset times and strengths.
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

    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    onset_strengths = onset_env[onset_frames] if len(onset_frames) > 0 else np.array([])

    return onset_times, onset_strengths
