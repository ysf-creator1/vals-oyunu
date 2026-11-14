import { useState } from 'react';
import type { BandId } from '../../engine/types';
import type { StringKey } from '../../i18n';
import { continueTarget, isUnlocked, selectBandManually, setAuto } from '../../progression/adaptive';
import { bandsOfTier, LEVELS_PER_BAND, levelId, tierOf, TIERS, type Tier } from '../../progression/bands';
import { useGame } from '../../store/game';
import { ScreenHead } from '../components/ScreenHead';
import { useT } from '../hooks';

export function LevelsScreen() {
  const t = useT();
  const profile = useGame((s) => s.profile);
  const g = useGame.getState;
  const [tab, setTab] = useState<Tier>(tierOf(profile.currentBand));
  const cont = continueTarget(profile);

  const open = (band: BandId, index: number) => {
    if (band !== profile.currentBand || profile.mode === 'manual') g().updateProfile((p) => selectBandManually(p, band));
    g().startCampaign(band, index);
  };

  return (
    <div className="screen">
      <ScreenHead title={t('levels.title')} />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>{t('levels.difficulty')}</span>
        <div className="seg" role="group" aria-label={t('levels.difficulty')}>
          <button aria-pressed={profile.mode === 'auto'} onClick={() => g().updateProfile(setAuto)}>{t('levels.auto')}</button>
          <button aria-pressed={profile.mode === 'manual'} onClick={() => g().updateProfile((p) => ({ ...p, mode: 'manual' }))}>
            {t('levels.manual')}
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
        {profile.mode === 'auto' ? t('levels.autoHint') : t('levels.manualHint')}
      </p>
      <div className="tabs" role="tablist">
        {TIERS.map((tier) => (
          <button key={tier} role="tab" aria-selected={tab === tier} onClick={() => setTab(tier)}>
            {t(`tier.${tier}` as StringKey)}
          </button>
        ))}
      </div>
      <div className="scroll">
        {bandsOfTier(tab).map((band, bi) => (
          <section className="band" key={band}>
            <h3>
              {t('levels.band', { b: bi + 1 })}
              {band === profile.currentBand && <span className="badge">●</span>}
            </h3>
            <div className="lv-grid">
              {Array.from({ length: LEVELS_PER_BAND }, (_, i) => {
                const r = profile.results[levelId(band, i)];
                const unlocked = isUnlocked(profile, band, i);
                const n = i + 1;
                const isCur = cont.band === band && cont.index === i;
                return (
                  <button
                    key={i}
                    className={`lv${r ? ' done' : ''}${isCur ? ' cur' : ''}`}
                    disabled={!unlocked}
                    onClick={() => open(band, i)}
                    aria-label={`${n}${r ? `, ${r.stars}★` : unlocked ? '' : `, ${t('levels.locked')}`}`}
                  >
                    {n}
                    <small aria-hidden="true">{r ? '★'.repeat(r.stars) : ''}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
