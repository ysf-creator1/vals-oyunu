import { applyStone } from './rules';
import type { Rng } from './rng';
import { metrics, solveStones } from './solver';
import type { BandConfig, Dir, Kind, Len, Level, LevelBand, Stone } from './types';

/** Walk the solution path following the rhythm, placing stones as we go ("build the path first"). */
export function buildWalk(c: BandConfig, rng: Rng): Stone[] | null {
  const { w: W, h: H, n, nR, nH } = c;
  const kinds: Kind[] = Array(n).fill('P');
  const mid = rng.shuffle(Array.from({ length: n - 2 }, (_, i) => i + 1)); // first & last stay plain
  for (const i of mid.slice(0, nR)) kinds[i] = 'R';
  for (const i of mid.slice(nR, nR + nH)) kinds[i] = 'H';
  const pos: [number, number][] = [[rng.int(W), rng.int(H)]];
  const used = new Set<number>([pos[0][0] + pos[0][1] * W]);
  let L: Len = 1;
  let d: Dir = 1;
  for (let i = 1; i < n; i++) {
    const [x, y] = pos[pos.length - 1];
    const cands = ([
      [x + L, y],
      [x - L, y],
      [x, y + L],
      [x, y - L],
    ] as [number, number][]).filter(([a, b]) => a >= 0 && a < W && b >= 0 && b < H && !used.has(a + b * W));
    if (cands.length === 0) return null;
    const p = rng.pick(cands);
    pos.push(p);
    used.add(p[0] + p[1] * W);
    const r = applyStone(kinds[i], L, d);
    L = r.len;
    d = r.dir;
  }
  return pos.map(([x, y], i) => [x, y, kinds[i]]);
}

/** Canonical key under the 8 symmetries of a square board. */
export function canonical(W: number, H: number, stones: Stone[]): string {
  let best: string | null = null;
  for (let t = 0; t < 8; t++) {
    const pts = stones.map(([x0, y0, k]) => {
      let x = x0;
      let y = y0;
      if (t & 1) x = W - 1 - x;
      if (t & 2) y = H - 1 - y;
      if (t & 4) [x, y] = [y, x];
      return `${x},${y},${k}`;
    });
    pts.sort();
    const key = pts.join(';');
    if (best === null || key < best) best = key;
  }
  return best!;
}

/**
 * Key of the puzzle itself: the same under the 8 symmetries AND any shift on the board.
 * `canonical` keeps absolute positions, so a shape moved by one cell counts as new there;
 * for players it is the same puzzle.
 */
export function shapeKey(stones: Stone[]): string {
  let best: string | null = null;
  for (let t = 0; t < 8; t++) {
    const pts = stones.map(([x0, y0, k]) => {
      let x = t & 1 ? -x0 : x0;
      let y = t & 2 ? -y0 : y0;
      if (t & 4) [x, y] = [y, x];
      return [x, y, k] as const;
    });
    const mx = Math.min(...pts.map((p) => p[0]));
    const my = Math.min(...pts.map((p) => p[1]));
    const key = pts.map(([x, y, k]) => `${x - mx},${y - my},${k}`).sort().join(';');
    if (best === null || key < best) best = key;
  }
  return best!;
}

export class GenerationError extends Error {}

export function generate(
  c: BandConfig,
  rng: Rng,
  seen: Set<string>,
  meta: { id: string; band: LevelBand } = { id: '', band: 'K1' },
  maxTries = 300_000,
): Level {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const stones = buildWalk(c, rng);
    if (!stones) continue;
    const start = c.hidden ? null : 0;
    const { solutions, nodes } = solveStones(stones, start);
    if (solutions.length !== 1) continue;
    const { decisions, overlap } = metrics(stones, solutions[0]);
    if (decisions < c.minDecisions || nodes < c.minNodes || nodes > c.maxNodes || overlap > 2) continue;
    const key = canonical(c.w, c.h, stones);
    if (seen.has(key)) continue;
    seen.add(key);
    // Shuffle the stone order so the array order doesn't reveal the solution.
    const order = rng.shuffle(Array.from({ length: c.n }, (_, i) => i));
    if (!c.hidden) {
      order.splice(order.indexOf(0), 1);
      order.unshift(0);
    }
    const inv = new Map(order.map((old, i) => [old, i]));
    return {
      id: meta.id,
      band: meta.band,
      w: c.w,
      h: c.h,
      stones: order.map((o) => [...stones[o]] as Stone),
      start: c.hidden ? null : 0,
      solution: solutions[0].map((i) => inv.get(i)!),
      nodes,
      decisions,
    };
  }
  throw new GenerationError('band too narrow: no new unique level found');
}
