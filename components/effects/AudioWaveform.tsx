"use client";

import { useMemo } from "react";

const BAR_COUNT = 20;

// Pre-compute deterministic durations to avoid random per-render
const BAR_CONFIGS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  duration: 0.8 + ((i * 7 + 3) % 11) / 11 * 0.8, // deterministic pseudo-random
  delay: i * 0.08,
}));

export function AudioWaveform({ className }: { className?: string }) {
  const bars = useMemo(
    () =>
      BAR_CONFIGS.map((config, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-linear-to-t from-primary/60 to-accent/40"
          style={{
            animation: `waveform-bar ${config.duration}s ease-in-out ${config.delay}s infinite alternate`,
            height: "4px",
          }}
        />
      )),
    [],
  );

  return (
    <div
      className={`flex items-end justify-center gap-[2px] h-8 overflow-hidden ${className ?? ""}`}
    >
      {bars}
    </div>
  );
}
