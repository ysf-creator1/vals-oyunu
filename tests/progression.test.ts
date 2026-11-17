import { describe, expect, it } from 'vitest';
import { acceptEasier, applyCampaignResult, continueTarget, selectBandManually, stayInTier } from '../src/progression/adaptive';
import { stageOf, targetMs, tierOf } from '../src/progression/bands';
import { LEVEL_ALIASES, levelCount, levelId } from '../src/progression/catalog';
import type { BandId } from '../src/engine/types';
import { defaultProfile, migrateProfile, type Profile, type RecentEntry } from '../src/progression/profile';
import { classify, starsFor } from '../src/progression/stars';
import { currentStreak, recordDailySolve, weekKey } from '../src/progression/streak';

const entry = (band: BandId, cls: RecentEntry['cls'], ms = targetMs(band) * 0.8): RecentEntry => ({ levelId: 'x', band, cls, ms });

function play(p: Profile, ...es: RecentEntry[]) {
  const evs = [];
  for (const e of es) {
    const r = applyCampaignResult(p, e);
    p = r.profile;
    evs.push(r.events);
  }
  return { p, evs };
}

describe('stars and classes', () => {
  it('stars by hint count', () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(2)).toBe(2);
    expect(starsFor(3)).toBe(1);
  });
  it('classification', () => {
    expect(classify(10_000, 0, 20_000)).toBe('fast');
    expect(classify(30_000, 0, 20_000)).toBe('normal');
    expect(classify(51_000, 0, 20_000)).toBe('struggled');
    expect(classify(10_000, 2, 20_000)).toBe('struggled');
    expect(classify(10_000, 0, 20_000, true)).toBe('struggled');
  });
});

describe('auto difficulty', () => {
  it('2 of last 3 fast → up one band', () => {
    const { p, evs } = play(defaultProfile(), entry('K1', 'fast'), entry('K1', 'normal'), entry('K1', 'fast'));
    expect(p.currentBand).toBe('K2');
    expect(evs[2].promoted).toEqual({ from: 'K1', to: 'K2' });
  });
  it('3 very fast in a row → two bands, never past the tier end', () => {
    const vf = (b: BandId) => entry(b, 'fast', targetMs(b) * 0.3);
    let { p } = play(defaultProfile(), vf('K1'), vf('K1'), vf('K1'));
    expect(p.currentBand).toBe('K3');
    ({ p } = play(p, vf('K3'), vf('K3'), vf('K3')));
    expect(p.currentBand).toBe('K4'); // capped at the tier's last band
    const r = play(p, vf('K4'), vf('K4'), vf('K4'));
    expect(r.p.currentBand).toBe('O1'); // the tier boundary is crossed in one step
    expect(r.evs[2].tierUp).toEqual({ from: 'easy', to: 'medium' });
  });
  it('medium and hard: a fast player moves up one band, but only after 10 levels and 4 of the last 5 fast', () => {
    const vf = (b: BandId) => entry(b, 'fast', targetMs(b) * 0.3);
    const solved = (p: Profile, band: BandId, n: number) => {
      for (let i = 0; i < n; i++) p.results[levelId(band, i)] = { stars: 3, bestMs: 1, fast: true };
      return p;
    };
    for (const band of ['O1', 'O2', 'O3', 'O4'] as BandId[]) {
      // very fast but fewer than 10 levels played: stays
      const early = play(solved({ ...defaultProfile(), results: {}, currentBand: band }, band, 5), ...Array(5).fill(vf(band)));
      expect(early.p.currentBand).toBe(band);
    }
    // 10 played, 4 of the last 5 fast → one band, never two
    const p = solved({ ...defaultProfile(), results: {}, currentBand: 'O3' }, 'O3', 10);
    const r = play(p, vf('O3'), vf('O3'), entry('O3', 'normal'), vf('O3'), vf('O3'));
    expect(r.p.currentBand).toBe('O4');
    // only 3 of the last 5 fast → stays
    const q = solved({ ...defaultProfile(), results: {}, currentBand: 'O1' }, 'O1', 12);
    const s3 = play(q, vf('O1'), entry('O1', 'normal'), vf('O1'), entry('O1', 'normal'), vf('O1'));
    expect(s3.p.currentBand).toBe('O1');
    // a finished band always opens the next one
    const done = solved({ ...defaultProfile(), results: {}, currentBand: 'O2' }, 'O2', 40);
    const d = play(done, entry('O2', 'normal'));
    expect(d.p.currentBand).toBe('O3');
    expect(d.evs[0].tierUp).toEqual({ from: 'medium', to: 'hard' });
  });
  it('O4 → Z1 is the step into extra hard; Z keeps speed promotion', () => {
    const p = { ...defaultProfile(), currentBand: 'O4' as BandId };
    for (let i = 0; i < levelCount('O4'); i++) p.results[levelId('O4', i)] = { stars: 3, bestMs: 1, fast: false };
    expect(play(p, entry('O4', 'normal')).evs[0].tierUp).toEqual({ from: 'hard', to: 'extra' });
    const z = play({ ...defaultProfile(), currentBand: 'Z1' }, entry('Z1', 'fast'), entry('Z1', 'fast'), entry('Z1', 'normal'));
    expect(z.p.currentBand).toBe('Z2');
  });
  it('stages are numbered inside each tier', () => {
    expect(['K4', 'O1', 'O2', 'O3', 'O4', 'Z1', 'Z4'].map((b) => `${tierOf(b as BandId)} ${stageOf(b as BandId)}`)).toEqual([
      'easy 4', 'medium 1', 'medium 2', 'hard 1', 'hard 2', 'extra 1', 'extra 4',
    ]);
  });
  it('2 struggled in a row → offer once; declined → not again for 5 levels', () => {
    let p: Profile = { ...defaultProfile(), currentBand: 'K3' };
    const r = play(p, entry('K3', 'struggled'), entry('K3', 'struggled'));
    expect(r.evs[1].offerEasier).toBe(true);
    p = r.p;
    const after = play(p, ...Array.from({ length: 5 }, () => entry('K3', 'struggled')));
    expect(after.evs.some((e) => e.offerEasier)).toBe(false);
    const sixth = play(after.p, entry('K3', 'struggled'));
    expect(sixth.evs[0].offerEasier).toBe(true);
    expect(acceptEasier(sixth.p).currentBand).toBe('K2');
  });
  it('manual mode never changes the band', () => {
    const p = selectBandManually(defaultProfile(), 'K2');
    const r = play(p, entry('K2', 'fast'), entry('K2', 'fast'), entry('K2', 'fast'));
    expect(r.p.currentBand).toBe('K2');
    expect(r.evs.every((e) => !e.promoted)).toBe(true);
  });
  it('"stay in Easy" blocks K4 → O1', () => {
    let p = stayInTier({ ...defaultProfile(), currentBand: 'O1' }, 'easy');
    expect(p.currentBand).toBe('K4');
    ({ p } = play(p, entry('K4', 'fast'), entry('K4', 'fast'), entry('K4', 'fast')));
    expect(p.currentBand).toBe('K4');
  });
  it('band completion moves up (natural progression)', () => {
    const p = defaultProfile();
    for (let i = 0; i < levelCount('K1'); i++) p.results[levelId('K1', i)] = { stars: 3, bestMs: 1, fast: false };
    expect(play(p, entry('K1', 'normal')).p.currentBand).toBe('K2');
  });
  it('continue opens the first unsolved level of the current band', () => {
    const p = defaultProfile();
    p.results[levelId('K1', 0)] = { stars: 3, bestMs: 1, fast: false };
    expect(continueTarget(p)).toEqual({ band: 'K1', index: 1 });
  });
});

describe('dropped repeat levels', () => {
  it('easy bands lost their repeats, later bands keep (almost) all 40', () => {
    expect(levelCount('K1')).toBeLessThan(25);
    expect(levelCount('O3')).toBe(40);
  });
  it('a result saved under a dropped id moves to the kept twin, keeping the best of both', () => {
    const [dropped, kept] = Object.entries(LEVEL_ALIASES).find(([, to]) => to.startsWith('K1'))!;
    const raw = { ...defaultProfile(), results: { [dropped]: { stars: 3, bestMs: 5000, fast: true }, [kept]: { stars: 2, bestMs: 9000, fast: false } } };
    const p = migrateProfile(JSON.parse(JSON.stringify(raw)));
    expect(p.results[dropped]).toBeUndefined();
    expect(p.results[kept]).toEqual({ stars: 3, bestMs: 5000, fast: true });
  });
  it('a band counts as complete once its kept levels are solved', () => {
    const p = defaultProfile();
    for (let i = 0; i < levelCount('K1'); i++) p.results[levelId('K1', i)] = { stars: 3, bestMs: 1, fast: false };
    expect(continueTarget(p).band).toBe('K2');
  });
});

describe('streak', () => {
  const base = { lastSolved: null, streak: 0, best: 0, freezeUsedWeek: null };
  it('consecutive days grow the streak', () => {
    let s = recordDailySolve(base, '2026-11-09');
    s = recordDailySolve(s, '2026-11-10');
    s = recordDailySolve(s, '2026-11-10');
    expect(s.streak).toBe(2);
  });
  it('one missed day per calendar week is forgiven, a second one is not', () => {
    let s = recordDailySolve(base, '2026-11-09'); // Mon
    s = recordDailySolve(s, '2026-11-11'); // missed Tue
    expect(s.streak).toBe(2);
    expect(currentStreak(s, '2026-11-13')).toBe(0); // missing Thu too in the same week would break it
    s = recordDailySolve(s, '2026-11-13');
    expect(s.streak).toBe(1);
    expect(s.best).toBe(2);
  });
  it('a missed day in the next week is forgiven again', () => {
    let s = recordDailySolve(base, '2026-11-12');
    s = recordDailySolve(s, '2026-11-14'); // missed Fri 13 (week of 9th)
    s = recordDailySolve(s, '2026-11-15');
    s = recordDailySolve(s, '2026-11-17'); // missed Mon 16 (week of 16th)
    expect(s.streak).toBe(4);
    expect(weekKey('2026-11-16')).toBe('2026-11-16');
    expect(weekKey('2026-11-15')).toBe('2026-11-09');
  });
});
