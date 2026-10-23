// Tiny WebAudio sound kit. No assets, no network. Everything is a no-op until the first
// user gesture creates the AudioContext, and when sound is switched off.

let ctx: AudioContext | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slideTo?: number } = {}) {
  const a = audio();
  if (!a || !enabled) return;
  const t0 = a.currentTime + (opts.at ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.06;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  setEnabled(on: boolean) { enabled = on; },
  unlock() { audio(); },
  click() { tone(520, 0.07, { type: 'triangle', gain: 0.05 }); },
  count() { tone(440, 0.12, { type: 'square', gain: 0.035 }); },
  go() { tone(660, 0.1, { type: 'square', gain: 0.04 }); tone(990, 0.2, { type: 'square', gain: 0.04, at: 0.09 }); },
  tick() { tone(880, 0.05, { type: 'square', gain: 0.025 }); },
  radar() { tone(300, 0.35, { type: 'sine', gain: 0.07, slideTo: 1200 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.06, at: i * 0.08 })); },
  lose() { tone(330, 0.25, { type: 'sawtooth', gain: 0.04 }); tone(220, 0.4, { type: 'sawtooth', gain: 0.04, at: 0.18, slideTo: 160 }); },
  final() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.05, at: i * 0.1 })); },
};
