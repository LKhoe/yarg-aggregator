"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface FlyingGhostOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FlyingGhostProps {
  origin: FlyingGhostOrigin;
  targetRef: React.RefObject<HTMLElement | null>;
  onComplete: () => void;
}

export function FlyingGhost({ origin, targetRef, onComplete }: FlyingGhostProps) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    const target = targetRef.current;
    if (!el || !target) {
      onComplete();
      return;
    }

    const targetRect = target.getBoundingClientRect();

    // Single rAF to flush initial styles, then apply destination
    requestAnimationFrame(() => {
      el.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.top = `${targetRect.top}px`;
      el.style.left = `${targetRect.left}px`;
      el.style.width = `${targetRect.width}px`;
      el.style.height = `${Math.min(targetRect.height, 200)}px`;
      el.style.borderRadius = "12px";
      el.style.opacity = "0";
      el.style.transform = "scale(0.95)";
    });

    const timer = setTimeout(onComplete, 420);
    return () => clearTimeout(timer);
  }, [targetRef, onComplete]);

  return createPortal(
    <div
      ref={elRef}
      style={{
        position: "fixed",
        zIndex: 9999,
        top: origin.top,
        left: origin.left,
        width: origin.width,
        height: origin.height,
        borderRadius: 8,
        background: "linear-gradient(135deg, var(--primary), var(--accent))",
        opacity: 0.5,
        pointerEvents: "none" as const,
      }}
    />,
    document.body,
  );
}
