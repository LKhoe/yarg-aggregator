import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// 1. Define variants using CVA to match your system style
const difficultyMedalVariants = cva(
  "relative flex shrink-0 items-center justify-center rounded-full select-none",
  {
    variants: {
      size: {
        default: "size-20", // 80px (Standard)
        sm: "size-8", // 24px (Small)
        lg: "size-24", // 96px (Large)
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

// Helper to map sizes to the inner circle dimensions (to keep proportions)
const innerCircleSizes = {
  default: "size-[50px]",
  sm: "size-[26px]",
  lg: "size-[60px]",
};

interface DifficultyMedalProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof difficultyMedalVariants> {
  level: number;
  icon?: React.ReactNode;
  gapColor?: string;
  badge?: React.ReactNode;
}

function DifficultyMedal({
  className,
  size = "default",
  level,
  icon,
  gapColor,
  badge,
  ...props
}: DifficultyMedalProps) {
  // Calculate rotation: 6 segments = 60deg per segment
  const rotation = level * 60;
  const activeColor =
    level < 7
      ? "var(--difficulty-medal-active)"
      : "var(--difficulty-medal-hard)";
  const inactiveColor = "var(--difficulty-medal-inactive)";
  const gapColorValue = gapColor || "var(--background)";

  return (
    <div
      data-slot="difficulty-medal"
      data-level={level}
      className={cn(difficultyMedalVariants({ size, className }))}
      {...props}
    >
      <div
        className="absolute inset-0 rounded-full mask-[radial-gradient(farthest-side,transparent_85%,black_65%)]"
        style={{
          background: `
            repeating-conic-gradient(
              from 0deg,
              transparent 0deg,
              transparent 54deg,
              ${gapColorValue} 54deg,
              ${gapColorValue} 60deg
            ),
            conic-gradient(
              ${activeColor} 0deg ${rotation}deg,
              ${inactiveColor} ${rotation}deg 360deg
            )
          `,
        }}
      />

      <div
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full bg-card border-border text-card-foreground",
          innerCircleSizes[size || "default"],
        )}
      >
        {icon}
      </div>

      {badge && (
        <div
          className={cn(
            "absolute z-20 flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ring-2 ring-background",
            size === "sm"
              ? "-bottom-1 -right-1 h-3.5 w-3.5 text-[9px] ring-1"
              : size === "lg"
                ? "bottom-0 right-0 h-6 w-6 text-sm"
                : "bottom-0 right-0 h-5 w-5 text-xs",
          )}
        >
          {badge}
        </div>
      )}
    </div>
  );
}

export { DifficultyMedal, difficultyMedalVariants };
