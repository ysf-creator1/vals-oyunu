import { rhythmAfter } from '../engine/rules';
import type { Level, Stone } from '../engine/types';
import type { StringKey, T } from '../i18n';

export type DirName = 'left' | 'right' | 'up' | 'down';

/** Direction of a straight jump from a to b. */
export function dirBetween(a: Stone, b: Stone): DirName {
  if (a[1] === b[1]) return b[0] > a[0] ? 'right' : 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Is the path still a prefix of the stored solution? */
export function onSolution(level: Level, path: number[]): boolean {
  return level.solution.length > 0 && path.length <= level.solution.length && path.every((s, i) => s === level.solution[i]);
}

/**
 * Why the next jump has the length it has: the effect of the stone just landed on.
 * Null before the first jump (the first jump is always 1).
 */
export function landingNote(level: Level, path: number[], t: T): string | null {
  if (path.length < 2) return null;
  const kind = level.stones[path[path.length - 1]][2];
  const before = rhythmAfter(level, path.slice(0, -1));
  const now = rhythmAfter(level, path);
  if (kind === 'H') return t('ex.hold', { n: now.len });
  if (kind === 'R') return t('ex.reverse', { n: now.len });
  if (now.dir === 1 && before.len === 3) return t('ex.wrap');
  if (now.dir === -1 && before.len === 1) return t('ex.wrapRev');
  return t(now.dir === -1 ? 'ex.plainRev' : 'ex.plain', { n: now.len });
}

/** "Now 2 steps right." — direction only when the target is known. */
export function nowLine(level: Level, path: number[], target: number | null, t: T): string {
  const { len } = rhythmAfter(level, path);
  if (target === null || path.length === 0) return t('ex.nowNoDir', { n: len });
  const dir = dirBetween(level.stones[path[path.length - 1]], level.stones[target]);
  return t('ex.now', { n: len, dir: t(`dir.${dir}` as StringKey) });
}

/** "3rd move: 2 steps right." */
export function moveLine(level: Level, path: number[], target: number, t: T): string {
  const { len } = rhythmAfter(level, path);
  const dir = dirBetween(level.stones[path[path.length - 1]], level.stones[target]);
  return t('ex.move', { k: path.length, n: len, dir: t(`dir.${dir}` as StringKey) });
}
