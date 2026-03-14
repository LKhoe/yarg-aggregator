"""
Global configuration for the automated charting pipeline.
All paths and tunable parameters live here.
"""
from pathlib import Path

# ── Output directories ───────────────────────────────────────────────────────
LAB_DIR = Path(__file__).parent.parent
STEMS_DIR = LAB_DIR / "output" / "stems"
MIDI_DIR = LAB_DIR / "output" / "midi"
CHART_DIR = LAB_DIR / "output" / "chart"

# ── Stem separation (Demucs) ─────────────────────────────────────────────────
DEMUCS_MODEL = "htdemucs_6s"          # 6-stem: drums/bass/guitar/piano/vocals/other
DEMUCS_DEVICE = "cpu"                 # "cuda" if GPU available

# ── Beat detection (librosa) ─────────────────────────────────────────────────
BEAT_TRIM_SILENCE = True              # trim leading silence before detection
BEAT_START_BPM = 120.0               # prior for librosa BPM estimator

# ── Guitar / Bass pitch detection (Basic Pitch) ──────────────────────────────
BASIC_PITCH_MIN_NOTE_LEN = 0.1       # seconds — shorter notes are filtered
BASIC_PITCH_CONFIDENCE = 0.5         # note-on confidence threshold
BASIC_PITCH_MIN_FREQ = 40.0          # Hz — ignore below (cleans drum bleed)
BASIC_PITCH_MAX_FREQ = 2000.0        # Hz

# ── Vocal pitch detection (torchcrepe) ───────────────────────────────────────
CREPE_MODEL = "tiny"                 # "tiny" / "small" / "medium" / "large" / "full"
CREPE_CONFIDENCE_THRESHOLD = 0.75   # only keep frames with confidence above this
CREPE_NOTE_MIN_DURATION = 0.08      # seconds — merge gaps shorter than this
CREPE_FMIN = 60.0                   # Hz  (C2 — lowest vocal note authored)
CREPE_FMAX = 1000.0                 # Hz  (B4 ≈ 988 Hz — highest vocal note authored)

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

# ── .chart serialization ─────────────────────────────────────────────────────
CHART_RESOLUTION = 192              # ticks-per-beat used in .chart format
