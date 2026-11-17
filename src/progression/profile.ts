import type { BandId } from '../engine/types';
import { BAND_IDS } from './bands';
import type { SolveClass, Stars } from './stars';

export type ThemeId = 'classic' | 'lily' | 'stars' | 'islands';
export type Lang = 'tr' | 'en';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  showTimer: boolean;
  helper: 'auto' | 'on' | 'off';
  fontSize: 'normal' | 'large';
  highContrast: boolean;
  /** Reduced motion also follows the system setting; this forces it on. */
  reducedMotion: boolean;
  theme: ThemeId;
  lang: Lang;
}

export interface RecentEntry {
  levelId: string;
  band: BandId;
  cls: SolveClass;
  ms: number;
}

export interface DailyState {
  lastSolved: string | null;
  streak: number;
  best: number;
  freezeUsedWeek: string | null;
  /** Result for the day in lastSolved (for the home card and the share text). */
  lastResult?: { stars: Stars; ms: number; band: BandId };
}

export interface Stats {
  solved: Record<BandId, number>;
  noHint: Record<BandId, number>;
  totalMs: Record<BandId, number>;
}

export interface Profile {
  version: 1;
  mode: 'auto' | 'manual';
  currentBand: BandId;
  stayInTier: boolean;
  results: Record<string, { stars: Stars; bestMs: number; fast: boolean }>;
  recent: RecentEntry[];
  easierOfferCooldown: number;
  tutorialSeen: string[];
  /** The short "extra hard: find the start too" card has been shown. */
  extraIntroSeen: boolean;
  daily: DailyState;
  themesUnlocked: ThemeId[];
  stats: Stats;
  settings: Settings;
  /** Recovery code of the server backup; once set, the backup follows every change. */
  backup?: { code: string };
  /** The "add to home screen" card was closed. */
  installHintDismissed?: boolean;
  /** Settings defaults revision; 2 = timer shown by default (older profiles get it turned on once). */
  settingsRev?: number;
}

const SETTINGS_REV = 2;

const zero = (): Record<BandId, number> => Object.fromEntries(BAND_IDS.map((b) => [b, 0])) as Record<BandId, number>;

export const defaultSettings = (): Settings => ({
  sound: true,
  vibration: true,
  showTimer: true,
  helper: 'auto',
  fontSize: 'normal',
  highContrast: false,
  reducedMotion: false,
  theme: 'classic',
  lang: typeof navigator !== 'undefined' && !navigator.language?.toLowerCase().startsWith('tr') ? 'en' : 'tr',
});

export const defaultProfile = (): Profile => ({
  version: 1,
  mode: 'auto',
  currentBand: 'K1',
  stayInTier: false,
  results: {},
  recent: [],
  easierOfferCooldown: 0,
  tutorialSeen: [],
  extraIntroSeen: false,
  daily: { lastSolved: null, streak: 0, best: 0, freezeUsedWeek: null },
  themesUnlocked: ['classic'],
  stats: { solved: zero(), noHint: zero(), totalMs: zero() },
  settings: defaultSettings(),
  settingsRev: SETTINGS_REV,
});

/** Fill in missing fields from an older/partial saved profile. */
export function migrateProfile(raw: unknown): Profile {
  const d = defaultProfile();
  if (!raw || typeof raw !== 'object') return d;
  const p = raw as Partial<Profile>;
  return {
    ...d,
    ...p,
    version: 1,
    daily: { ...d.daily, ...(p.daily ?? {}) },
    stats: {
      solved: { ...d.stats.solved, ...(p.stats?.solved ?? {}) },
      noHint: { ...d.stats.noHint, ...(p.stats?.noHint ?? {}) },
      totalMs: { ...d.stats.totalMs, ...(p.stats?.totalMs ?? {}) },
    },
    settings: { ...d.settings, ...(p.settings ?? {}), ...((p.settingsRev ?? 1) < 2 ? { showTimer: true } : {}) },
    settingsRev: SETTINGS_REV,
  };
}

export const totalSolved = (p: Profile) => Object.values(p.stats.solved).reduce((a, b) => a + b, 0);
