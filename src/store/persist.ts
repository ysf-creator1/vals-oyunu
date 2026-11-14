/** Single versioned localStorage key. Every access is guarded: storage may be unavailable. */
const KEY = 'vals:v1';

export function loadSaved(): { profile?: unknown; session?: unknown } {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;
let latest: unknown = null;

export function save(data: { profile: unknown; session: unknown }) {
  latest = data;
  if (pending) return;
  pending = setTimeout(flush, 150);
}

export function flush() {
  if (pending) clearTimeout(pending);
  pending = null;
  if (latest === null) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(latest));
  } catch {
    /* storage full or blocked: keep playing */
  }
}

export function clearSaved() {
  latest = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
