import { useEffect, useRef, useState } from 'react';
import type { BandId } from '../../engine/types';
import { formatTime, type StringKey, type T } from '../../i18n';
import { tierOf } from '../../progression/bands';
import type { Profile } from '../../progression/profile';
import { currentStreak, dateKey } from '../../progression/streak';
import { useGame, type EndCard } from '../../store/game';
import { useT } from '../hooks';

export function shareText(p: Profile, t: T, now = new Date()): string | null {
  const r = p.daily.lastResult;
  if (!r || p.daily.lastSolved !== dateKey(now)) return null;
  const months = t('months').split(',');
  const date = `${now.getDate()} ${months[now.getMonth()]}`;
  const tier = t(`tier.${tierOf(r.band as BandId)}` as StringKey);
  return [
    t('share.header', { name: t('app.name'), date, tier }),
    t('share.line', { stars: '⭐'.repeat(r.stars), time: formatTime(r.ms), streak: currentStreak(p.daily, dateKey(now)) }),
  ].join('\n');
}

export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function EndCardSheet({ card }: { card: EndCard }) {
  const t = useT();
  const profile = useGame((s) => s.profile);
  const showTimer = profile.settings.showTimer;
  const g = useGame.getState;
  const [toast, setToast] = useState<string | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => primary.current?.focus(), []);

  const tierName = (tier: string) => t(`tier.${tier}` as StringKey);
  const tutorial = card.kind === 'tutorial';

  const doShare = async () => {
    const text = shareText(profile, t);
    if (!text) return;
    if ((await share(text)) === 'copied') {
      setToast(t('end.copied'));
      setTimeout(() => setToast(null), 1800);
    }
  };

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="end-title">
        <h2 id="end-title">{tutorial && card.tutorialFinished ? t('end.tutorialDone') : t('end.solved')}</h2>
        {!tutorial && (
          <div className="stars" aria-label={`${card.stars} / 3`}>
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= card.stars ? '' : 'off'}>★</span>
            ))}
          </div>
        )}
        {(showTimer || card.fast) && !tutorial && (
          <div className="info">
            {showTimer && <span className="badge">{t('end.time', { t: formatTime(card.ms) })}</span>}
            {card.fast && <span className="badge">⚡ {t('end.fast')}</span>}
          </div>
        )}

        {card.events.tierUp && (
          <div className="note">
            {card.stayed ? (
              <span>{t('end.stayed', { tier: tierName(card.events.tierUp.from) })}</span>
            ) : (
              <>
                <span>🎉 {t('end.tierUp', { tier: tierName(card.events.tierUp.to) })}</span>
                {card.newTitle && <span>{t('end.newTitle', { title: t(`title.${card.newTitle}` as StringKey) })}</span>}
                <div className="row">
                  <button className="btn" onClick={() => g().chooseStay()}>
                    {t('end.stayIn', { tier: tierName(card.events.tierUp.from) })}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {!card.events.tierUp && card.newTitle && (
          <div className="note">{t('end.newTitle', { title: t(`title.${card.newTitle}` as StringKey) })}</div>
        )}
        {card.events.offerEasier && (
          <div className="note">
            {card.offerAnswered === 'yes' ? (
              <span>{t('end.eased')}</span>
            ) : card.offerAnswered === 'no' ? null : (
              <>
                <span>{t('end.offerEasier')}</span>
                <div className="row">
                  <button className="btn" onClick={() => g().answerEasier(true)}>{t('end.yes')}</button>
                  <button className="btn" onClick={() => g().answerEasier(false)}>{t('end.no')}</button>
                </div>
              </>
            )}
          </div>
        )}
        {card.newThemes.map((th) => (
          <div className="note" key={th}>{t('end.themeUnlocked', { theme: t(`theme.${th}` as StringKey) })}</div>
        ))}

        {card.kind === 'daily' && (
          <button className="btn" onClick={doShare}>↗ {t('end.share')}</button>
        )}
        <button ref={primary} className="btn primary big" onClick={() => card.next()}>
          {t('end.next')}
        </button>
        <div className="two">
          <button className="btn" onClick={() => g().replay()}>{t('end.again')}</button>
          <button className="btn" onClick={() => g().setScreen('home')}>{t('end.home')}</button>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
