import { memo } from 'react';
import type { Level } from '../../engine/types';
import type { T } from '../../i18n';
import type { ThemeId } from '../../progression/profile';

export interface BoardProps {
  level: Level;
  path: number[];
  size: number;
  t: T;
  theme: ThemeId;
  onTap?: (stone: number) => void;
  /** Currently legal targets (helper highlight). */
  targets?: number[];
  hintTarget?: number | null;
  ruler?: { from: number; len: number; key: number } | null;
  shake?: { stone: number; key: number } | null;
  /** Index into path highlighted during the win replay. */
  replay?: number;
  showStartRing?: boolean;
  /** Animated tapping finger on this stone (tutorial, help, guide). */
  finger?: number | null;
  /** Numbered step markers along a straight jump: shows why the target is the right distance. */
  count?: { from: number; to: number } | null;
  /** Stones on a wrong branch (shown in the warning colour until undone). */
  wrong?: number[];
}

const PAD = 0.12;
const c = (v: number) => v + 0.5;

function arc(ax: number, ay: number, bx: number, by: number, i: number, flat: boolean) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const bend = (flat ? 0.07 : 0.14 + 0.07 * dist) * (i % 2 ? 1 : -1);
  const qx = mx + (-dy / dist) * bend;
  const qy = my + (dx / dist) * bend;
  return `M${ax} ${ay}Q${qx} ${qy} ${bx} ${by}`;
}

function lilyPad(cx: number, cy: number, r: number) {
  const p = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  const [x1, y1] = p(-72);
  const [x2, y2] = p(-108);
  return `M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 1 1 ${x2} ${y2}Z`;
}

function StoneShape({ kind, x, y, theme, fill, stroke, sw }: {
  kind: 'P' | 'R' | 'H'; x: number; y: number; theme: ThemeId; fill: string; stroke: string; sw: number;
}) {
  const cx = c(x);
  const cy = c(y);
  if (kind === 'P') {
    if (theme === 'lily') return <path d={lilyPad(cx, cy, 0.33)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    return <circle cx={cx} cy={cy} r={0.3} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  if (kind === 'R') {
    const r = 0.37;
    return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  }
  const s = 0.54;
  return <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} rx={0.09} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

function Frog() {
  return (
    <g transform="translate(0.27 -0.3) scale(0.85)">
      <ellipse cx={0} cy={0.02} rx={0.15} ry={0.11} fill="#3f9b3a" stroke="#1d4d1c" strokeWidth={0.025} />
      <circle cx={-0.07} cy={-0.08} r={0.05} fill="#fff" stroke="#1d4d1c" strokeWidth={0.02} />
      <circle cx={0.07} cy={-0.08} r={0.05} fill="#fff" stroke="#1d4d1c" strokeWidth={0.02} />
      <circle cx={-0.07} cy={-0.08} r={0.02} fill="#111" />
      <circle cx={0.07} cy={-0.08} r={0.02} fill="#111" />
    </g>
  );
}

function Boat() {
  return (
    <g transform="translate(0.27 -0.3) scale(0.85)">
      <path d="M-0.17 0.02 L0.17 0.02 L0.11 0.1 L-0.11 0.1 Z" fill="#7a2e12" stroke="#3b1406" strokeWidth={0.02} />
      <path d="M0 -0.18 L0 0.02 L0.13 0.02 Z" fill="#fff" stroke="#3b1406" strokeWidth={0.02} strokeLinejoin="round" />
    </g>
  );
}

/** A pointing hand whose fingertip is at (0,0). Drawn in board units (1 = one cell). */
function Hand() {
  return (
    <g className="hand">
      <g transform="rotate(-18)" fill="#ffffff" stroke="#1d1b26" strokeWidth={0.035} strokeLinejoin="round">
        <rect x={0.07} y={0.36} width={0.19} height={0.36} rx={0.095} />
        <rect x={0.22} y={0.42} width={0.18} height={0.33} rx={0.09} />
        <ellipse cx={-0.15} cy={0.7} rx={0.085} ry={0.18} transform="rotate(-28 -0.15 0.7)" />
        <path d="M-0.11 0.5 L0.4 0.55 L0.42 0.86 Q0.42 1.06 0.2 1.06 L0.02 1.06 Q-0.15 1.06 -0.15 0.86 Z" />
        <rect x={-0.11} y={0} width={0.22} height={0.66} rx={0.11} />
      </g>
    </g>
  );
}

function StepCount({ level, from, to }: { level: Level; from: number; to: number }) {
  const [x, y] = level.stones[from];
  const [tx, ty] = level.stones[to];
  const dx = Math.sign(tx - x);
  const dy = Math.sign(ty - y);
  const L = Math.abs(tx - x) + Math.abs(ty - y);
  // numbers sit beside the line (not on the stones): above / left of it, away from the finger (which hangs down-right)
  const side = -1;
  const ox = dy !== 0 ? side * 0.4 : 0;
  const oy = dx !== 0 ? side * 0.4 : 0;
  const marks = [];
  for (let k = 1; k <= L; k++) {
    const mx = c(x + dx * k) + ox;
    const my = c(y + dy * k) + oy;
    marks.push(
      <g key={k} className="count-mark" style={{ animationDelay: `${(k - 1) * 0.18}s` }}>
        <circle cx={mx} cy={my} r={0.15} fill="var(--b-accent)" />
        <text x={mx} y={my + 0.008} fontSize={0.19} fontWeight={800} textAnchor="middle" dominantBaseline="central" fill="var(--b-num)">{k}</text>
      </g>,
    );
  }
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line x1={c(x) + ox} y1={c(y) + oy} x2={c(tx) + ox} y2={c(ty) + oy} stroke="var(--b-accent)" strokeWidth={0.035} strokeDasharray="0.08 0.08" opacity={0.6} />
      {marks}
    </g>
  );
}

function BoardImpl(p: BoardProps) {
  const { level, path, size, t, theme } = p;
  const W = level.w;
  const H = level.h;
  const visitedAt = new Map(path.map((s, i) => [s, i]));
  // Label on a visited stone: 0 on the start, otherwise the length of the jump that landed there (1-2-3 rhythm).
  const jumpLen = (vi: number) => {
    if (vi === 0) return 0;
    const [ax, ay] = level.stones[path[vi - 1]];
    const [bx, by] = level.stones[path[vi]];
    return Math.abs(bx - ax) + Math.abs(by - ay);
  };
  const wrongSet = new Set(p.wrong ?? []);
  const active = path.length ? path[path.length - 1] : null;
  const targets = new Set(p.targets ?? []);
  const flat = theme === 'stars';
  const interactive = !!p.onTap;

  const grid: JSX.Element[] = [];
  for (let i = 0; i <= W; i++) grid.push(<line key={`v${i}`} x1={i} y1={0} x2={i} y2={H} />);
  for (let j = 0; j <= H; j++) grid.push(<line key={`h${j}`} x1={0} y1={j} x2={W} y2={j} />);

  let ruler: JSX.Element | null = null;
  if (p.ruler) {
    const [x, y] = level.stones[p.ruler.from];
    const L = p.ruler.len;
    ruler = (
      <g key={p.ruler.key} className="ruler" stroke="var(--b-accent)" strokeWidth={0.05} strokeLinecap="round" opacity={0.75}>
        {[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => {
          const ex = x + dx * L;
          const ey = y + dy * L;
          if (ex < 0 || ex >= W || ey < 0 || ey >= H) return null;
          const ticks = [];
          for (let k = 1; k <= L; k++) {
            const tx = c(x + dx * k);
            const ty = c(y + dy * k);
            ticks.push(<line key={k} x1={tx - dy * 0.12} y1={ty - dx * 0.12} x2={tx + dy * 0.12} y2={ty + dx * 0.12} />);
          }
          return (
            <g key={`${dx}${dy}`}>
              <line x1={c(x)} y1={c(y)} x2={c(ex)} y2={c(ey)} strokeDasharray="0.12 0.1" />
              {ticks}
              <circle cx={c(ex)} cy={c(ey)} r={0.42} fill="none" strokeWidth={0.035} />
            </g>
          );
        })}
      </g>
    );
  }

  const arcs = path.slice(1).map((s, k) => {
    const a = level.stones[path[k]];
    const b = level.stones[s];
    const isNew = k === path.length - 2;
    return (
      <path
        key={`${k}-${path[k]}-${s}`}
        d={arc(c(a[0]), c(a[1]), c(b[0]), c(b[1]), k, flat)}
        pathLength={1}
        className={isNew ? 'draw' : undefined}
        fill="none"
        stroke="var(--b-path)"
        strokeWidth={flat ? 0.045 : 0.075}
        strokeLinecap="round"
        opacity={theme === 'islands' ? 0.85 : 0.7}
        strokeDasharray={theme === 'islands' ? '0.08 0.08' : undefined}
      />
    );
  });

  const replayStone = p.replay !== undefined && p.replay >= 0 ? path[p.replay] : null;

  return (
    <svg
      className="board"
      width={size}
      height={size}
      viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}`}
      role="group"
      aria-label={`${W}×${H}`}
    >
      <rect x={-PAD} y={-PAD} width={W + 2 * PAD} height={H + 2 * PAD} rx={0.28} fill="var(--b-bg)" />
      {theme === 'stars' &&
        [[0.4, 0.7], [2.2, 0.3], [4.6, 1.2], [5.3, 4.4], [1.1, 5.4], [3.3, 3.6], [0.6, 2.9]].map(([sx, sy], i) =>
          sx < W && sy < H ? <circle key={i} cx={sx} cy={sy} r={0.025} fill="#fff" opacity={0.5} /> : null,
        )}
      <g stroke="var(--b-grid)" strokeWidth="var(--b-grid-w)">{grid}</g>
      {ruler}
      <g>{arcs}</g>
      {level.stones.map(([x, y, kind], i) => {
        const vi = visitedAt.get(i);
        const visited = vi !== undefined;
        const isActive = i === active;
        const isTarget = targets.has(i);
        const shake = p.shake && p.shake.stone === i;
        const isWrong = visited && wrongSet.has(i);
        const state = isActive ? t('a11y.active') : visited ? t('a11y.visited', { n: vi + 1 }) : t('a11y.unvisited');
        const label = t('a11y.stone', { col: x + 1, row: y + 1, kind: t(`a11y.kind.${kind}`), state });
        return (
          <g
            key={i}
            className={`stone${shake ? ' shake' : ''}`}
            data-k={shake ? p.shake!.key : undefined}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? label : undefined}
            onPointerDown={interactive ? (e) => { e.preventDefault(); p.onTap!(i); } : undefined}
            onKeyDown={interactive ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onTap!(i); }
            } : undefined}
          >
            <rect x={x} y={y} width={1} height={1} fill="transparent" />
            <circle className="focus-ring" cx={c(x)} cy={c(y)} r={0.47} fill="none" stroke="none" />
            {isTarget && !visited && <circle className="glow" cx={c(x)} cy={c(y)} r={0.44} fill="var(--b-accent)" opacity={0.2} />}
            {p.showStartRing && i === level.start && (
              <circle cx={c(x)} cy={c(y)} r={0.42} fill="none" stroke="var(--b-stroke)" strokeWidth={0.035} />
            )}
            <g className={replayStone === i ? 'pop' : undefined} key={replayStone === i ? `r${p.replay}` : 'n'}>
              <StoneShape
                kind={kind}
                x={x}
                y={y}
                theme={theme}
                fill={isWrong ? 'var(--b-wrong)' : visited ? 'var(--b-visited)' : 'var(--b-fill)'}
                stroke={isWrong ? 'var(--b-wrong)' : visited ? 'var(--b-visited)' : 'var(--b-stroke)'}
                sw={0.06}
              />
              {visited && (
                <text
                  x={c(x)}
                  y={c(y) + 0.012}
                  fontSize={0.3}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--b-num)"
                  style={{ pointerEvents: 'none' }}
                >
                  {jumpLen(vi)}
                </text>
              )}
            </g>
            {isWrong && <circle cx={c(x)} cy={c(y)} r={0.46} fill="none" stroke="var(--b-wrong)" strokeWidth={0.06} />}
            {p.hintTarget === i && (
              <circle cx={c(x)} cy={c(y)} r={0.46} fill="none" stroke="var(--b-accent)" strokeWidth={0.06} strokeDasharray="0.12 0.09" className="glow" />
            )}
          </g>
        );
      })}
      {p.count && <StepCount key={`c${p.count.from}-${p.count.to}`} level={level} from={p.count.from} to={p.count.to} />}
      {active !== null && (
        <g className="token" style={{ transform: `translate(${c(level.stones[active][0])}px, ${c(level.stones[active][1])}px)`, pointerEvents: 'none' }}>
          <circle className="breathe" r={0.45} fill="none" stroke="var(--b-accent)" strokeWidth={0.075} />
          {theme === 'lily' && <Frog />}
          {theme === 'islands' && <Boat />}
        </g>
      )}
      {p.finger != null && level.stones[p.finger] && (
        <g key={`f${p.finger}`} className="finger" transform={`translate(${c(level.stones[p.finger][0])} ${c(level.stones[p.finger][1])})`} style={{ pointerEvents: 'none' }}>
          <circle className="tap-ring" r={0.34} fill="none" stroke="var(--b-accent)" strokeWidth={0.06} />
          <Hand />
        </g>
      )}
    </svg>
  );
}

export const Board = memo(BoardImpl);
