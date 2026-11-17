/**
 * Progress backup with a recovery code instead of an account: the profile is stored on the event server
 * under a random 12-character code (shown as XXXX-XXXX-XXXX). Entering the code on another phone brings
 * the progress back. No name, e-mail or login. Once a code exists the backup follows every change.
 */
const ORACLE_HOST = 'vals.130-61-214-155.sslip.io';
const api = () =>
  typeof location !== 'undefined' && location.hostname === ORACLE_HOST ? '/api/yedek' : `https://${ORACLE_HOST}/api/yedek`;

/** Accepts any spacing, dashes and case; returns XXXX-XXXX-XXXX or null. */
export function normalizeCode(raw: string): string | null {
  const x = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^[2-9A-HJKMNP-Z]{12}$/.test(x) ? x.match(/.{4}/g)!.join('-') : null;
}

async function post<T>(url: string, body: unknown, timeoutMs = 8000): Promise<{ status: number; data?: T }> {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    // text/plain: no CORS preflight from GitHub Pages.
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, signal: ctl?.signal, cache: 'no-store' });
    let data: T | undefined;
    try {
      data = (await r.json()) as T;
    } catch {
      data = undefined;
    }
    return { status: r.status, data };
  } catch {
    return { status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export type BackupError = 'offline' | 'notfound' | 'limit' | 'error';
const errorOf = (status: number): BackupError => (status === 0 ? 'offline' : status === 404 ? 'notfound' : status === 429 ? 'limit' : 'error');

/** Creates a new code (no code given) or updates the backup under an existing one. */
export async function saveBackup(profile: unknown, code?: string): Promise<{ code: string; at: string } | BackupError> {
  const r = await post<{ kod: string; z: string }>(api(), code ? { kod: code, profil: profile } : { profil: profile });
  if (r.status === 200 && r.data?.kod) return { code: r.data.kod, at: r.data.z };
  return errorOf(r.status);
}

/** Last-moment save while the page is closing (fire and forget). */
export function saveBackupOnExit(profile: unknown, code: string) {
  const body = JSON.stringify({ kod: code, profil: profile });
  try {
    if (navigator.sendBeacon?.(api(), body)) return;
  } catch {
    /* fall through */
  }
  try {
    void fetch(api(), { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function loadBackup(code: string): Promise<{ code: string; at: string; profile: unknown } | BackupError> {
  const r = await post<{ kod: string; z: string; profil: unknown }>(`${api()}/al`, { kod: code });
  if (r.status === 200 && r.data?.profil) return { code: r.data.kod, at: r.data.z, profile: r.data.profil };
  return errorOf(r.status);
}
