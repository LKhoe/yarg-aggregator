"use client";

import { useEffect, useRef } from "react";

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    // Throttle to ~20fps — aurora is slow-moving, doesn't need 60fps
    let lastFrame = 0;
    const FRAME_INTERVAL = 50;

    // Render at half resolution for performance
    const SCALE = 0.5;

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * SCALE);
      canvas.height = Math.round(window.innerHeight * SCALE);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawAurora = (now: number) => {
      animationId = requestAnimationFrame(drawAurora);

      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Draw ribbons at half res with larger step size
      drawRibbon(ctx, width, height, time, height * 0.25, 60, 0.003, 0.4, height * 0.35, "rgba(100,50,180,0.12)", "rgba(120,70,200,0.06)", 0);
      drawRibbon(ctx, width, height, time, height * 0.35, 45, 0.004, 0.3, height * 0.3, "rgba(50,140,160,0.10)", "rgba(60,160,180,0.05)", 2);
      drawRibbon(ctx, width, height, time, height * 0.2, 35, 0.002, 0.5, height * 0.25, "rgba(140,50,120,0.08)", "rgba(130,60,140,0.04)", 4);
      drawRibbon(ctx, width, height, time, height * 0.3, 25, 0.005, 0.35, height * 0.2, "rgba(110,60,200,0.07)", "rgba(120,80,190,0.03)", 1);

      time += 0.05;
    };

    animationId = requestAnimationFrame(drawAurora);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", opacity: 0.7 }}
    />
  );
}

function drawRibbon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  yBase: number,
  amplitude: number,
  frequency: number,
  speed: number,
  ribbonHeight: number,
  color1: string,
  color2: string,
  phaseOffset: number,
) {
  const step = 8; // Fewer points at half res
  ctx.beginPath();
  ctx.moveTo(0, yBase);

  for (let x = 0; x <= width; x += step) {
    const y =
      yBase +
      Math.sin(x * frequency + time * speed + phaseOffset) * amplitude +
      Math.sin(x * frequency * 0.5 + time * speed * 0.7 + phaseOffset * 1.3) * amplitude * 0.5;
    ctx.lineTo(x, y);
  }

  for (let x = width; x >= 0; x -= step) {
    const y =
      yBase +
      ribbonHeight +
      Math.sin(x * frequency * 0.8 + time * speed * 0.6 + phaseOffset + 1) * amplitude * 0.6;
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, yBase, 0, yBase + ribbonHeight);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(0.5, color2);
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fill();
}
