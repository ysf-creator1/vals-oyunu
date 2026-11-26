import { describe, expect, it } from 'vitest';
import { compareSolve, type OthersTimes } from '../src/analytics/times';
import { migrateProfile } from '../src/progression/profile';

const o = (x: Partial<OthersTimes>): OthersTimes => ({ n: 5, avg: 60000, best: 30000, bestN: 4, scope: 'level', ...x });

describe('end-of-level comparison', () => {
  it('celebrates beating every other help-free best', () => {
    expect(compareSolve(25000, false, o({}))).toBe('fastest');
    expect(compareSolve(30000, false, o({}))).toBeNull();
    expect(compareSolve(25000, true, o({}))).toBeNull();
  });
  it('only says "so far" with too few other players', () => {
    expect(compareSolve(25000, false, o({ bestN: 2 }))).toBe('leading');
  });
  it('notes being among the first, and never compares endless band averages', () => {
    expect(compareSolve(90000, true, o({ n: 0, avg: null, best: null, bestN: 0 }))).toBe('first');
    expect(compareSolve(1000, false, o({ scope: 'band', best: null }))).toBeNull();
    expect(compareSolve(1000, false, null)).toBeNull();
  });
});

describe('timer setting', () => {
  it('is off for new players; only players who switched it on themselves keep it', () => {
    // new players: timer off
    expect(migrateProfile(undefined).settings.showTimer).toBe(false);
    expect(migrateProfile(undefined).timerAsk).toBeFalsy();
    // rev 1 (timer was off by default then): the stored value is the player's own choice
    expect(migrateProfile({ settings: { showTimer: true } }).settings.showTimer).toBe(true);
    expect(migrateProfile({ settings: { showTimer: false } }).settings.showTimer).toBe(false);
    expect(migrateProfile({ settings: { showTimer: true } }).timerAsk).toBe(false);
    // rev 2 (on for everyone): off, and ask the server once
    const rev2 = migrateProfile({ settingsRev: 2, settings: { showTimer: true } });
    expect(rev2.settings.showTimer).toBe(false);
    expect(rev2.timerAsk).toBe(true);
    expect(rev2.settingsRev).toBe(3);
    // rev 3: kept as is; a pending question survives a reload
    expect(migrateProfile(rev2).timerAsk).toBe(true);
    const on = { ...rev2, timerAsk: false, settings: { ...rev2.settings, showTimer: true } };
    expect(migrateProfile(on).settings.showTimer).toBe(true);
    expect(migrateProfile(on).timerAsk).toBe(false);
  });
});

import { normalizeCode } from '../src/backup/backup';
describe('backup code', () => {
  it('accepts any spacing and case, rejects lookalike letters and wrong lengths', () => {
    expect(normalizeCode(' 7kq2 m9xd-h4pa ')).toBe('7KQ2-M9XD-H4PA');
    expect(normalizeCode('7KQ2M9XDH4PA')).toBe('7KQ2-M9XD-H4PA');
    expect(normalizeCode('7KQ2-M9XD-H4P')).toBeNull();
    expect(normalizeCode('0KQ2-M9XD-H4PA')).toBeNull();
    expect(normalizeCode('IKQ2-M9XD-H4PA')).toBeNull();
  });
});

import { printsFor } from '../src/ui/board/Footprints';
describe('themes', () => {
  it('opens lily and the footprint themes to everyone, keeps earned ones', () => {
    expect(migrateProfile(undefined).themesUnlocked).toEqual(expect.arrayContaining(['classic', 'lily', 'beach', 'snow', 'paws']));
    const old = migrateProfile({ themesUnlocked: ['classic', 'stars'] });
    expect(old.themesUnlocked).toEqual(expect.arrayContaining(['lily', 'beach', 'snow', 'paws', 'stars']));
    expect(old.themesUnlocked).not.toContain('islands');
  });
  it('leaves one print per cell crossed, right foot first, then alternating', () => {
    const level = { id: 'x', band: 'K1' as const, w: 4, h: 4, stones: [[0, 0, 'P'], [3, 0, 'P'], [3, 2, 'P']] as never, start: 0, solution: [0, 1, 2], nodes: 0, decisions: 0 };
    const ps = printsFor(level, [0, 1, 2], 0.1);
    expect(ps.length).toBe(5);
    expect(ps.map((p) => p.right)).toEqual([true, false, true, false, true]);
    // walking east (+x): the right foot is on the south side (+y)
    expect(ps[0].y).toBeGreaterThan(0.5);
    expect(ps[1].y).toBeLessThan(0.5);
    // only the newest jump animates
    expect(ps.map((p) => p.fresh)).toEqual([undefined, undefined, undefined, 0, 1]);
  });
});
