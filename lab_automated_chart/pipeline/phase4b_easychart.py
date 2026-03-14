"""
Phase 4b — Automatic Difficulty Generation (EasyChartGenerator)
Wraps eerovil/EasyChartGenerator to generate Hard, Medium and Easy
difficulty tracks from the Expert chart produced in Phase 4.

Source: https://github.com/eerovil/EasyChartGenerator

The Parser class takes a chart file, analyses the expert note data
(beat positions, timing, snare patterns) and applies instrument-specific
reduction rules for each lower difficulty:

  Guitar/Bass:
    Hard   → half-beat notes, no G/O chords, reduced 16ths
    Medium → on/off-beat only, max 2-note chords
    Easy   → on-beat only, single notes, colour remapping

  Drums:
    Hard   → kick + 1 extra note on-beat, 2-note chords off-beat
    Medium → on/off-beat, no bass on off-beats, max 2-note chords
    Easy   → on-beat only, no kick/crash pairing

Also detects half-tempo charted songs automatically via snare pattern
analysis and applies the correct BPM multiplier.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from types import SimpleNamespace

# ── Add EasyChartGenerator to sys.path ───────────────────────────────────────
_ECG_DIR = Path(__file__).parent.parent / "EasyChartGenerator"
if str(_ECG_DIR) not in sys.path:
    sys.path.insert(0, str(_ECG_DIR))

try:
    from EasyChartGenerator.easygen import Parser as _ECGParser
    _ECG_AVAILABLE = True
except ImportError:
    _ECG_AVAILABLE = False


def generate_difficulties(
    chart_path: Path,
    bpm_multiplier: float = 1.0,
    doublekick_ms: int = 0,
    force: bool = True,
) -> Path:
    """
    Run EasyChartGenerator on *chart_path* in-place, adding Hard / Medium /
    Easy difficulty sections to the existing Expert chart.

    Args:
        chart_path:      Path to the .chart file produced by Phase 4.
        bpm_multiplier:  Tempo correction factor.  Use 2.0 for songs charted
                         at half BPM (EasyChartGenerator can auto-detect this
                         from snare patterns, but you can set it explicitly).
        doublekick_ms:   Threshold in milliseconds for auto-marking double kick
                         events on drum charts (0 = disabled).
        force:           Replace any existing Easy/Medium/Hard sections.

    Returns:
        The same chart_path, now containing all four difficulty levels.
    """
    if not _ECG_AVAILABLE:
        raise ImportError(
            "EasyChartGenerator not found.\n"
            f"Expected at: {_ECG_DIR}\n"
            "Clone it with: git clone https://github.com/eerovil/EasyChartGenerator"
        )

    chart_path = Path(chart_path)
    if not chart_path.exists():
        raise FileNotFoundError(chart_path)

    print(f"[easychart] Generating Easy / Medium / Hard from {chart_path.name} ...")

    # Build the options namespace EasyChartGenerator's Parser expects
    opts = SimpleNamespace(
        easy=True,
        medium=True,
        hard=True,
        force=force,
        bpm_multiplier=bpm_multiplier,
        doublekick=doublekick_ms,
    )

    # Read file (strip BOM if present, as ECG's main() does)
    raw_lines = chart_path.read_text(encoding="utf-8-sig").splitlines()
    lines = [line.strip() for line in raw_lines]

    # Suppress ECG's own verbose logging during normal pipeline runs
    ecg_logger = logging.getLogger("EasyChartGenerator")
    ecg_logger.setLevel(logging.WARNING)

    parser = _ECGParser(opts)
    parser.parse_file(lines)

    # Write back in-place (all four difficulties in one .chart file)
    parser.write_file(str(chart_path))

    # Post-process: remove duplicate notes ECG's reduction may introduce
    _dedup_chart(chart_path)

    # Report what was generated
    generated = list(parser.new_parts.keys())
    print(f"[easychart] Generated sections: {generated or '(none — may already exist)'}")
    print(f"[easychart] Chart updated: {chart_path}")

    return chart_path


def _dedup_chart(chart_path: Path) -> None:
    """
    Remove duplicate `N` (note) events at the same tick+fret within each
    track section. EasyChartGenerator can occasionally emit two identical
    note lines when reducing Expert to Medium/Hard.
    """
    import re

    text = chart_path.read_text(encoding="utf-8")
    section_re = re.compile(r"(\[[^\]]+\]\s*\{[^}]*\})", re.DOTALL)
    note_re = re.compile(r"^(\s*)(\d+)\s*=\s*N\s+(\d+)\s+(\d+)", re.MULTILINE)

    def dedup_section(m: re.Match) -> str:
        block = m.group(1)
        seen: set[tuple[int, int]] = set()
        out_lines = []
        for line in block.splitlines(keepends=True):
            nm = note_re.match(line)
            if nm:
                key = (int(nm.group(2)), int(nm.group(3)))  # (tick, fret)
                if key in seen:
                    continue
                seen.add(key)
            out_lines.append(line)
        return "".join(out_lines)

    deduped = section_re.sub(dedup_section, text)
    chart_path.write_text(deduped, encoding="utf-8")
