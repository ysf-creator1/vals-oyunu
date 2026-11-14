import type { Rhythm as R } from '../../engine/types';
import type { T } from '../../i18n';

/** Three beats ① ② ③; the next jump length is filled and large. Arrow shows the rhythm direction. */
export function Rhythm({ rhythm, held, t, hidden }: { rhythm: R; held: boolean; t: T; hidden?: boolean }) {
  const rev = rhythm.dir === -1;
  const live = hidden ? t('game.chooseStart') : t('a11y.rhythm', { n: rhythm.len, rev: rev ? `, ${t('game.reversed')}` : '' });
  return (
    <div className="rhythm">
      <span className="dir-arrow" aria-hidden="true">{rev ? '←' : ''}</span>
      {[1, 2, 3].map((n) => (
        <div key={n} className={`beat${!hidden && rhythm.len === n ? ' on' : ''}`} aria-hidden="true">
          {n}
          {!hidden && held && rhythm.len === n && <span className="rep">↻</span>}
        </div>
      ))}
      <span className="dir-arrow" aria-hidden="true">{rev ? '' : '→'}</span>
      <span className="sr-only" aria-live="polite">{live}</span>
    </div>
  );
}
