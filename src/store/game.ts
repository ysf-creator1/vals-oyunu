import { create } from 'zustand';
import levelsJson from '../data/levels.json';
import { FIRST_RUN_TUTORIAL, tutorialLevel } from '../data/tutorial';
import { hint as computeHint, type Hint } from '../engine/hint';
import { initialPath, isSolved, rhythmAfter, tryMove, type MoveResult } from '../engine/rules';
import type { BandId, Level } from '../engine/types';
import {
  acceptEasier, applyCampaignResult, continueTarget, manualNext, stayInTier, type AdaptiveEvents,
} from '../progression/adaptive';
import { BAND_IDS, levelId, stageOf, targetMs, tierOf, TUTORIAL_BEFORE, type Tier } from '../progression/bands';
import { dailyLevel, endlessLevel, titleOf, unlockedThemes, type Title } from '../progression/daily';
import { defaultProfile, migrateProfile, totalSolved, type Profile, type Settings, type ThemeId } from '../progression/profile';
import { classify, isFastBadge, starsFor, type Stars } from '../progression/stars';
import { dateKey, recordDailySolve } from '../progression/streak';
import type { StringKey, T } from '../i18n';
import { deviceInfo, deviceModel, flush as flushEvents, isFirstVisit, track, VERSION } from '../analytics/track';
import { fetchOthersTimes, type OthersTimes } from '../analytics/times';
import { loadBackup, saveBackup, saveBackupOnExit, type BackupError } from '../backup/backup';
import { persistStorage } from '../platform/device';
import { clearSaved, loadSaved, save } from './persist';

const LEVELS = levelsJson as unknown as Level[];
const LEVEL_BY_ID = new Map(LEVELS.map((l) => [l.id, l]));
export const campaignLevel = (band: BandId, index: number) => LEVEL_BY_ID.get(levelId(band, index))!;

export type Screen = 'home' | 'game' | 'levels' | 'endless' | 'stats' | 'settings' | 'howto';
type Pos = { band: BandId; index: number };

export interface Session {
  kind: 'campaign' | 'daily' | 'endless' | 'tutorial';
  level: Level;
  pos?: Pos;
  tier?: Tier;
  /** Tutorial levels still to play after this one, and where to go afterwards. */
  tutorialQueue?: string[];
  then?: Pos | 'continue';
  path: number[];
  redo: number[] | null;
  elapsedMs: number;
  hintSteps: number[];
  wrongCount: number;
  /** Path for which the current hint was given (pressing Help again there costs nothing). */
  hintKey: string;
  hint: Hint | null;
  solved: boolean;
  /** Rejected taps (wrong distance, visited stone…), for the usage report. */
  misses?: number;
  /** Unique per started session; the game screen remounts on change. */
  nonce: number;
}

export interface EndCard {
  stars: Stars;
  ms: number;
  fast: boolean;
  /** Solved with help (hint or wrong-path marks): never counts as the fastest. */
  helped: boolean;
  /** Other players' times for this level: undefined while loading, null when unavailable. */
  others?: OthersTimes | null;
  events: AdaptiveEvents;
  newTitle?: Title;
  newThemes: ThemeId[];
  kind: Session['kind'];
  tutorialFinished?: boolean;
  offerAnswered?: 'yes' | 'no';
  stayed?: boolean;
  next: () => void;
}

interface State {
  profile: Profile;
  session: Session | null;
  screen: Screen;
  endCard: EndCard | null;
  /** Server backup status: time of the last successful save, and whether the latest save failed. */
  backupAt: string | null;
  backupFailed: boolean;
  createBackup(): Promise<BackupError | null>;
  fetchBackup(code: string): ReturnType<typeof loadBackup>;
  applyBackup(code: string, profile: unknown, at: string): void;
  dismissInstallHint(): void;
  setScreen(s: Screen): void;
  updateProfile(fn: (p: Profile) => Profile): void;
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
  resetProgress(): void;

  continueGame(): void;
  startCampaign(band: BandId, index: number): void;
  startTutorial(ids: string[], then?: Pos | 'continue'): void;
  startDaily(): void;
  startEndless(tier: Tier): void;
  replay(): void;

  tap(stone: number): MoveResult | { ok: true; path: number[]; undo: true };
  undo(): void;
  rewindToStart(): void;
  reset(): void;
  redoPath(): void;
  rewindTo(path: number[]): void;
  help(): Hint | null;
  addElapsed(ms: number): void;
  complete(): EndCard | null;
  answerEasier(yes: boolean): void;
  chooseStay(): void;
}

const pathKey = (p: number[]) => p.join(',');

/** Fields that describe a session in usage events. */
const lv = (s: Session) => ({ mod: s.kind, seviye: s.level.id, bant: s.level.band, tas: s.level.stones.length });
/** A level counts as abandoned only if the player actually tried it. */
const tried = (s: Session) => !s.solved && (s.path.length > initialPath(s.level).length || s.elapsedMs > 5000);
const abandoned = (s: Session, closed: boolean) =>
  track('birakti', {
    ...lv(s), sn: Math.round(s.elapsedMs / 1000), adim: s.path.length, ipucu: s.hintSteps.length + s.wrongCount,
    hata: s.misses ?? 0, kapatti: closed,
  });

function newSession(kind: Session['kind'], level: Level, extra: Partial<Session> = {}): Session {
  return {
    kind, level, path: initialPath(level), redo: null, elapsedMs: 0, hintSteps: [], wrongCount: 0,
    hintKey: '', hint: null, solved: false, nonce: Date.now() + Math.random(), ...extra,
  };
}

const BACKUP_AT_KEY = 'vals:yedek-z';
const readBackupAt = () => {
  try {
    return localStorage.getItem(BACKUP_AT_KEY);
  } catch {
    return null;
  }
};
const writeBackupAt = (z: string | null) => {
  try {
    if (z) localStorage.setItem(BACKUP_AT_KEY, z);
    else localStorage.removeItem(BACKUP_AT_KEY);
  } catch {
    /* ignore */
  }
};

const saved = loadSaved();
const initialProfile = migrateProfile(saved.profile);
const savedSession = (saved.session as Session | null) ?? null;
// Daily puzzles now always show their start; drop a saved hidden-start daily from an older version.
const initialSession = savedSession && savedSession.kind === 'daily' && savedSession.level.start === null ? null : savedSession;

export const useGame = create<State>((set, get) => {
  const setSession = (fn: (s: Session) => Session) => {
    const s = get().session;
    if (s) set({ session: fn(s) });
  };
  const open = (session: Session) => {
    const prev = get().session;
    if (prev && prev.nonce !== session.nonce && tried(prev)) abandoned(prev, false);
    track('basla', lv(session));
    set({ session, screen: 'game', endCard: null });
  };

  return {
    profile: initialProfile,
    session: initialSession,
    screen: initialSession && !initialSession.solved ? 'game' : 'home',
    endCard: null,

    setScreen: (screen) => {
      if (screen !== get().screen && screen !== 'game') track('ekran', { ekran: screen });
      set({ screen, endCard: null });
    },
    updateProfile: (fn) => set({ profile: fn(get().profile) }),
    setSetting: (k, v) => {
      track('ayar', { ayar: k, deger: String(v) });
      set({ profile: { ...get().profile, settings: { ...get().profile.settings, [k]: v } } });
    },
    resetProgress: () => {
      track('sifirla', { cozulen: totalSolved(get().profile), bant: get().profile.currentBand });
      const settings = get().profile.settings;
      clearSaved();
      // The backup code is dropped too: the server copy keeps the old progress and the code can still restore it.
      writeBackupAt(null);
      set({ profile: { ...defaultProfile(), settings }, session: null, endCard: null, screen: 'home', backupAt: null, backupFailed: false });
    },

    backupAt: readBackupAt(),
    backupFailed: false,

    createBackup: async () => {
      if (get().profile.backup) return null;
      const r = await saveBackup(get().profile);
      if (typeof r === 'string') {
        track('yedek', { ne: 'hata', neden: r });
        return r;
      }
      track('yedek', { ne: 'olustur', cozulen: totalSolved(get().profile) });
      writeBackupAt(r.at);
      set({ backupAt: r.at, backupFailed: false });
      get().updateProfile((p) => ({ ...p, backup: { code: r.code } }));
      return null;
    },

    fetchBackup: (code) => loadBackup(code),

    applyBackup: (code, raw, at) => {
      const profile = { ...migrateProfile(raw), backup: { code } };
      track('yedek', { ne: 'geri', cozulen: totalSolved(profile), onceki: totalSolved(get().profile) });
      writeBackupAt(at);
      set({ profile, session: null, endCard: null, screen: 'home', backupAt: at, backupFailed: false });
    },

    dismissInstallHint: () => get().updateProfile((p) => ({ ...p, installHintDismissed: true })),

    continueGame: () => {
      const { session, profile } = get();
      if (session && !session.solved) return set({ screen: 'game', endCard: null });
      if (!FIRST_RUN_TUTORIAL.every((id) => profile.tutorialSeen.includes(id))) {
        return get().startTutorial(FIRST_RUN_TUTORIAL.filter((id) => !profile.tutorialSeen.includes(id)), 'continue');
      }
      const c = continueTarget(profile);
      get().startCampaign(c.band, c.index);
    },

    startCampaign: (band, index) => {
      const { profile, session } = get();
      // Every new shape up to this band, also when a fast player skipped the band that introduces it.
      const need = BAND_IDS.slice(0, BAND_IDS.indexOf(band) + 1)
        .map((x) => TUTORIAL_BEFORE[x])
        .filter((x): x is string => !!x && !profile.tutorialSeen.includes(x));
      if (need.length) return get().startTutorial(need, { band, index });
      const level = campaignLevel(band, index);
      if (session && !session.solved && session.level.id === level.id) return set({ screen: 'game', endCard: null });
      open(newSession('campaign', level, { pos: { band, index } }));
    },

    startTutorial: (ids, then) => {
      const [first, ...rest] = ids;
      open(newSession('tutorial', tutorialLevel(first), { tutorialQueue: rest, then }));
    },

    startDaily: () => {
      const today = new Date();
      const id = `D-${dateKey(today)}`;
      const s = get().session;
      if (s && s.level.id === id && !s.solved && s.level.start !== null) return set({ screen: 'game', endCard: null });
      open(newSession('daily', dailyLevel(today)));
    },

    startEndless: (tier) => open(newSession('endless', endlessLevel(tier), { tier })),

    replay: () => {
      const s = get().session;
      if (s) open(newSession(s.kind, s.level, { pos: s.pos, tier: s.tier, tutorialQueue: s.tutorialQueue, then: s.then }));
    },

    tap: (stone) => {
      const s = get().session!;
      if (s.solved) return { ok: false, reason: 'visited' };
      const last = s.path[s.path.length - 1];
      // Tapping the last stone undoes one move (in a hidden start this also clears the start choice).
      if (s.path.length > 0 && stone === last && (s.path.length > 1 || s.level.start === null)) {
        get().undo();
        return { ok: true, path: get().session!.path, undo: true };
      }
      const r = tryMove(s.level, s.path, stone);
      if (r.ok) setSession((x) => ({ ...x, path: r.path, redo: null, hint: null, solved: isSolved(x.level, r.path) }));
      else setSession((x) => ({ ...x, misses: (x.misses ?? 0) + 1 }));
      return r;
    },
    undo: () => setSession((x) => {
      const min = x.level.start === null ? 0 : 1;
      return x.path.length > min ? { ...x, path: x.path.slice(0, -1), hint: null } : x;
    }),
    rewindToStart: () => setSession((x) => ({ ...x, path: initialPath(x.level), hint: null })),
    reset: () => setSession((x) => ({ ...x, redo: x.path.length > initialPath(x.level).length ? x.path : null, path: initialPath(x.level), hint: null })),
    redoPath: () => setSession((x) => (x.redo ? { ...x, path: x.redo, redo: null, hint: null } : x)),
    rewindTo: (path) => setSession((x) => ({ ...x, path, hint: null, redo: null })),

    help: () => {
      const s = get().session;
      if (!s || s.solved) return null;
      const key = pathKey(s.path);
      const h = computeHint(s.level, s.path);
      let { hintSteps, wrongCount } = s;
      if (s.hintKey !== key) {
        track('yardim', { ...lv(s), ne: h.kind, adim: s.path.length, sn: Math.round(s.elapsedMs / 1000) });
        if (h.kind === 'wrong') wrongCount += 1;
        if ((h.kind === 'next' || h.kind === 'start') && !hintSteps.includes(s.path.length)) hintSteps = [...hintSteps, s.path.length];
      }
      set({ session: { ...s, hintKey: key, hint: h, hintSteps, wrongCount } });
      return h;
    },

    addElapsed: (ms) => setSession((x) => (x.solved ? x : { ...x, elapsedMs: x.elapsedMs + ms })),

    complete: () => {
      const s = get().session;
      if (!s || !s.solved) return null;
      let p = get().profile;
      const hints = s.hintSteps.length + s.wrongCount;
      const stars = starsFor(hints);
      const ms = s.elapsedMs;
      const band = s.level.band === 'T' ? null : s.level.band;
      const tgt = band ? targetMs(band) : Infinity;
      const fast = band ? isFastBadge(ms, hints, tgt) : false;
      const titleBefore = titleOf(p);
      const themesBefore = p.themesUnlocked;
      let events: AdaptiveEvents = {};
      let tutorialFinished = false;
      const firstSolve = s.kind === 'campaign' && !p.results[s.level.id];

      const bumpStats = (b: BandId) => {
        p = {
          ...p,
          stats: {
            solved: { ...p.stats.solved, [b]: p.stats.solved[b] + 1 },
            noHint: { ...p.stats.noHint, [b]: p.stats.noHint[b] + (hints === 0 ? 1 : 0) },
            totalMs: { ...p.stats.totalMs, [b]: p.stats.totalMs[b] + ms },
          },
        };
      };

      if (s.kind === 'tutorial') {
        p = { ...p, tutorialSeen: [...new Set([...p.tutorialSeen, s.level.id])] };
        tutorialFinished = !s.tutorialQueue?.length;
      } else if (s.kind === 'campaign' && band) {
        const prev = p.results[s.level.id];
        if (!prev) bumpStats(band);
        p = {
          ...p,
          results: {
            ...p.results,
            [s.level.id]: {
              stars: Math.max(prev?.stars ?? 1, stars) as Stars,
              bestMs: Math.min(prev?.bestMs ?? Infinity, ms),
              fast: (prev?.fast ?? false) || fast,
            },
          },
        };
        const r = applyCampaignResult(p, { levelId: s.level.id, band, cls: classify(ms, hints, tgt), ms });
        p = r.profile;
        events = r.events;
      } else if (s.kind === 'daily' && band) {
        bumpStats(band);
        const today = dateKey(new Date());
        if (s.level.id === `D-${today}`) {
          p = { ...p, daily: { ...recordDailySolve(p.daily, today), lastResult: { stars, ms, band } } };
        }
      } else if (s.kind === 'endless' && band) {
        bumpStats(band);
      }

      const themes = unlockedThemes(p);
      p = { ...p, themesUnlocked: themes };
      const titleAfter = titleOf(p);
      set({ profile: p });
      track('bitti', {
        ...lv(s), sn: Math.round(ms / 1000), ms: Math.round(ms), yildiz: stars, ipucu: hints, yanlis: s.wrongCount, hata: s.misses ?? 0,
        hizli: fast, ilk: s.kind === 'campaign' ? firstSolve : undefined,
        son: s.kind === 'tutorial' ? tutorialFinished : undefined,
        yukseldi: events.promoted ? `${events.promoted.from}>${events.promoted.to}` : undefined,
        kademe: events.tierUp ? `${events.tierUp.from}>${events.tierUp.to}` : undefined,
        teklif: events.offerEasier || undefined,
        seri: s.kind === 'daily' ? p.daily.streak : undefined,
        simdiki: p.currentBand,
      });

      const next = () => {
        const st = get();
        const cur = st.session!;
        if (cur.kind === 'tutorial') {
          if (cur.tutorialQueue?.length) return st.startTutorial(cur.tutorialQueue, cur.then);
          if (cur.then && cur.then !== 'continue') return st.startCampaign(cur.then.band, cur.then.index);
          const c = continueTarget(st.profile);
          return st.startCampaign(c.band, c.index);
        }
        if (cur.kind === 'endless') return st.startEndless(cur.tier ?? 'medium');
        if (cur.kind === 'campaign' && cur.pos && st.profile.mode === 'manual') {
          const n = manualNext(st.profile, cur.pos.band, cur.pos.index);
          return st.startCampaign(n.band, n.index);
        }
        const c = continueTarget(st.profile);
        st.startCampaign(c.band, c.index);
      };

      const card: EndCard = {
        stars, ms, fast, helped: hints > 0, events, kind: s.kind, tutorialFinished, next,
        newTitle: titleAfter !== titleBefore ? titleAfter : undefined,
        newThemes: themes.filter((t) => !themesBefore.includes(t)),
      };
      set({ endCard: card });
      if (band) {
        void fetchOthersTimes(s.level.id, band, s.kind === 'endless').then((others) => {
          const c = get().endCard;
          if (c && c.next === next) set({ endCard: { ...c, others } });
        });
      }
      return card;
    },

    answerEasier: (yes) => {
      const c = get().endCard;
      track('kolay_teklif', { kabul: yes, bant: get().profile.currentBand });
      if (yes) get().updateProfile(acceptEasier);
      if (c) set({ endCard: { ...c, offerAnswered: yes ? 'yes' : 'no' } });
    },
    chooseStay: () => {
      const c = get().endCard;
      const from = c?.events.tierUp?.from;
      if (!c || !from) return;
      track('kademede_kal', { kademe: from });
      get().updateProfile((p) => stayInTier(p, from));
      set({ endCard: { ...c, stayed: true } });
    },
  };
});

useGame.subscribe((st) => save({ profile: st.profile, session: st.session }));

// ---- server backup: once a code exists, every profile change is saved a few seconds later ----
let backupDirty = false;
let backupTimer: ReturnType<typeof setTimeout> | null = null;
async function syncBackup() {
  backupTimer = null;
  const { profile } = useGame.getState();
  const code = profile.backup?.code;
  if (!code) return;
  backupDirty = false;
  const r = await saveBackup(profile, code);
  if (typeof r === 'string') {
    backupDirty = true;
    useGame.setState({ backupFailed: true });
    return;
  }
  writeBackupAt(r.at);
  useGame.setState({ backupAt: r.at, backupFailed: false });
}
const scheduleBackup = (ms: number) => {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => void syncBackup(), ms);
};
useGame.subscribe((st, prev) => {
  if (st.profile === prev.profile || !st.profile.backup) return;
  // A new code was just created together with a fresh save: nothing new to send.
  if (!prev.profile.backup && st.backupAt) return;
  backupDirty = true;
  scheduleBackup(8000);
});
if (typeof window !== 'undefined') {
  const exitSave = () => {
    const { profile } = useGame.getState();
    if (!backupDirty || !profile.backup) return;
    backupDirty = false;
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = null;
    saveBackupOnExit(profile, profile.backup.code);
  };
  window.addEventListener('pagehide', exitSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') exitSave();
  });
  // Catch up on changes from a session that closed before its save went out.
  if (useGame.getState().profile.backup) {
    backupDirty = true;
    scheduleBackup(5000);
  }
}

// ---- usage report: app open, visible play time, levels left when the page closes ----
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let visibleSince = Date.now();
  const sendVisible = () => {
    const sn = Math.round((Date.now() - visibleSince) / 1000);
    if (sn >= 2) track('oturum', { sn: Math.min(sn, 6 * 3600), ekran: useGame.getState().screen });
    visibleSince = Date.now();
  };
  // Registered before the first track() call, so these run before the tracker's own flush on hide.
  window.addEventListener('pagehide', () => {
    const { session, screen } = useGame.getState();
    if (screen === 'game' && session && tried(session)) abandoned(session, true);
    sendVisible();
    flushEvents();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendVisible();
      flushEvents();
    } else visibleSince = Date.now();
  });
  const p = useGame.getState().profile;
  const ua = navigator.userAgent;
  const yeni = isFirstVisit();
  void Promise.all([deviceModel(), persistStorage()]).then(([model, kalici]) => track('acilis', {
    kalici,
    yeni,
    mobil: /Mobi|Android|iPhone|iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua)),
    ...deviceInfo(),
    dil: p.settings.lang,
    bant: p.currentBand,
    oto: p.mode === 'auto',
    cozulen: totalSolved(p),
    seri: p.daily.streak,
    tema: p.settings.theme,
    ekran: `${Math.round(screen.width)}x${Math.round(screen.height)}`,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    model: model || undefined,
    surum: VERSION,
    devam: !!initialSession && !initialSession.solved,
  }));
}

/** Label like "Zor 2 · 5" for the top bar: tier, stage inside the tier, level number inside the stage. */
export function sessionLabel(s: Session, t: T): string {
  if (s.kind === 'tutorial') return `${t('game.tutorial')} · ${s.level.id.slice(1)}`;
  const band = s.level.band as BandId;
  const tierName = t(`tier.${tierOf(band)}` as StringKey);
  if (s.kind === 'daily') return `${t('game.daily')} · ${tierName}`;
  if (s.kind === 'endless') return `${t('game.endless')} · ${tierName}`;
  return t('game.label', { tier: tierName, stage: stageOf(band), n: (s.pos?.index ?? 0) + 1 });
}

export const rhythmOf = (s: Session) => rhythmAfter(s.level, s.path);
