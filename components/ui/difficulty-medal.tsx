import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// 1. Define variants using CVA to match your system style
const difficultyMedalVariants = cva(
  "relative flex shrink-0 items-center justify-center rounded-full select-none",
  {
    variants: {
      size: {
        default: "size-20", // 80px (Standard)
        sm: "size-8",       // 24px (Small)
        lg: "size-24",      // 96px (Large)
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// Helper to map sizes to the inner circle dimensions (to keep proportions)
const innerCircleSizes = {
  default: "size-[50px]",
  sm: "size-[26px]",
  lg: "size-[60px]",
}

interface DifficultyMedalProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof difficultyMedalVariants> {
  level: number
  icon?: React.ReactNode
  gapColor?: string
}

function DifficultyMedal({
  className,
  size = "default",
  level,
  icon,
  gapColor = "#111317",
  ...props
}: DifficultyMedalProps) {
  // Calculate rotation: 6 segments = 60deg per segment
  const rotation = level * 60
  const activeColor = level < 7 ? "#00d2ff" : "#ff0004ff"
  const inactiveColor = "#222"

  return (
    <div
      data-slot="difficulty-medal"
      data-level={level}
      className={cn(difficultyMedalVariants({ size, className }))}
      {...props}
    >
      <div
        className="absolute inset-0 rounded-full [mask-image:radial-gradient(farthest-side,transparent_90%,black_61%)]"
        style={{
          background: `
            repeating-conic-gradient(
              from 0deg,
              transparent 0deg,
              transparent 56deg,
              ${gapColor} 56deg,
              ${gapColor} 60deg
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
          "relative z-10 flex items-center justify-center rounded-full bg-black border-white text-white",
          innerCircleSizes[size || "default"],
        )}
      >
        {icon}
      </div>
    </div>
  )
}

export { DifficultyMedal, difficultyMedalVariants }