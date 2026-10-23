'use client';

import { useEffect, useRef } from 'react';

type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; color: string; life: number };
const COLORS = ['#6978f5', '#aeb7ff', '#e75d87', '#fbbf24', '#4ade80', '#ffffff'];

/** Short burst of confetti over whatever is behind it. Respects prefers-reduced-motion. */
export default function Confetti({ burst, big = false }: { burst: number; big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !burst) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const count = big ? 190 : 110;
    const parts: P[] = Array.from({ length: count }, () => {
      const a = (Math.random() * Math.PI) - Math.PI; // upward fan
      const sp = (big ? 9 : 7) + Math.random() * (big ? 11 : 8);
      return { x: w / 2, y: h * 0.62, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, color: COLORS[Math.floor(Math.random() * COLORS.length)], life: 1 };
    });
    let raf = 0; let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.7); last = now;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of parts) {
        p.vy += 0.32 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.008 * dt;
        if (p.life <= 0 || p.y > h + 20) continue;
        alive++;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [burst, big]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full" />;
}
