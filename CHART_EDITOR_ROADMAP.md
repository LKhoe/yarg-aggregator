# Chart Editor — Feature Roadmap

> Research based on: Moonscraper Chart Editor, Editor on Fire, REAPER/MIDI workflow, FeedBack, Chart Hero, and the YARG charting documentation.

---

## Current State

| Feature | Status |
|---|---|
| `.chart` / `.mid` import & export | ✅ Done |
| Multi-stem audio loading (OGG, MP3, WAV, FLAC, Opus) | ✅ Done |
| Per-stem mute/unmute with live gain | ✅ Done |
| Playback speed control (0.25x–2x) | ✅ Done |
| 3D perspective highway (canvas-based) | ✅ Done |
| 5-fret instruments (Guitar, Bass, Keys, Vocals) | ✅ Done |
| 4-pad Drums + kick drum | ✅ Done |
| Sustains (hold notes) | ✅ Done |
| Star Power phrases — visual only | ⚠️ Partial |
| Beat grid with configurable snap (1/4 – 1/32) | ✅ Done |
| Waveform overlay on highway | ✅ Done |
| Zoom control (30%–800%) | ✅ Done |
| Click-to-add notes with grid snap | ✅ Done |
| Drag notes (horizontal = time, vertical = fret) | ✅ Done |
| Shift+click multi-select | ✅ Done |
| Right-click context menu delete | ✅ Done |
| Properties panel (tick, fret, sustain length) | ✅ Done |
| Keyboard shortcuts (Space, Ctrl+Z/Y, Delete, Arrows) | ✅ Done |
| Track selector (instrument + difficulty tabs) | ✅ Done |
| Undo/redo (50-state history) | ✅ Done |
| Toolbar (transport, zoom, snap, speed) | ✅ Done |
| BPM events in data model — no UI | ⚠️ Model only |
| Time signatures in data model — no UI | ⚠️ Model only |

---

## Phase 1 — Implementing Now

> These features are required to produce a valid, playable YARG/Clone Hero chart from scratch.

---

### 1. BPM / Tempo Map Editor

**Priority**: Critical | **Effort**: Medium

The `syncTrack.bpmEvents` array exists in the data model but there is no UI to add, edit, or delete tempo changes. Without this, songs with variable tempo cannot be charted correctly — the beat grid drifts out of sync.

**What to build:**
- Thin "Sync Track" strip above the main highway
- Click on the strip at any tick → popover to enter BPM value → adds `BpmEvent`
- BPM markers rendered as vertical dashed lines with label (e.g., `♩=120`)
- Drag a marker horizontally to change its tick position
- Right-click a marker → delete
- Any change triggers waveform recomputation (already handled by `waveform.ts`)

**New reducer actions:** `ADD_BPM`, `UPDATE_BPM`, `DELETE_BPM`

**Files:**
- `components/chart-editor/ChartEditor.tsx`
- `components/chart-editor/TrackLane.tsx`
- `components/chart-editor/Toolbar.tsx`
- `lib/chart-editor/reducers.ts`
- `types/index.ts` ← `BpmEvent { tick, bpm }` already exists

---

### 2. Time Signature Editor

**Priority**: Critical | **Effort**: Low

Companion to the BPM editor. Changes the grouping of beat lines on the grid. Most songs use 4/4, but charting unusual time signatures (3/4, 5/4, 7/8) requires this.

**What to build:**
- Displayed alongside BPM markers in the Sync Track strip
- Click to add → popover to enter numerator/denominator
- Beat grid spacing updates immediately on change
- Measure bar labels show the active time signature

**Files:** Same as BPM editor (`TimeSignature { tick, numerator, denominator }` already in `types/index.ts`)

---

### 3. Star Power / Phrase Editing

**Priority**: Critical | **Effort**: Medium

Star Power phrases currently render as colored overlays but are read-only. There is no way to place or edit them — making it impossible to produce a complete chart from the editor.

**What to build:**
- **Phrase Mode** toggle in toolbar (switches between Note mode and Phrase mode)
- In Phrase mode: click-drag on the highway to draw a phrase region
  - Mousedown → start tick
  - Drag → extend length (grid-snapped)
  - Mouseup → `ADD_PHRASE`
- Phrase regions have draggable left/right handles for resizing
- Right-click a phrase → delete
- Phrase type selector in toolbar (Star Power, BRE, Tremolo, Trill)

**New reducer actions:** `ADD_PHRASE`, `DELETE_PHRASE`, `RESIZE_PHRASE`

**Files:**
- `components/chart-editor/TrackLane.tsx`
- `components/chart-editor/Toolbar.tsx`
- `lib/chart-editor/reducers.ts`
- `types/index.ts` ← `Phrase { id, tick, length, type }` already exists

---

### 4. HOPO / Force Strum Flags

**Priority**: High | **Effort**: Low–Medium

Hammer-On/Pull-Off is the single most important mechanical flag in 5-fret charting. A HOPO can be hit without strumming if the previous note was played. Currently the editor has zero flag support.

**What to build:**
- Extend `Note` type with an optional `flags` field:
  ```typescript
  interface NoteFlags {
    forceHopo?: boolean   // Force HOPO regardless of interval
    forceStrum?: boolean  // Force strummed note (overrides auto-HOPO)
    tap?: boolean         // Tap note (no strum required)
  }
  ```
- Properties Panel: checkbox group for "Force HOPO", "Force Strum", "Tap"
- Keyboard shortcuts: `H` = toggle Force HOPO on selected notes, `S` = toggle Force Strum
- Visual indicators:
  - HOPO → small upward arrow overlay on the gem
  - Tap → ring/outline style gem
  - Auto-HOPO (not forced but auto-detected) → faint indicator, distinct from manual
- `.chart` format: note type `5` = forced HOPO, type `6` = forced strum — parse and serialize correctly

**New reducer action:** `TOGGLE_NOTE_FLAG`

**Files:**
- `types/index.ts`
- `lib/chart-editor/reducers.ts`
- `components/chart-editor/PropertiesPanel.tsx`
- `components/chart-editor/TrackLane.tsx`
- `lib/chart-editor/parser-chart.ts`
- `lib/chart-editor/serializer-chart.ts`

---

### 5. Section Markers

**Priority**: High | **Effort**: Medium

Named markers that appear in Practice Mode, the chart timeline, and during gameplay. Essential for any shippable chart. In `.chart` format these live in the `[Events]` section as `tick = E "section Verse 1"`.

**What to build:**
- Section markers render as vertical colored lines + label on the top ruler
- Click on an empty ruler position → popover with name input → `ADD_SECTION`
- Click an existing marker → edit name or delete
- Two types: **Practice Section** (purple) and **Solo** (yellow/gold)
- Collapsible section list panel showing all markers with click-to-seek
- Keyboard shortcut: `M` = add section at current playhead position

**New reducer actions:** `ADD_SECTION`, `RENAME_SECTION`, `DELETE_SECTION`

**Files:**
- `types/index.ts` ← add `Section { tick, name, type: "section" | "solo" }`
- `components/chart-editor/ChartEditor.tsx`
- `components/chart-editor/TrackLane.tsx`
- `lib/chart-editor/parser-chart.ts` ← parse `[Events]` block
- `lib/chart-editor/serializer-chart.ts` ← export `[Events]` block
- `lib/chart-editor/reducers.ts`

---

### 6. Lasso / Rubber Band Selection

**Priority**: High | **Effort**: Medium

Currently the only multi-select method is Shift+clicking individual notes one by one. Box selection is a standard UX that makes selecting note ranges dramatically faster.

**What to build:**
- Detect drag on empty canvas area (no note under cursor at mousedown)
- Draw a semi-transparent selection rectangle while dragging
- On mouseup: select all notes whose screen bounding box intersects the rect
- Hold Shift while dragging to add to existing selection
- Disambiguation: note drag activates only when the initial click lands on a note

**Files:**
- `components/chart-editor/TrackLane.tsx`

---

### 7. Note Resize by Dragging

**Priority**: High | **Effort**: Medium

Sustain length is only editable via the Properties Panel (click, type, Enter). Dragging the sustain tail is standard in every charting tool and is 10× faster.

**What to build:**
- Detect mouse within ~8px of the trailing edge of a sustain note
- Cursor changes to `ew-resize` on hover
- Drag tail: update sustain length in real time (snapped to grid)
- Minimum sustain: 0 (collapses to a tap note)
- Emit `RESIZE_NOTE` on mouseup
- Visual: sustain tail highlights on hover to indicate the resize handle

**Files:**
- `components/chart-editor/TrackLane.tsx`
- `lib/chart-editor/reducers.ts` ← `RESIZE_NOTE` already exists, just needs live preview

---

### 8. Copy / Paste

**Priority**: High | **Effort**: Medium

There is currently no clipboard support at all. Ctrl+C / Ctrl+V is one of the most fundamental editing operations.

**What to build:**
- `Ctrl+C`: copy selected notes to internal clipboard (stored as tick-relative offsets from the earliest selected note)
- `Ctrl+V`: paste at current playhead position (apply offset); pasted notes become new selection
- `Ctrl+D`: duplicate — copy + paste in one step, offset by the selection's duration
- Right-click context menu: **"Copy difficulty to…"** — clones all notes from the current track to a target difficulty (e.g., Expert → Hard)

**New reducer action:** `PASTE_NOTES`

**Files:**
- `components/chart-editor/ChartEditor.tsx` ← clipboard state + keyboard handlers
- `lib/chart-editor/reducers.ts`

---

## Phase 2 — Future Roadmap

> These features significantly improve the editor experience but are not blockers for producing valid charts. Implement after Phase 1 is complete.

---

### 9. Tap Tempo / BPM Detection Helper

**Priority**: Medium | **Effort**: Low

- **Tap tempo**: Press `T` repeatedly in time with the music. BPM is calculated from the average interval of the last N taps and applied as a BPM event at the current playhead tick.
- **Audio transient detection**: Analyze the already-computed waveform peaks to estimate BPM automatically.
- Useful for establishing the initial tempo before manual refinement.

---

### 10. Metronome Click Track

**Priority**: Medium | **Effort**: Low

- Toggle button in toolbar: enable/disable click track during playback
- Uses Web Audio API (already used for audio stems) to schedule clicks at beat positions
- Beat timing derived from the active BPM map
- Optional accent on downbeats vs. subdivision clicks
- Independent volume control

---

### 11. Minimap / Song Overview

**Priority**: Medium | **Effort**: Medium

- Horizontal strip (above or below the highway) showing the entire song duration
- Note density rendered as colored bars per track
- Current viewport highlighted as a draggable window
- Click anywhere to seek
- Section markers visible as colored ticks
- Critical for navigating songs longer than 4 minutes

---

### 12. Solo Section Markers

**Priority**: Medium | **Effort**: Low

- Extension of the Section Markers feature (Phase 1 item #5)
- Solo sections trigger an in-game score bonus and lighting effects
- `.chart` format: `tick = E "solo"` / `tick = E "soloend"` pairs
- Rendered as a gold/yellow overlay region on the highway, distinct from Star Power
- Can reuse the section marker infrastructure with a `"solo"` type

---

### 13. Keyboard Shortcut Reference Panel

**Priority**: Medium | **Effort**: Low

- `?` key opens a modal overlay listing all keyboard shortcuts
- Grouped by category: Playback, Editing, Navigation, View, Flags
- Optional: rebindable shortcuts stored in `localStorage`

---

### 14. Open Notes Support

**Priority**: Low | **Effort**: Low

- Notes with no fret pressed (open strums) — very common in bass charts
- Represented as fret index `-1` or a dedicated `open` flag on `Note`
- Renders as a black/hollow gem spanning all 5 fret lanes
- `.chart` parse/serialize: note type `7`

---

### 15. Drum Note Flags (Accent / Ghost / Pro Cymbals)

**Priority**: Low | **Effort**: Medium

| Flag | Meaning | Visual |
|---|---|---|
| **Accent** | Loud hit (full velocity) | Larger gem or bright outline |
| **Ghost** | Quiet hit (low velocity) | Hollow/dim gem |
| **Cymbal** | Yellow/Blue/Green as cymbal, not tom | Different gem shape |
| **Tom** | Explicit tom hit (Pro Drums) | Standard round gem |

- Set via right-click context menu on drum notes
- Parse/serialize cymbal flags in `.chart` (note types `66`, `67`, `68`)

---

### 16. Chart Validator

**Priority**: Low | **Effort**: Medium

Automated pre-export checks to catch common charting mistakes.

| Check | Rule |
|---|---|
| Empty tracks | Warn if a track/difficulty has no notes |
| Missing sections | Warn if no `[Events]` section markers exist |
| Star Power too short | SP phrase < 2 beats at current BPM |
| Notes too close | Two notes within 1 tick (likely a mistake vs. intentional chord) |
| Sustain too short | Sustain < 1/8th note at current BPM |
| HOPO conflicts | Force-strum and Force-HOPO set on the same note |
| No BPM defined | Chart has no BPM event (would default to 120) |
| Overlapping notes | Two notes on the same fret at the same tick |

- "Validate" button in toolbar
- Auto-validate on export with option to proceed or cancel

---

### 17. Extended Metadata Editor (song.ini fields)

**Priority**: Low | **Effort**: Low

Expand the existing metadata panel to include full `song.ini`-compatible fields:

| Field | Description |
|---|---|
| `diff_guitar` | Difficulty rating 0–6 |
| `diff_bass` | Difficulty rating 0–6 |
| `diff_drums` | Difficulty rating 0–6 |
| `diff_keys` | Difficulty rating 0–6 |
| `diff_vocals` | Difficulty rating 0–6 |
| `preview_start_time` | Audio preview start offset (ms) |
| `loading_phrase` | Text shown on the loading screen |
| `icon` | Charter icon identifier |
| `hopo_frequency` | Custom HOPO threshold override (ticks) |
| `album_art` | Image file upload |

---

### 18. 6-Fret (Guitar Hero Live) Support

**Priority**: Low | **Effort**: High

- Guitar Hero Live uses a 2-row × 3-button layout (3 black frets + 3 white frets)
- `DoubleGuitar` / `DoubleBass` track keys already exist in the data model schema
- Requires an entirely new highway renderer layout (2 rows × 3 lanes)
- New gem visuals for black/white fret distinction
- Parse/serialize GHL note format in `.chart` (note fret indices 8–14)

---

## Implementation Order

```
Phase 1 — Core (Implement Now)
────────────────────────────────────────────
 1. BPM Map Editor
 2. Time Signature Editor       ← bundle with #1
 3. Star Power / Phrase Editing
 4. HOPO / Force Strum Flags
 5. Section Markers
 6. Lasso / Rubber Band Selection
 7. Note Resize by Dragging
 8. Copy / Paste (+ Difficulty Clone)

Phase 2 — Roadmap (Future)
────────────────────────────────────────────
 9.  Tap Tempo / BPM Detection
 10. Metronome Click Track
 11. Minimap / Song Overview
 12. Solo Section Markers       ← small extension of #5
 13. Keyboard Shortcut Panel
 14. Open Notes
 15. Drum Note Flags (Accent / Ghost / Pro Cymbals)
 16. Chart Validator
 17. Extended Metadata (song.ini)
 18. 6-Fret (GHL) Support
```

---

## Key Files Reference

| File | Role |
|---|---|
| `app/admin/chart-editor/page.tsx` | Route, admin guard |
| `components/chart-editor/ChartEditor.tsx` | Main orchestrator, all state |
| `components/chart-editor/TrackLane.tsx` | Canvas 3D highway, all mouse input |
| `components/chart-editor/Toolbar.tsx` | Transport + editor controls |
| `components/chart-editor/PropertiesPanel.tsx` | Note detail sidebar |
| `components/chart-editor/TrackSelector.tsx` | Instrument/difficulty tabs |
| `lib/chart-editor/reducers.ts` | All edit actions |
| `lib/chart-editor/tempo-utils.ts` | BPM↔time conversion, grid snap |
| `lib/chart-editor/waveform.ts` | Audio→waveform computation |
| `lib/chart-editor/parser-chart.ts` | `.chart` file parser |
| `lib/chart-editor/parser-midi.ts` | MIDI parser |
| `lib/chart-editor/serializer-chart.ts` | `.chart` export |
| `lib/chart-editor/serializer-midi.ts` | MIDI export |
| `types/index.ts` | Central TypeScript types |
