import { useEffect, useState } from 'react';
import { tutorialLevel } from '../../data/tutorial';
import type { Level } from '../../engine/types';
import type { StringKey } from '../../i18n';
import { useGame } from '../../store/game';
import { Board } from '../board/Board';
import { ScreenHead } from '../components/ScreenHead';
import { useReducedMotion, useT } from '../hooks';

/** A small board that plays its solution in a loop. */
function Demo({ level }: { level: Level }) {
  const t = useT();
  const theme = useGame((s) => s.profile.settings.theme);
  const rm = useReducedMotion();
  const n = level.solution.length;
  const [k, setK] = useState(rm ? n : 1);
  useEffect(() => {
    if (rm) return;
    const id = setInterval(() => setK((x) => (x >= n + 1 ? 1 : x + 1)), 750);
    return () => clearInterval(id);
  }, [n, rm]);
  return <Board level={level} path={level.solution.slice(0, Math.min(k, n))} size={132} t={t} theme={theme} showStartRing={level.start !== null} />;
}

const ITEMS: [string, StringKey][] = [
  ['T3', 'howto.rhythm'],
  ['T5', 'howto.hold'],
  ['T6', 'howto.reverse'],
  ['T7', 'howto.hidden'],
];

export function HowToScreen() {
  const t = useT();
  const g = useGame.getState;
  return (
    <div className="screen">
      <ScreenHead title={t('howto.title')} />
      <div className="scroll">
        {ITEMS.map(([id, key]) => (
          <div className="howto-item" key={id}>
            <Demo level={tutorialLevel(id)} />
            <p>{t(key)}</p>
          </div>
        ))}
        <p style={{ lineHeight: 1.5 }}>{t('howto.extra')}</p>
        <button className="btn primary" style={{ width: '100%' }} onClick={() => g().startTutorial(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], 'continue')}>
          {t('howto.replay')}
        </button>
      </div>
    </div>
  );
}
