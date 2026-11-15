import { describe, expect, it } from 'vitest';
import levelsJson from '../src/data/levels.json';
import { TUTORIAL } from '../src/data/tutorial';
import { canonical, generate } from '../src/engine/generator';
import { hint } from '../src/engine/hint';
import { mulberry32 } from '../src/engine/rng';
import { applyStone, isDeadEnd, isSolved, legalMoves, nextLen, rhythmAfter, tryMove } from '../src/engine/rules';
import { metrics, solve, solveStones } from '../src/engine/solver';
import type { Level, Stone } from '../src/engine/types';
import { BANDS, bandInfo, LEVELS_PER_BAND } from '../src/progression/bands';
import { dailyLevel } from '../src/progression/daily';
import { generateCampaign } from '../scripts/generate-levels';

const levels = levelsJson as unknown as Level[];

const lvl = (stones: Stone[], start: number | null, solution: number[] = [], w = 6): Level => ({
  id: 'x', band: 'K1', w, h: w, stones, start, solution, nodes: 0, decisions: 0,
});

describe('rhythm', () => {
  it('plain stones cycle 1→2→3→1', () => {
    expect(nextLen(1, 1)).toBe(2);
    expect(nextLen(2, 1)).toBe(3);
    expect(nextLen(3, 1)).toBe(1);
  });
  it('reverse stone: from 2 to 1, from 1 to 3', () => {
    expect(applyStone('R', 2, 1)).toEqual({ len: 1, dir: -1 });
    expect(applyStone('R', 1, 1)).toEqual({ len: 3, dir: -1 });
    expect(applyStone('P', 3, -1)).toEqual({ len: 2, dir: -1 });
    expect(applyStone('R', 1, -1)).toEqual({ len: 2, dir: 1 });
  });
  it('hold stone keeps the length', () => {
    expect(applyStone('H', 1, 1)).toEqual({ len: 1, dir: 1 });
    expect(applyStone('H', 3, -1)).toEqual({ len: 3, dir: -1 });
  });
});

describe('fixtures (design §13.1)', () => {
  const F: [string, Stone[], number | null, number[], number][] = [
    ['F1', [[2, 3, 'P'], [3, 3, 'P'], [1, 3, 'P'], [3, 0, 'P'], [1, 1, 'P'], [3, 1, 'P']], 0, [0, 2, 1, 3, 5, 4], 10],
    ['F2', [[1, 4, 'P'], [0, 2, 'R'], [0, 4, 'P'], [3, 1, 'P'], [0, 1, 'P'], [3, 3, 'P'], [3, 4, 'P'], [2, 4, 'P'], [3, 2, 'P']], 0, [0, 7, 2, 6, 5, 3, 4, 1, 8], 22],
    ['F3', [[1, 0, 'P'], [5, 0, 'P'], [4, 4, 'P'], [3, 3, 'P'], [2, 0, 'P'], [3, 2, 'P'], [3, 0, 'R'], [3, 1, 'P'], [4, 0, 'H'], [0, 0, 'P'], [4, 2, 'P'], [4, 1, 'P']], null, [0, 9, 4, 1, 8, 6, 3, 7, 11, 2, 10, 5], 194],
  ];
  for (const [name, stones, start, sol, nodes] of F) {
    it(`${name}: unique solution and node count`, () => {
      const r = solveStones(stones, start);
      expect(r.solutions).toEqual([sol]);
      expect(r.nodes).toBe(nodes);
    });
  }
});

describe('rules API', () => {
  const F1 = lvl([[2, 3, 'P'], [3, 3, 'P'], [1, 3, 'P'], [3, 0, 'P'], [1, 1, 'P'], [3, 1, 'P']], 0, [0, 2, 1, 3, 5, 4], 4);
  it('legal moves and tryMove reasons', () => {
    expect(legalMoves(F1, [0]).sort()).toEqual([1, 2]);
    expect(tryMove(F1, [0], 3)).toEqual({ ok: false, reason: 'distance' });
    expect(tryMove(F1, [0, 2], 0)).toEqual({ ok: false, reason: 'visited' });
    expect(tryMove(F1, [0], 2)).toEqual({ ok: true, path: [0, 2] });
  });
  it('hidden start: only plain stones', () => {
    const h = lvl([[0, 0, 'P'], [1, 0, 'H'], [2, 0, 'P']], null);
    expect(tryMove(h, [], 1)).toEqual({ ok: false, reason: 'notPlainStart' });
    expect(tryMove(h, [], 2)).toEqual({ ok: true, path: [2] });
  });
  it('dead end and solved', () => {
    expect(isDeadEnd(F1, [0, 1, 2])).toBe(true); // at (1,3) the next jump is 3: nothing reachable
    expect(isSolved(F1, F1.solution)).toBe(true);
    expect(isDeadEnd(F1, F1.solution)).toBe(false);
    expect(rhythmAfter(F1, [0, 2, 1])).toEqual({ len: 3, dir: 1 });
  });
});

describe('hints', () => {
  const F1 = lvl([[2, 3, 'P'], [3, 3, 'P'], [1, 3, 'P'], [3, 0, 'P'], [1, 1, 'P'], [3, 1, 'P']], 0, [0, 2, 1, 3, 5, 4], 4);
  it('the first press already names the next stone', () => {
    expect(hint(F1, [0])).toEqual({ kind: 'next', len: 1, dir: 'left', target: 2, note: null });
    expect(hint(F1, [0, 2])).toMatchObject({ kind: 'next', len: 2, dir: 'right', target: 1 });
  });
  it('wrong path names the first bad move', () => {
    expect(hint(F1, [0, 1])).toEqual({ kind: 'wrong', move: 1, rewindTo: [0] });
  });
  it('hidden start: the start stone right away', () => {
    expect(hint(TUTORIAL[6], [])).toEqual({ kind: 'start', target: 0 });
  });
});

describe('tutorial levels', () => {
  for (const t of TUTORIAL) {
    it(`${t.id} has exactly the documented solution`, () => {
      expect(solve(t).solutions).toEqual([t.solution]);
    });
  }
});

describe('campaign levels.json', () => {
  it('has 480 levels with unique ids', () => {
    expect(levels.length).toBe(BANDS.length * LEVELS_PER_BAND);
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
  });
  it('every level: single solution equal to the stored one, band filters hold', () => {
    for (const l of levels) {
      const c = bandInfo(l.band as never).config;
      const { solutions, nodes } = solve(l);
      expect(solutions, l.id).toEqual([l.solution]);
      expect(nodes, l.id).toBe(l.nodes);
      const m = metrics(l.stones, l.solution);
      expect(m.decisions).toBe(l.decisions);
      expect(m.decisions >= c.minDecisions && m.overlap <= 2, l.id).toBe(true);
      expect(nodes >= c.minNodes && nodes <= c.maxNodes, l.id).toBe(true);
      expect(l.stones.length).toBe(c.n);
      expect(l.stones.filter((s) => s[2] === 'R').length).toBe(c.nR);
      expect(l.stones.filter((s) => s[2] === 'H').length).toBe(c.nH);
      expect(l.start).toBe(c.hidden ? null : 0);
      expect(l.w).toBe(6);
    }
  });
  it('no duplicates under symmetry within a band', () => {
    for (const b of BANDS) {
      const keys = levels.filter((l) => l.band === b.id).map((l) => canonical(6, 6, l.stones));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('generator is deterministic and matches the committed file', () => {
    const again = generateCampaign();
    expect(JSON.stringify(again)).toBe(JSON.stringify(levels));
  });
});

describe('generator', () => {
  it('same seed → same level', () => {
    const c = bandInfo('O2').config;
    const a = generate(c, mulberry32(42), new Set());
    const b = generate(c, mulberry32(42), new Set());
    expect(a).toEqual(b);
  });
  it('daily puzzle is the same for the same date and fast to make', () => {
    const d = new Date(2026, 10, 14, 9, 0);
    const t0 = performance.now();
    const a = dailyLevel(d);
    const b = dailyLevel(new Date(2026, 10, 14, 23, 30));
    expect(a).toEqual(b);
    expect(a.band).toBe('O4'); // Saturday: a big Hard puzzle
    expect(a.stones.length).toBe(13);
    expect(a.id).toBe('D-2026-11-14');
    expect(solve(a).solutions).toEqual([a.solution]);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
  it('every daily puzzle has a marked start', () => {
    for (let day = 1; day <= 28; day++) {
      const l = dailyLevel(new Date(2026, 10, day, 12));
      expect(l.start, l.id).toBe(0);
      expect(l.solution[0]).toBe(0);
      expect(solve(l).solutions, l.id).toEqual([l.solution]);
    }
  });
});
