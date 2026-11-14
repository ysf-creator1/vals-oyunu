import type { Dir, Kind, Len, Level, Rhythm, Stone } from './types';

/** Rhythm step: dir=+1 → 1,2,3,1…  dir=-1 → 1,3,2,1… */
export function nextLen(L: Len, d: Dir): Len {
  return (d === 1 ? (L % 3) + 1 : ((L + 1) % 3) + 1) as Len;
}

/** Next jump length and direction after landing on a stone of the given kind. */
export function applyStone(kind: Kind, L: Len, d: Dir): Rhythm {
  if (kind === 'P') return { len: nextLen(L, d), dir: d };
  if (kind === 'R') {
    const nd = -d as Dir;
    return { len: nextLen(L, nd), dir: nd };
  }
  return { len: L, dir: d }; // 'H' hold: same length again
}

export const INITIAL_RHYTHM: Rhythm = { len: 1, dir: 1 };

/** Rhythm for the next jump, recomputed from the path (state is never stored). */
export function rhythmAfter(level: Pick<Level, 'stones'>, path: number[]): Rhythm {
  let r: Rhythm = INITIAL_RHYTHM;
  for (let i = 1; i < path.length; i++) r = applyStone(level.stones[path[i]][2], r.len, r.dir);
  return r;
}

/** Indices of unvisited stones exactly L cells away in a straight line. Visited is a bitmask. */
export function legalFrom(stones: Stone[], cur: number, visited: number, L: number): number[] {
  const [x, y] = stones[cur];
  const out: number[] = [];
  for (let j = 0; j < stones.length; j++) {
    if ((visited >> j) & 1) continue;
    const [a, b] = stones[j];
    if ((a === x && Math.abs(b - y) === L) || (b === y && Math.abs(a - x) === L)) out.push(j);
  }
  return out;
}

function mask(path: number[]): number {
  let m = 0;
  for (const i of path) m |= 1 << i;
  return m;
}

/** Legal next stones. With an empty path (hidden start) any plain stone is a legal start. */
export function legalMoves(level: Level, path: number[]): number[] {
  if (path.length === 0) {
    return level.stones.map((s, i) => (s[2] === 'P' ? i : -1)).filter((i) => i >= 0);
  }
  if (path.length === level.stones.length) return [];
  const { len } = rhythmAfter(level, path);
  return legalFrom(level.stones, path[path.length - 1], mask(path), len);
}

export type MoveResult =
  | { ok: true; path: number[] }
  | { ok: false; reason: 'visited' | 'distance' | 'notPlainStart' };

export function tryMove(level: Level, path: number[], stone: number): MoveResult {
  if (path.length === 0) {
    if (level.stones[stone][2] !== 'P') return { ok: false, reason: 'notPlainStart' };
    return { ok: true, path: [stone] };
  }
  if (path.includes(stone)) return { ok: false, reason: 'visited' };
  if (!legalMoves(level, path).includes(stone)) return { ok: false, reason: 'distance' };
  return { ok: true, path: [...path, stone] };
}

export function isSolved(level: Level, path: number[]): boolean {
  return path.length === level.stones.length;
}

export function isDeadEnd(level: Level, path: number[]): boolean {
  return path.length > 0 && !isSolved(level, path) && legalMoves(level, path).length === 0;
}

/** The path a level starts with: [start] for an open start, [] for a hidden one. */
export function initialPath(level: Level): number[] {
  return level.start === null ? [] : [level.start];
}
