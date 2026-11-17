import { useEffect, useState } from 'react';
import { normalizeCode, type BackupError } from '../../backup/backup';
import { formatDateTime, type StringKey } from '../../i18n';
import { canPromptInstall, isStandalone, onInstallChange, platform, promptInstall } from '../../platform/device';
import { totalSolved } from '../../progression/profile';
import { track } from '../../analytics/track';
import { useGame } from '../../store/game';
import { useT } from '../hooks';
import { toast } from './Toast';

function useInstallState() {
  const [, bump] = useState(0);
  useEffect(() => onInstallChange(() => bump((n) => n + 1)), []);
  return { standalone: isStandalone(), canPrompt: canPromptInstall(), plat: platform() };
}

/** How to add the game to the home screen on this phone, with the browser's own button where it offers one. */
function InstallHow({ where }: { where: 'home' | 'settings' }) {
  const t = useT();
  const { canPrompt, plat } = useInstallState();
  if (canPrompt) {
    return (
      <button
        className="btn primary"
        onClick={async () => {
          const ok = await promptInstall();
          track('ana_ekran', { ne: ok ? 'kurdu' : 'vazgecti', yer: where });
        }}
      >
        📲 {t('install.button')}
      </button>
    );
  }
  return <span className="muted install-how">{t(plat === 'ios' ? 'install.ios' : plat === 'android' ? 'install.android' : 'install.desktop')}</span>;
}

/** Home screen card, shown once a phone player has solved a few levels, until closed or installed. */
export function InstallCard() {
  const t = useT();
  const profile = useGame((s) => s.profile);
  const { standalone, plat } = useInstallState();
  const show = !standalone && plat !== 'desktop' && !profile.installHintDismissed && totalSolved(profile) >= 5;
  useEffect(() => {
    if (show) track('ana_ekran', { ne: 'goster' });
  }, [show]);
  if (!show) return null;
  return (
    <div className="card install-card" role="note">
      <span className="t">📌 {t('install.title')}</span>
      <span className="muted">{t('install.why')}</span>
      <InstallHow where="home" />
      <button
        className="btn link"
        onClick={() => {
          track('ana_ekran', { ne: 'kapat' });
          useGame.getState().dismissInstallHint();
        }}
      >
        {t('install.close')}
      </button>
    </div>
  );
}

const errorKey = (e: BackupError) => `backup.err.${e}` as StringKey;

/** Settings section: recovery-code backup and restore, plus home-screen install. */
export function KeepProgressSection() {
  const t = useT();
  const profile = useGame((s) => s.profile);
  const backupAt = useGame((s) => s.backupAt);
  const failed = useGame((s) => s.backupFailed);
  const { standalone } = useInstallState();
  const g = useGame.getState;
  const [busy, setBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const code = profile.backup?.code;

  const create = async () => {
    setBusy(true);
    setMsg(null);
    const e = await g().createBackup();
    setBusy(false);
    if (e) setMsg(t(errorKey(e)));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code!);
      toast(t('end.copied'));
    } catch {
      /* the code is on screen anyway */
    }
  };
  const restore = async () => {
    const c = normalizeCode(input);
    if (!c) return setMsg(t('backup.err.format'));
    setBusy(true);
    setMsg(null);
    const r = await g().fetchBackup(c);
    setBusy(false);
    if (typeof r === 'string') {
      track('yedek', { ne: 'geri_hata', neden: r });
      return setMsg(t(errorKey(r)));
    }
    const theirs = totalSolved(r.profile as never);
    const ok = window.confirm(t('backup.confirm', { n: theirs, date: formatDateTime(r.at, t), mine: totalSolved(profile) }));
    if (!ok) return;
    g().applyBackup(r.code, r.profile, r.at);
    toast(t('backup.restored'));
  };

  return (
    <div className="keep">
      <h2>{t('keep.title')}</h2>
      <p className="muted">{t('keep.intro')}</p>

      <div className="keep-box">
        <span className="t">🔑 {t('backup.title')}</span>
        {code ? (
          <>
            <div className="code-row">
              <code className="backup-code" aria-label={t('backup.title')}>{code}</code>
              <button className="btn" onClick={copy}>{t('backup.copy')}</button>
            </div>
            <span className="muted">{t('backup.keepIt')}</span>
            <span className={failed ? 'warn' : 'muted'} role="status">
              {failed ? t('backup.failed') : backupAt ? t('backup.savedAt', { date: formatDateTime(backupAt, t) }) : t('backup.saving')}
            </span>
          </>
        ) : (
          <>
            <span className="muted">{t('backup.explain')}</span>
            <button className="btn primary" disabled={busy} onClick={create}>{busy ? '…' : t('backup.create')}</button>
          </>
        )}
        {restoreOpen ? (
          <div className="restore">
            <label className="muted" htmlFor="restore-code">{t('backup.enter')}</label>
            <input
              id="restore-code"
              className="code-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            <button className="btn" disabled={busy} onClick={restore}>{busy ? '…' : t('backup.restore')}</button>
          </div>
        ) : (
          <button className="btn link" onClick={() => { setRestoreOpen(true); setMsg(null); }}>{t('backup.restoreOpen')}</button>
        )}
        {msg && <span className="warn" role="alert">{msg}</span>}
      </div>

      {!standalone && (
        <div className="keep-box">
          <span className="t">📌 {t('install.title')}</span>
          <span className="muted">{t('install.why')}</span>
          <InstallHow where="settings" />
        </div>
      )}
    </div>
  );
}
