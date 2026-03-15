#!/usr/bin/env python3
"""
Automated Chart Generation Pipeline
====================================
Converts a single .mp3 (or any audio file) into a .chart file
ready to be imported into the YARG chart editor for manual cleanup.

Usage:
    python run_pipeline.py <audio_file> [--name "Song Name"] [--artist "Artist"]
                           [--skip-stems] [--skip-beats] [--skip-guitar]
                           [--skip-bass] [--skip-drums] [--skip-vocals]
                           [--skip-keys] [--skip-difficulties]
                           [--bpm-multiplier FLOAT] [--doublekick MS]
                           [--force]

Examples:
    python run_pipeline.py ~/music/song.mp3
    python run_pipeline.py song.wav --name "My Song" --artist "My Band"
    python run_pipeline.py song.mp3 --skip-vocals  # faster, no vocal detection
    python run_pipeline.py song.mp3 --bpm-multiplier 2.0  # fix half-tempo charts
    python run_pipeline.py song.mp3 --force  # re-run all phases, ignore cache

Output:
    lab_automated_chart/output/
        stems/          ← separated audio stems (Demucs)
        midi/           ← raw + quantized MIDI per instrument
        chart/          ← final .chart file with all 4 difficulties + validation report
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auto-chart an audio file into a .chart for YARG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("audio", help="Path to the input audio file (.mp3/.wav/.flac)")
    parser.add_argument("--name", default="Unknown Song", help="Song title")
    parser.add_argument("--artist", default="Unknown Artist", help="Artist name")
    parser.add_argument(
        "--skip-stems", action="store_true", help="Skip stem separation (use existing)"
    )
    parser.add_argument(
        "--skip-beats",
        action="store_true",
        help="Skip beat detection (use existing JSON)",
    )
    parser.add_argument(
        "--skip-guitar", action="store_true", help="Skip guitar transcription"
    )
    parser.add_argument(
        "--skip-bass", action="store_true", help="Skip bass transcription"
    )
    parser.add_argument(
        "--skip-drums", action="store_true", help="Skip drum transcription"
    )
    parser.add_argument(
        "--skip-vocals", action="store_true", help="Skip vocal transcription"
    )
    parser.add_argument(
        "--skip-keys", action="store_true", help="Skip keys/piano transcription"
    )
    parser.add_argument(
        "--skip-difficulties",
        action="store_true",
        help="Skip auto-difficulty generation (EasyChartGenerator)",
    )
    parser.add_argument(
        "--bpm-multiplier",
        type=float,
        default=1.0,
        help="BPM correction factor for EasyChartGenerator (2.0 = fix half-tempo charts)",
    )
    parser.add_argument(
        "--doublekick",
        type=int,
        default=0,
        help="Double-kick threshold in ms for drum charts (0 = disabled, try 150)",
    )
    parser.add_argument(
        "--snap",
        type=int,
        default=16,
        choices=[4, 8, 16, 32],
        help="Quantization grid (default: 16 = 1/16 note)",
    )
    parser.add_argument(
        "--lyrics",
        type=str,
        default=None,
        help="Path to LRC lyrics file (skip online fetch)",
    )
    parser.add_argument(
        "--skip-lyrics", action="store_true", help="Skip lyrics acquisition"
    )
    parser.add_argument(
        "--lyrics-offset",
        type=float,
        default=0.0,
        help="Global offset in seconds for lyrics timing (negative = earlier)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run all phases, ignore cached intermediate files",
    )
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # ── Output dirs ───────────────────────────────────────────────────────────
    lab = Path(__file__).parent
    song_out_dir = lab / "output" / audio_path.stem
    song_out_dir.mkdir(parents=True, exist_ok=True)
    out_midi = lab / "output" / "midi"
    out_midi.mkdir(parents=True, exist_ok=True)

    # ── Force: clear cached intermediates ─────────────────────────────────────
    if args.force:
        _clear_cache(audio_path, out_midi, song_out_dir)

    t_start = time.time()

    from pipeline.config import DEVICE

    print("=" * 60)
    print("  YARG Auto-Chartter")
    print(f"  Song   : {args.name}")
    print(f"  Artist : {args.artist}")
    print(f"  Audio  : {audio_path.name}")
    print(f"  Device : {DEVICE}")
    print("=" * 60)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 1a: Stem separation
    # ─────────────────────────────────────────────────────────────────────────
    from pipeline.phase1_stems import separate_stems

    print("\n── Phase 1a: Stem Separation ─────────────────────────────")
    if args.skip_stems:
        print("[stems] Skipped.")
        stems = _find_existing_stems(audio_path, song_out_dir, lab)
    else:
        stems = separate_stems(audio_path, dest_dir=song_out_dir)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 1b: Beat detection (uses original full mix for best results)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 1b: Beat & BPM Detection ───────────────────────")
    beats_json = out_midi / f"{audio_path.stem}_beats.json"

    if args.skip_beats and beats_json.exists():
        print(f"[beats] Loading existing: {beats_json.name}")
        beats_data = json.loads(beats_json.read_text())
    else:
        from pipeline.phase1_beats import detect_beats

        # Use original audio for beat detection (full mix is most reliable)
        beats_data = detect_beats(audio_path)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 1c: Lyrics acquisition
    # ─────────────────────────────────────────────────────────────────────────
    phrases = None
    if not args.skip_lyrics and not args.skip_vocals and "vocals" in stems:
        print("\n── Phase 1c: Lyrics Acquisition ──────────────────────────")
        from pipeline.phase1c_lyrics import acquire_lyrics

        phrases = acquire_lyrics(
            stems["vocals"],
            args.name,
            args.artist,
            lyrics_file=Path(args.lyrics) if args.lyrics else None,
            force=args.force,
            offset_s=args.lyrics_offset,
        )
    elif args.skip_lyrics:
        print("\n── Phase 1c: Lyrics Acquisition ──────────────────────────")
        print("[lyrics] Skipped.")

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 2: Instrument transcription (parallel)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 2: Instrument Transcription (parallel) ─────────")
    raw_midis: dict[str, Path] = {}

    tasks: dict[str, tuple] = {}
    if not args.skip_guitar and "guitar" in stems:
        tasks["guitar"] = ("guitar_instrument", stems["guitar"], "guitar")
    if not args.skip_bass and "bass" in stems:
        tasks["bass"] = ("guitar_instrument", stems["bass"], "bass")
    if not args.skip_keys and "piano" in stems:
        tasks["keys"] = ("guitar_instrument", stems["piano"], "keys")
    if not args.skip_drums and "drums" in stems:
        tasks["drums"] = ("drums", stems["drums"])
    if not args.skip_vocals and "vocals" in stems:
        tasks["vocals"] = ("vocals", stems["vocals"], phrases)

    if tasks:
        with ProcessPoolExecutor(max_workers=min(4, len(tasks))) as pool:
            futures = {}
            for label, task_args in tasks.items():
                task_type = task_args[0]
                if task_type == "guitar_instrument":
                    futures[label] = pool.submit(
                        _transcribe_guitar_worker, task_args[1], task_args[2]
                    )
                elif task_type == "drums":
                    futures[label] = pool.submit(_transcribe_drums_worker, task_args[1])
                elif task_type == "vocals":
                    futures[label] = pool.submit(
                        _transcribe_vocals_worker, task_args[1], task_args[2]
                    )

            for label, future in futures.items():
                try:
                    result = future.result()
                    raw_midis[label] = result
                    print(f"[phase2] {label} transcription complete → {result.name}")
                except Exception as e:
                    print(f"[phase2] ERROR in {label}: {e}")
    else:
        print("\nWARNING: No instrument transcription tasks. Check that stems exist.")

    if not raw_midis:
        print("\nWARNING: No instrument MIDI was generated. Check that stems exist.")

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 3: Quantize + Lane mapping
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 3: Quantize & Lane Mapping ─────────────────────")
    from pipeline.phase3_map_lanes import map_drums_to_pads, map_guitar_to_lanes
    from pipeline.phase3_quantize import quantize_midi

    lane_midis: dict[str, Path] = {}

    for label, raw_path in raw_midis.items():
        quantized = quantize_midi(raw_path, beats_data, snap=args.snap)
        if label == "drums":
            lane_midis[label] = map_drums_to_pads(quantized)
        elif label == "vocals":
            from pipeline.phase3_map_lanes import map_vocals_pitch

            lane_midis[label] = map_vocals_pitch(quantized)
        else:
            lane_midis[label] = map_guitar_to_lanes(quantized, label)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 4: Export .chart
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 4: Export .chart ────────────────────────────────")
    from pipeline.phase4_export_chart import export_chart

    chart_path = export_chart(
        song_name=args.name,
        artist=args.artist,
        bpm_events=beats_data.get("bpm_events", []),
        midi_files=lane_midis,
        lyrics=phrases,
        output_dir=song_out_dir,
    )

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 4b: Auto-generate Easy / Medium / Hard (EasyChartGenerator)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 4b: Auto-Difficulty Generation (EasyChartGenerator) ─")
    if args.skip_difficulties:
        print("[easychart] Skipped.")
    else:
        from pipeline.phase4b_easychart import generate_difficulties

        chart_path = generate_difficulties(
            chart_path,
            bpm_multiplier=args.bpm_multiplier,
            doublekick_ms=args.doublekick,
            force=True,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 5: Validate
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 5: Validation ───────────────────────────────────")
    from pipeline.phase5_validate import validate_chart

    report = validate_chart(chart_path)

    # ─────────────────────────────────────────────────────────────────────────
    # Summary
    # ─────────────────────────────────────────────────────────────────────────
    elapsed = time.time() - t_start
    print("\n" + "=" * 60)
    print(f"  Pipeline complete in {elapsed:.1f}s")
    print(f"  Output: {chart_path}")
    print(f"  Errors: {len(report.errors)}")
    print(f"  Warnings: {len(report.warnings)}")
    print()
    print("  Next steps:")
    print("  1. Import the .chart into the YARG chart editor")
    print("  2. Review and correct note lane assignments (all 4 difficulties)")
    print("  3. Fine-tune Hard / Medium / Easy auto-generated notes")
    print("  4. Add lyrics to the Vocals track")
    print("  5. Place overdrive phrases & solo markers")
    print("=" * 60)


# ── Worker functions for parallel transcription ─────────────────────────────


def _transcribe_guitar_worker(stem_path: Path, label: str) -> Path:
    """Worker: transcribe guitar/bass/keys using Basic Pitch."""
    from pipeline.phase2_guitar import transcribe_instrument

    return transcribe_instrument(stem_path, label)


def _transcribe_drums_worker(stem_path: Path) -> Path:
    """Worker: transcribe drums."""
    from pipeline.phase2_drums import transcribe_drums

    return transcribe_drums(stem_path)


def _transcribe_vocals_worker(
    stem_path: Path, phrases: list[dict] | None = None
) -> Path:
    """Worker: transcribe vocals using CREPE, optionally guided by lyrics phrases."""
    from pipeline.phase2_vocals import transcribe_vocals

    return transcribe_vocals(stem_path, phrases=phrases)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _clear_cache(audio_path: Path, midi_dir: Path, song_out_dir: Path) -> None:
    """Delete cached intermediate files for the given audio file."""
    stem = audio_path.stem
    cleared = 0
    # Clear MIDI intermediates
    if midi_dir.exists():
        for f in midi_dir.iterdir():
            if f.is_file() and stem in f.name:
                f.unlink()
                cleared += 1
    # Clear song output dir (stems + chart)
    if song_out_dir.exists():
        for f in song_out_dir.iterdir():
            if f.is_file():
                f.unlink()
                cleared += 1
    if cleared:
        print(f"[force] Cleared {cleared} cached files for '{stem}'")


def _find_existing_stems(
    audio_path: Path, song_out_dir: Path, lab: Path
) -> dict[str, Path]:
    """Look for stems already separated in a previous run."""
    from pipeline.config import DEMUCS_MODEL, STEMS_DIR
    from pipeline.phase1_stems import STEM_NAMES

    stems: dict[str, Path] = {}

    # Check flat song output dir first
    for name in STEM_NAMES:
        for ext in [".wav", ".mp3"]:
            p = song_out_dir / f"{name}{ext}"
            if p.exists():
                stems[name] = p
                break

    if stems:
        return stems

    # Fall back to old Demucs nested location
    stem_dir = Path(STEMS_DIR) / DEMUCS_MODEL / audio_path.stem
    for name in STEM_NAMES:
        for ext in [".wav", ".mp3"]:
            p = stem_dir / f"{name}{ext}"
            if p.exists():
                stems[name] = p
                break

    if not stems:
        print(f"[stems] WARNING: No existing stems found in {song_out_dir}")
        print("[stems] Tip: Run without --skip-stems to generate them first.")
    return stems


if __name__ == "__main__":
    main()
