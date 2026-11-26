import { generate } from '../engine/generator';
import { mulberry32, randomSeed } from '../engine/rng';
import type { BandConfig, BandId, Level } from '../engine/types';
import { bandInfo, ENDLESS_BANDS, type Tier } from './bands';
import type { Profile, ThemeId } from './profile';
import { FREE_THEMES, totalSolved } from './profile';
import { dateKey } from './streak';

/**
 * The daily puzzle always shows its start stone. The weekend ones are bigger "Hard" puzzles
 * (more stones, more search) instead of hidden-start extra hard ones.
 */
const weekend = (n: number, nH: number, minNodes: number): BandConfig => ({
  ...bandInfo('O4').config, n, nR: 2, nH, minNodes, maxNodes: 9999,
});
// Sun..Sat
const DAILY_BY_WEEKDAY: { band: BandId; config: BandConfig }[] = [
  { band: 'O4', config: weekend(14, 2, 60) },
  { band: 'K4', config: bandInfo('K4').config },
  { band: 'O1', config: bandInfo('O1').config },
  { band: 'O2', config: bandInfo('O2').config },
  { band: 'O3', config: bandInfo('O3').config },
  { band: 'O4', config: bandInfo('O4').config },
  { band: 'O4', config: weekend(13, 1, 45) },
];

export const dailyBand = (d: Date): BandId => DAILY_BY_WEEKDAY[d.getDay()].band;

/** Seed is the player's local date as the number YYYYMMDD. */
export const dailySeed = (d: Date): number => Number(dateKey(d).replace(/-/g, ''));

/** Everyone gets the same puzzle on the same local date. */
export function dailyLevel(d: Date): Level {
  const { band, config } = DAILY_BY_WEEKDAY[d.getDay()];
  return generate({ ...config, hidden: false }, mulberry32(dailySeed(d)), new Set(), { id: `D-${dateKey(d)}`, band });
}

export function endlessLevel(tier: Tier, seed = randomSeed()): Level {
  const rng = mulberry32(seed);
  const band = rng.pick(ENDLESS_BANDS[tier]);
  return generate(bandInfo(band).config, rng, new Set(), { id: `E-${seed.toString(36)}`, band });
}

export type Title = 'apprentice' | 'dancer' | 'soloist' | 'maestro';

/** Title by the highest tier with at least 10 solved levels. */
export function titleOf(p: Profile): Title {
  const s = p.stats.solved;
  const tierCount = (bands: BandId[]) => bands.reduce((a, b) => a + s[b], 0);
  if (tierCount(['Z1', 'Z2', 'Z3', 'Z4']) >= 10) return 'maestro';
  if (tierCount(['O1', 'O2', 'O3', 'O4']) >= 10) return 'soloist';
  if (tierCount(['K1', 'K2', 'K3', 'K4']) >= 10) return 'dancer';
  return 'apprentice';
}

export const THEME_ORDER: ThemeId[] = ['classic', 'lily', 'beach', 'snow', 'paws', 'stars', 'islands'];

export function unlockedThemes(p: Profile): ThemeId[] {
  const n = totalSolved(p);
  const out: ThemeId[] = [...FREE_THEMES];
  if (n >= 100) out.push('stars');
  if (p.daily.best >= 7) out.push('islands');
  return out;
}
