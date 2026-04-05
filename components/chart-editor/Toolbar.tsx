"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  SkipBack,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Gauge,
  Pencil,
  Star,
  Activity,
  BarChart2,
  Timer,
  HelpCircle,
  Flame,
  MapPin,
  Eraser,
  FlipHorizontal,
  Music,
  Hand,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@/lib/chart/types";
import type { TempoPoint } from "@/lib/chart/tempo-utils";
import { SectionNav } from "./SectionNav";

export interface ToolbarProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  renderDistance: number;
  onRenderDistanceChange: (value: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (value: number) => void;
  snapDivision: number;
  onSnapChange: (division: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  currentTick: number;
  bpm: number;
  // Edit mode (now includes eraser)
  editMode: "note" | "phrase" | "eraser";
  onEditModeChange: (mode: "note" | "phrase" | "eraser") => void;
  phraseType: string;
  onPhraseTypeChange: (type: string) => void;
  // Visualization mode
  vizMode: "waveform" | "spectrogram" | "none";
  onVizModeChange: (mode: "waveform" | "spectrogram" | "none") => void;
  spectrogramLoading?: boolean;
  // Metronome
  metronomeEnabled?: boolean;
  onMetronomeToggle?: () => void;
  // Clap sounds
  clapEnabled?: boolean;
  onClapToggle?: () => void;
  // Section nav
  sections?: Section[];
  tempoMap?: TempoPoint[];
  onSectionSeek?: (tick: number) => void;
  // Loop
  loopA?: number | null;
  loopB?: number | null;
  onClearLoop?: () => void;
  // BPM detection
  onShowBpmDetect?: () => void;
  // Density overlay
  densityOverlay?: boolean;
  onDensityToggle?: () => void;
  // Global view (minimap)
  showGlobalView?: boolean;
  onToggleGlobalView?: () => void;
  // Lefty-flip
  leftyFlip?: boolean;
  onLeftyFlipToggle?: () => void;
  // View mode (global vs local)
  viewMode?: "local" | "global";
  onViewModeChange?: (mode: "local" | "global") => void;
  // Help
  onShowShortcuts?: () => void;
  // Bookmarks
  bookmarks?: (number | null)[];
  onBookmarkSeek?: (tick: number) => void;
  // Sustain gap
  sustainGap?: number;
  onSustainGapChange?: (gap: number) => void;
}

const SNAP_OPTIONS = [
  { value: 4, label: "1/4" },
  { value: 6, label: "1/6 (triplet)" },
  { value: 8, label: "1/8" },
  { value: 12, label: "1/12 (triplet)" },
  { value: 16, label: "1/16" },
  { value: 24, label: "1/24 (triplet)" },
  { value: 32, label: "1/32" },
  { value: 48, label: "1/48 (triplet)" },
  { value: 64, label: "1/64" },
];

const SPEED_OPTIONS = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
];

const RENDER_DIST_OPTIONS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
];

const PHRASE_TYPE_OPTIONS = [
  { value: "starPower", label: "Star Power" },
  { value: "bre", label: "BRE" },
  { value: "tremolo", label: "Tremolo" },
  { value: "trill", label: "Trill" },
];

// Divider between toolbar groups
const Sep = () => <div className="w-px h-5 bg-border/50 shrink-0" />;

export const Toolbar = memo(function Toolbar({
  isPlaying,
  onPlayPause,
  onStop,
  zoom,
  onZoomIn,
  onZoomOut,
  renderDistance,
  onRenderDistanceChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  snapDivision,
  onSnapChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  currentTick,
  bpm,
  editMode,
  onEditModeChange,
  phraseType,
  onPhraseTypeChange,
  vizMode,
  onVizModeChange,
  spectrogramLoading,
  metronomeEnabled,
  onMetronomeToggle,
  clapEnabled,
  onClapToggle,
  sections,
  tempoMap,
  onSectionSeek,
  loopA,
  loopB,
  onClearLoop,
  onShowBpmDetect,
  densityOverlay,
  onDensityToggle,
  showGlobalView,
  onToggleGlobalView,
  leftyFlip,
  onLeftyFlipToggle,
  viewMode,
  onViewModeChange,
  onShowShortcuts,
  bookmarks,
  onBookmarkSeek,
  sustainGap,
  onSustainGapChange,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-3 py-1.5 border-b bg-background/80 backdrop-blur-sm min-h-[40px]">
      {/* ── Row 1: Transport + Edit + Nav ── */}

      {/* Transport */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStop} title="Stop / Go to start">
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="icon"
          className="h-7 w-7"
          onClick={onPlayPause}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        {onMetronomeToggle && (
          <Button variant={metronomeEnabled ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={onMetronomeToggle} title="Metronome (M)">
            <Timer className="h-3.5 w-3.5" />
          </Button>
        )}
        {onClapToggle && (
          <Button variant={clapEnabled ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={onClapToggle} title="Clap sounds (N)">
            <Hand className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Sep />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sep />

      {/* Edit Mode Toggle */}
      <div className="flex items-center rounded-md border p-0.5 bg-muted/30">
        <Button
          variant={editMode === "note" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", editMode === "note" && "shadow-sm")}
          onClick={() => onEditModeChange("note")}
          title="Note mode"
        >
          <Pencil className="h-3 w-3" />
          <span className="hidden sm:inline">Notes</span>
        </Button>
        <Button
          variant={editMode === "phrase" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", editMode === "phrase" && "shadow-sm")}
          onClick={() => onEditModeChange("phrase")}
          title="Phrase mode"
        >
          <Star className="h-3 w-3" />
          <span className="hidden sm:inline">Phrases</span>
        </Button>
        <Button
          variant={editMode === "eraser" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", editMode === "eraser" && "shadow-sm")}
          onClick={() => onEditModeChange("eraser")}
          title="Eraser (K)"
        >
          <Eraser className="h-3 w-3" />
          <span className="hidden sm:inline">Eraser</span>
        </Button>
      </div>

      {editMode === "phrase" && (
        <Select value={phraseType} onValueChange={onPhraseTypeChange}>
          <SelectTrigger className="h-7 w-[7rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHRASE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Sep />

      {/* Section Nav */}
      {sections && tempoMap && onSectionSeek && sections.length > 0 && (
        <>
          <SectionNav sections={sections} currentTick={currentTick} tempoMap={tempoMap} onSeek={onSectionSeek} />
          <Sep />
        </>
      )}

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground min-w-[2.5rem] text-center font-mono">{Math.round(zoom)}%</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sep />

      {/* Grid Snap + Speed + Render distance — compact group */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground hidden lg:inline">Snap</span>
          <Select value={String(snapDivision)} onValueChange={(v) => onSnapChange(Number(v))}>
            <SelectTrigger className="h-6 w-[4.5rem] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SNAP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Gauge className="h-3 w-3 text-muted-foreground" />
          <Select value={String(playbackSpeed)} onValueChange={(v) => onPlaybackSpeedChange(Number(v))}>
            <SelectTrigger className="h-6 w-[3.5rem] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="h-3 w-3 text-muted-foreground" />
          <Select value={String(renderDistance)} onValueChange={(v) => onRenderDistanceChange(Number(v))}>
            <SelectTrigger className="h-6 w-[3.5rem] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RENDER_DIST_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Spacer pushes right-side items */}
      <div className="flex-1 min-w-[8px]" />

      {/* ── Right side: View toggles ── */}

      {/* Audio visualization */}
      <div className="flex items-center rounded-md border p-0.5 bg-muted/30">
        <Button
          variant={vizMode === "waveform" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", vizMode === "waveform" && "shadow-sm")}
          onClick={() => onVizModeChange("waveform")}
          title="Waveform"
        >
          <Activity className="h-3 w-3" />
          <span className="hidden xl:inline">Wave</span>
        </Button>
        <Button
          variant={vizMode === "spectrogram" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", vizMode === "spectrogram" && "shadow-sm")}
          onClick={() => onVizModeChange("spectrogram")}
          title="Spectrogram"
          disabled={spectrogramLoading}
        >
          <BarChart2 className="h-3 w-3" />
          <span className="hidden xl:inline">{spectrogramLoading ? "\u2026" : "Spec"}</span>
        </Button>
        <Button
          variant={vizMode === "none" ? "secondary" : "ghost"}
          size="sm"
          className={cn("h-6 px-1.5 gap-1 text-xs", vizMode === "none" && "shadow-sm")}
          onClick={() => onVizModeChange("none")}
          title="Hide overlay"
        >
          <EyeOff className="h-3 w-3" />
        </Button>
      </div>

      {/* View toggles group */}
      <div className="flex items-center gap-0.5">
        {onDensityToggle && (
          <Button variant={densityOverlay ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={onDensityToggle} title="Density heatmap">
            <Flame className="h-3.5 w-3.5" />
          </Button>
        )}
        {onToggleGlobalView && (
          <Button variant={showGlobalView ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={onToggleGlobalView} title="Minimap">
            <MapPin className="h-3.5 w-3.5" />
          </Button>
        )}
        {onLeftyFlipToggle && (
          <Button variant={leftyFlip ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={onLeftyFlipToggle} title="Lefty-flip (L)">
            <FlipHorizontal className="h-3.5 w-3.5" />
          </Button>
        )}
        {onViewModeChange && (
          <Button
            variant={viewMode === "global" ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-6 px-1.5 text-xs", viewMode === "global" && "shadow-sm")}
            onClick={() => onViewModeChange(viewMode === "local" ? "global" : "local")}
            title="Global/Local view (G)"
          >
            {viewMode === "global" ? "Glb" : "Lcl"}
          </Button>
        )}
      </div>

      {/* Sustain gap */}
      {onSustainGapChange && (
        <Select value={String(sustainGap ?? 0)} onValueChange={(v) => onSustainGapChange(Number(v))}>
          <SelectTrigger className="h-6 w-14 text-xs" title="Sustain gap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Gap: Off</SelectItem>
            <SelectItem value="1">1 tick</SelectItem>
            <SelectItem value="12">1/16</SelectItem>
            <SelectItem value="24">1/8</SelectItem>
            <SelectItem value="48">1/4</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Loop indicator */}
      {(loopA !== null || loopB !== null) && (
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="text-green-400">A:{loopA != null ? Math.round(loopA) : "\u2013"}</span>
          <span className="text-red-400">B:{loopB != null ? Math.round(loopB) : "\u2013"}</span>
          {onClearLoop && (
            <button onClick={onClearLoop} className="text-muted-foreground hover:text-foreground transition-colors" title="Clear loop (Esc)">&times;</button>
          )}
        </div>
      )}

      {/* Bookmarks */}
      {bookmarks && bookmarks.some((b) => b !== null) && onBookmarkSeek && (
        <div className="flex items-center gap-0.5 text-[10px] font-mono">
          {bookmarks.map((bm, i) =>
            bm !== null ? (
              <button
                key={i}
                onClick={() => onBookmarkSeek(bm)}
                className="w-4 h-4 rounded bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                title={`Bookmark ${i} (tick ${Math.round(bm)})`}
              >
                {i}
              </button>
            ) : null,
          )}
        </div>
      )}

      <Sep />

      {/* Status */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono shrink-0">
        <span>{Math.round(currentTick)}</span>
        {onShowBpmDetect ? (
          <button onClick={onShowBpmDetect} className="hover:text-foreground transition-colors" title="BPM Detection">
            {Math.round(bpm * 100) / 100} bpm
          </button>
        ) : (
          <span>{Math.round(bpm * 100) / 100} bpm</span>
        )}
      </div>

      {onShowShortcuts && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onShowShortcuts} title="Keyboard shortcuts (?)">
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
});
