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
  it('is on for new players and turned on once for older profiles, then left to the player', () => {
    expect(migrateProfile(undefined).settings.showTimer).toBe(true);
    const old = migrateProfile({ settings: { showTimer: false } });
    expect(old.settings.showTimer).toBe(true);
    expect(migrateProfile({ ...old, settings: { ...old.settings, showTimer: false } }).settings.showTimer).toBe(false);
  });
});
