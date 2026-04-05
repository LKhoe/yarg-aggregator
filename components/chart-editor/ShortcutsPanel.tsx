"use client";

import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Shortcut {
  key: string;
  description: string;
}

interface ShortcutGroup {
  category: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Transport",
    shortcuts: [
      { key: "Space", description: "Play / Pause" },
      { key: "I", description: "Set loop start (A)" },
      { key: "O", description: "Set loop end (B)" },
      { key: "Esc", description: "Clear loop points" },
      { key: "N", description: "Toggle clap/hit sounds" },
      { key: "P", description: "Toggle piano tone preview (Vocals)" },
    ],
  },
  {
    category: "Navigation",
    shortcuts: [
      { key: "[", description: "Jump to previous section" },
      { key: "]", description: "Jump to next section" },
      { key: "M", description: "Add section at playhead" },
      { key: "0-9", description: "Jump to bookmark" },
      { key: "Ctrl+0-9", description: "Set bookmark at playhead" },
    ],
  },
  {
    category: "Guitar / Bass",
    shortcuts: [
      { key: "H", description: "Toggle Force HOPO" },
      { key: "S", description: "Toggle Force Strum" },
      { key: "T", description: "Toggle Tap" },
      { key: "F", description: "Toggle Open Note" },
    ],
  },
  {
    category: "Drums (Pro)",
    shortcuts: [
      { key: "C", description: "Toggle Cymbal" },
      { key: "A", description: "Toggle Accent" },
      { key: "Shift+G", description: "Toggle Ghost" },
      { key: "Shift+K", description: "Toggle Double Kick (Expert+)" },
    ],
  },
  {
    category: "Editing",
    shortcuts: [
      { key: "Del / Backspace", description: "Delete selected notes" },
      { key: "K", description: "Toggle eraser mode" },
      { key: "Arrow Up/Down", description: "Move notes forward/backward" },
      { key: "Arrow Left/Right", description: "Shift notes across frets" },
      { key: "Right-click drag", description: "Place note with sustain" },
    ],
  },
  {
    category: "Selection & Clipboard",
    shortcuts: [
      { key: "Ctrl+C", description: "Copy selected notes" },
      { key: "Ctrl+X", description: "Cut selected notes" },
      { key: "Ctrl+V", description: "Paste at playhead" },
      { key: "Ctrl+D", description: "Duplicate selection" },
      { key: "Ctrl+A", description: "Select all notes in track" },
      { key: "Shift+Click", description: "Add to selection" },
      { key: "Click+Drag", description: "Lasso select" },
    ],
  },
  {
    category: "View",
    shortcuts: [
      { key: "G", description: "Toggle global/local view" },
      { key: "L", description: "Toggle lefty-flip mode" },
      { key: "?", description: "Show keyboard shortcuts" },
    ],
  },
  {
    category: "History",
    shortcuts: [
      { key: "Ctrl+Z", description: "Undo" },
      { key: "Ctrl+Y", description: "Redo" },
    ],
  },
];

export interface ShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShortcutsPanel = memo(function ShortcutsPanel({
  open,
  onOpenChange,
}: ShortcutsPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for chart editor shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="ml-4 shrink-0 px-1.5 py-0.5 text-[11px] font-mono bg-muted rounded border text-muted-foreground">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});
