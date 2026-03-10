"use client";

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
  Gauge,
} from "lucide-react";

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
}

const SNAP_OPTIONS = [
  { value: 4, label: "1/4" },
  { value: 8, label: "1/8" },
  { value: 16, label: "1/16" },
  { value: 32, label: "1/32" },
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

export function Toolbar({
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
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
      {/* Transport */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          title="Stop / Go to start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="icon"
          onClick={onPlayPause}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          title="Zoom out (smaller notes)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
          {Math.round(zoom)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          title="Zoom in (bigger notes)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Render distance */}
      <div className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={String(renderDistance)}
          onValueChange={(v) => onRenderDistanceChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-[4.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RENDER_DIST_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Grid Snap */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Snap:</span>
        <Select
          value={String(snapDivision)}
          onValueChange={(v) => onSnapChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SNAP_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Playback speed */}
      <div className="flex items-center gap-1.5">
        <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={String(playbackSpeed)}
          onValueChange={(v) => onPlaybackSpeedChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-[4.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1" />

      {/* Status */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
        <span>Tick: {Math.round(currentTick)}</span>
        <span>{Math.round(bpm)} BPM</span>
      </div>
    </div>
  );
}
