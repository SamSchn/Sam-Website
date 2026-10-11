// Tiny synthesized sound effects (no audio files). The AudioContext is created
// lazily on the first user gesture, as browsers require.

const KEY = 'sv_muted';
let ctx = null;
let master = null;
let muted = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();
const listeners = new Set();

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'square', vol = 0.5, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(start, dur, { vol = 0.3, freq = 800, q = 1 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  blip: () => tone(660 + Math.random() * 80, 0, 0.035, { vol: 0.12 }),
  open: () => { tone(523, 0, 0.08, { vol: 0.25 }); tone(784, 0.07, 0.12, { vol: 0.25 }); },
  close: () => { tone(659, 0, 0.07, { vol: 0.2 }); tone(440, 0.06, 0.1, { vol: 0.2 }); },
  select: () => tone(988, 0, 0.05, { vol: 0.18 }),
  door: () => { noise(0, 0.12, { vol: 0.5, freq: 220, q: 0.8 }); tone(140, 0.02, 0.12, { type: 'triangle', vol: 0.4, slide: -40 }); },
  step: (indoor) => noise(0, 0.05, { vol: indoor ? 0.18 : 0.12, freq: indoor ? 1400 : 2600, q: 1.2 }),
  coin: () => { tone(988, 0, 0.07, { vol: 0.2 }); tone(1319, 0.07, 0.18, { vol: 0.2 }); },
};

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* storage unavailable */ }
  listeners.forEach(fn => fn(m));
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
