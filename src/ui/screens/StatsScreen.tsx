import { formatTime, type StringKey } from '../../i18n';
import { BAND_IDS, tierOf } from '../../progression/bands';
import { titleOf } from '../../progression/daily';
import { totalSolved } from '../../progression/profile';
import { useGame } from '../../store/game';
import { ScreenHead } from '../components/ScreenHead';
import { useT } from '../hooks';

export function StatsScreen() {
  const t = useT();
  const p = useGame((s) => s.profile);
  const total = totalSolved(p);
  const noHint = Object.values(p.stats.noHint).reduce((a, b) => a + b, 0);
  const rows = BAND_IDS.filter((b) => p.stats.solved[b] > 0);

  return (
    <div className="screen">
      <ScreenHead title={t('stats.title')} />
      <div className="scroll">
        <div className="stat-grid">
          <div className="stat"><span className="muted">{t('stats.solved')}</span><b>{total}</b></div>
          <div className="stat"><span className="muted">{t('stats.noHint')}</span><b>{total ? Math.round((noHint / total) * 100) : 0}%</b></div>
          <div className="stat"><span className="muted">{t('stats.bestStreak')}</span><b>{p.daily.best}</b></div>
          <div className="stat"><span className="muted">{t('stats.title2')}</span><b>{t(`title.${titleOf(p)}` as StringKey)}</b></div>
        </div>
        <h2 style={{ fontSize: '1.05rem', marginTop: 20 }}>{t('stats.byBand')}</h2>
        {rows.length === 0 ? (
          <p className="muted">{t('stats.none')}</p>
        ) : (
          <table className="bands">
            <thead>
              <tr><th></th><th>{t('stats.solved')}</th><th>{t('stats.noHint')}</th><th>{t('stats.avg')}</th></tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b}>
                  <td>{t(`tier.${tierOf(b)}` as StringKey)} {b[1]}</td>
                  <td>{p.stats.solved[b]}</td>
                  <td>{Math.round((p.stats.noHint[b] / p.stats.solved[b]) * 100)}%</td>
                  <td>{formatTime(p.stats.totalMs[b] / p.stats.solved[b])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
