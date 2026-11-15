import { rhythmAfter } from './rules';
import type { Level } from './types';

export type Direction = 'left' | 'right' | 'up' | 'down';
export type StoneNote = 'reversed' | 'hold' | null;

/** One press of Help always gives a concrete answer: the stone to tap next, or where the path went wrong. */
export type Hint =
  | { kind: 'solved' }
  /** The path left the (unique) solution at path index `move` (0 = the start stone). */
  | { kind: 'wrong'; move: number; rewindTo: number[] }
  /** Hidden start: the start stone. */
  | { kind: 'start'; target: number }
  /** On track: the next stone, with the jump length and direction that reach it. */
  | { kind: 'next'; len: number; dir: Direction; target: number; note: StoneNote };

/** First index where the path differs from the solution, or -1 if the path is a prefix of it. */
export function divergence(level: Level, path: number[]): number {
  for (let i = 0; i < path.length; i++) if (path[i] !== level.solution[i]) return i;
  return -1;
}

/** Every level has exactly one solution, so any path that is not its prefix is a dead end. */
export function hint(level: Level, path: number[]): Hint {
  if (path.length === level.stones.length) return { kind: 'solved' };
  const sol = level.solution;
  if (path.length === 0) return { kind: 'start', target: sol[0] };
  const div = divergence(level, path);
  if (div >= 0) return { kind: 'wrong', move: div, rewindTo: path.slice(0, div) };

  const last = level.stones[path[path.length - 1]];
  const note: StoneNote = path.length > 1 ? (last[2] === 'R' ? 'reversed' : last[2] === 'H' ? 'hold' : null) : null;
  const target = sol[path.length];
  const t = level.stones[target];
  const dx = t[0] - last[0];
  const dy = t[1] - last[1];
  const dir: Direction = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
  return { kind: 'next', len: rhythmAfter(level, path).len, dir, target, note };
}
