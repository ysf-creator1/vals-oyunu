import { useGame } from '../../store/game';
import { useT } from '../hooks';

export function ScreenHead({ title }: { title: string }) {
  const t = useT();
  return (
    <div className="screen-head">
      <button className="icon-btn" onClick={() => useGame.getState().setScreen('home')} aria-label={t('game.back')}>
        <span aria-hidden="true">‹</span> {t('game.back')}
      </button>
      <h1>{title}</h1>
    </div>
  );
}
