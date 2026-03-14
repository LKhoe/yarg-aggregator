"""
Phase 1a — Stem Separation
Uses Demucs (htdemucs_6s) to split an audio file into:
  drums / bass / guitar / piano / vocals / other
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from .config import DEMUCS_MODEL, DEMUCS_DEVICE, STEMS_DIR


STEM_NAMES = ["drums", "bass", "guitar", "piano", "vocals", "other"]


def separate_stems(audio_path: Path, output_dir: Path | None = None) -> dict[str, Path]:
    """
    Run Demucs on *audio_path* and return a mapping of stem_name → wav_path.

    Demucs writes files to:
        <output_dir>/<model>/<song_name>/<stem>.wav

    Args:
        audio_path: Path to the input .mp3 / .wav / .flac file.
        output_dir: Where Demucs places its output. Defaults to STEMS_DIR.

    Returns:
        Dict mapping stem name (e.g. "drums") to the resulting wav Path.
    """
    audio_path = Path(audio_path)
    output_dir = Path(output_dir or STEMS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    song_name = audio_path.stem
    expected_stem_dir = output_dir / DEMUCS_MODEL / song_name

    # Skip if already separated
    if expected_stem_dir.exists() and any(expected_stem_dir.iterdir()):
        print(f"[stems] Found existing stems in {expected_stem_dir}, skipping Demucs.")
    else:
        print(f"[stems] Running Demucs ({DEMUCS_MODEL}) on {audio_path.name} ...")
        cmd = [
            sys.executable, "-m", "demucs",
            "--two-stems", "vocals",   # fast fallback; override below for 6s
        ]
        # Use 6-stem model
        cmd = [
            sys.executable, "-m", "demucs",
            "-n", DEMUCS_MODEL,
            "--device", DEMUCS_DEVICE,
            "-o", str(output_dir),
            str(audio_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print("[stems] Demucs stderr:\n", result.stderr[-2000:])
            raise RuntimeError(f"Demucs failed (exit {result.returncode})")
        print(f"[stems] Done. Stems written to {expected_stem_dir}")

    # Collect output paths (Demucs writes .wav files)
    stems: dict[str, Path] = {}
    for name in STEM_NAMES:
        p = expected_stem_dir / f"{name}.wav"
        if p.exists():
            stems[name] = p
        else:
            # Some models produce .mp3; check for that too
            mp3 = expected_stem_dir / f"{name}.mp3"
            if mp3.exists():
                stems[name] = mp3

    if not stems:
        raise FileNotFoundError(
            f"No stems found in {expected_stem_dir}. "
            "Check that Demucs ran successfully."
        )

    print(f"[stems] Available stems: {list(stems.keys())}")
    return stems
