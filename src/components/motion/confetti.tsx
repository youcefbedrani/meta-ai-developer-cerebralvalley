"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#f77373", "#e0469b", "#814bee", "#41175e", "#0f8a52", "#f5b83d"];

/**
 * A short confetti burst, once per `id` per browser session (so a page refresh doesn't replay it).
 * Skipped entirely for reduced motion. Pure canvas, no library.
 */
export function Confetti({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = `confetti:${id}`;
    const seen = () => {
      try {
        return !!sessionStorage.getItem(key);
      } catch {
        return false;
      }
    };
    if (seen()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const pieces = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 18 * dpr,
      vy: (-Math.random() * 16 - 6) * dpr,
      size: (Math.random() * 6 + 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let raf = 0;
    let t0 = 0;
    const frame = (t: number) => {
      t0 ||= t;
      const elapsed = t - t0;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
      for (const p of pieces) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (elapsed < 2600) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    // Start once the score ring has drawn. By then the page's entrance animation has ended, so no
    // transformed ancestor traps this fixed canvas.
    const start = setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* storage blocked: still celebrate */
      }
      raf = requestAnimationFrame(frame);
    }, 1000);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [id]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 size-full" aria-hidden="true" />;
}
