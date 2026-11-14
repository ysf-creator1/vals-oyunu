import type { DailyState } from './profile';

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

const fromDayNumber = (n: number) => {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/** Calendar week id: the Monday of the week containing `key`. */
export function weekKey(key: string): string {
  const n = dayNumber(key);
  const dow = (new Date(n * 86_400_000).getUTCDay() + 6) % 7; // Mon=0
  return fromDayNumber(n - dow);
}

/**
 * Whether the missed days between `last` and `today` are all covered by the automatic freeze
 * (one missed day per calendar week). Returns the last week used, or false if the streak breaks.
 */
function coverMissed(last: string, today: string, usedWeek: string | null): string | null | false {
  const a = dayNumber(last);
  const b = dayNumber(today);
  const used = new Set<string>(usedWeek ? [usedWeek] : []);
  let lastUsed = usedWeek;
  for (let n = a + 1; n < b; n++) {
    const wk = weekKey(fromDayNumber(n));
    if (used.has(wk)) return false;
    used.add(wk);
    lastUsed = wk;
  }
  return lastUsed;
}

export function recordDailySolve(s: DailyState, today: string): DailyState {
  if (s.lastSolved === today) return s;
  let streak = 1;
  let freezeUsedWeek = s.freezeUsedWeek;
  if (s.lastSolved && dayNumber(today) > dayNumber(s.lastSolved)) {
    const cover = coverMissed(s.lastSolved, today, s.freezeUsedWeek);
    if (cover !== false) {
      streak = s.streak + 1;
      freezeUsedWeek = cover;
    }
  }
  return { ...s, lastSolved: today, streak, best: Math.max(s.best, streak), freezeUsedWeek };
}

/** Streak to show today: still alive if solving today would continue it. */
export function currentStreak(s: DailyState, today: string): number {
  if (!s.lastSolved) return 0;
  if (s.lastSolved === today) return s.streak;
  if (dayNumber(today) < dayNumber(s.lastSolved)) return s.streak;
  return coverMissed(s.lastSolved, today, s.freezeUsedWeek) === false ? 0 : s.streak;
}
