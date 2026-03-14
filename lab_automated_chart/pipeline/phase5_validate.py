"""
Phase 5 — Chart Validation
Checks the generated .chart file for common authoring mistakes and prints
a human-readable report.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ValidationIssue:
    severity: str          # "error" | "warning" | "info"
    track: str
    tick: int
    message: str

    def __str__(self) -> str:
        return f"[{self.severity.upper():7s}] {self.track} @ tick {self.tick}: {self.message}"


@dataclass
class ValidationReport:
    issues: list[ValidationIssue] = field(default_factory=list)

    def add(self, severity: str, track: str, tick: int, message: str) -> None:
        self.issues.append(ValidationIssue(severity, track, tick, message))

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]

    def print(self) -> None:
        if not self.issues:
            print("[validate] ✓ No issues found.")
            return
        for issue in sorted(self.issues, key=lambda i: (i.track, i.tick)):
            print(" ", issue)
        print(
            f"\n[validate] {len(self.errors)} error(s), "
            f"{len(self.warnings)} warning(s), "
            f"{len([i for i in self.issues if i.severity == 'info'])} info(s)"
        )


def validate_chart(chart_path: Path) -> ValidationReport:
    """
    Parse a .chart file and run common validation checks.

    Checks performed:
    - Notes shorter than 1/64 note (too short)
    - Sustain gap < 1/32 note (overlapping sustains)
    - Duplicate notes at same tick/fret in same track
    - No star power phrases
    - Tracks with 0 notes
    - BPM events missing at tick 0
    """
    chart_path = Path(chart_path)
    report = ValidationReport()

    print(f"[validate] Reading {chart_path.name} ...")
    text = chart_path.read_text(encoding="utf-8")

    resolution = _parse_resolution(text)
    min_note_ticks = resolution // 16       # 1/64 note
    min_gap_ticks = resolution // 8         # 1/32 note

    # Parse all tracks
    sections = _parse_sections(text)
    sync = sections.get("SyncTrack", "")
    has_bpm_at_zero = bool(re.search(r"^\s*0\s*=\s*B\s+\d+", sync, re.MULTILINE))
    if not has_bpm_at_zero:
        report.add("error", "SyncTrack", 0, "No BPM event at tick 0")

    instrument_sections = {
        k: v for k, v in sections.items()
        if k not in ("Song", "SyncTrack", "Events")
    }

    for track_name, content in instrument_sections.items():
        notes = _parse_notes(content)
        star_power = _parse_star_power(content)

        if not notes:
            report.add("warning", track_name, 0, "Track has 0 notes")
            continue

        report.add("info", track_name, 0, f"{len(notes)} notes total")

        # Check for star power
        if not star_power:
            report.add("warning", track_name, 0, "No star power (overdrive) phrases")

        # Per-note checks
        seen: dict[tuple[int, int], int] = {}  # (tick, fret) → first occurrence tick
        prev_end: dict[int, int] = {}           # fret → tick of last note end

        for tick, fret, length in sorted(notes, key=lambda x: x[0]):
            # Minimum length
            if 0 < length < min_note_ticks:
                report.add("warning", track_name, tick,
                           f"Fret {fret}: sustain length {length} < min ({min_note_ticks} ticks)")

            # Sustain gap
            if fret in prev_end:
                gap = tick - prev_end[fret]
                if 0 < gap < min_gap_ticks:
                    report.add("warning", track_name, tick,
                               f"Fret {fret}: gap {gap} ticks < min gap ({min_gap_ticks} ticks)")

            # Duplicate note at same tick+fret
            key = (tick, fret)
            if key in seen:
                report.add("error", track_name, tick,
                           f"Duplicate note fret {fret} (first at tick {seen[key]})")
            seen[key] = tick

            end_tick = tick + max(length, 0)
            prev_end[fret] = end_tick

    report.print()
    return report


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_resolution(text: str) -> int:
    m = re.search(r"Resolution\s*=\s*(\d+)", text)
    return int(m.group(1)) if m else 192


def _parse_sections(text: str) -> dict[str, str]:
    """Split .chart into named sections → content string."""
    sections: dict[str, str] = {}
    pattern = re.compile(r"\[(\w+)\]\s*\{([^}]*)\}", re.DOTALL)
    for m in pattern.finditer(text):
        sections[m.group(1)] = m.group(2)
    return sections


def _parse_notes(content: str) -> list[tuple[int, int, int]]:
    """Parse lines like `  TICK = N FRET LENGTH` from a track section."""
    notes = []
    for m in re.finditer(r"(\d+)\s*=\s*N\s+(\d+)\s+(\d+)", content):
        notes.append((int(m.group(1)), int(m.group(2)), int(m.group(3))))
    return notes


def _parse_star_power(content: str) -> list[tuple[int, int]]:
    """Parse lines like `  TICK = S 2 LENGTH` (star power phrases)."""
    sp = []
    for m in re.finditer(r"(\d+)\s*=\s*S\s+2\s+(\d+)", content):
        sp.append((int(m.group(1)), int(m.group(2))))
    return sp
