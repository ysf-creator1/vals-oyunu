import type { CSSProperties, ReactNode } from 'react';
import type { Level } from '../../engine/types';
import type { ThemeId } from '../../progression/profile';

/** Themes that draw the path as footprints instead of a line. */
export const FOOTPRINT_THEMES: ThemeId[] = ['beach', 'snow', 'paws'];
export const isFootprintTheme = (t: ThemeId) => FOOTPRINT_THEMES.includes(t);

const c = (v: number) => v + 0.5;
/** Print size on the board (shapes below are drawn about 0.27 cells long). */
const SCALE = 1.55;

// Shapes point up (forward = -y), centred on 0,0. Right foot; the left one is mirrored.
function BareFoot({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M-0.052 -0.05 C-0.062 0.0 -0.03 0.035 -0.036 0.075 C-0.042 0.122 0.042 0.13 0.046 0.08 C0.05 0.035 0.07 -0.005 0.066 -0.05 C0.062 -0.095 -0.048 -0.098 -0.052 -0.05Z" />
      <circle cx={-0.036} cy={-0.112} r={0.024} />
      <circle cx={-0.004} cy={-0.124} r={0.017} />
      <circle cx={0.022} cy={-0.12} r={0.015} />
      <circle cx={0.044} cy={-0.108} r={0.013} />
      <circle cx={0.06} cy={-0.09} r={0.011} />
    </g>
  );
}

const BOOT = 'M-0.055 -0.04 C-0.06 -0.11 -0.03 -0.142 0.008 -0.142 C0.05 -0.142 0.07 -0.11 0.064 -0.04 C0.06 0.0 0.045 0.02 0.042 0.05 C0.04 0.09 0.045 0.135 0.0 0.138 C-0.042 0.138 -0.046 0.09 -0.045 0.05 C-0.045 0.02 -0.052 0.0 -0.055 -0.04Z';
const LUGS = [-0.11, -0.078, -0.046, -0.014].map((y) => `M-0.036 ${y + 0.012}L0.004 ${y - 0.006}L0.044 ${y + 0.012}`)
  .concat([0.07, 0.102].map((y) => `M-0.026 ${y + 0.01}L0 ${y - 0.004}L0.028 ${y + 0.01}`)).join('');

function Boot({ fill, lug }: { fill: string; lug?: string }) {
  return (
    <g>
      <path d={BOOT} fill={fill} />
      {lug && <path d={LUGS} fill="none" stroke={lug} strokeWidth={0.012} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
}

function Paw({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M-0.06 0.06 C-0.07 0.0 -0.03 -0.02 0 -0.02 C0.03 -0.02 0.07 0.0 0.06 0.06 C0.055 0.1 0.02 0.09 0 0.09 C-0.02 0.09 -0.055 0.1 -0.06 0.06Z" />
      <ellipse cx={-0.068} cy={-0.045} rx={0.02} ry={0.027} transform="rotate(-25 -0.068 -0.045)" />
      <ellipse cx={-0.026} cy={-0.082} rx={0.021} ry={0.029} />
      <ellipse cx={0.026} cy={-0.082} rx={0.021} ry={0.029} />
      <ellipse cx={0.068} cy={-0.045} rx={0.02} ry={0.027} transform="rotate(25 0.068 -0.045)" />
    </g>
  );
}

interface Print {
  key: string;
  x: number;
  y: number;
  ang: number;
  right: boolean;
  /** Stagger index inside the newest jump; undefined for older prints (no animation). */
  fresh?: number;
}

/**
 * One print per cell crossed, at the cell borders (a 3-long jump leaves 3 prints), so the 1-2-3 rhythm shows in
 * the trail. Right and left alternate over the whole path, starting with the right foot, each one beside the
 * line on its own side of the walking direction.
 */
export function printsFor(level: Level, path: number[], side: number): Print[] {
  const out: Print[] = [];
  let n = 0;
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = level.stones[path[k - 1]];
    const [bx, by] = level.stones[path[k]];
    const L = Math.abs(bx - ax) + Math.abs(by - ay);
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const fresh = k === path.length - 1;
    for (let s = 0; s < L; s++, n++) {
      const right = n % 2 === 0;
      const off = (right ? 1 : -1) * side;
      out.push({
        key: `${k}-${path[k - 1]}-${path[k]}-${s}`,
        x: c(ax) + dx * (s + 0.5) - dy * off,
        y: c(ay) + dy * (s + 0.5) + dx * off,
        ang,
        right,
        fresh: fresh ? s : undefined,
      });
    }
  }
  return out;
}

function Placed({ p, dx = 0, dy = 0, s = 1, mirror, children }: { p: Print; dx?: number; dy?: number; s?: number; mirror: boolean; children: ReactNode }) {
  const style: CSSProperties | undefined = p.fresh !== undefined ? { animationDelay: `${p.fresh * 0.13}s` } : undefined;
  return (
    <g transform={`translate(${p.x + dx} ${p.y + dy}) rotate(${p.ang}) scale(${SCALE * s})`}>
      <g className={p.fresh !== undefined ? 'step-in' : undefined} style={style}>
        {mirror && !p.right ? <g transform="scale(-1 1)">{children}</g> : children}
      </g>
    </g>
  );
}

export function Footprints({ level, path, theme }: { level: Level; path: number[]; theme: ThemeId }) {
  if (theme === 'snow') {
    // Pressed into snow, light from the top left: a lit rim of piled-up snow (lower right), the wall in shadow
    // (upper left), then the packed floor with its lugs. Offsets are in board space so the light never turns.
    const ps = printsFor(level, path, 0.11);
    return (
      <g style={{ pointerEvents: 'none' }}>
        <g filter="url(#snow-soft)">
          {ps.map((p) => <Placed key={p.key} p={p} dx={0.014} dy={0.018} s={1.12} mirror><Boot fill="#ffffff" /></Placed>)}
        </g>
        <g filter="url(#snow-soft)">
          {ps.map((p) => <Placed key={p.key} p={p} mirror><Boot fill="#6d87a8" /></Placed>)}
        </g>
        <g>
          {ps.map((p) => <Placed key={p.key} p={p} dx={0.011} dy={0.014} s={0.9} mirror><Boot fill="#b2c3d8" lug="#e1e9f3" /></Placed>)}
        </g>
      </g>
    );
  }
  const paws = theme === 'paws';
  const ps = printsFor(level, path, paws ? 0.08 : 0.1);
  return (
    <g style={{ pointerEvents: 'none' }}>
      {ps.map((p) => (
        <Placed key={p.key} p={p} mirror={!paws}>
          {paws ? <Paw fill="var(--b-path)" /> : <BareFoot fill="var(--b-path)" />}
        </Placed>
      ))}
    </g>
  );
}

/** Snowfield under the grid: drifts, sparkle, and the filters the snow prints use. */
export function SnowGround({ W, H, pad }: { W: number; H: number; pad: number }) {
  const sx = W / 6;
  const sy = H / 6;
  const drifts: [number, number, number, number, string][] = [
    [0.9, 1.1, 1.6, 0.5, 'url(#snow-hump)'], [4.6, 0.7, 1.4, 0.45, 'url(#snow-hump)'], [3.2, 5.3, 2.0, 0.5, 'url(#snow-hump)'],
    [1.2, 1.5, 1.4, 0.3, 'url(#snow-hollow)'], [4.9, 1.05, 1.2, 0.28, 'url(#snow-hollow)'], [3.4, 5.7, 1.8, 0.3, 'url(#snow-hollow)'],
    [5.6, 3.0, 0.8, 0.5, 'url(#snow-hollow)'],
  ];
  const glints = [];
  for (let i = 0; i < 46; i++) {
    const x = (i * 0.618034 * 7.3) % W;
    const y = (i * 0.754877 * 5.1 + 0.3) % H;
    glints.push(<circle key={i} cx={x} cy={y} r={i % 3 ? 0.012 : 0.018} fill={i % 4 ? '#ffffff' : '#9fb6d1'} opacity={0.9} />);
  }
  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="snow-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={0.009} /></filter>
        <linearGradient id="snow-bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#f6f9fd" /><stop offset="1" stopColor="#dfe8f2" /></linearGradient>
        <radialGradient id="snow-hump"><stop offset="0" stopColor="#ffffff" stopOpacity={0.75} /><stop offset="1" stopColor="#ffffff" stopOpacity={0} /></radialGradient>
        <radialGradient id="snow-hollow"><stop offset="0" stopColor="#8fa8c6" stopOpacity={0.16} /><stop offset="1" stopColor="#8fa8c6" stopOpacity={0} /></radialGradient>
        <radialGradient id="snow-stone"><stop offset="0.45" stopColor="#5d7898" stopOpacity={0.26} /><stop offset="1" stopColor="#5d7898" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={-pad} y={-pad} width={W + 2 * pad} height={H + 2 * pad} rx={0.28} fill="url(#snow-bg)" />
      {drifts.map(([x, y, rx, ry, fill], i) => <ellipse key={i} cx={x * sx} cy={y * sy} rx={rx * sx} ry={ry * sy} fill={fill} />)}
      {glints}
    </g>
  );
}

/** Stones sit in the snow: a soft blue shadow to the lower right of each. */
export function SnowStoneShadows({ level }: { level: Level }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {level.stones.map(([x, y], i) => <ellipse key={i} cx={c(x) + 0.05} cy={c(y) + 0.07} rx={0.46} ry={0.42} fill="url(#snow-stone)" />)}
    </g>
  );
}

/** Gentle snowfall over the board (hidden with reduced motion). */
export function Snowfall({ W, H }: { W: number; H: number }) {
  const flakes = [];
  for (let i = 0; i < 26; i++) {
    const style = {
      '--dur': `${7 + (i % 5) * 1.6}s`,
      '--delay': `${-((i * 1.37) % 9)}s`,
      '--sway': `${(i % 2 ? 1 : -1) * (0.12 + (i % 3) * 0.06)}px`,
      '--fall': `${H + 0.6}px`,
    } as CSSProperties;
    flakes.push(
      <circle key={i} className="flake" cx={((i * 0.618034 * 9.7) % (W + 0.2)) - 0.1} cy={-0.2} r={0.022 + (i % 4) * 0.009}
        fill="#ffffff" stroke="rgba(70,100,140,0.35)" strokeWidth={0.008} style={style} />,
    );
  }
  return <g style={{ pointerEvents: 'none' }}>{flakes}</g>;
}

export function Shell() {
  return (
    <g transform="translate(0.27 -0.3) scale(0.85)">
      <path d="M0 0.1 L-0.15 -0.02 C-0.12 -0.14 0.12 -0.14 0.15 -0.02 Z" fill="#f6b8a6" stroke="#8a3b2a" strokeWidth={0.022} strokeLinejoin="round" />
      <path d="M0 0.1 L-0.08 -0.1 M0 0.1 L0 -0.12 M0 0.1 L0.08 -0.1" stroke="#8a3b2a" strokeWidth={0.016} />
    </g>
  );
}

export function Beanie() {
  return (
    <g transform="translate(0.27 -0.3) scale(0.85)">
      <path d="M-0.13 0.05 C-0.13 -0.1 0.13 -0.1 0.13 0.05 Z" fill="#d64545" stroke="#7a1f1f" strokeWidth={0.02} strokeLinejoin="round" />
      <path d="M-0.06 -0.055 L-0.06 0.05 M0 -0.07 L0 0.05 M0.06 -0.055 L0.06 0.05" stroke="#a83232" strokeWidth={0.014} />
      <rect x={-0.15} y={0.03} width={0.3} height={0.065} rx={0.03} fill="#ffffff" stroke="#7a1f1f" strokeWidth={0.02} />
      <circle cx={0} cy={-0.115} r={0.045} fill="#ffffff" stroke="#7a1f1f" strokeWidth={0.02} />
    </g>
  );
}

export function Cat() {
  return (
    <g transform="translate(0.27 -0.3) scale(0.85)">
      <path d="M-0.13 -0.02 L-0.12 -0.16 L-0.05 -0.09 Z M0.13 -0.02 L0.12 -0.16 L0.05 -0.09 Z" fill="#e07b39" stroke="#5a3112" strokeWidth={0.02} strokeLinejoin="round" />
      <ellipse cx={0} cy={0} rx={0.14} ry={0.115} fill="#e07b39" stroke="#5a3112" strokeWidth={0.022} />
      <circle cx={-0.05} cy={-0.015} r={0.018} fill="#1d1b26" />
      <circle cx={0.05} cy={-0.015} r={0.018} fill="#1d1b26" />
      <path d="M-0.02 0.035 L0 0.05 L0.02 0.035" fill="none" stroke="#5a3112" strokeWidth={0.015} strokeLinecap="round" />
    </g>
  );
}
