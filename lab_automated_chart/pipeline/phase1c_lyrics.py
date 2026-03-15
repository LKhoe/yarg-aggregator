"""
Phase 1c — Lyrics Acquisition & Timing Validation
Acquires synced lyrics from three sources (user LRC, online fetch, WhisperX fallback)
and validates timing against the vocal stem's energy envelope.

Returns phrase list: [{"time_s": float, "end_s": float, "text": str}, ...] or None.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from .config import (
    LYRICS_MIN_PHRASE_ENERGY,
    MIDI_DIR,
    WHISPERX_MODEL_SIZE,
    DEVICE,
)


def acquire_lyrics(
    vocal_stem_path: Path,
    song_name: str,
    artist: str,
    lyrics_file: Path | None = None,
    force: bool = False,
    offset_s: float = 0.0,
) -> list[dict] | None:
    """
    Acquire synced lyrics through a three-tier fallback chain.

    Priority:
    1. User-provided LRC file (--lyrics flag)
    2. Online fetch via syncedlyrics package
    3. WhisperX transcription + forced alignment

    After acquisition, validate timing against vocal stem energy.
    Results are cached to output/midi/<stem>_lyrics.json.
    """
    vocal_stem_path = Path(vocal_stem_path)
    cache_path = Path(MIDI_DIR) / f"{vocal_stem_path.stem}_lyrics.json"

    # Check cache
    if cache_path.exists() and not force:
        print(f"[lyrics] Loading cached lyrics: {cache_path.name}")
        phrases = json.loads(cache_path.read_text())
        if phrases:
            print(f"[lyrics] {len(phrases)} cached phrases")
            return phrases

    phrases = None

    # Tier 1: User-provided LRC file
    if lyrics_file is not None:
        lyrics_file = Path(lyrics_file)
        if lyrics_file.exists():
            print(f"[lyrics] Parsing user LRC: {lyrics_file.name}")
            phrases = _parse_lrc(lyrics_file.read_text())
            if phrases:
                print(f"[lyrics] Parsed {len(phrases)} phrases from LRC file")
        else:
            print(f"[lyrics] WARNING: LRC file not found: {lyrics_file}")

    # Tier 2: Online fetch
    if phrases is None:
        print(f"[lyrics] Searching online for: {artist} - {song_name}")
        phrases = _fetch_online(song_name, artist)
        if phrases:
            print(f"[lyrics] Found {len(phrases)} phrases online")

    # Tier 3: WhisperX fallback
    if phrases is None:
        print("[lyrics] Trying WhisperX transcription fallback ...")
        phrases = _transcribe_whisperx(vocal_stem_path)
        if phrases:
            print(f"[lyrics] WhisperX produced {len(phrases)} phrases")

    if phrases is None:
        print("[lyrics] No lyrics source available — proceeding without lyrics")
        return None

    # Validate timing against vocal energy
    phrases = _validate_timing(phrases, vocal_stem_path, offset_s=offset_s)

    if not phrases:
        print("[lyrics] No valid phrases after timing validation")
        return None

    # Cache result
    Path(MIDI_DIR).mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(phrases, indent=2))
    print(f"[lyrics] {len(phrases)} phrases validated and cached → {cache_path.name}")

    return phrases


def _parse_lrc(lrc_text: str) -> list[dict] | None:
    """Parse LRC-style lyrics: [mm:ss.xx] text → list of {time_s, end_s, text}."""
    lines = lrc_text.strip().splitlines()
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

    if not phrases:
        return None

    # Set end times: each phrase ends when the next one starts
    for i in range(len(phrases) - 1):
        phrases[i]["end_s"] = phrases[i + 1]["time_s"]
    # Last phrase: extend 3 seconds
    phrases[-1]["end_s"] = phrases[-1]["time_s"] + 3.0

    return phrases


def _fetch_online(song_name: str, artist: str) -> list[dict] | None:
    """Fetch synced lyrics online using the syncedlyrics package."""
    try:
        import syncedlyrics
    except ImportError:
        print("[lyrics] syncedlyrics not installed — skipping online fetch")
        return None

    try:
        query = f"{artist} {song_name}"
        lrc_text = syncedlyrics.search(query)
        if not lrc_text:
            print("[lyrics] No synced lyrics found online")
            return None
        return _parse_lrc(lrc_text)
    except Exception as e:
        print(f"[lyrics] Online fetch failed: {e}")
        return None


def _transcribe_whisperx(vocal_stem_path: Path) -> list[dict] | None:
    """Transcribe vocals with WhisperX and group words into phrases by pause gaps."""
    try:
        import whisperx
    except ImportError:
        print("[lyrics] whisperx not installed — skipping transcription fallback")
        return None

    try:
        # Transcribe
        model = whisperx.load_model(
            WHISPERX_MODEL_SIZE,
            device=DEVICE,
            compute_type="float32" if DEVICE == "cpu" else "float16",
        )
        audio = whisperx.load_audio(str(vocal_stem_path))
        result = model.transcribe(audio, batch_size=16)

        # Forced alignment for word-level timestamps
        align_model, metadata = whisperx.load_align_model(
            language_code=result.get("language", "en"),
            device=DEVICE,
        )
        result = whisperx.align(
            result["segments"], align_model, metadata, audio, DEVICE,
            return_char_alignments=False,
        )

        # Group words into phrases by pause gaps (> 0.5s gap = new phrase)
        words = []
        for seg in result.get("segments", []):
            for w in seg.get("words", []):
                if "start" in w and "end" in w:
                    words.append(w)

        if not words:
            return None

        phrases = []
        current_words = [words[0]]
        for w in words[1:]:
            gap = w["start"] - current_words[-1]["end"]
            if gap > 0.5:
                # Emit current phrase
                phrases.append({
                    "time_s": current_words[0]["start"],
                    "end_s": current_words[-1]["end"],
                    "text": " ".join(cw["word"] for cw in current_words),
                })
                current_words = [w]
            else:
                current_words.append(w)

        # Emit last phrase
        if current_words:
            phrases.append({
                "time_s": current_words[0]["start"],
                "end_s": current_words[-1]["end"],
                "text": " ".join(cw["word"] for cw in current_words),
            })

        return phrases if phrases else None

    except Exception as e:
        print(f"[lyrics] WhisperX transcription failed: {e}")
        return None


def _validate_timing(
    phrases: list[dict],
    vocal_stem_path: Path,
    offset_s: float = 0.0,
) -> list[dict]:
    """
    Apply manual offset and drop phrases with near-zero vocal energy.

    Args:
        offset_s: Manual global offset in seconds (from --lyrics-offset).
                  Negative = shift lyrics earlier, positive = shift later.
    """
    print("[lyrics] Validating phrases against vocal energy ...")

    if offset_s != 0.0:
        print(f"[lyrics] Applying manual offset: {offset_s:+.3f}s")
        for p in phrases:
            p["time_s"] += offset_s
            p["end_s"] += offset_s

    audio, sr = sf.read(str(vocal_stem_path))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    energy = _compute_energy_envelope(audio, sr)
    energy_sr = sr / 512
    n_energy = len(energy)

    valid = []
    for p in phrases:
        start_frame = int(max(0, p["time_s"]) * energy_sr)
        end_frame = int(p["end_s"] * energy_sr)
        start_frame = max(0, min(start_frame, n_energy - 1))
        end_frame = max(start_frame + 1, min(end_frame, n_energy))

        phrase_energy = np.mean(energy[start_frame:end_frame])
        if phrase_energy >= LYRICS_MIN_PHRASE_ENERGY:
            valid.append(p)
        else:
            print(f"[lyrics] Dropping silent phrase: {p['text'][:40]}")

    dropped = len(phrases) - len(valid)
    if dropped:
        print(f"[lyrics] Dropped {dropped} silent/low-energy phrases")

    return valid


def _compute_energy_envelope(audio: np.ndarray, sr: int) -> np.ndarray:
    """Compute RMS energy envelope of audio signal."""
    return librosa.feature.rms(y=audio, frame_length=1024, hop_length=512)[0]
