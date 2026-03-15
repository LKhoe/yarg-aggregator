"""
Global configuration for the automated charting pipeline.
All paths and tunable parameters live here.
"""
from pathlib import Path

import torch

# ── Output directories ───────────────────────────────────────────────────────
LAB_DIR = Path(__file__).parent.parent
STEMS_DIR = LAB_DIR / "output" / "stems"
MIDI_DIR = LAB_DIR / "output" / "midi"
CHART_DIR = LAB_DIR / "output" / "chart"

# ── Device auto-detection ─────────────────────────────────────────────────────
if torch.cuda.is_available():
    DEVICE = "cuda"
elif torch.backends.mps.is_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"

# ── Stem separation (Demucs) ─────────────────────────────────────────────────
DEMUCS_MODEL = "htdemucs_6s"          # 6-stem: drums/bass/guitar/piano/vocals/other

# ── Beat detection (librosa) ─────────────────────────────────────────────────
BEAT_TRIM_SILENCE = True              # trim leading silence before detection
BEAT_START_BPM = 120.0               # prior for librosa BPM estimator

# ── Guitar / Bass pitch detection (Basic Pitch) ──────────────────────────────
BASIC_PITCH_MIN_NOTE_LEN = 0.1       # seconds — shorter notes are filtered
BASIC_PITCH_CONFIDENCE = 0.5         # note-on confidence threshold
BASIC_PITCH_MIN_FREQ = 40.0          # Hz — ignore below (cleans drum bleed)
BASIC_PITCH_MAX_FREQ = 2000.0        # Hz

# ── Vocal pitch detection (torchcrepe) ───────────────────────────────────────
CREPE_MODEL = "full"                 # "tiny" or "full" (torchcrepe only supports these two)
CREPE_CONFIDENCE_THRESHOLD = 0.35   # frame-level voicing threshold (low = more frames kept)
CREPE_NOTE_MIN_DURATION = 0.045     # seconds — discard notes shorter than this (ref min=0.045)
CREPE_FMIN = 60.0                   # Hz  (C2 — lowest vocal note authored)
CREPE_FMAX = 1000.0                 # Hz  (B4 ≈ 988 Hz — highest vocal note authored)
CREPE_ONSET_DELTA = 0.15            # onset detection sensitivity for syllable splitting

# ── MIDI / quantization ───────────────────────────────────────────────────────
MIDI_RESOLUTION = 480               # ticks per quarter note (standard)
SNAP_DIVISIONS = [4, 8, 16, 32]    # snap options; pipeline uses 16th by default
DEFAULT_SNAP = 16                   # snap all notes to 1/16 note grid

# ── Guitar → 5-lane mapping ───────────────────────────────────────────────────
# Maps MIDI pitch classes (0-11) to guitar fret lane (0-4)
# This is a chromatic "mod-5" mapping; the chart editor can remap manually.
PITCH_CLASS_TO_LANE = {
    0:  0,  # C  → Green
    1:  0,  # C# → Green  (default same as C)
    2:  1,  # D  → Red
    3:  1,  # D# → Red
    4:  2,  # E  → Yellow
    5:  2,  # F  → Yellow
    6:  3,  # F# → Blue
    7:  3,  # G  → Blue
    8:  4,  # G# → Orange
    9:  4,  # A  → Orange
    10: 0,  # A# → Green  (wraps)
    11: 1,  # B  → Red    (wraps)
}

# ── Drum → 5-pad mapping ─────────────────────────────────────────────────────
# GM MIDI drum note → Rock Band pad (0=kick, 1=red/snare, 2=yellow/hihat,
#                                    3=blue/mid-tom, 4=green/crash+floor)
DRUM_NOTE_TO_PAD = {
    35: 0, 36: 0,           # Bass drum 1 & 2 → Kick
    38: 1, 40: 1, 37: 1,   # Snare, snare rim → Red
    26: 2, 42: 2, 46: 2,   # Hi-hat closed/open, pedal → Yellow
    47: 3, 48: 3, 43: 3,   # Low/mid tom, high floor tom → Blue
    49: 4, 57: 4, 51: 4,   # Crash 1 & 2, ride → Green
    45: 3, 50: 3,           # Low/high tom → Blue
    41: 4, 39: 1,           # Low floor → Green, hand clap → Red
}

# ── Drum band definitions ────────────────────────────────────────────────────
# Per-band onset sensitivity (delta) and reduced frequency overlaps.
DRUM_BANDS = [
    {"label": "kick",  "lo": 20,   "hi": 120,   "pad": 0, "delta": 0.06},
    {"label": "snare", "lo": 150,  "hi": 500,   "pad": 1, "delta": 0.04},
    {"label": "hihat", "lo": 500,  "hi": 4000,  "pad": 2, "delta": 0.03},
    {"label": "tom",   "lo": 200,  "hi": 400,   "pad": 3, "delta": 0.05},
    {"label": "crash", "lo": 4000, "hi": 16000, "pad": 4, "delta": 0.04},
]

# Cross-band NMS: max time gap (seconds) for deduplication across pads.
DRUM_NMS_WINDOW_S = 0.030  # 30ms

# Pad combos that are allowed to fire simultaneously (no NMS between them).
DRUM_NMS_ALLOW_COMBOS = {
    frozenset({0, 2}),  # kick + hihat
    frozenset({1, 2}),  # snare + hihat
    frozenset({0, 4}),  # kick + crash
    frozenset({1, 4}),  # snare + crash
}

# ── Lyrics acquisition ───────────────────────────────────────────────────────
LYRICS_MAX_OFFSET_S = 5.0                # cross-correlation search range
LYRICS_OFFSET_THRESHOLD_S = 0.2          # apply correction if offset > this
LYRICS_PHRASE_PAD_BEFORE_S = 0.2         # audio padding before phrase for CREPE
LYRICS_PHRASE_PAD_AFTER_S = 0.1          # audio padding after phrase
LYRICS_MIN_PHRASE_ENERGY = 0.01          # RMS threshold for dropping silent phrases
WHISPERX_MODEL_SIZE = "base"             # Whisper model size for fallback

# ── .chart serialization ─────────────────────────────────────────────────────
CHART_RESOLUTION = 192              # ticks-per-beat used in .chart format
