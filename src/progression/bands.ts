import type { BandConfig, BandId } from '../engine/types';

export type Tier = 'easy' | 'medium' | 'hard';

export interface BandInfo {
  id: BandId;
  tier: Tier;
  config: BandConfig;
  /** Target solve time in seconds. A first guess — tune here, nowhere else. */
  targetSec: number;
}

const b = (
  id: BandId, tier: Tier, n: number, nR: number, nH: number, hidden: boolean,
  minDecisions: number, minNodes: number, maxNodes: number, targetSec: number,
): BandInfo => ({ id, tier, targetSec, config: { w: 6, h: 6, n, nR, nH, hidden, minDecisions, minNodes, maxNodes } });

//               id    tier       n  R  H  hidden minDec minNodes maxNodes target
export const BANDS: BandInfo[] = [
  b('K1', 'easy',    6, 0, 0, false, 1, 0,   99,   20),
  b('K2', 'easy',    7, 0, 0, false, 1, 10,  99,   30),
  b('K3', 'easy',    8, 0, 1, false, 2, 0,   99,   40),
  b('K4', 'easy',    9, 0, 1, false, 2, 14,  99,   50),
  b('O1', 'medium', 10, 1, 0, false, 2, 16,  99,   60),
  b('O2', 'medium', 11, 1, 1, false, 3, 20,  99,   75),
  b('O3', 'medium', 12, 1, 1, false, 3, 28,  999,  90),
  b('O4', 'medium', 12, 2, 1, false, 3, 34,  999,  110),
  b('Z1', 'hard',   12, 1, 1, true,  3, 90,  9999, 120),
  b('Z2', 'hard',   13, 2, 1, true,  3, 130, 9999, 150),
  b('Z3', 'hard',   14, 2, 2, true,  4, 190, 9999, 180),
  b('Z4', 'hard',   15, 2, 2, true,  4, 260, 9999, 210),
];

export const BAND_IDS: BandId[] = BANDS.map((x) => x.id);
export const LEVELS_PER_BAND = 40;
export const TIERS: Tier[] = ['easy', 'medium', 'hard'];

export const bandInfo = (id: BandId): BandInfo => BANDS.find((x) => x.id === id)!;
export const bandIndex = (id: BandId): number => BAND_IDS.indexOf(id);
export const tierOf = (id: BandId): Tier => bandInfo(id).tier;
export const bandsOfTier = (t: Tier): BandId[] => BANDS.filter((x) => x.tier === t).map((x) => x.id);
export const targetMs = (id: BandId): number => bandInfo(id).targetSec * 1000;

export const levelId = (band: BandId, index: number): string => `${band}-${String(index + 1).padStart(3, '0')}`;

/** Tutorial level that must be shown before a band whose mechanic is new. */
export const TUTORIAL_BEFORE: Partial<Record<BandId, string>> = { K3: 'T5', O1: 'T6', Z1: 'T7' };

/** Bands used by endless mode (K1/K2 have too few distinct levels). */
export const ENDLESS_BANDS: Record<Tier, BandId[]> = {
  easy: ['K3', 'K4'],
  medium: ['O1', 'O2', 'O3', 'O4'],
  hard: ['Z1', 'Z2', 'Z3', 'Z4'],
};
