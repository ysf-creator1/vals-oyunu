import type { StringKey } from '../../i18n';
import { TIERS } from '../../progression/bands';
import { useGame } from '../../store/game';
import { ScreenHead } from '../components/ScreenHead';
import { useT } from '../hooks';

export function EndlessScreen() {
  const t = useT();
  const g = useGame.getState;
  return (
    <div className="screen">
      <ScreenHead title={t('endless.title')} />
      <p className="muted">{t('endless.desc')}</p>
      <h2 style={{ fontSize: '1.05rem' }}>{t('endless.pick')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TIERS.map((tier) => (
          <button key={tier} className="btn big" onClick={() => g().startEndless(tier)}>
            {t(`tier.${tier}` as StringKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
