/**
 * Keeping progress on the phone: persistent storage (asked silently where the browser does not prompt)
 * and adding the game to the home screen (the browser's own install dialog where offered, instructions on iPhone).
 * On iPhone, Safari wipes a site's saved data after 7 days without a visit unless it is on the home screen.
 */

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Call once at startup, before the browser fires beforeinstallprompt. */
export function setupInstall() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}
let installedNow = false;

export function onInstallChange(f: () => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return installedNow || !!window.matchMedia?.('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone;
}

export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** The browser offers its own "install" dialog (Chrome, Edge, Samsung on Android and desktop). */
export const canPromptInstall = () => !!deferred;

export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  try {
    await d.prompt();
    const r = await d.userChoice;
    notify();
    return r.outcome === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Ask the browser to keep this site's data even when space runs low. Chrome and Safari decide silently;
 * Firefox would show a permission prompt, so it is skipped there. Resolves to the resulting state.
 */
export async function persistStorage(): Promise<boolean | undefined> {
  try {
    const st = navigator.storage;
    if (!st?.persist || !st.persisted) return undefined;
    if (await st.persisted()) return true;
    if (/Firefox|FxiOS/.test(navigator.userAgent)) return false;
    return await st.persist();
  } catch {
    return undefined;
  }
}
