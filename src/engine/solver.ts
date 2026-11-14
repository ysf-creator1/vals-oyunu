import { applyStone, legalFrom } from './rules';
import type { Dir, Len, Level, Stone } from './types';

/** Full DFS from one start stone. Mirrors the Python reference exactly (incl. node counting). */
export function solveFrom(stones: Stone[], start: number, cap = 2): { solutions: number[][]; nodes: number } {
  const n = stones.length;
  const solutions: number[][] = [];
  let nodes = 0;
  const path = [start];
  const rec = (cur: number, visited: number, L: Len, d: Dir) => {
    nodes++;
    if (path.length === n) {
      solutions.push(path.slice());
      return;
    }
    if (solutions.length >= cap) return;
    for (const j of legalFrom(stones, cur, visited, L)) {
      const r = applyStone(stones[j][2], L, d);
      path.push(j);
      rec(j, visited | (1 << j), r.len, r.dir);
      path.pop();
    }
  };
  rec(start, 1 << start, 1, 1);
  return { solutions, nodes };
}

/** Solve a level; start=null means hidden start (every plain stone is tried). */
export function solveStones(stones: Stone[], start: number | null, cap = 2): { solutions: number[][]; nodes: number } {
  const starts = start !== null ? [start] : stones.map((s, i) => (s[2] === 'P' ? i : -1)).filter((i) => i >= 0);
  const solutions: number[][] = [];
  let nodes = 0;
  for (const s of starts) {
    const r = solveFrom(stones, s, cap);
    solutions.push(...r.solutions);
    nodes += r.nodes;
    if (solutions.length > 1) break;
  }
  return { solutions, nodes };
}

export function solve(level: Pick<Level, 'stones' | 'start'>, cap = 2) {
  return solveStones(level.stones, level.start, cap);
}

/** Decision points on the solution path and the max number of jumps over one unit edge. */
export function metrics(stones: Stone[], sol: number[]): { decisions: number; overlap: number } {
  let L: Len = 1;
  let d: Dir = 1;
  let visited = 1 << sol[0];
  let decisions = 0;
  const cover = new Map<string, number>();
  const bump = (k: string) => cover.set(k, (cover.get(k) ?? 0) + 1);
  for (let i = 1; i < stones.length; i++) {
    if (legalFrom(stones, sol[i - 1], visited, L).length > 1) decisions++;
    const a = stones[sol[i - 1]];
    const b = stones[sol[i]];
    if (a[1] === b[1]) {
      for (let x = Math.min(a[0], b[0]); x < Math.max(a[0], b[0]); x++) bump(`h${x},${a[1]}`);
    } else {
      for (let y = Math.min(a[1], b[1]); y < Math.max(a[1], b[1]); y++) bump(`v${a[0]},${y}`);
    }
    const r = applyStone(stones[sol[i]][2], L, d);
    L = r.len;
    d = r.dir;
    visited |= 1 << sol[i];
  }
  let overlap = 0;
  for (const v of cover.values()) overlap = Math.max(overlap, v);
  return { decisions, overlap };
}
