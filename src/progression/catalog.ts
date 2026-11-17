import aliasesJson from '../data/level-aliases.json';
import levelsJson from '../data/levels.json';
import type { BandId, Level } from '../engine/types';
import { BAND_IDS } from './bands';

/**
 * The campaign levels. Bands have different sizes: repeated puzzles were dropped (see scripts/generate-levels.ts),
 * so ids have gaps (K1-001, K1-002, K1-005…) and the position in the band is not the number in the id.
 */
export const LEVELS = levelsJson as unknown as Level[];
const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));
const IDS: Record<BandId, string[]> = Object.fromEntries(
  BAND_IDS.map((b) => [b, LEVELS.filter((l) => l.band === b).map((l) => l.id)]),
) as Record<BandId, string[]>;

/** Dropped repeat id → id of the identical level that was kept. */
export const LEVEL_ALIASES = aliasesJson as Record<string, string>;

export const levelCount = (band: BandId): number => IDS[band].length;
/** Id of the level at `index` (0-based) in the band; clamped to the band. */
export const levelId = (band: BandId, index: number): string => {
  const ids = IDS[band];
  return ids[Math.max(0, Math.min(index, ids.length - 1))];
};
/** 0-based position of a level id in its band, or -1. */
export const levelIndex = (band: BandId, id: string): number => IDS[band].indexOf(id);
export const levelById = (id: string): Level | undefined => BY_ID.get(id);
