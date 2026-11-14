import { create } from 'zustand';
import levelsJson from '../data/levels.json';
import { FIRST_RUN_TUTORIAL, tutorialLevel } from '../data/tutorial';
import { hint as computeHint, type Hint } from '../engine/hint';
import { initialPath, isSolved, rhythmAfter, tryMove, type MoveResult } from '../engine/rules';
import type { BandId, Level } from '../engine/types';
import {
  acceptEasier, applyCampaignResult, continueTarget, manualNext, stayInTier, type AdaptiveEvents,
} from '../progression/adaptive';
import { levelId, targetMs, tierOf, TUTORIAL_BEFORE, type Tier } from '../progression/bands';
import { dailyLevel, endlessLevel, titleOf, unlockedThemes, type Title } from '../progression/daily';
import { defaultProfile, migrateProfile, type Profile, type Settings, type ThemeId } from '../progression/profile';
import { classify, isFastBadge, starsFor, type Stars } from '../progression/stars';
import { dateKey, recordDailySolve } from '../progression/streak';
import type { StringKey, T } from '../i18n';
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
  hintTier: number;
  hintKey: string;
  hint: Hint | null;
  solved: boolean;
  /** Unique per started session; the game screen remounts on change. */
  nonce: number;
}

export interface EndCard {
  stars: Stars;
  ms: number;
  fast: boolean;
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

function newSession(kind: Session['kind'], level: Level, extra: Partial<Session> = {}): Session {
  return {
    kind, level, path: initialPath(level), redo: null, elapsedMs: 0, hintSteps: [], wrongCount: 0,
    hintTier: 0, hintKey: '', hint: null, solved: false, nonce: Date.now() + Math.random(), ...extra,
  };
}

const saved = loadSaved();
const initialProfile = migrateProfile(saved.profile);
const initialSession = (saved.session as Session | null) ?? null;

export const useGame = create<State>((set, get) => {
  const setSession = (fn: (s: Session) => Session) => {
    const s = get().session;
    if (s) set({ session: fn(s) });
  };
  const open = (session: Session) => set({ session, screen: 'game', endCard: null });

  return {
    profile: initialProfile,
    session: initialSession,
    screen: initialSession && !initialSession.solved ? 'game' : 'home',
    endCard: null,

    setScreen: (screen) => set({ screen, endCard: null }),
    updateProfile: (fn) => set({ profile: fn(get().profile) }),
    setSetting: (k, v) => set({ profile: { ...get().profile, settings: { ...get().profile.settings, [k]: v } } }),
    resetProgress: () => {
      const settings = get().profile.settings;
      clearSaved();
      set({ profile: { ...defaultProfile(), settings }, session: null, endCard: null, screen: 'home' });
    },

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
      const tut = TUTORIAL_BEFORE[band];
      if (tut && !profile.tutorialSeen.includes(tut)) return get().startTutorial([tut], { band, index });
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
      if (s && s.level.id === id && !s.solved) return set({ screen: 'game', endCard: null });
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
      const maxTier = s.path.length === 0 ? 2 : 3;
      const tier = s.hintKey === key ? Math.min(s.hintTier + 1, maxTier) : 1;
      const h = computeHint(s.level, s.path, tier);
      let { hintSteps, wrongCount } = s;
      if (h.kind === 'wrong' && tier === 1) wrongCount += 1;
      if ((h.kind === 'direction' || h.kind === 'mark' || h.kind === 'startMark') && !hintSteps.includes(s.path.length)) {
        hintSteps = [...hintSteps, s.path.length];
      }
      set({ session: { ...s, hintTier: tier, hintKey: key, hint: h, hintSteps, wrongCount } });
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
        stars, ms, fast, events, kind: s.kind, tutorialFinished, next,
        newTitle: titleAfter !== titleBefore ? titleAfter : undefined,
        newThemes: themes.filter((t) => !themesBefore.includes(t)),
      };
      set({ endCard: card });
      return card;
    },

    answerEasier: (yes) => {
      const c = get().endCard;
      if (yes) get().updateProfile(acceptEasier);
      if (c) set({ endCard: { ...c, offerAnswered: yes ? 'yes' : 'no' } });
    },
    chooseStay: () => {
      const c = get().endCard;
      const from = c?.events.tierUp?.from;
      if (!c || !from) return;
      get().updateProfile((p) => stayInTier(p, from));
      set({ endCard: { ...c, stayed: true } });
    },
  };
});

useGame.subscribe((st) => save({ profile: st.profile, session: st.session }));

/** Label like "Orta · 37" for the top bar (number within the tier: 4 bands × 40). */
export function sessionLabel(s: Session, t: T): string {
  if (s.kind === 'tutorial') return `${t('game.tutorial')} · ${s.level.id.slice(1)}`;
  const band = s.level.band as BandId;
  const tierName = t(`tier.${tierOf(band)}` as StringKey);
  if (s.kind === 'daily') return `${t('game.daily')} · ${tierName}`;
  if (s.kind === 'endless') return `${t('game.endless')} · ${tierName}`;
  return t('game.label', { tier: tierName, stage: band[1], n: (s.pos?.index ?? 0) + 1 });
}

export const rhythmOf = (s: Session) => rhythmAfter(s.level, s.path);
