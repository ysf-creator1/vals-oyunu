import { rhythmAfter } from './rules';
import type { Level } from './types';

export type Direction = 'left' | 'right' | 'up' | 'down';
export type StoneNote = 'reversed' | 'hold' | null;

export type Hint =
  | { kind: 'solved' }
  /** The path left the (unique) solution at path index `move` (0 = the start stone). */
  | { kind: 'wrong'; move: number; rewindTo: number[] }
  | { kind: 'onTrack'; tier: 1; note: StoneNote }
  | { kind: 'direction'; tier: 2; len: number; dir: Direction; target: number; note: StoneNote }
  | { kind: 'mark'; tier: 3; target: number; note: StoneNote }
  | { kind: 'startRegion'; tier: 1; region: 'top' | 'bottom' }
  | { kind: 'startMark'; tier: 2; target: number };

/** First index where the path differs from the solution, or -1 if the path is a prefix of it. */
export function divergence(level: Level, path: number[]): number {
  for (let i = 0; i < path.length; i++) if (path[i] !== level.solution[i]) return i;
  return -1;
}

/**
 * Tiered hint for the current path. `tier` is how many times Help was pressed in this state (1-based).
 * Every level has exactly one solution, so any path that is not its prefix is a dead end.
 */
export function hint(level: Level, path: number[], tier = 1): Hint {
  if (path.length === level.stones.length) return { kind: 'solved' };
  const sol = level.solution;
  if (path.length === 0) {
    const target = sol[0];
    if (tier <= 1) return { kind: 'startRegion', tier: 1, region: level.stones[target][1] < level.h / 2 ? 'top' : 'bottom' };
    return { kind: 'startMark', tier: 2, target };
  }
  const div = divergence(level, path);
  if (div >= 0) return { kind: 'wrong', move: div, rewindTo: path.slice(0, div) };

  const last = level.stones[path[path.length - 1]];
  const note: StoneNote = path.length > 1 ? (last[2] === 'R' ? 'reversed' : last[2] === 'H' ? 'hold' : null) : null;
  if (tier <= 1) return { kind: 'onTrack', tier: 1, note };
  const target = sol[path.length];
  if (tier === 2) {
    const t = level.stones[target];
    const dx = t[0] - last[0];
    const dy = t[1] - last[1];
    const dir: Direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    return { kind: 'direction', tier: 2, len: rhythmAfter(level, path).len, dir, target, note };
  }
  return { kind: 'mark', tier: 3, target, note };
}
