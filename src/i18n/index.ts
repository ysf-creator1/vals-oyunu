import type { Lang } from '../progression/profile';
import { en } from './en';
import { tr, type StringKey } from './tr';

export type { StringKey };
const DICTS: Record<Lang, Record<StringKey, string>> = { tr, en };

export type T = (key: StringKey, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  const d = DICTS[lang] ?? tr;
  return (key, vars) => {
    let s = d[key] ?? tr[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
