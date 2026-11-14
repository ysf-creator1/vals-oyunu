export type Stars = 1 | 2 | 3;

export function starsFor(hints: number): Stars {
  if (hints === 0) return 3;
  if (hints <= 2) return 2;
  return 1;
}

export type SolveClass = 'fast' | 'normal' | 'struggled';

export function classify(ms: number, hints: number, targetMs: number, skipped = false): SolveClass {
  if (skipped || hints >= 2 || ms > 2.5 * targetMs) return 'struggled';
  if (ms <= targetMs && hints === 0) return 'fast';
  return 'normal';
}

/** "Fast solve" badge: under target time and no hints. Positive feedback only. */
export const isFastBadge = (ms: number, hints: number, targetMs: number) => hints === 0 && ms <= targetMs;
