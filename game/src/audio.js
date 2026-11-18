// Sunset Vice — all sound is synthesized with WebAudio: no audio files, no
// network. A tiny bass loop runs under the game; one-shot effects fire on
// events the simulation reports through its sfx list.
let ctx = null;
let master = null;
let muted = false;
let bassTimer = null;
let bassStep = 0;

// Bassline notes (A minor walk), in Hz.
const BASSLINE = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ensureCtx() || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol, lowpass) {
  if (!ensureCtx() || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

// Start the audio context (call from a user gesture) and the bass loop.
export function startAudio() {
  if (!ensureCtx()) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (bassTimer) return;
  bassTimer = setInterval(() => {
    if (muted) return;
    const note = BASSLINE[bassStep % BASSLINE.length];
    bassStep++;
    tone(note, 0.42, 'triangle', 0.16);
    tone(note * 2, 0.2, 'sine', 0.05);
  }, 260);
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

// Play one named effect. Unknown names are ignored.
export function playSfx(name) {
  switch (name) {
    case 'shoot':
      noise(0.12, 0.35, 3200);
      tone(180, 0.1, 'square', 0.18, 60);
      break;
    case 'punch':
      noise(0.08, 0.3, 900);
      break;
    case 'pickup':
      tone(660, 0.09, 'sine', 0.2);
      setTimeout(() => tone(880, 0.12, 'sine', 0.2), 80);
      break;
    case 'cash':
      tone(990, 0.08, 'sine', 0.18);
      setTimeout(() => tone(1320, 0.14, 'sine', 0.18), 70);
      break;
    case 'crash':
      noise(0.3, 0.4, 500);
      tone(90, 0.25, 'sawtooth', 0.2, 40);
      break;
    case 'siren':
      tone(700, 0.22, 'sine', 0.1, 950);
      setTimeout(() => tone(950, 0.22, 'sine', 0.1, 700), 220);
      break;
    case 'mission':
      tone(523, 0.12, 'sine', 0.22);
      setTimeout(() => tone(659, 0.12, 'sine', 0.22), 120);
      setTimeout(() => tone(784, 0.22, 'sine', 0.22), 240);
      break;
    case 'wasted':
      tone(220, 0.5, 'sawtooth', 0.2, 55);
      break;
    case 'steal':
      tone(300, 0.15, 'square', 0.12, 520);
      break;
    case 'busted':
      tone(440, 0.2, 'square', 0.15, 330);
      setTimeout(() => tone(330, 0.3, 'square', 0.15, 220), 200);
      break;
    case 'engine':
      tone(70, 0.18, 'sawtooth', 0.05, 110);
      break;
    default:
      break;
  }
}
