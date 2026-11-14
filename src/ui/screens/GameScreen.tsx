import { useCallback, useEffect, useRef, useState } from 'react';
import { playError, playJump, playMelody, unlockAudio, vibrate } from '../../audio/synth';
import type { Hint } from '../../engine/hint';
import { isDeadEnd, legalMoves, rhythmAfter } from '../../engine/rules';
import { formatTime, type T } from '../../i18n';
import { sessionLabel, useGame } from '../../store/game';
import { Board } from '../board/Board';
import { Rhythm } from '../board/Rhythm';
import { GuideSheet, InfoButton } from '../components/Guide';
import { landingNote, nowLine, onSolution } from '../explain';
import { useElementSize, useReducedMotion, useT } from '../hooks';
import { EndCardSheet } from './EndCardSheet';

type Msg = { text: string; action?: { label: string; fn: () => void } } | null;

function hintText(h: Hint, t: T): string {
  const note = 'note' in h && h.note ? ' ' + t(h.note === 'reversed' ? 'hint.noteReversed' : 'hint.noteHold') : '';
  switch (h.kind) {
    case 'onTrack':
      return t('hint.onTrack') + note;
    case 'direction':
      return t('hint.direction', { n: h.len, dir: t(`dir.${h.dir}`) }) + note;
    case 'mark':
      return t('hint.mark') + note;
    case 'wrong':
      return h.move === 0 ? t('hint.wrongStart') : t('hint.wrong', { n: h.move });
    case 'startRegion':
      return t(h.region === 'top' ? 'hint.startTop' : 'hint.startBottom');
    case 'startMark':
      return t('hint.startMark');
    default:
      return '';
  }
}

/** Tutorial levels where the finger always shows the next stone; elsewhere it appears after a pause. */
const ALWAYS_FINGER = ['T1', 'T2', 'T3', 'T5', 'T6'];
const IDLE_MS = 5000;

const DIRS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function GameScreen() {
  const t = useT();
  const session = useGame((s) => s.session)!;
  const settings = useGame((s) => s.profile.settings);
  const endCard = useGame((s) => s.endCard);
  const g = useGame.getState;
  const reducedMotion = useReducedMotion();

  const [msg, setMsg] = useState<Msg>(null);
  const [ruler, setRuler] = useState<{ from: number; len: number; key: number } | null>(null);
  const [shake, setShake] = useState<{ stone: number; key: number } | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [replay, setReplay] = useState(-1);
  // Wrong branch found by Help: stones from `at` onward stay highlighted while that branch is still on the path.
  const [wrongMark, setWrongMark] = useState<{ at: number; stone: number } | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [guide, setGuide] = useState(false);
  const guideOpen = useRef(false);
  guideOpen.current = guide;
  const [idle, setIdle] = useState(false);
  const busy = useRef(false);
  const lastInput = useRef(Date.now());
  const [wrapRef, wrap] = useElementSize<HTMLDivElement>();

  const { level, path } = session;
  const rhythm = rhythmAfter(level, path);
  const dead = isDeadEnd(level, path);
  const hidden = level.start === null && path.length === 0;
  const lastKind = path.length > 1 ? level.stones[path[path.length - 1]][2] : null;
  const helperOn = settings.helper === 'on' || (settings.helper === 'auto' && (session.kind === 'tutorial' || level.band === 'K1'));

  // Active-time clock: stops when hidden or after 60 s without input.
  useEffect(() => {
    let prev = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - prev;
      prev = now;
      if (document.visibilityState !== 'visible' || guideOpen.current || Date.now() - lastInput.current > 60_000) return;
      if (!g().session?.solved) g().addElapsed(Math.min(dt, 2000));
    }, 1000);
    return () => clearInterval(id);
  }, [g]);

  // The finger appears after a short pause where the player has to think (two choices, hidden start).
  useEffect(() => {
    setIdle(false);
    const id = setTimeout(() => setIdle(true), IDLE_MS);
    return () => clearTimeout(id);
  }, [path.length, level.id]);

  useEffect(() => {
    if (dead) {
      setPulseKey((k) => k + 1);
      vibrate([20, 60, 20], settings.vibration);
    }
  }, [dead, path.length, settings.vibration]);

  const finish = useCallback(
    (finalPath: number[]) => {
      busy.current = true;
      g().complete();
      const notes = finalPath.map((_, k) => (k === 0 ? { len: 1, dir: 1 } : rhythmAfter(level, finalPath.slice(0, k))));
      const step = 120;
      playMelody(notes, step);
      if (reducedMotion) {
        setTimeout(() => setShowCard(true), 250);
        return;
      }
      finalPath.forEach((_, k) => setTimeout(() => setReplay(k), k * step));
      setTimeout(() => {
        setReplay(-1);
        setShowCard(true);
      }, finalPath.length * step + 500);
    },
    [g, level, reducedMotion],
  );

  const fail = (stone: number, reason: 'visited' | 'distance' | 'notPlainStart') => {
    playError();
    vibrate(40, settings.vibration);
    setShake({ stone, key: Date.now() });
    if (reason === 'distance') {
      setRuler({ from: path[path.length - 1], len: rhythm.len, key: Date.now() });
      setMsg({ text: t('msg.distance', { n: rhythm.len }) });
    } else {
      setMsg({ text: t(reason === 'visited' ? 'msg.visited' : 'msg.notPlainStart') });
    }
  };

  const onTap = (stone: number) => {
    unlockAudio();
    lastInput.current = Date.now();
    if (busy.current) return;
    const before = rhythmAfter(level, path);
    const r = g().tap(stone);
    if (!r.ok) return fail(stone, r.reason);
    setMsg(null);
    setRuler(null);
    if ('undo' in r) return;
    if (path.length > 0) playJump(before.len, before.dir);
    else playJump(1, 1);
    vibrate(8, settings.vibration);
    if (g().session!.solved) finish(r.path);
  };

  const undo = () => {
    lastInput.current = Date.now();
    if (busy.current) return;
    g().undo();
    setMsg(null);
  };
  const rewind = () => {
    if (busy.current) return;
    g().rewindToStart();
    setMsg(null);
  };
  const reset = () => {
    lastInput.current = Date.now();
    if (busy.current) return;
    g().reset();
    const s = g().session!;
    setMsg(s.redo ? { text: t('msg.resetDone'), action: { label: t('game.redo'), fn: () => { g().redoPath(); setMsg(null); } } } : null);
  };
  const help = () => {
    unlockAudio();
    lastInput.current = Date.now();
    if (busy.current) return;
    const h = g().help();
    if (!h) return;
    if (h.kind === 'wrong') {
      setWrongMark({ at: h.move, stone: g().session!.path[h.move] });
      setMsg({ text: hintText(h, t), action: { label: t('hint.rewind'), fn: () => { g().rewindTo(h.rewindTo); setMsg(null); } } });
    } else setMsg({ text: hintText(h, t) });
  };

  // Long-press on Undo rewinds to the start.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const undoDown = () => {
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      rewind();
      vibrate(25, settings.vibration);
    }, 550);
  };
  const undoUp = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    if (!longFired.current) undo();
  };
  const undoCancel = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  // Keyboard: arrows jump, Z undo, R reset, H help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showCard || guideOpen.current || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = g().session!;
      const k = e.key.toLowerCase();
      if (k === 'z') return undo();
      if (k === 'r') return reset();
      if (k === 'h') return help();
      const d = DIRS[e.key];
      if (!d || s.path.length === 0) return;
      e.preventDefault();
      const cur = s.level.stones[s.path[s.path.length - 1]];
      const L = rhythmAfter(s.level, s.path).len;
      const tx = cur[0] + d[0] * L;
      const ty = cur[1] + d[1] * L;
      const idx = s.level.stones.findIndex((st) => st[0] === tx && st[1] === ty);
      if (idx >= 0) onTap(idx);
      else {
        playError();
        setRuler({ from: s.path[s.path.length - 1], len: L, key: Date.now() });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const wrongStones = wrongMark && path[wrongMark.at] === wrongMark.stone ? path.slice(wrongMark.at) : [];

  const boardSize = Math.max(200, Math.min(wrap.w, wrap.h));
  const hintTarget = session.hint && (session.hint.kind === 'mark' || session.hint.kind === 'startMark') ? session.hint.target : null;

  const tutorial = session.kind === 'tutorial';
  const tutTarget = tutorial && !session.solved && onSolution(level, path) && path.length < level.solution.length ? level.solution[path.length] : null;
  const finger = hintTarget ?? (tutTarget !== null && (ALWAYS_FINGER.includes(level.id) || idle) ? tutTarget : null);
  const count = finger !== null && path.length > 0 && !session.solved ? { from: path[path.length - 1], to: finger } : null;

  // Tutorial coach (above the board, where the eyes are): the lesson, what to do now, and why.
  let coachNow: string | null = null;
  let coachWhy: string | null = null;
  if (tutorial && !session.solved && !dead) {
    if (hidden) coachNow = t('game.chooseStart');
    else {
      coachNow = nowLine(level, path, finger, t);
      coachWhy = path.length === 1 ? t('ex.first') : landingNote(level, path, t);
    }
  }
  // Easy and medium: always say how many steps the next jump is.
  const easyOrMedium = level.band === 'T' || /^[KO]/.test(level.band);
  const showSteps = !tutorial && easyOrMedium && !hidden && !session.solved && !dead;
  const stepsWhy = showSteps && (lastKind === 'H' || lastKind === 'R') ? landingNote(level, path, t) : null;
  const [stepsA, stepsB] = t('game.nextSteps', { n: '\u0000' }).split('\u0000');

  let line: Msg = msg;
  if (!line && session.solved) line = { text: t('end.solved') };
  if (!line && dead) line = { text: t('msg.deadEnd') };
  if (!line && hidden && !tutorial) line = { text: t('game.chooseStart') };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => g().setScreen('home')} aria-label={t('game.back')}>
          <span aria-hidden="true">‹</span> {t('game.back')}
        </button>
        <div className="label">{sessionLabel(session, t)}</div>
        <div className="prog" aria-label={`${path.length} / ${level.stones.length}`}>
          {settings.showTimer && <span className="muted">{formatTime(session.elapsedMs)} · </span>}
          {t('game.progress', { a: path.length, b: level.stones.length })}
        </div>
        <InfoButton onClick={() => setGuide(true)} />
      </div>
      <Rhythm rhythm={rhythm} held={lastKind === 'H'} t={t} hidden={hidden} />
      {showSteps && (
        <div className="next-steps" key={path.length}>
          {stepsA}<b>{rhythm.len}</b>{stepsB}
          {stepsWhy && <span className="why">{stepsWhy}</span>}
        </div>
      )}
      {tutorial && !session.solved && (
        <div className="coach" key={`${level.id}-${path.length}-${dead}`} role="status">
          <span className="lesson">{t(`tut.${level.id}` as never)}</span>
          {coachNow && <span className="now">{coachNow}</span>}
          {coachWhy && <span className="why">{coachWhy}</span>}
        </div>
      )}
      <div className="board-wrap" ref={wrapRef}>
        {wrap.w > 0 && (
          <Board
            level={level}
            path={path}
            size={boardSize}
            t={t}
            theme={settings.theme}
            onTap={onTap}
            targets={helperOn && !session.solved ? legalMoves(level, path) : undefined}
            hintTarget={hintTarget}
            ruler={ruler}
            shake={shake}
            replay={replay}
            showStartRing={level.start !== null}
            finger={finger}
            count={count}
            wrong={wrongStones}
          />
        )}
      </div>
      <div className="msg" role="status" aria-live="polite">
        <span>{line?.text}</span>
        {line?.action && (
          <button className="btn primary" onClick={line.action.fn}>
            {line.action.label}
          </button>
        )}
      </div>
      <div className="controls">
        <button
          key={pulseKey}
          className={`btn${dead && pulseKey ? ' pulse' : ''}`}
          onPointerDown={undoDown}
          onPointerUp={undoUp}
          onPointerLeave={undoCancel}
          onPointerCancel={undoCancel}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), undo())}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="ico" aria-hidden="true">↶</span>
          {t('game.undo')}
        </button>
        <button className="btn primary" onClick={help}>
          <span className="ico" aria-hidden="true">?</span>
          {t('game.help')}
        </button>
        <button className="btn" onClick={reset}>
          <span className="ico" aria-hidden="true">⟲</span>
          {t('game.reset')}
        </button>
      </div>
      {showCard && endCard && <EndCardSheet card={endCard} />}
      {guide && <GuideSheet onClose={() => setGuide(false)} />}
    </div>
  );
}
