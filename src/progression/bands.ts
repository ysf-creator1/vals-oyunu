import type { BandConfig, BandId } from '../engine/types';

/** 'extra' = extra hard: the start stone is hidden and must be found too. */
export type Tier = 'easy' | 'medium' | 'hard' | 'extra';

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
  b('O3', 'hard',   12, 1, 1, false, 3, 28,  999,  90),
  b('O4', 'hard',   12, 2, 1, false, 3, 34,  999,  110),
  b('Z1', 'extra',  12, 1, 1, true,  3, 90,  9999, 120),
  b('Z2', 'extra',  13, 2, 1, true,  3, 130, 9999, 150),
  b('Z3', 'extra',  14, 2, 2, true,  4, 190, 9999, 180),
  b('Z4', 'extra',  15, 2, 2, true,  4, 260, 9999, 210),
];

export const BAND_IDS: BandId[] = BANDS.map((x) => x.id);
export const LEVELS_PER_BAND = 40;
export const TIERS: Tier[] = ['easy', 'medium', 'hard', 'extra'];
/** Tiers where auto mode never skips ahead on speed: the player moves on when a band's levels are done. */
export const NO_SKIP_TIERS: Tier[] = ['medium', 'hard'];

export const bandInfo = (id: BandId): BandInfo => BANDS.find((x) => x.id === id)!;
export const bandIndex = (id: BandId): number => BAND_IDS.indexOf(id);
export const tierOf = (id: BandId): Tier => bandInfo(id).tier;
export const bandsOfTier = (t: Tier): BandId[] => BANDS.filter((x) => x.tier === t).map((x) => x.id);
/** 1-based stage of a band inside its tier ("Zor 2" for O4). */
export const stageOf = (id: BandId): number => bandsOfTier(tierOf(id)).indexOf(id) + 1;
export const targetMs = (id: BandId): number => bandInfo(id).targetSec * 1000;

export const levelId = (band: BandId, index: number): string => `${band}-${String(index + 1).padStart(3, '0')}`;

/** Tutorial level that must be shown before a band whose mechanic is new. */
export const TUTORIAL_BEFORE: Partial<Record<BandId, string>> = { K3: 'T5', O1: 'T6', Z1: 'T7' };

/** Bands used by endless mode (K1/K2 have too few distinct levels). */
export const ENDLESS_BANDS: Record<Tier, BandId[]> = {
  easy: ['K3', 'K4'],
  medium: ['O1', 'O2'],
  hard: ['O3', 'O4'],
  extra: ['Z1', 'Z2', 'Z3', 'Z4'],
};
