#!/usr/bin/env python3
"""
Experiment: Compare full-stem CREPE vs phrase-sliced CREPE for vocals.

Hypothesis: Feeding CREPE isolated phrase slices (guided by synced lyrics timing)
will produce better pitch tracking because:
1. CREPE won't be confused by silence/instrumental bleed between phrases
2. Voicing detection is more accurate on shorter, known-vocal segments
3. We know exactly where vocal content exists — no need to guess

We compare:
A) Baseline: full vocal stem → CREPE (current pipeline)
B) Phrase-sliced: cut vocal stem at lyrics timestamps → CREPE per slice → reassemble
"""
from __future__ import annotations

import re
import time
from pathlib import Path

import librosa
import numpy as np
import pretty_midi
import soundfile as sf
import torch

from pipeline.config import (
    CREPE_MODEL,
    CREPE_CONFIDENCE_THRESHOLD,
    CREPE_NOTE_MIN_DURATION,
    CREPE_FMIN,
    CREPE_FMAX,
    CREPE_ONSET_DELTA,
    DEVICE,
)


def parse_lrc(lyrics_path: Path) -> list[dict]:
    """Parse LRC-style lyrics: [mm:ss.xx] text → list of {time_s, text, end_s}."""
    lines = Path(lyrics_path).read_text().strip().splitlines()
    phrases = []
    for line in lines:
        m = re.match(r"\[(\d+):(\d+\.\d+)\]\s*(.*)", line.strip())
        if m:
            minutes = int(m.group(1))
            seconds = float(m.group(2))
            time_s = minutes * 60 + seconds
            text = m.group(3).strip()
            if text:
                phrases.append({"time_s": time_s, "text": text})

    # Set end times: each phrase ends when the next one starts (+ small buffer)
    for i in range(len(phrases) - 1):
        phrases[i]["end_s"] = phrases[i + 1]["time_s"]
    # Last phrase: extend 3 seconds
    if phrases:
        phrases[-1]["end_s"] = phrases[-1]["time_s"] + 3.0

    return phrases


def run_crepe_on_audio(audio: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Run CREPE on audio, return (times, pitch_hz, periodicity)."""
    import torchcrepe

    if sr != 16000:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    audio_tensor = torch.from_numpy(audio.astype(np.float32)).unsqueeze(0)
    hop_length = 160  # 10ms

    with torch.no_grad():
        pitch, periodicity = torchcrepe.predict(
            audio_tensor, sr,
            hop_length=hop_length,
            fmin=CREPE_FMIN, fmax=CREPE_FMAX,
            model=CREPE_MODEL,
            batch_size=512,
            device=DEVICE,
            return_periodicity=True,
        )

    pitch = pitch.squeeze().numpy()
    periodicity = periodicity.squeeze().numpy()
    hop_s = hop_length / sr
    times = np.arange(len(pitch)) * hop_s

    return times, pitch, periodicity


def pitch_to_notes(
    times: np.ndarray,
    pitch_hz: np.ndarray,
    periodicity: np.ndarray,
    confidence_threshold: float = CREPE_CONFIDENCE_THRESHOLD,
) -> list[tuple[float, float, int]]:
    """Convert frame-level pitch to note list using simple segmentation."""
    hop_s = times[1] - times[0] if len(times) > 1 else 0.01

    voiced = periodicity >= confidence_threshold
    midi_frames = np.where(
        voiced & (pitch_hz > 0),
        69.0 + 12.0 * np.log2(np.maximum(pitch_hz, 1.0) / 440.0),
        0.0,
    )

    # Simple segmentation: group consecutive voiced frames with similar pitch
    notes = []
    i = 0
    n = len(midi_frames)
    while i < n:
        if midi_frames[i] <= 0:
            i += 1
            continue
        seg_start = i
        seg_pitches = [midi_frames[i]]
        j = i + 1
        while j < n and midi_frames[j] > 0:
            if abs(midi_frames[j] - np.median(seg_pitches)) > 1.0:
                break
            seg_pitches.append(midi_frames[j])
            j += 1

        start_s = float(times[seg_start])
        end_s = float(times[min(j - 1, n - 1)]) + hop_s
        dur = end_s - start_s
        median_pitch = int(round(float(np.median(seg_pitches))))

        if dur >= CREPE_NOTE_MIN_DURATION and 36 <= median_pitch <= 83:
            notes.append((start_s, end_s, median_pitch))
        i = j

    return notes


def analyze_notes(notes: list[tuple[float, float, int]], label: str) -> dict:
    """Compute metrics for a note list."""
    if not notes:
        return {"label": label, "count": 0}

    durations = [n[1] - n[0] for n in notes]
    pitches = [n[2] for n in notes]
    starts = [n[0] for n in notes]
    total_sounding = sum(durations)
    time_span = notes[-1][1] - notes[0][0]

    return {
        "label": label,
        "count": len(notes),
        "pitch_min": min(pitches),
        "pitch_max": max(pitches),
        "unique_pitches": len(set(pitches)),
        "dur_mean": float(np.mean(durations)),
        "dur_median": float(np.median(durations)),
        "total_sounding": total_sounding,
        "time_span": time_span,
        "coverage": total_sounding / time_span if time_span > 0 else 0,
        "density": len(notes) / time_span if time_span > 0 else 0,
    }


def main():
    vocal_stem = Path("output/stems/htdemucs_6s/HAYASii - Hunting Soul/vocals.wav")
    lyrics_path = Path("input/lyrics_synced.txt")

    if not vocal_stem.exists():
        print(f"ERROR: {vocal_stem} not found")
        return
    if not lyrics_path.exists():
        print(f"ERROR: {lyrics_path} not found")
        return

    phrases = parse_lrc(lyrics_path)
    print(f"Parsed {len(phrases)} phrases from lyrics")
    for i, p in enumerate(phrases):
        print(f"  [{i:2d}] {p['time_s']:6.2f}s – {p['end_s']:6.2f}s  {p['text']}")

    # Load vocal stem once
    print(f"\nLoading vocal stem: {vocal_stem.name}")
    audio, sr = sf.read(str(vocal_stem))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)
    duration = len(audio) / sr
    print(f"Duration: {duration:.1f}s  SR: {sr}")

    # ═══════════════════════════════════════════════════════════════════════
    # A) BASELINE: Full stem → CREPE
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("  A) BASELINE: Full vocal stem → CREPE")
    print(f"{'='*60}")

    t0 = time.time()
    times_full, pitch_full, period_full = run_crepe_on_audio(audio, sr)
    baseline_time = time.time() - t0
    print(f"  CREPE time: {baseline_time:.1f}s")

    # Voiced stats on full run
    voiced_full = period_full >= CREPE_CONFIDENCE_THRESHOLD
    print(f"  Voiced frames: {np.sum(voiced_full)}/{len(voiced_full)} "
          f"({np.sum(voiced_full)/len(voiced_full)*100:.1f}%)")

    baseline_notes = pitch_to_notes(times_full, pitch_full, period_full)
    baseline_stats = analyze_notes(baseline_notes, "Baseline")

    # ═══════════════════════════════════════════════════════════════════════
    # B) PHRASE-SLICED: Cut by lyrics timing → CREPE per slice
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("  B) PHRASE-SLICED: Lyrics-guided → CREPE per phrase")
    print(f"{'='*60}")

    t0 = time.time()
    sliced_notes = []
    total_voiced_frames = 0
    total_frames = 0

    for i, phrase in enumerate(phrases):
        # Skip instrumental markers
        if phrase["text"] in ("♪♪",):
            continue

        start_sample = int(phrase["time_s"] * sr)
        end_sample = int(phrase["end_s"] * sr)
        # Add small padding (200ms before, to catch attack transients)
        pad_before = int(0.2 * sr)
        start_sample = max(0, start_sample - pad_before)
        end_sample = min(len(audio), end_sample)

        slice_audio = audio[start_sample:end_sample]
        if len(slice_audio) < sr * 0.1:  # skip < 100ms
            continue

        times_s, pitch_s, period_s = run_crepe_on_audio(slice_audio, sr)

        voiced_s = period_s >= CREPE_CONFIDENCE_THRESHOLD
        total_voiced_frames += np.sum(voiced_s)
        total_frames += len(voiced_s)

        # Convert notes, offset times back to absolute
        offset = max(0, phrase["time_s"] - 0.2)
        notes_s = pitch_to_notes(times_s, pitch_s, period_s)
        for start, end, pitch in notes_s:
            sliced_notes.append((start + offset, end + offset, pitch))

        v_pct = np.sum(voiced_s) / len(voiced_s) * 100 if len(voiced_s) > 0 else 0
        n_notes = len(notes_s)
        print(f"  Phrase {i:2d}: {phrase['time_s']:6.2f}s–{phrase['end_s']:6.2f}s "
              f"| voiced={v_pct:4.1f}% | notes={n_notes:3d} | {phrase['text'][:40]}")

    sliced_time = time.time() - t0
    print(f"\n  CREPE time: {sliced_time:.1f}s")
    print(f"  Total voiced: {total_voiced_frames}/{total_frames} "
          f"({total_voiced_frames/total_frames*100:.1f}%)" if total_frames > 0 else "")

    # Sort by start time
    sliced_notes.sort(key=lambda n: n[0])
    sliced_stats = analyze_notes(sliced_notes, "Phrase-sliced")

    # ═══════════════════════════════════════════════════════════════════════
    # COMPARISON
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print("  COMPARISON")
    print(f"{'='*60}")

    headers = ["Metric", "Baseline (full)", "Phrase-sliced"]
    rows = [
        ("Note count", baseline_stats["count"], sliced_stats["count"]),
        ("Pitch min (MIDI)", baseline_stats.get("pitch_min", "—"), sliced_stats.get("pitch_min", "—")),
        ("Pitch max (MIDI)", baseline_stats.get("pitch_max", "—"), sliced_stats.get("pitch_max", "—")),
        ("Unique pitches", baseline_stats.get("unique_pitches", "—"), sliced_stats.get("unique_pitches", "—")),
        ("Duration mean (s)", f"{baseline_stats.get('dur_mean', 0):.3f}", f"{sliced_stats.get('dur_mean', 0):.3f}"),
        ("Duration median (s)", f"{baseline_stats.get('dur_median', 0):.3f}", f"{sliced_stats.get('dur_median', 0):.3f}"),
        ("Total sounding (s)", f"{baseline_stats.get('total_sounding', 0):.1f}", f"{sliced_stats.get('total_sounding', 0):.1f}"),
        ("Coverage", f"{baseline_stats.get('coverage', 0):.1%}", f"{sliced_stats.get('coverage', 0):.1%}"),
        ("Density (/s)", f"{baseline_stats.get('density', 0):.2f}", f"{sliced_stats.get('density', 0):.2f}"),
        ("CREPE time (s)", f"{baseline_time:.1f}", f"{sliced_time:.1f}"),
    ]

    col_widths = [22, 20, 20]
    header_line = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    print(f"\n  {header_line}")
    print(f"  {'-' * len(header_line)}")
    for row in rows:
        line = " | ".join(str(v).ljust(w) for v, w in zip(row, col_widths))
        print(f"  {line}")

    # ═══════════════════════════════════════════════════════════════════════
    # PITCH DISTRIBUTION COMPARISON
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n  --- Pitch Distribution ---")
    if baseline_notes:
        bp = sorted(set(n[2] for n in baseline_notes))
        print(f"  Baseline pitches:  {bp}")
    if sliced_notes:
        sp = sorted(set(n[2] for n in sliced_notes))
        print(f"  Sliced pitches:    {sp}")

    # ═══════════════════════════════════════════════════════════════════════
    # TIMING ALIGNMENT between approaches
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n  --- Cross-method alignment ---")
    if baseline_notes and sliced_notes:
        baseline_starts = np.array([n[0] for n in baseline_notes])
        sliced_starts = np.array([n[0] for n in sliced_notes])

        # For each baseline note, find closest sliced note
        matched = 0
        timing_diffs = []
        pitch_diffs = []
        for b_start, b_end, b_pitch in baseline_notes:
            dists = np.abs(sliced_starts - b_start)
            closest = int(np.argmin(dists))
            if dists[closest] < 0.3:
                matched += 1
                timing_diffs.append(dists[closest])
                pitch_diffs.append(abs(sliced_notes[closest][2] - b_pitch))

        if timing_diffs:
            td = np.array(timing_diffs)
            pd = np.array(pitch_diffs)
            print(f"  Matched notes (within 300ms): {matched}/{len(baseline_notes)}")
            print(f"  Timing diff — mean: {np.mean(td)*1000:.0f}ms  median: {np.median(td)*1000:.0f}ms")
            print(f"  Pitch agreement — exact: {np.sum(pd == 0)}/{matched} ({np.sum(pd == 0)/matched:.0%})")
            print(f"  Pitch within ±2: {np.sum(pd <= 2)}/{matched} ({np.sum(pd <= 2)/matched:.0%})")

    # Notes that only exist in sliced (new vocal content found)
    if baseline_notes and sliced_notes:
        new_in_sliced = 0
        for s_start, s_end, s_pitch in sliced_notes:
            dists = np.abs(baseline_starts - s_start)
            if np.min(dists) > 0.3:
                new_in_sliced += 1
        print(f"\n  Notes only in phrase-sliced (not in baseline): {new_in_sliced}")
        print(f"  Notes only in baseline (not in phrase-sliced): {len(baseline_notes) - matched}")


if __name__ == "__main__":
    main()
