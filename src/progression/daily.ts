import { generate } from '../engine/generator';
import { mulberry32, randomSeed } from '../engine/rng';
import type { BandId, Level } from '../engine/types';
import { bandInfo, ENDLESS_BANDS, type Tier } from './bands';
import type { Profile, ThemeId } from './profile';
import { totalSolved } from './profile';
import { dateKey } from './streak';

// Sun..Sat
const DAILY_BAND_BY_WEEKDAY: BandId[] = ['Z2', 'K4', 'O1', 'O2', 'O3', 'O4', 'Z1'];

export const dailyBand = (d: Date): BandId => DAILY_BAND_BY_WEEKDAY[d.getDay()];

/** Seed is the player's local date as the number YYYYMMDD. */
export const dailySeed = (d: Date): number => Number(dateKey(d).replace(/-/g, ''));

/** Everyone gets the same puzzle on the same local date. */
export function dailyLevel(d: Date): Level {
  const band = dailyBand(d);
  return generate(bandInfo(band).config, mulberry32(dailySeed(d)), new Set(), { id: `D-${dateKey(d)}`, band });
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

export const THEME_ORDER: ThemeId[] = ['classic', 'lily', 'stars', 'islands'];

export function unlockedThemes(p: Profile): ThemeId[] {
  const n = totalSolved(p);
  const out: ThemeId[] = ['classic'];
  if (n >= 25) out.push('lily');
  if (n >= 100) out.push('stars');
  if (p.daily.best >= 7) out.push('islands');
  return out;
}
