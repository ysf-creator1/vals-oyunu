import type { ReactNode } from 'react';
import type { StringKey } from '../../i18n';
import { THEME_ORDER } from '../../progression/daily';
import type { Settings, ThemeId } from '../../progression/profile';
import { useGame } from '../../store/game';
import { KeepProgressSection } from '../components/KeepProgress';
import { ScreenHead } from '../components/ScreenHead';
import { useT } from '../hooks';

const SWATCH: Record<ThemeId, string[]> = {
  classic: ['#fbfaf7', '#1d1b26', '#5b3cc4'],
  lily: ['#cfe9df', '#8fcc78', '#c2185b'],
  beach: ['#ead6ae', '#2b8a8a', '#e2563f'],
  snow: ['#edf2f8', '#2f4a6b', '#d64545'],
  paws: ['#dce6cb', '#4a5a32', '#e07b39'],
  stars: ['#0e1430', '#e6ebff', '#ffd166'],
  islands: ['#2d7db3', '#f1dca2', '#ff6b35'],
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const s = useGame((x) => x.profile.settings);
  const unlocked = useGame((x) => x.profile.themesUnlocked);
  const g = useGame.getState;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => g().setSetting(k, v);

  const Switch = ({ k }: { k: 'sound' | 'vibration' | 'showTimer' | 'highContrast' | 'reducedMotion' }) => (
    <button
      className="switch"
      role="switch"
      aria-checked={s[k]}
      aria-label={t(`settings.${k}` as StringKey)}
      onClick={() => set(k, !s[k])}
    />
  );

  function Seg<V extends string>({ k, opts }: { k: keyof Settings; opts: [V, string][] }) {
    return (
      <div className="seg" role="group">
        {opts.map(([v, label]) => (
          <button key={v} aria-pressed={s[k] === v} onClick={() => set(k, v as never)}>{label}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="screen">
      <ScreenHead title={t('settings.title')} />
      <div className="scroll">
        <Row label={t('settings.sound')}><Switch k="sound" /></Row>
        <Row label={t('settings.vibration')}><Switch k="vibration" /></Row>
        <Row label={t('settings.showTimer')}><Switch k="showTimer" /></Row>
        <Row label={t('settings.helper')}>
          <Seg k="helper" opts={[['auto', t('settings.helper.auto')], ['on', t('settings.helper.on')], ['off', t('settings.helper.off')]]} />
        </Row>
        <Row label={t('settings.fontSize')}>
          <Seg k="fontSize" opts={[['normal', t('settings.font.normal')], ['large', t('settings.font.large')]]} />
        </Row>
        <Row label={t('settings.highContrast')}><Switch k="highContrast" /></Row>
        <Row label={t('settings.reducedMotion')}><Switch k="reducedMotion" /></Row>
        <Row label={t('settings.lang')}>
          <Seg k="lang" opts={[['tr', 'Türkçe'], ['en', 'English']]} />
        </Row>
        <div className="set-row">
          <span style={{ fontWeight: 600 }}>{t('settings.theme')}</span>
          <div className="themes">
            {THEME_ORDER.map((th) => {
              const open = unlocked.includes(th);
              return (
                <button key={th} className="theme-opt" aria-pressed={s.theme === th} disabled={!open} onClick={() => set('theme', th)}>
                  <span className="sw" aria-hidden="true">{SWATCH[th].map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <span style={{ fontWeight: 700 }}>{t(`theme.${th}` as StringKey)}</span>
                  {!open && <span className="muted" style={{ display: 'block', fontSize: '0.8rem' }}>{t('settings.locked', { cond: t(`theme.cond.${th}` as StringKey) })}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <KeepProgressSection />
        <div style={{ marginTop: 24 }}>
          <button
            className="btn"
            style={{ width: '100%' }}
            onClick={() => {
              if (window.confirm(t('settings.resetConfirm'))) g().resetProgress();
            }}
          >
            {t('settings.reset')}
          </button>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 16 }}>{t('settings.privacy')}</p>
        </div>
      </div>
    </div>
  );
}
