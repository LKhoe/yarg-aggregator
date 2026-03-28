"use client";

import { cn } from "@/lib/utils";

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
}

export function GlitchText({ children, className }: GlitchTextProps) {
  // Extract text content for the pseudo-elements
  const textContent = typeof children === "string" ? children : "";

  return (
    <span className={cn("glitch-text", className)} data-text={textContent}>
      {children}
    </span>
  );
}
