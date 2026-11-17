import { registerSW } from 'virtual:pwa-register';

/**
 * Keep the installed app up to date.
 * A home-screen app is mostly resumed from the background, not relaunched, so the browser's own check
 * (only on a fresh start, and the new version shows only on the start after that) can keep an old
 * version for days. Check whenever the app comes to the front and every hour while open; when a new
 * version is installed, registerSW (autoUpdate) reloads the page. Progress and the current puzzle are
 * saved on every change, so the reload continues where the player was.
 */
export function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return;
      let last = Date.now();
      const check = async () => {
        if (!navigator.onLine || Date.now() - last < 30_000) return;
        last = Date.now();
        try {
          await reg.update();
        } catch {
          /* offline or server unreachable: try again next time */
        }
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
      });
      setInterval(() => void check(), 60 * 60 * 1000);
    },
  });
}
