/**
 * Anonymous usage events for the weekly/monthly report (server: server/vals-sunucu.js on the Oracle host).
 * No names or accounts: a random device code, the event and a few numbers. The server keeps only the
 * network part of the IP (for an approximate city/country). Every call is a no-op outside a real browser,
 * in dev builds, in automated browsers, on localhost and with ?debug, so tests never pollute the report.
 */
declare const __SURUM__: string;

const ORACLE_HOST = 'vals.130-61-214-155.sslip.io';
/** Build stamp (UTC "YYYY-MM-DD HH:MM"), set by vite.config.ts. */
export const VERSION = typeof __SURUM__ === 'string' ? __SURUM__ : 'dev';
const DEVICE_KEY = 'vals:cihaz';

type Value = string | number | boolean | undefined;
export type EventData = Record<string, Value>;

interface Ctx {
  url: string;
  device: string;
  firstVisit: boolean;
  source: 'web' | 'anaekran';
  site: string;
}

let ctx: Ctx | null | undefined;
let queue: Record<string, Value>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function setup(): Ctx | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (import.meta.env?.DEV || navigator.webdriver) return null;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:') return null;
  if (/[?&]debug/.test(location.search)) return null;

  let device = '';
  let firstVisit = false;
  try {
    device = localStorage.getItem(DEVICE_KEY) ?? '';
    if (!/^[0-9a-f]{12}$/.test(device)) {
      const b = new Uint8Array(6);
      crypto.getRandomValues(b);
      device = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_KEY, device);
      firstVisit = true;
    }
  } catch {
    device = '';
  }
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
  const site = location.hostname === ORACLE_HOST ? 'oracle' : location.hostname.endsWith('github.io') ? 'pages' : location.hostname.slice(0, 40);
  const url = location.hostname === ORACLE_HOST ? '/api/olay' : `https://${ORACLE_HOST}/api/olay`;

  window.addEventListener('pagehide', () => flush());
  // Script errors, so a crash on some phone shows up in the report. Only the message and file:line, at most 5 per page.
  let errors = 0;
  const report = (msg: unknown, where: string) => {
    if (++errors > 5) return;
    track('hata_js', { mesaj: String(msg ?? '').slice(0, 40), yer: where.slice(-40), surum: VERSION });
  };
  window.addEventListener('error', (e) => {
    const file = String(e.filename || '').split('/').pop() || '?';
    report(e.message, `${file}:${e.lineno || 0}:${e.colno || 0}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | undefined;
    report(r?.message ?? r, 'promise');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  return { url, device, firstVisit, source: standalone ? 'anaekran' : 'web', site };
}

function context(): Ctx | null {
  if (ctx === undefined) {
    try {
      ctx = setup();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

/** True only the very first time this browser opened the game (device code was just created). */
export const isFirstVisit = () => context()?.firstVisit ?? false;
/** Anonymous device code and the server base, or null where events are off (dev, tests, ?debug). */
export const deviceCode = () => {
  const c = context();
  return c && c.device ? { device: c.device, api: c.url.replace(/\/olay$/, '') } : null;
};
export const deviceInfo = () => {
  const c = context();
  return c ? { kaynak: c.source, site: c.site } : {};
};

/**
 * Phone model where the browser offers it without asking: Chrome/Edge/Samsung on Android ("SM-A546E").
 * iPhones and other browsers never reveal it; the report then guesses the size class from the screen.
 * Resolves within 800 ms either way.
 */
export function deviceModel(): Promise<string> {
  const uad = (navigator as { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ model?: string }> } }).userAgentData;
  if (!context() || !uad?.getHighEntropyValues) return Promise.resolve('');
  return Promise.race([
    uad.getHighEntropyValues(['model']).then((v) => String(v.model ?? '').slice(0, 40), () => ''),
    new Promise<string>((r) => setTimeout(() => r(''), 800)),
  ]);
}

export function track(tur: string, data: EventData = {}) {
  const c = context();
  if (!c) return;
  queue.push({ ...data, tur, cihaz: c.device });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 3000);
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const c = context();
  if (!c || !queue.length) return;
  const body = JSON.stringify(queue);
  queue = [];
  try {
    // A string body is sent as text/plain: no CORS preflight from GitHub Pages to the Oracle host.
    if (navigator.sendBeacon?.(c.url, body)) return;
  } catch {
    /* fall through */
  }
  try {
    void fetch(c.url, { method: 'POST', body, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {
    /* offline or blocked: drop silently */
  }
}
