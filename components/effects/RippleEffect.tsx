"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface RippleEffectProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  color?: string;
}

export function RippleEffect({
  children,
  className,
  color,
  ...props
}: RippleEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const createRipple = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const maxDim = Math.max(rect.width, rect.height);
      const rippleSize = maxDim * 2.5;

      const ripple = document.createElement("span");
      ripple.className = "ripple-circle";
      ripple.style.cssText = `
      position: absolute;
      left: ${x - rippleSize / 2}px;
      top: ${y - rippleSize / 2}px;
      width: ${rippleSize}px;
      height: ${rippleSize}px;
      border-radius: 50%;
      background: ${color || "var(--accent)"};
      opacity: 0;
      transform: scale(0);
      pointer-events: none;
      animation: ripple-expand 0.6s ease-out forwards;
    `;

      container.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    },
    [color],
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onMouseDown={createRipple}
      {...props}
    >
      {children}
    </div>
  );
}
