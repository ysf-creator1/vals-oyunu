/**
 * End-of-level comparison with other players: their best and average solve time for the same level
 * (daily and campaign levels are the same for everyone). Endless levels are one-offs, so those get the
 * average for the band instead. Computed by the event server from the anonymous "bitti" events,
 * always excluding this device. Off wherever usage events are off; any failure just means no comparison.
 */
import { deviceCode } from './track';

export interface OthersTimes {
  /** Other players (devices) counted. */
  n: number;
  /** Their average first-solve time (ms). */
  avg: number | null;
  /** Their best time without help (ms), and how many players had a help-free solve. */
  best: number | null;
  bestN: number;
  scope: 'level' | 'band';
}

/** Fewest other help-free players before beating them all earns the big celebration. */
export const FASTEST_MIN_PLAYERS = 3;

export async function fetchOthersTimes(levelId: string, band: string, endless: boolean, timeoutMs = 3000): Promise<OthersTimes | null> {
  const d = deviceCode();
  if (!d || typeof fetch !== 'function') return null;
  const q = new URLSearchParams(endless ? { b: band, c: d.device } : { s: levelId, c: d.device });
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    const r = await fetch(`${d.api}/sure?${q}`, { signal: ctl?.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { n?: number; ort?: number | null; en?: number | null; enN?: number };
    if (typeof j.n !== 'number') return null;
    return { n: j.n, avg: j.ort ?? null, best: j.en ?? null, bestN: j.enN ?? 0, scope: endless ? 'band' : 'level' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** How this solve compares; only help-free solves can be "fastest". */
export function compareSolve(ms: number, helped: boolean, o: OthersTimes | null): 'fastest' | 'leading' | 'first' | null {
  if (!o || o.scope !== 'level') return null;
  if (o.n === 0) return 'first';
  if (helped || o.best === null || ms >= o.best) return null;
  return o.bestN >= FASTEST_MIN_PLAYERS ? 'fastest' : 'leading';
}
