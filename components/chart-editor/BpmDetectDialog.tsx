"use client";

import { memo, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { detectBPM, bpmFromTaps } from "@/lib/chart/bpm-detect";

export interface BpmDetectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioBuffer?: AudioBuffer;
  onApply: (bpm: number) => void;
}

export const BpmDetectDialog = memo(function BpmDetectDialog({
  open,
  onOpenChange,
  audioBuffer,
  onApply,
}: BpmDetectDialogProps) {
  const [tab, setTab] = useState<"auto" | "tap">("auto");
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);

  // Tap tempo state
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const tapTimestamps = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState(0);

  const handleAutoDetect = useCallback(() => {
    if (!audioBuffer) return;
    setAnalyzing(true);
    // Defer to avoid blocking UI
    setTimeout(() => {
      const result = detectBPM(audioBuffer);
      setDetectedBpm(result.bpm);
      setConfidence(result.confidence);
      setAnalyzing(false);
    }, 50);
  }, [audioBuffer]);

  const handleTap = useCallback(() => {
    tapTimestamps.current.push(Date.now());
    // Keep last 16 taps
    if (tapTimestamps.current.length > 16) {
      tapTimestamps.current = tapTimestamps.current.slice(-16);
    }
    setTapCount(tapTimestamps.current.length);
    const bpm = bpmFromTaps(tapTimestamps.current);
    setTapBpm(bpm);
  }, []);

  const handleResetTap = useCallback(() => {
    tapTimestamps.current = [];
    setTapCount(0);
    setTapBpm(null);
  }, []);

  const handleApply = () => {
    const bpm = tab === "auto" ? detectedBpm : tapBpm;
    if (bpm && bpm > 0) {
      onApply(Math.round(bpm * 100) / 100);
      onOpenChange(false);
    }
  };

  const currentBpm = tab === "auto" ? detectedBpm : tapBpm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>BPM Detection</DialogTitle>
          <DialogDescription>
            Auto-detect BPM from audio or tap to the beat manually.
          </DialogDescription>
        </DialogHeader>

        {/* Tab selector */}
        <div className="flex gap-1 rounded-md border p-0.5 bg-muted/30">
          <Button
            variant={tab === "auto" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setTab("auto")}
          >
            Auto Detect
          </Button>
          <Button
            variant={tab === "tap" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setTab("tap")}
          >
            Tap Tempo
          </Button>
        </div>

        {tab === "auto" ? (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAutoDetect}
              disabled={!audioBuffer || analyzing}
            >
              {analyzing ? "Analyzing..." : audioBuffer ? "Analyze Audio" : "No audio loaded"}
            </Button>
            {detectedBpm !== null && (
              <div className="text-center space-y-1">
                <div className="text-2xl font-mono font-bold">{detectedBpm} BPM</div>
                <div className="text-xs text-muted-foreground">
                  Confidence: {Math.round(confidence * 100)}%
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-20 text-lg"
              onClick={handleTap}
            >
              Tap Here ({tapCount} taps)
            </Button>
            {tapBpm !== null && (
              <div className="text-center">
                <div className="text-2xl font-mono font-bold">{tapBpm} BPM</div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={handleResetTap}
            >
              Reset
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!currentBpm || currentBpm <= 0}
            onClick={handleApply}
          >
            Apply {currentBpm ? `${currentBpm} BPM` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
