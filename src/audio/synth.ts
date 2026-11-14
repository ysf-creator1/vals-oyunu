/**
 * Web Audio synth. No sound files. The context is created lazily on the first user gesture.
 * Jump lengths are notes: 1 → C, 2 → E, 3 → G; one octave lower while the rhythm is reversed.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

const NOTE: Record<number, number> = { 1: 523.25, 2: 659.25, 3: 783.99 };

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

/** Call from a pointer/key handler: browsers only allow audio after a gesture. */
export function unlockAudio() {
  if (!enabled) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'triangle', peak = 0.5, lowpass?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node: AudioNode = o;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export const noteFor = (len: number, dir: number) => NOTE[len] / (dir === -1 ? 2 : 1);

export function playJump(len: number, dir: number) {
  if (!enabled || !ctx) return;
  tone(noteFor(len, dir), ctx.currentTime, 0.32);
}

export function playError() {
  if (!enabled || !ctx) return;
  tone(130, ctx.currentTime, 0.14, 'square', 0.18, 500);
}

/** Replays the solved path as a melody, then a short chord. Returns total duration in ms. */
export function playMelody(notes: { len: number; dir: number }[], stepMs: number): number {
  if (!enabled || !ctx) return notes.length * stepMs + 600;
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((n, i) => tone(noteFor(n.len, n.dir), t0 + (i * stepMs) / 1000, 0.28, 'triangle', 0.4));
  const end = t0 + (notes.length * stepMs) / 1000 + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, end, 1.1, 'sine', 0.22));
  return notes.length * stepMs + 600;
}

export function vibrate(pattern: number | number[], on: boolean) {
  if (!on) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
