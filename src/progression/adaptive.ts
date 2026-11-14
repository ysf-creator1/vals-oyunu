import type { BandId } from '../engine/types';
import { BAND_IDS, bandIndex, bandsOfTier, LEVELS_PER_BAND, levelId, targetMs, tierOf, type Tier } from './bands';
import type { Profile, RecentEntry } from './profile';

export interface AdaptiveEvents {
  promoted?: { from: BandId; to: BandId };
  /** Set when the promotion crossed a tier boundary (K4→O1, O4→Z1). */
  tierUp?: { from: Tier; to: Tier };
  offerEasier?: boolean;
}

const lastOfTier = (t: Tier) => bandsOfTier(t)[3];

export const isBandComplete = (p: Profile, band: BandId) => {
  for (let i = 0; i < LEVELS_PER_BAND; i++) if (!p.results[levelId(band, i)]) return false;
  return true;
};

/** Band index after promoting by `steps` (1 or 2); a tier boundary is always crossed in a single step. */
function promoteTarget(band: BandId, steps: 1 | 2): BandId {
  const i = bandIndex(band);
  if (i >= BAND_IDS.length - 1) return band;
  const tierEnd = bandIndex(lastOfTier(tierOf(band)));
  if (i === tierEnd) return BAND_IDS[i + 1];
  return BAND_IDS[Math.min(i + steps, tierEnd)];
}

/**
 * Record a solved campaign level and apply auto-difficulty rules (design §7.3).
 * The result entry must already be classified. Pure: returns a new profile.
 */
export function applyCampaignResult(profile: Profile, entry: RecentEntry): { profile: Profile; events: AdaptiveEvents } {
  const p: Profile = { ...profile, recent: [...profile.recent, entry].slice(-10) };
  const events: AdaptiveEvents = {};
  if (entry.band !== p.currentBand || p.mode !== 'auto') return { profile: p, events };

  const inBand = p.recent.filter((r) => r.band === p.currentBand);
  const last3 = inBand.slice(-3);
  const veryFast = last3.length === 3 && last3.every((r) => r.cls === 'fast' && r.ms < targetMs(r.band) / 2);
  const fastCount = last3.filter((r) => r.cls === 'fast').length;

  let target: BandId = p.currentBand;
  if (veryFast) target = promoteTarget(p.currentBand, 2);
  else if ((last3.length === 3 && fastCount >= 2) || isBandComplete(p, p.currentBand)) target = promoteTarget(p.currentBand, 1);

  if (target !== p.currentBand) {
    const fromTier = tierOf(p.currentBand);
    const toTier = tierOf(target);
    if (fromTier !== toTier && p.stayInTier) {
      target = p.currentBand; // "stay in tier" blocks automatic tier changes
    } else {
      events.promoted = { from: p.currentBand, to: target };
      if (fromTier !== toTier) events.tierUp = { from: fromTier, to: toTier };
      p.currentBand = target;
      p.easierOfferCooldown = 0;
      return { profile: p, events };
    }
  }

  const last2 = inBand.slice(-2);
  const struggling = last2.length === 2 && last2.every((r) => r.cls === 'struggled');
  if (struggling && p.easierOfferCooldown === 0 && bandIndex(p.currentBand) > 0) {
    events.offerEasier = true;
    p.easierOfferCooldown = 5; // if declined, not asked again for 5 levels
  } else if (p.easierOfferCooldown > 0) {
    p.easierOfferCooldown -= 1;
  }
  return { profile: p, events };
}

export function acceptEasier(p: Profile): Profile {
  const i = bandIndex(p.currentBand);
  return { ...p, currentBand: BAND_IDS[Math.max(0, i - 1)], easierOfferCooldown: 0 };
}

/** "Stay in Easy": undo a tier promotion and keep auto mode inside the previous tier. */
export function stayInTier(p: Profile, fromTier: Tier): Profile {
  return { ...p, currentBand: lastOfTier(fromTier), stayInTier: true };
}

export function selectBandManually(p: Profile, band: BandId): Profile {
  return { ...p, mode: 'manual', currentBand: band, stayInTier: false };
}

export function setAuto(p: Profile): Profile {
  return { ...p, mode: 'auto' };
}

export function firstUnsolved(p: Profile, band: BandId): number | null {
  for (let i = 0; i < LEVELS_PER_BAND; i++) if (!p.results[levelId(band, i)]) return i;
  return null;
}

/** Level that "Continue" opens: first unsolved in the current band, else in the following bands. */
export function continueTarget(p: Profile): { band: BandId; index: number } {
  const start = bandIndex(p.currentBand);
  for (let k = 0; k < BAND_IDS.length; k++) {
    const band = BAND_IDS[(start + k) % BAND_IDS.length];
    const i = firstUnsolved(p, band);
    if (i !== null) return { band, index: i };
  }
  return { band: p.currentBand, index: 0 };
}

/** Next level after finishing (band, index) in manual mode: next unsolved in the band, else next band. */
export function manualNext(p: Profile, band: BandId, index: number): { band: BandId; index: number } {
  for (let i = index + 1; i < LEVELS_PER_BAND; i++) if (!p.results[levelId(band, i)]) return { band, index: i };
  const i = firstUnsolved(p, band);
  if (i !== null) return { band, index: i };
  const bi = bandIndex(band);
  if (bi < BAND_IDS.length - 1) return { band: BAND_IDS[bi + 1], index: firstUnsolved(p, BAND_IDS[bi + 1]) ?? 0 };
  return { band, index: Math.min(index + 1, LEVELS_PER_BAND - 1) };
}

/** Levels in a band open in order; the first is always open. */
export function isUnlocked(p: Profile, band: BandId, index: number): boolean {
  if (index === 0 || p.results[levelId(band, index)] || p.results[levelId(band, index - 1)]) return true;
  const c = continueTarget(p);
  return c.band === band && c.index === index;
}
