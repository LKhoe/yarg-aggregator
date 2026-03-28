"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  cellX: number;
  cellY: number;
}

const PARTICLE_COUNT = 35;
const CONNECTION_DISTANCE = 100;
const CONNECTION_DISTANCE_SQ = CONNECTION_DISTANCE * CONNECTION_DISTANCE;
const MOUSE_RADIUS = 130;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
const MOUSE_FORCE = 0.02;
const CELL_SIZE = CONNECTION_DISTANCE;

export function ParticleConstellation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const boundingRef = useRef<DOMRect | null>(null);
  // Reusable grid to avoid per-frame allocation
  const gridRef = useRef<(Particle[] | null)[]>([]);
  const gridDims = useRef({ cols: 0, rows: 0 });

  const initParticles = useCallback((width: number, height: number) => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return {
        x, y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        cellX: Math.floor(x / CELL_SIZE),
        cellY: Math.floor(y / CELL_SIZE),
      };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let lastFrame = 0;
    const FRAME_INTERVAL = 33;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      boundingRef.current = rect;

      // Pre-allocate grid
      const cols = Math.ceil(rect.width / CELL_SIZE) + 1;
      const rows = Math.ceil(rect.height / CELL_SIZE) + 1;
      gridDims.current = { cols, rows };
      gridRef.current = new Array(cols * rows).fill(null);

      if (particlesRef.current.length === 0) {
        initParticles(rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = boundingRef.current;
      if (!rect) return;
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    const parent = canvas.parentElement;
    parent?.addEventListener("mousemove", handleMouseMove);
    parent?.addEventListener("mouseleave", handleMouseLeave);

    const isDark = document.documentElement.classList.contains("dark");
    const opacityMul = isDark ? 1 : 0.5;

    // Pre-build color strings for common opacities to reduce allocations
    const pR = isDark ? 167 : 100;
    const pG = isDark ? 139 : 80;
    const pB = isDark ? 250 : 180;
    const lR = isDark ? 139 : 80;
    const lG = isDark ? 192 : 120;
    const lB = isDark ? 255 : 200;

    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const { cols, rows } = gridDims.current;
      const grid = gridRef.current;

      // Clear grid (reset to null, no allocation)
      for (let i = 0, len = grid.length; i < len; i++) {
        if (grid[i]) grid[i]!.length = 0;
      }

      // Update particles + populate grid
      for (const p of particles) {
        if (mouse.x > 0) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MOUSE_RADIUS_SQ && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
            p.vx -= (dx / dist) * force;
            p.vy -= (dy / dist) * force;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        p.cellX = Math.floor(p.x / CELL_SIZE);
        p.cellY = Math.floor(p.y / CELL_SIZE);
        const idx = p.cellY * cols + p.cellX;
        if (idx >= 0 && idx < grid.length) {
          if (!grid[idx]) grid[idx] = [];
          grid[idx]!.push(p);
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pR},${pG},${pB},${p.opacity * opacityMul})`;
        ctx.fill();
      }

      // Draw connections using spatial grid
      ctx.lineWidth = 0.5;
      for (const p of particles) {
        const cx = p.cellX;
        const cy = p.cellY;
        for (let ny = cy - 1; ny <= cy + 1; ny++) {
          for (let nx = cx - 1; nx <= cx + 1; nx++) {
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const cell = grid[ny * cols + nx];
            if (!cell) continue;
            for (const q of cell) {
              if (q === p || q.x < p.x) continue;
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < CONNECTION_DISTANCE_SQ) {
                const opacity = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.15 * opacityMul;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.strokeStyle = `rgba(${lR},${lG},${lB},${opacity})`;
                ctx.stroke();
              }
            }
          }
        }
      }

      // Mouse connections
      if (mouse.x > 0 && mouse.y > 0) {
        for (const p of particles) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MOUSE_RADIUS_SQ) {
            const opacity = (1 - Math.sqrt(distSq) / MOUSE_RADIUS) * 0.3 * opacityMul;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${lR},${lG},${lB},${opacity})`;
            ctx.stroke();
          }
        }
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      parent?.removeEventListener("mousemove", handleMouseMove);
      parent?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className ?? ""}`}
    />
  );
}
