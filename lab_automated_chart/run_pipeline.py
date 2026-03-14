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
                           [--skip-difficulties] [--bpm-multiplier FLOAT]
                           [--doublekick MS]

Examples:
    python run_pipeline.py ~/music/song.mp3
    python run_pipeline.py song.wav --name "My Song" --artist "My Band"
    python run_pipeline.py song.mp3 --skip-vocals  # faster, no vocal detection
    python run_pipeline.py song.mp3 --bpm-multiplier 2.0  # fix half-tempo charts

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
    parser.add_argument("--skip-stems", action="store_true", help="Skip stem separation (use existing)")
    parser.add_argument("--skip-beats", action="store_true", help="Skip beat detection (use existing JSON)")
    parser.add_argument("--skip-guitar", action="store_true", help="Skip guitar transcription")
    parser.add_argument("--skip-bass", action="store_true", help="Skip bass transcription")
    parser.add_argument("--skip-drums", action="store_true", help="Skip drum transcription")
    parser.add_argument("--skip-vocals", action="store_true", help="Skip vocal transcription")
    parser.add_argument("--skip-difficulties", action="store_true",
                        help="Skip auto-difficulty generation (EasyChartGenerator)")
    parser.add_argument("--bpm-multiplier", type=float, default=1.0,
                        help="BPM correction factor for EasyChartGenerator (2.0 = fix half-tempo charts)")
    parser.add_argument("--doublekick", type=int, default=0,
                        help="Double-kick threshold in ms for drum charts (0 = disabled, try 150)")
    parser.add_argument("--snap", type=int, default=16,
                        choices=[4, 8, 16, 32], help="Quantization grid (default: 16 = 1/16 note)")
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # ── Output dirs ───────────────────────────────────────────────────────────
    lab = Path(__file__).parent
    out_midi = lab / "output" / "midi"
    out_midi.mkdir(parents=True, exist_ok=True)

    t_start = time.time()
    print("=" * 60)
    print(f"  YARG Auto-Chartter")
    print(f"  Song   : {args.name}")
    print(f"  Artist : {args.artist}")
    print(f"  Audio  : {audio_path.name}")
    print("=" * 60)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 1a: Stem separation
    # ─────────────────────────────────────────────────────────────────────────
    from pipeline.phase1_stems import separate_stems
    print("\n── Phase 1a: Stem Separation ─────────────────────────────")
    if args.skip_stems:
        print("[stems] Skipped.")
        # Try to find existing stems
        stems = _find_existing_stems(audio_path, lab)
    else:
        stems = separate_stems(audio_path)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 1b: Beat detection
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 1b: Beat & BPM Detection ───────────────────────")
    beats_json = out_midi / f"{audio_path.stem}_beats.json"

    if args.skip_beats and beats_json.exists():
        print(f"[beats] Loading existing: {beats_json.name}")
        beats_data = json.loads(beats_json.read_text())
    else:
        from pipeline.phase1_beats import detect_beats
        # Prefer the "other" or original file for beat detection (full mix is best)
        beat_source = stems.get("other", stems.get("drums", audio_path))
        beats_data = detect_beats(beat_source)

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 2: Instrument transcription
    # ─────────────────────────────────────────────────────────────────────────
    raw_midis: dict[str, Path] = {}

    if not args.skip_guitar and "guitar" in stems:
        print("\n── Phase 2a: Guitar Transcription ────────────────────────")
        from pipeline.phase2_guitar import transcribe_instrument
        raw_midis["guitar"] = transcribe_instrument(stems["guitar"], "guitar")

    if not args.skip_bass and "bass" in stems:
        print("\n── Phase 2b: Bass Transcription ──────────────────────────")
        from pipeline.phase2_guitar import transcribe_instrument
        raw_midis["bass"] = transcribe_instrument(stems["bass"], "bass")

    if not args.skip_drums and "drums" in stems:
        print("\n── Phase 2c: Drum Transcription ──────────────────────────")
        from pipeline.phase2_drums import transcribe_drums
        raw_midis["drums"] = transcribe_drums(stems["drums"])

    if not args.skip_vocals and "vocals" in stems:
        print("\n── Phase 2d: Vocal Melody Extraction ────────────────────")
        from pipeline.phase2_vocals import transcribe_vocals
        raw_midis["vocals"] = transcribe_vocals(stems["vocals"])

    if not raw_midis:
        print("\nWARNING: No instrument MIDI was generated. Check that stems exist.")

    # ─────────────────────────────────────────────────────────────────────────
    # Phase 3: Quantize + Lane mapping
    # ─────────────────────────────────────────────────────────────────────────
    print("\n── Phase 3: Quantize & Lane Mapping ─────────────────────")
    from pipeline.phase3_quantize import quantize_midi
    from pipeline.phase3_map_lanes import map_guitar_to_lanes, map_drums_to_pads

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


def _find_existing_stems(audio_path: Path, lab: Path) -> dict[str, Path]:
    """Look for stems already separated in a previous run."""
    from pipeline.config import STEMS_DIR, DEMUCS_MODEL
    from pipeline.phase1_stems import STEM_NAMES
    stem_dir = Path(STEMS_DIR) / DEMUCS_MODEL / audio_path.stem
    stems: dict[str, Path] = {}
    for name in STEM_NAMES:
        for ext in [".wav", ".mp3"]:
            p = stem_dir / f"{name}{ext}"
            if p.exists():
                stems[name] = p
                break
    if not stems:
        print(f"[stems] WARNING: No existing stems found in {stem_dir}")
        print("[stems] Tip: Run without --skip-stems to generate them first.")
    return stems


if __name__ == "__main__":
    main()
