"""
Phase 1b — Beat & BPM Detection
Uses librosa to detect the tempo map (BPM events + beat timestamps).
"""
from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np

from .config import BEAT_TRIM_SILENCE, BEAT_START_BPM, MIDI_DIR


def detect_beats(audio_path: Path) -> dict:
    """
    Analyse *audio_path* and return a tempo map dict:

        {
            "estimated_bpm": float,
            "beats": [{"time_s": float, "beat_idx": int}, ...],
            "bpm_events": [{"time_s": float, "bpm": float}, ...],
        }

    The "bpm_events" list tries to capture tempo changes by analysing
    local tempo over sliding windows of 8 beats.
    """
    audio_path = Path(audio_path)
    print(f"[beats] Loading audio: {audio_path.name}")

    y, sr = librosa.load(str(audio_path), sr=None, mono=True)

    if BEAT_TRIM_SILENCE:
        # Trim leading silence so beat tracker starts on an actual note
        y_trimmed, index = librosa.effects.trim(y, top_db=30)
        offset_s = float(index[0]) / sr
    else:
        y_trimmed = y
        offset_s = 0.0

    print("[beats] Running beat tracker ...")
    tempo, beat_frames = librosa.beat.beat_track(
        y=y_trimmed,
        sr=sr,
        start_bpm=BEAT_START_BPM,
        units="frames",
    )
    beat_times_trimmed = librosa.frames_to_time(beat_frames, sr=sr)
    beat_times = beat_times_trimmed + offset_s  # restore original timeline

    estimated_bpm = float(np.round(np.asarray(tempo).flatten()[0], 2))
    print(f"[beats] Estimated global BPM: {estimated_bpm}")

    # Build per-beat list
    beats = [
        {"time_s": float(t), "beat_idx": int(i)}
        for i, t in enumerate(beat_times)
    ]

    # Detect local tempo changes using a sliding window of 8 beats
    bpm_events = _detect_tempo_changes(beat_times, window=8)

    result = {
        "estimated_bpm": estimated_bpm,
        "beats": beats,
        "bpm_events": bpm_events,
    }

    # Save JSON alongside MIDI output
    out_path = Path(MIDI_DIR) / f"{audio_path.stem}_beats.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"[beats] Beat data saved to {out_path}")

    return result


def _detect_tempo_changes(beat_times: np.ndarray, window: int = 8) -> list[dict]:
    """
    Slide a window over beat_times to detect local BPM changes.
    Returns a list of {"time_s": ..., "bpm": ...} events.
    """
    if len(beat_times) < window:
        if len(beat_times) < 2:
            return []
        avg_bpm = 60.0 / float(np.mean(np.diff(beat_times)))
        return [{"time_s": float(beat_times[0]), "bpm": round(avg_bpm, 2)}]

    events: list[dict] = []
    prev_bpm: float | None = None

    for i in range(0, len(beat_times) - window, window // 2):
        chunk = beat_times[i : i + window]
        intervals = np.diff(chunk)
        local_bpm = float(np.round(60.0 / np.mean(intervals), 2))

        # Only emit an event when BPM changes by more than 1%
        if prev_bpm is None or abs(local_bpm - prev_bpm) / prev_bpm > 0.01:
            events.append({"time_s": float(chunk[0]), "bpm": local_bpm})
            prev_bpm = local_bpm

    return events
