import { useEffect, useMemo, useRef, useState } from 'react';
import { tutorialLevel } from '../../data/tutorial';
import { rhythmAfter } from '../../engine/rules';
import type { Kind, Level } from '../../engine/types';
import type { StringKey, T } from '../../i18n';
import { useGame } from '../../store/game';
import { Board } from '../board/Board';
import { Rhythm } from '../board/Rhythm';
import { landingNote, moveLine } from '../explain';
import { useElementSize, useT } from '../hooks';

/** Chapters go from easy to hard: plain rhythm → square → diamond → hidden start. */
const CHAPTERS: { level: string; title: StringKey; rule: StringKey; shape: Kind; hidden?: boolean }[] = [
  { level: 'T3', title: 'g.ch1', rule: 'g.ch1.rule', shape: 'P' },
  { level: 'T5', title: 'g.ch2', rule: 'g.ch2.rule', shape: 'H' },
  { level: 'T6', title: 'g.ch3', rule: 'g.ch3.rule', shape: 'R' },
  { level: 'T7', title: 'g.ch4', rule: 'g.ch4.rule', shape: 'P', hidden: true },
];

const FRAME_MS = 2300;

interface Frame {
  path: number[];
  finger: number | null;
  why: string | null;
  now: string;
}

/** One "video" frame per move: the finger shows the next stone, the caption says why it is that far. */
function buildFrames(level: Level, t: T): Frame[] {
  const sol = level.solution;
  const frames: Frame[] = [];
  if (level.start === null) frames.push({ path: [], finger: sol[0], why: t('g.hiddenWhy'), now: t('g.pickStart') });
  for (let k = 0; k < sol.length; k++) {
    const path = sol.slice(0, k + 1);
    if (k === sol.length - 1) {
      frames.push({ path, finger: null, why: landingNote(level, path, t), now: t('g.done') });
      break;
    }
    const why = k === 0 ? t(level.start === null ? 'g.started' : 'g.start') : landingNote(level, path, t);
    frames.push({ path, finger: sol[k + 1], why, now: moveLine(level, path, sol[k + 1], t) });
  }
  return frames;
}

function ShapeIcon({ kind, hidden }: { kind: Kind; hidden?: boolean }) {
  const common = { fill: 'var(--surface)', stroke: 'var(--ink)', strokeWidth: 2.2, strokeLinejoin: 'round' as const };
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true">
      {kind === 'P' && <circle cx="13" cy="11" r="7" {...common} />}
      {kind === 'H' && <rect x="6" y="4" width="14" height="14" rx="2.5" {...common} />}
      {kind === 'R' && <polygon points="13,2 22,11 13,20 4,11" {...common} />}
      {hidden && <text x="13" y="11.5" fontSize="9" fontWeight="800" textAnchor="middle" dominantBaseline="central" fill="var(--ink)">?</text>}
    </svg>
  );
}

export function Guide({ onDone, showTitle = true }: { onDone?: () => void; showTitle?: boolean }) {
  const t = useT();
  const theme = useGame((s) => s.profile.settings.theme);
  const [chapter, setChapter] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const ch = CHAPTERS[chapter];
  const level = tutorialLevel(ch.level);
  const frames = useMemo(() => buildFrames(level, t), [level, t]);
  const f = frames[Math.min(frame, frames.length - 1)];
  const last = frame >= frames.length - 1;

  // Auto-advance like a video; stop on the last frame.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing || last) return;
    timer.current = setTimeout(() => setFrame((x) => x + 1), FRAME_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, frame, last]);
  useEffect(() => {
    if (last) setPlaying(false);
  }, [last]);

  const goChapter = (i: number) => {
    setChapter(i);
    setFrame(0);
    setPlaying(true);
  };
  const toggle = () => {
    if (last) {
      setFrame(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };

  const rhythm = rhythmAfter(level, f.path);
  const lastKind = f.path.length > 1 ? level.stones[f.path[f.path.length - 1]][2] : null;
  const size = Math.max(140, Math.min(stage.w - 56, stage.h - 40, 320)); // room for the finger
  const count = f.finger !== null && f.path.length > 0 ? { from: f.path[f.path.length - 1], to: f.finger } : null;
  const nextCh = CHAPTERS[chapter + 1];

  return (
    <div className="guide">
      {showTitle && <h2 id="guide-title">{t('g.title')}</h2>}
      <div className="guide-chapters" role="list">
        {CHAPTERS.map((c, i) => (
          <button key={c.level} role="listitem" aria-current={i === chapter ? 'step' : undefined} onClick={() => goChapter(i)}>
            <ShapeIcon kind={c.shape} hidden={c.hidden} />
            <span>{t(c.title)}</span>
            <span className="n">{t('g.stepOf', { a: i + 1, b: CHAPTERS.length })}</span>
          </button>
        ))}
      </div>
      <p className="guide-rule" key={`r${chapter}`}>{t(ch.rule)}</p>
      <div className="guide-video">
        <Rhythm rhythm={rhythm} held={lastKind === 'H'} t={t} hidden={f.path.length === 0} />
        <div className="guide-stage" ref={stageRef} onClick={toggle}>
          {stage.w > 0 && (
            <Board
              level={level}
              path={f.path}
              size={size}
              t={t}
              theme={theme}
              finger={f.finger}
              count={count}
              showStartRing={level.start !== null}
            />
          )}
        </div>
        <div className="guide-caption" aria-live="polite" key={`${chapter}-${frame}`}>
          {f.why && <span className="why">{f.why}</span>}
          <span className="now">{f.now}</span>
        </div>
        <div className={`guide-bar${playing ? '' : ' paused'}`} style={{ ['--seg' as string]: `${FRAME_MS}ms` }} aria-hidden="true">
          {frames.map((_, i) => (
            <i key={`${chapter}-${i}-${i === frame ? frame : ''}`} className={i < frame || (last && i === frame) ? 'done' : i === frame ? 'cur' : ''} />
          ))}
        </div>
      </div>
      <div className="guide-nav">
        <button className="btn" onClick={() => goChapter(Math.max(0, chapter - 1))} disabled={chapter === 0} aria-label={t('g.prev')}>‹</button>
        {nextCh ? (
          <button className={`btn${last ? ' primary' : ''}`} onClick={() => goChapter(chapter + 1)}>
            {t('g.next', { title: t(nextCh.title) })} ›
          </button>
        ) : (
          <button className={`btn${last ? ' primary' : ''}`} onClick={() => onDone?.()} disabled={!onDone}>
            {t('g.finish')}
          </button>
        )}
        <button className="btn play" onClick={toggle} aria-label={last ? t('g.replay') : playing ? t('g.pause') : t('g.play')}>
          {last ? '↻' : playing ? '❚❚' : '▶'}
        </button>
      </div>
    </div>
  );
}

/** Modal version opened by the "i" button. */
export function GuideSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="guide-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="guide-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <button ref={closeRef} className="x" onClick={onClose} aria-label={t('g.close')}>✕</button>
        <Guide onDone={onClose} />
      </div>
    </div>
  );
}

export function InfoButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button className="info-btn" onClick={onClick} aria-label={t('g.title')} title={t('g.title')}>
      i
    </button>
  );
}
