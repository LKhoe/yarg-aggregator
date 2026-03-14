# lab_automated_chart

Automated chart generation pipeline for YARG / Clone Hero.
Converts a single `.mp3` (or `.wav`/`.flac`) into a `.chart` file
ready to be imported into the YARG chart editor for manual cleanup.

> This folder is git-ignored and docker-ignored.

---

## Setup

```bash
cd lab_automated_chart

# Create the venv with Python 3.11 (required for all dependencies)
/opt/homebrew/bin/python3.11 -m venv .venv

# Activate
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## Usage

```bash
source .venv/bin/activate

python run_pipeline.py <audio_file> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--name "Song Title"` | Song name (default: "Unknown Song") |
| `--artist "Artist"` | Artist name (default: "Unknown Artist") |
| `--skip-stems` | Skip Demucs stem separation (use existing) |
| `--skip-beats` | Skip beat/BPM detection (use existing JSON) |
| `--skip-guitar` | Skip guitar transcription |
| `--skip-bass` | Skip bass transcription |
| `--skip-drums` | Skip drum transcription |
| `--skip-vocals` | Skip vocal pitch extraction |
| `--skip-difficulties` | Skip auto-difficulty generation (EasyChartGenerator) |
| `--snap 16` | Quantization grid: 4/8/16/32 (default: 16) |
| `--bpm-multiplier 2.0` | Fix songs charted at half-tempo (ECG also auto-detects via snare patterns) |
| `--doublekick 150` | Auto-mark double kick on drums below this ms threshold |

### Examples

```bash
# Full pipeline on an mp3
python run_pipeline.py ~/music/mysong.mp3 --name "My Song" --artist "My Band"

# Re-run without re-separating stems (faster iteration)
python run_pipeline.py song.mp3 --name "My Song" --skip-stems

# Guitar + drums only, no vocals (much faster)
python run_pipeline.py song.mp3 --skip-vocals --skip-bass

# Fix a half-tempo charted song (ECG also auto-detects via snare patterns)
python run_pipeline.py song.mp3 --bpm-multiplier 2.0

# Enable double-kick detection for drum-heavy metal songs
python run_pipeline.py song.mp3 --doublekick 150

# Skip auto-difficulty generation (Expert only)
python run_pipeline.py song.mp3 --skip-difficulties
```

---

## Pipeline Stages

```
[Audio file]
    │
    ▼
Phase 1a: Stem Separation (Demucs htdemucs_6s)
          → output/stems/htdemucs_6s/<song>/
             drums.wav  bass.wav  guitar.wav  piano.wav  vocals.wav  other.wav
    │
    ▼
Phase 1b: Beat & BPM Detection (librosa)
          → output/midi/<song>_beats.json
    │
    ├─▶ Phase 2a: Guitar transcription (Basic Pitch)
    ├─▶ Phase 2b: Bass transcription   (Basic Pitch)
    ├─▶ Phase 2c: Drum transcription   (librosa onset detection)
    └─▶ Phase 2d: Vocal extraction     (torchcrepe CREPE)
          → output/midi/*_raw.mid
    │
    ▼
Phase 3a: Quantization (snap to 1/16 note grid)
Phase 3b: Lane mapping (pitch → 5 fret lanes, drum GM notes → RB pads)
          → output/midi/*_quantized.mid
          → output/midi/*_lanes.mid
    │
    ▼
Phase 4: Export Expert .chart (Clone Hero / YARG format)
          → output/chart/<Song Name>.chart  [Expert only]
    │
    ▼
Phase 4b: Auto-Difficulty Generation (EasyChartGenerator)
          Analyses Expert note data (beat positions, snare patterns, timing)
          and applies instrument-specific reduction rules to generate:
            Guitar/Bass: Hard (half-beat notes) / Medium (on+off-beat, 2-note chords)
                         / Easy (on-beat only, single notes, colour remap)
            Drums:       Hard (kick+note on-beat, 2-note off-beat)
                         / Medium (no off-beat kick, max 2-note chords)
                         / Easy  (on-beat only, no kick/crash pairing)
          Also: auto-detects half-tempo charts via snare pattern analysis,
                double-kick detection and conversion (--doublekick)
          → output/chart/<Song Name>.chart  [Expert + Hard + Medium + Easy]
    │
    ▼
Phase 5: Validation (common authoring mistake checks)
          → printed report
```

---

## Output

```
output/
├── stems/
│   └── htdemucs_6s/<song>/
│       ├── drums.wav
│       ├── bass.wav
│       ├── guitar.wav
│       ├── piano.wav
│       ├── vocals.wav
│       └── other.wav
├── midi/
│   ├── <song>_beats.json
│   ├── <song>_guitar_raw.mid
│   ├── <song>_guitar_quantized.mid
│   ├── <song>_guitar_lanes.mid
│   ├── ... (same for bass, drums, vocals)
└── chart/
    └── <Song Name>.chart   ← import this into the chart editor
```

---

## Realistic Quality Expectations

| Stage | Accuracy | Manual work needed |
|-------|----------|--------------------|
| BPM detection | ~90% | Minor correction |
| Stem separation | Good (some bleed) | Minimal |
| Drum detection | ~70-80% hit rate | Significant cleanup |
| Guitar/bass MIDI | ~50-60% | Major cleanup + lane remapping |
| Vocal melody | ~80% (clean vocals) | Syllable boundaries + lyrics |
| Difficulty reduction | 0% | 100% manual per difficulty |

The pipeline provides a **skeleton** — not a finished chart.
Always do manual review in the chart editor before publishing.

---

## Toolchain

| Tool | Purpose |
|------|---------|
| [Demucs](https://github.com/facebookresearch/demucs) | Stem separation |
| [librosa](https://librosa.org/) | Beat/BPM detection |
| [Basic Pitch](https://github.com/spotify/basic-pitch) | Melodic pitch detection |
| [torchcrepe](https://github.com/maxrmorrison/torchcrepe) | Vocal pitch detection |
| [pretty_midi](https://github.com/craffel/pretty-midi) | MIDI processing |
| [EasyChartGenerator](https://github.com/eerovil/EasyChartGenerator) | Auto Hard/Medium/Easy difficulty generation |
