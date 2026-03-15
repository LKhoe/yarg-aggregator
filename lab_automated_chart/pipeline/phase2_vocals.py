"""
Phase 2c — Vocal Melody Extraction
Uses torchcrepe (CREPE model in PyTorch) for pitch tracking and librosa
onset detection for syllable segmentation. Produces one MIDI note per syllable.
"""
from __future__ import annotations

from pathlib import Path

import librosa
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
    CREPE_ONSET_DELTA,
    DEVICE,
    MIDI_DIR,
    LYRICS_PHRASE_PAD_BEFORE_S,
    LYRICS_PHRASE_PAD_AFTER_S,
)


def transcribe_vocals(vocal_stem_path: Path, phrases: list[dict] | None = None) -> Path:
    """
    Extract vocal melody from *vocal_stem_path* using torchcrepe + onset detection.

    When *phrases* is provided (from lyrics acquisition), runs CREPE on each
    phrase slice individually for better accuracy and fewer false positives.

    When *phrases* is None, runs CREPE on the full stem (original behavior).

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

    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    if phrases is not None:
        notes = _transcribe_with_phrases(audio, sr, phrases)
    else:
        notes = _transcribe_full_stem(audio, sr)

    # ── Write MIDI ──────────────────────────────────────────────────────────
    pm = pretty_midi.PrettyMIDI(initial_tempo=120.0)
    vocal_inst = pretty_midi.Instrument(program=52, is_drum=False, name="Vocals")

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


def _transcribe_with_phrases(
    audio: np.ndarray,
    sr: int,
    phrases: list[dict],
) -> list[tuple[float, float, int]]:
    """Run CREPE on each phrase slice and reassemble notes with absolute timing."""
    print(f"[vocals] Phrase-guided transcription: {len(phrases)} phrases")

    all_notes: list[tuple[float, float, int]] = []

    for i, phrase in enumerate(phrases):
        pad_before = LYRICS_PHRASE_PAD_BEFORE_S
        pad_after = LYRICS_PHRASE_PAD_AFTER_S

        start_s = max(0.0, phrase["time_s"] - pad_before)
        end_s = phrase["end_s"] + pad_after

        start_sample = int(start_s * sr)
        end_sample = min(int(end_s * sr), len(audio))

        slice_audio = audio[start_sample:end_sample]
        if len(slice_audio) < sr * 0.1:  # skip < 100ms
            continue

        segment_notes = _run_crepe_segment(slice_audio, sr, time_offset=start_s)
        all_notes.extend(segment_notes)

        print(f"[vocals]   Phrase {i:2d}: {phrase['time_s']:6.2f}s–{phrase['end_s']:6.2f}s "
              f"| {len(segment_notes):3d} notes | {phrase['text'][:40]}")

    # Sort and merge same-pitch adjacents
    all_notes.sort(key=lambda n: n[0])
    all_notes = _merge_same_pitch(all_notes, max_gap=0.05)

    print(f"[vocals] {len(all_notes)} vocal notes (phrase-guided)")
    return all_notes


def _transcribe_full_stem(
    audio: np.ndarray,
    sr: int,
) -> list[tuple[float, float, int]]:
    """Original full-stem CREPE transcription with onset detection."""
    import torchcrepe

    # Keep original for onset detection
    audio_orig_sr = audio.copy()
    orig_sr = sr

    # Resample to 16 kHz for CREPE
    if sr != 16000:
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr_16k = 16000
    else:
        audio_16k = audio
        sr_16k = sr

    # ── Step 1: CREPE pitch tracking ────────────────────────────────────────
    audio_tensor = torch.from_numpy(audio_16k).unsqueeze(0)

    print(f"[vocals] Running CREPE ({CREPE_MODEL}) on {DEVICE} ...")
    hop_length = 160  # 10 ms at 16 kHz

    with torch.no_grad():
        pitch, periodicity = torchcrepe.predict(
            audio_tensor,
            sr_16k,
            hop_length=hop_length,
            fmin=CREPE_FMIN,
            fmax=CREPE_FMAX,
            model=CREPE_MODEL,
            batch_size=512,
            device=DEVICE,
            return_periodicity=True,
        )

    pitch = pitch.squeeze().numpy()
    periodicity = periodicity.squeeze().numpy()
    hop_s = hop_length / sr_16k
    times = np.arange(len(pitch)) * hop_s

    # ── Step 2: Voicing mask with smoothing ─────────────────────────────────
    voiced_mask = periodicity >= CREPE_CONFIDENCE_THRESHOLD
    voiced_mask = _smooth_voicing(voiced_mask, min_gap_frames=8, min_voiced_frames=4)

    pitch_filtered = np.where(voiced_mask, pitch, 0.0)
    pitch_filtered = _interpolate_gaps(pitch_filtered, voiced_mask)

    voiced_pct = np.sum(voiced_mask) / len(voiced_mask) * 100
    print(f"[vocals] Voiced frames (after smoothing): {np.sum(voiced_mask)}/{len(voiced_mask)} ({voiced_pct:.1f}%)")

    midi_frames = np.where(
        pitch_filtered > 0,
        69.0 + 12.0 * np.log2(np.maximum(pitch_filtered, 1.0) / 440.0),
        0.0,
    )

    # ── Step 3: Onset detection ─────────────────────────────────────────────
    print("[vocals] Detecting onsets for syllable segmentation ...")
    onset_env = librosa.onset.onset_strength(y=audio_orig_sr, sr=orig_sr)
    onset_frames_detected = librosa.util.peak_pick(
        onset_env,
        pre_max=5, post_max=5,
        pre_avg=10, post_avg=10,
        delta=CREPE_ONSET_DELTA,
        wait=8,
    )
    onset_times_arr = librosa.frames_to_time(onset_frames_detected, sr=orig_sr)
    onset_frame_set = set(int(round(t / hop_s)) for t in onset_times_arr)
    print(f"[vocals] Detected {len(onset_times_arr)} vocal onsets")

    # ── Step 4: Segment into notes ──────────────────────────────────────────
    notes = _segment_with_onsets(times, midi_frames, onset_frame_set, hop_s)
    print(f"[vocals] {len(notes)} vocal notes")

    return notes


def _run_crepe_segment(
    audio: np.ndarray,
    sr: int,
    time_offset: float = 0.0,
) -> list[tuple[float, float, int]]:
    """
    Run CREPE on an audio segment, returning notes with absolute timing.

    Handles resampling, pitch tracking, voicing smoothing, and segmentation
    for a single audio slice. Used by both phrase-guided and full-stem paths.
    """
    import torchcrepe

    # Resample to 16 kHz for CREPE
    if sr != 16000:
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr_16k = 16000
    else:
        audio_16k = audio
        sr_16k = sr

    audio_tensor = torch.from_numpy(audio_16k.astype(np.float32)).unsqueeze(0)
    hop_length = 160  # 10ms at 16 kHz

    with torch.no_grad():
        pitch, periodicity = torchcrepe.predict(
            audio_tensor,
            sr_16k,
            hop_length=hop_length,
            fmin=CREPE_FMIN,
            fmax=CREPE_FMAX,
            model=CREPE_MODEL,
            batch_size=512,
            device=DEVICE,
            return_periodicity=True,
        )

    pitch = pitch.squeeze().numpy()
    periodicity = periodicity.squeeze().numpy()
    hop_s = hop_length / sr_16k
    times = np.arange(len(pitch)) * hop_s

    # Voicing mask with smoothing
    voiced_mask = periodicity >= CREPE_CONFIDENCE_THRESHOLD
    voiced_mask = _smooth_voicing(voiced_mask, min_gap_frames=8, min_voiced_frames=4)

    pitch_filtered = np.where(voiced_mask, pitch, 0.0)
    pitch_filtered = _interpolate_gaps(pitch_filtered, voiced_mask)

    midi_frames = np.where(
        pitch_filtered > 0,
        69.0 + 12.0 * np.log2(np.maximum(pitch_filtered, 1.0) / 440.0),
        0.0,
    )

    # Simple segmentation by pitch change (no onset detection for phrase slices —
    # phrase boundaries already provide segmentation)
    notes: list[tuple[float, float, int]] = []
    n = len(midi_frames)
    i = 0
    while i < n:
        if midi_frames[i] <= 0:
            i += 1
            continue

        seg_start = i
        seg_pitches = [midi_frames[i]]
        j = i + 1
        while j < n and midi_frames[j] > 0:
            if abs(midi_frames[j] - float(np.median(seg_pitches))) > 1.0:
                break
            seg_pitches.append(midi_frames[j])
            j += 1

        start_s = float(times[seg_start]) + time_offset
        end_s = float(times[min(j - 1, n - 1)]) + hop_s + time_offset
        duration = end_s - start_s
        median_pitch = int(round(float(np.median(seg_pitches))))

        if duration >= CREPE_NOTE_MIN_DURATION and 36 <= median_pitch <= 83:
            notes.append((start_s, end_s, median_pitch))

        i = j

    return notes


def _segment_with_onsets(
    times: np.ndarray,
    midi_frames: np.ndarray,
    onset_frames: set[int],
    hop_s: float,
) -> list[tuple[float, float, int]]:
    """
    Walk through the frame-level MIDI pitch array and produce note segments.

    A new note starts when:
    - We transition from unvoiced → voiced
    - The pitch changes by more than 1 semitone from the segment's running median
    - An onset frame is encountered within a voiced region

    Each segment's pitch is the median of all its frame pitches (rounded).
    """
    notes: list[tuple[float, float, int]] = []
    n = len(midi_frames)

    i = 0
    while i < n:
        # Skip unvoiced
        if midi_frames[i] <= 0:
            i += 1
            continue

        # Start a new segment
        seg_start = i
        seg_pitches = [midi_frames[i]]

        j = i + 1
        while j < n:
            if midi_frames[j] <= 0:
                # Unvoiced → end segment
                break

            current_median = float(np.median(seg_pitches))

            # Check for onset (syllable boundary)
            is_onset = j in onset_frames

            # Check for pitch change (> 1 semitone from median)
            pitch_change = abs(midi_frames[j] - current_median) > 1.0

            if is_onset or pitch_change:
                # Only split if we already have a reasonable segment
                # Don't split on onset if pitch hasn't changed (sustained note)
                if is_onset and not pitch_change:
                    # Onset without pitch change — only split if the onset is strong
                    # (we already filtered onsets, so trust it as a syllable boundary)
                    if len(seg_pitches) >= 4:  # at least 40ms of content
                        break
                    else:
                        seg_pitches.append(midi_frames[j])
                        j += 1
                        continue
                else:
                    break

            seg_pitches.append(midi_frames[j])
            j += 1

        # Emit the segment
        start_s = float(times[seg_start])
        end_s = float(times[min(j - 1, n - 1)]) + hop_s
        duration = end_s - start_s
        median_pitch = int(round(float(np.median(seg_pitches))))

        if duration >= CREPE_NOTE_MIN_DURATION and 36 <= median_pitch <= 83:
            notes.append((start_s, end_s, median_pitch))

        i = j

    # Merge consecutive notes with same pitch and tiny gap
    notes = _merge_same_pitch(notes, max_gap=0.05)

    return notes


def _merge_same_pitch(
    segments: list[tuple[float, float, int]],
    max_gap: float = 0.05,
) -> list[tuple[float, float, int]]:
    """Merge consecutive segments that share the same pitch with a small gap."""
    if not segments:
        return []

    merged = [segments[0]]
    for start, end, pitch in segments[1:]:
        prev_start, prev_end, prev_pitch = merged[-1]
        gap = start - prev_end

        if pitch == prev_pitch and 0 <= gap <= max_gap:
            merged[-1] = (prev_start, end, pitch)
        else:
            merged.append((start, end, pitch))

    return merged


def _smooth_voicing(
    mask: np.ndarray,
    min_gap_frames: int = 8,
    min_voiced_frames: int = 4,
) -> np.ndarray:
    """
    Fill short unvoiced gaps and remove short voiced bursts.
    """
    result = mask.copy()

    # Fill short gaps
    in_gap = False
    gap_start = 0
    for i in range(len(result)):
        if not result[i]:
            if not in_gap:
                gap_start = i
                in_gap = True
        else:
            if in_gap:
                if i - gap_start <= min_gap_frames:
                    result[gap_start:i] = True
                in_gap = False

    # Remove short voiced bursts
    in_voiced = False
    voiced_start = 0
    for i in range(len(result)):
        if result[i]:
            if not in_voiced:
                voiced_start = i
                in_voiced = True
        else:
            if in_voiced:
                if i - voiced_start < min_voiced_frames:
                    result[voiced_start:i] = False
                in_voiced = False

    return result


def _interpolate_gaps(pitch: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """For gap-filled frames (mask=True, pitch=0), interpolate from neighbors."""
    result = pitch.copy()
    for i in range(len(result)):
        if mask[i] and result[i] <= 0:
            left = right = 0.0
            for j in range(i - 1, -1, -1):
                if result[j] > 0:
                    left = result[j]
                    break
            for j in range(i + 1, len(result)):
                if result[j] > 0:
                    right = result[j]
                    break
            if left > 0 and right > 0:
                result[i] = (left + right) / 2
            elif left > 0:
                result[i] = left
            elif right > 0:
                result[i] = right
    return result
