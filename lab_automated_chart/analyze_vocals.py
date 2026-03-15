#!/usr/bin/env python3
"""
Vocal Analysis: Compare reference MIDI vs generated MIDI against vocals.ogg
Extracts pitch, timing, and structural features to diagnose quality issues.
"""
from __future__ import annotations

import sys
from pathlib import Path

import librosa
import numpy as np
import pretty_midi
import soundfile as sf


def extract_audio_features(audio_path: Path) -> dict:
    """Extract pitch and timing features from vocal audio using pyin."""
    print(f"\n{'='*60}")
    print(f"  Audio: {audio_path.name}")
    print(f"{'='*60}")

    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration = len(y) / sr
    print(f"  Duration: {duration:.1f}s  Sample rate: {sr}")

    # Pitch detection with pyin (more robust than crepe for analysis)
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=60, fmax=1000, sr=sr,
        frame_length=2048, hop_length=512,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=512)

    # Voiced frames
    voiced_mask = voiced_flag & (f0 > 0) & np.isfinite(f0)
    voiced_f0 = f0[voiced_mask]
    voiced_times = times[voiced_mask]
    voiced_ratio = np.sum(voiced_mask) / len(f0) if len(f0) > 0 else 0

    # Convert to MIDI note numbers
    midi_notes = librosa.hz_to_midi(voiced_f0)

    # Segment into notes (consecutive voiced frames with same rounded pitch)
    notes = _segment_notes(voiced_times, midi_notes, hop_s=512/sr)

    # Pitch range
    if len(voiced_f0) > 0:
        pitch_min = float(np.min(voiced_f0))
        pitch_max = float(np.max(voiced_f0))
        pitch_mean = float(np.mean(voiced_f0))
        midi_min = float(np.min(midi_notes))
        midi_max = float(np.max(midi_notes))
    else:
        pitch_min = pitch_max = pitch_mean = midi_min = midi_max = 0

    # Onset detection for rhythmic analysis
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, onset_envelope=onset_env)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    features = {
        "duration_s": duration,
        "voiced_ratio": voiced_ratio,
        "pitch_min_hz": pitch_min,
        "pitch_max_hz": pitch_max,
        "pitch_mean_hz": pitch_mean,
        "midi_range": (midi_min, midi_max),
        "num_notes": len(notes),
        "notes": notes,  # list of (start_s, end_s, midi_note)
        "note_durations": [n[1] - n[0] for n in notes],
        "onset_times": onset_times.tolist(),
        "num_onsets": len(onset_times),
    }

    _print_audio_summary(features)
    return features


def extract_midi_features(midi_path: Path, track_filter: str | None = None) -> dict:
    """Extract note features from a MIDI file."""
    print(f"\n{'='*60}")
    print(f"  MIDI: {midi_path.name}")
    print(f"{'='*60}")

    pm = pretty_midi.PrettyMIDI(str(midi_path))

    # List all tracks
    print(f"  Tracks ({len(pm.instruments)}):")
    for i, inst in enumerate(pm.instruments):
        print(f"    [{i}] {inst.name} | notes={len(inst.notes)} | drum={inst.is_drum}")

    # Find vocal track
    vocal_inst = None
    for inst in pm.instruments:
        name_lower = inst.name.lower() if inst.name else ""
        if track_filter:
            if track_filter.lower() in name_lower:
                vocal_inst = inst
                break
        elif "vocal" in name_lower or "vox" in name_lower:
            vocal_inst = inst
            break

    if vocal_inst is None:
        # Fallback: try track named PART VOCALS (Rock Band convention)
        for inst in pm.instruments:
            if inst.name and "PART VOCALS" in inst.name:
                vocal_inst = inst
                break

    if vocal_inst is None and len(pm.instruments) > 0:
        # Last resort: pick the non-drum track with most notes
        melodic = [i for i in pm.instruments if not i.is_drum]
        if melodic:
            vocal_inst = max(melodic, key=lambda i: len(i.notes))
            print(f"  WARNING: No vocal track found, using '{vocal_inst.name}' ({len(vocal_inst.notes)} notes)")

    if vocal_inst is None:
        print("  ERROR: No suitable track found")
        return {"num_notes": 0, "notes": []}

    print(f"  Selected track: {vocal_inst.name} ({len(vocal_inst.notes)} notes)")

    notes = []
    for note in sorted(vocal_inst.notes, key=lambda n: n.start):
        notes.append((note.start, note.end, note.pitch))

    pitches = [n[2] for n in notes]
    durations = [n[1] - n[0] for n in notes]
    starts = [n[0] for n in notes]

    # Inter-onset intervals
    ioi = np.diff(starts).tolist() if len(starts) > 1 else []

    features = {
        "track_name": vocal_inst.name,
        "num_notes": len(notes),
        "notes": notes,
        "pitch_min": min(pitches) if pitches else 0,
        "pitch_max": max(pitches) if pitches else 0,
        "pitch_mean": float(np.mean(pitches)) if pitches else 0,
        "pitch_range": (max(pitches) - min(pitches)) if pitches else 0,
        "unique_pitches": len(set(pitches)),
        "duration_min": min(durations) if durations else 0,
        "duration_max": max(durations) if durations else 0,
        "duration_mean": float(np.mean(durations)) if durations else 0,
        "total_sounding_time": sum(durations),
        "time_span": (starts[-1] + durations[-1] - starts[0]) if starts else 0,
        "ioi_mean": float(np.mean(ioi)) if ioi else 0,
        "ioi_std": float(np.std(ioi)) if ioi else 0,
        "note_density_per_sec": len(notes) / (starts[-1] - starts[0]) if len(starts) > 1 else 0,
    }

    _print_midi_summary(features)
    return features


def compare_features(audio_feat: dict, ref_midi: dict, gen_midi: dict) -> None:
    """Print side-by-side comparison."""
    print(f"\n{'='*60}")
    print(f"  COMPARISON")
    print(f"{'='*60}")

    headers = ["Metric", "Audio (pyin)", "Reference MIDI", "Generated MIDI"]
    rows = [
        ("Note count", audio_feat["num_notes"], ref_midi["num_notes"], gen_midi["num_notes"]),
        ("Pitch min (MIDI)", f"{audio_feat['midi_range'][0]:.0f}", ref_midi["pitch_min"], gen_midi["pitch_min"]),
        ("Pitch max (MIDI)", f"{audio_feat['midi_range'][1]:.0f}", ref_midi["pitch_max"], gen_midi["pitch_max"]),
        ("Pitch range", f"{audio_feat['midi_range'][1]-audio_feat['midi_range'][0]:.0f}",
         ref_midi["pitch_range"], gen_midi.get("pitch_range", "?")),
        ("Unique pitches", "—", ref_midi["unique_pitches"], gen_midi["unique_pitches"]),
        ("Duration mean (s)", f"{np.mean(audio_feat['note_durations']):.3f}" if audio_feat["note_durations"] else "—",
         f"{ref_midi['duration_mean']:.3f}", f"{gen_midi['duration_mean']:.3f}"),
        ("Total sounding (s)", "—",
         f"{ref_midi['total_sounding_time']:.1f}", f"{gen_midi['total_sounding_time']:.1f}"),
        ("Note density (/s)", "—",
         f"{ref_midi['note_density_per_sec']:.2f}", f"{gen_midi['note_density_per_sec']:.2f}"),
        ("IOI mean (s)", "—",
         f"{ref_midi['ioi_mean']:.3f}", f"{gen_midi['ioi_mean']:.3f}"),
        ("IOI std (s)", "—",
         f"{ref_midi['ioi_std']:.3f}", f"{gen_midi['ioi_std']:.3f}"),
        ("Time span (s)", f"{audio_feat['duration_s']:.1f}",
         f"{ref_midi['time_span']:.1f}", f"{gen_midi['time_span']:.1f}"),
        ("Voiced ratio", f"{audio_feat['voiced_ratio']:.2%}", "—", "—"),
    ]

    # Print table
    col_widths = [20, 18, 18, 18]
    header_line = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    print(f"\n  {header_line}")
    print(f"  {'-'*len(header_line)}")
    for row in rows:
        line = " | ".join(str(v).ljust(w) for v, w in zip(row, col_widths))
        print(f"  {line}")

    # Pitch alignment analysis
    print(f"\n  --- Pitch Alignment ---")
    if ref_midi["notes"] and gen_midi["notes"]:
        ref_pitches = set(n[2] for n in ref_midi["notes"])
        gen_pitches = set(n[2] for n in gen_midi["notes"])
        overlap = ref_pitches & gen_pitches
        print(f"  Reference pitch set: {sorted(ref_pitches)}")
        print(f"  Generated pitch set: {sorted(gen_pitches)}")
        print(f"  Overlap: {len(overlap)}/{len(ref_pitches)} reference pitches matched")
        only_ref = sorted(ref_pitches - gen_pitches)
        only_gen = sorted(gen_pitches - ref_pitches)
        if only_ref:
            print(f"  Only in reference: {only_ref}")
        if only_gen:
            print(f"  Only in generated: {only_gen}")

    # Timing alignment: for each ref note, find closest gen note
    print(f"\n  --- Timing Alignment ---")
    if ref_midi["notes"] and gen_midi["notes"]:
        ref_starts = np.array([n[0] for n in ref_midi["notes"]])
        gen_starts = np.array([n[0] for n in gen_midi["notes"]])

        # For each reference note, find nearest generated note
        timing_errors = []
        pitch_errors = []
        matched = 0
        for r_start, r_end, r_pitch in ref_midi["notes"]:
            dists = np.abs(gen_starts - r_start)
            closest_idx = int(np.argmin(dists))
            closest_dist = dists[closest_idx]
            g_start, g_end, g_pitch = gen_midi["notes"][closest_idx]

            if closest_dist < 0.5:  # within 500ms
                timing_errors.append(closest_dist)
                pitch_errors.append(abs(g_pitch - r_pitch))
                matched += 1

        if timing_errors:
            te = np.array(timing_errors)
            pe = np.array(pitch_errors)
            print(f"  Matched notes (within 500ms): {matched}/{len(ref_midi['notes'])}")
            print(f"  Timing error — mean: {np.mean(te)*1000:.0f}ms  median: {np.median(te)*1000:.0f}ms  "
                  f"max: {np.max(te)*1000:.0f}ms")
            print(f"  Pitch error  — mean: {np.mean(pe):.1f} semitones  "
                  f"exact match: {np.sum(pe == 0)}/{matched} ({np.sum(pe == 0)/matched:.0%})")
            print(f"  Pitch within ±2 semitones: {np.sum(pe <= 2)}/{matched} ({np.sum(pe <= 2)/matched:.0%})")
        else:
            print(f"  No notes matched within 500ms window — timing severely off")

        # Coverage: what % of the song timeline has notes in gen vs ref
        print(f"\n  --- Coverage ---")
        ref_coverage = _timeline_coverage(ref_midi["notes"])
        gen_coverage = _timeline_coverage(gen_midi["notes"])
        print(f"  Reference covers: {ref_coverage:.1%} of its time span")
        print(f"  Generated covers: {gen_coverage:.1%} of its time span")

    # Note duration distribution
    print(f"\n  --- Duration Distribution ---")
    for label, midi in [("Reference", ref_midi), ("Generated", gen_midi)]:
        if not midi["notes"]:
            continue
        durs = [n[1] - n[0] for n in midi["notes"]]
        buckets = {"<0.1s": 0, "0.1-0.3s": 0, "0.3-1s": 0, "1-3s": 0, ">3s": 0}
        for d in durs:
            if d < 0.1: buckets["<0.1s"] += 1
            elif d < 0.3: buckets["0.1-0.3s"] += 1
            elif d < 1.0: buckets["0.3-1s"] += 1
            elif d < 3.0: buckets["1-3s"] += 1
            else: buckets[">3s"] += 1
        dist_str = "  ".join(f"{k}:{v}" for k, v in buckets.items())
        print(f"  {label:12s}: {dist_str}")


def _timeline_coverage(notes: list[tuple]) -> float:
    """What fraction of start-to-end is covered by notes."""
    if len(notes) < 2:
        return 0
    total_span = notes[-1][1] - notes[0][0]
    if total_span <= 0:
        return 0
    sounding = sum(n[1] - n[0] for n in notes)
    return min(1.0, sounding / total_span)


def _segment_notes(
    times: np.ndarray, midi_notes: np.ndarray, hop_s: float,
    min_dur: float = 0.05,
) -> list[tuple[float, float, int]]:
    """Segment frame-level pitch into discrete notes."""
    if len(times) == 0:
        return []

    notes = []
    seg_start = 0
    current_note = round(float(midi_notes[0]))

    for i in range(1, len(times)):
        rounded = round(float(midi_notes[i]))
        gap = times[i] - times[i-1]

        if rounded != current_note or gap > hop_s * 3:
            dur = float(times[i-1] - times[seg_start]) + hop_s
            if dur >= min_dur:
                notes.append((float(times[seg_start]), float(times[i-1]) + hop_s, current_note))
            seg_start = i
            current_note = rounded

    # Last segment
    dur = float(times[-1] - times[seg_start]) + hop_s
    if dur >= min_dur:
        notes.append((float(times[seg_start]), float(times[-1]) + hop_s, current_note))

    return notes


def _print_audio_summary(f: dict) -> None:
    print(f"  Duration: {f['duration_s']:.1f}s")
    print(f"  Voiced ratio: {f['voiced_ratio']:.2%}")
    print(f"  Pitch range: {f['pitch_min_hz']:.0f}–{f['pitch_max_hz']:.0f} Hz "
          f"(MIDI {f['midi_range'][0]:.0f}–{f['midi_range'][1]:.0f})")
    print(f"  Detected notes: {f['num_notes']}")
    print(f"  Audio onsets: {f['num_onsets']}")


def _print_midi_summary(f: dict) -> None:
    print(f"  Track: {f['track_name']}")
    print(f"  Notes: {f['num_notes']}")
    if f["num_notes"] > 0:
        print(f"  Pitch range: MIDI {f['pitch_min']}–{f['pitch_max']} ({f['pitch_range']} semitones)")
        print(f"  Unique pitches: {f['unique_pitches']}")
        print(f"  Duration: mean={f['duration_mean']:.3f}s  min={f['duration_min']:.3f}s  max={f['duration_max']:.3f}s")
        print(f"  Note density: {f['note_density_per_sec']:.2f}/s")
        print(f"  Time span: {f['time_span']:.1f}s")


def main():
    example_dir = Path(__file__).parent / "Examples" / "Skillet - Feel Invincible"
    gen_midi_dir = Path(__file__).parent / "output" / "midi"

    vocals_audio = example_dir / "vocals.ogg"
    ref_midi = example_dir / "notes.mid"
    gen_midi = gen_midi_dir / "vocals_vocals_raw.mid"

    if not vocals_audio.exists():
        print(f"ERROR: {vocals_audio} not found", file=sys.stderr)
        sys.exit(1)
    if not ref_midi.exists():
        print(f"ERROR: {ref_midi} not found", file=sys.stderr)
        sys.exit(1)
    if not gen_midi.exists():
        print(f"ERROR: {gen_midi} not found", file=sys.stderr)
        sys.exit(1)

    # 1. Analyze audio
    audio_features = extract_audio_features(vocals_audio)

    # 2. Analyze reference MIDI (Harmonix chart)
    ref_features = extract_midi_features(ref_midi, track_filter="vocal")

    # 3. Analyze generated MIDI
    gen_features = extract_midi_features(gen_midi, track_filter="vocal")

    # 4. Compare
    compare_features(audio_features, ref_features, gen_features)


if __name__ == "__main__":
    main()
