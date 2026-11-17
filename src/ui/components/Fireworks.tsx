import { useEffect, useRef } from 'react';

const COLORS = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff', '#ff9f1c'];

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }

/** A few bursts of fireworks over the whole screen (about 3 s), drawn on a canvas that ignores taps. */
export function Fireworks({ bursts = 6, onDone }: { bursts?: number; onDone?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext('2d');
    if (!cv || !g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    g.scale(dpr, dpr);
    const sparks: Spark[] = [];
    const scale = Math.min(w, 520) / 400;
    const burst = () => {
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.12 + Math.random() * 0.35);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const n = 46 + Math.floor(Math.random() * 20);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const sp = (1.6 + Math.random() * 2.6) * scale;
        const max = 55 + Math.random() * 30;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max, color: Math.random() < 0.2 ? '#ffffff' : color });
      }
    };
    const timers = Array.from({ length: bursts }, (_, i) => setTimeout(burst, i * 380 + Math.random() * 150));
    let raf = 0;
    let last = performance.now();
    const start = last;
    const frame = (now: number) => {
      const k = Math.min((now - last) / 16.7, 3);
      last = now;
      g.clearRect(0, 0, w, h);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.985 ** k;
        s.vy = s.vy * 0.985 ** k + 0.045 * k * scale;
        s.x += s.vx * k;
        s.y += s.vy * k;
        s.life -= k;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        g.globalAlpha = Math.min(1, s.life / (s.max * 0.5));
        g.fillStyle = s.color;
        g.beginPath();
        g.arc(s.x, s.y, 2.2 * scale, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      if (sparks.length || now - start < bursts * 400 + 200) raf = requestAnimationFrame(frame);
      else onDone?.();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
