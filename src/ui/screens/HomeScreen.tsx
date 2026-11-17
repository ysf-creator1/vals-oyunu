import type { StringKey } from '../../i18n';
import { continueTarget } from '../../progression/adaptive';
import { stageOf, tierOf } from '../../progression/bands';
import { titleOf } from '../../progression/daily';
import { currentStreak, dateKey } from '../../progression/streak';
import { useState } from 'react';
import { useGame } from '../../store/game';
import { GuideSheet, InfoButton } from '../components/Guide';
import { InstallCard } from '../components/KeepProgress';
import { useT } from '../hooks';

function Logo() {
  return (
    <svg width="132" height="44" viewBox="0 0 132 44" aria-hidden="true">
      <path d="M22 22 Q44 4 66 22 Q88 40 110 22" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <circle cx="22" cy="22" r="10" fill="var(--accent)" />
      <polygon points="66,10 78,22 66,34 54,22" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="100" y="12" width="20" height="20" rx="4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
    </svg>
  );
}

export function HomeScreen() {
  const t = useT();
  const profile = useGame((s) => s.profile);
  const session = useGame((s) => s.session);
  const g = useGame.getState;
  const today = dateKey(new Date());
  const solvedToday = profile.daily.lastSolved === today;
  const streak = currentStreak(profile.daily, today);
  const resuming = session && !session.solved;
  const c = continueTarget(profile);
  const nextLabel = t('game.label', { tier: t(`tier.${tierOf(c.band)}` as StringKey), stage: stageOf(c.band), n: c.index + 1 });
  const [guide, setGuide] = useState(false);

  return (
    <div className="screen home">
      <InfoButton onClick={() => setGuide(true)} />
      {guide && <GuideSheet onClose={() => setGuide(false)} />}
      <div className="logo">
        <Logo />
        <h1>{t('app.name')}</h1>
        <p className="muted">{t('app.tagline')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn primary big" onClick={() => g().continueGame()}>
          {t('home.continue')}
        </button>
        <div className="muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          {resuming ? t('home.resume') : t('home.band', { label: nextLabel })} · {t('home.titleLine', { title: t(`title.${titleOf(profile)}` as StringKey) })}
        </div>

        <button className="card daily-card" onClick={() => g().startDaily()}>
          <span style={{ fontSize: '1.8rem' }} aria-hidden="true">{solvedToday ? '✓' : '☀'}</span>
          <span style={{ flex: 1 }}>
            <span className="t" style={{ display: 'block' }}>{t('home.daily')}</span>
            <span className="s muted">{solvedToday ? t('home.dailySolved') : t('home.dailyOpen')}</span>
          </span>
          {streak > 0 && <span className="badge">🔥 {t('home.streak', { n: streak })}</span>}
        </button>
        <InstallCard />
      </div>

      <div className="home-grid">
        <button className="btn" onClick={() => g().setScreen('levels')}>{t('home.levels')}</button>
        <button className="btn" onClick={() => g().setScreen('endless')}>{t('home.endless')}</button>
        <button className="btn" onClick={() => g().setScreen('stats')}>{t('home.stats')}</button>
        <button className="btn" onClick={() => g().setScreen('settings')}>{t('home.settings')}</button>
        <button className="btn" style={{ gridColumn: '1 / -1' }} onClick={() => g().setScreen('howto')}>
          {t('home.howto')}
        </button>
      </div>
    </div>
  );
}
