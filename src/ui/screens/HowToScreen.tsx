import { useGame } from '../../store/game';
import { Guide } from '../components/Guide';
import { ScreenHead } from '../components/ScreenHead';
import { useT } from '../hooks';

/** Same step-by-step animated guide as the "i" button, plus a way to replay the tutorial. */
export function HowToScreen() {
  const t = useT();
  const g = useGame.getState;
  return (
    <div className="screen">
      <ScreenHead title={t('howto.title')} />
      <Guide showTitle={false} onDone={() => g().setScreen('home')} />
      <p className="guide-tip" style={{ margin: '8px 0' }}>{t('howto.extra')}</p>
      <button className="btn primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => g().startTutorial(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], 'continue')}>
        {t('howto.replay')}
      </button>
    </div>
  );
}
