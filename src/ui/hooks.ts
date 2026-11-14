import { useEffect, useMemo, useState } from 'react';
import { setSoundEnabled } from '../audio/synth';
import { makeT, type T } from '../i18n';
import { useGame } from '../store/game';

export function useT(): T {
  const lang = useGame((s) => s.profile.settings.lang);
  return useMemo(() => makeT(lang), [lang]);
}

function useSystemReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const [v, setV] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setV(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, [q]);
  return v;
}

export function useReducedMotion() {
  const setting = useGame((s) => s.profile.settings.reducedMotion);
  return useSystemReducedMotion() || setting;
}

/** Applies settings to <html>: theme, font size, contrast, motion, language, sound. */
export function useApplySettings() {
  const st = useGame((s) => s.profile.settings);
  const rm = useReducedMotion();
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.theme = st.theme;
    h.classList.toggle('large', st.fontSize === 'large');
    h.classList.toggle('hc', st.highContrast);
    h.classList.toggle('rm', rm);
    h.lang = st.lang;
    setSoundEnabled(st.sound);
  }, [st, rm]);
}

export function useElementSize<E extends HTMLElement>(): [(el: E | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<E | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size];
}
