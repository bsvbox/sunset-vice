// Sunset Vice — all sound is synthesised with WebAudio: no audio files, no
// network. A quiet bass loop runs under the game; effects are short tones
// and filtered noise bursts. Nothing starts until the player presses a key,
// so the browser's autoplay rules stay happy.
let ctx = null;
let master = null;
let muted = false;
let bassTimer = null;
let bassStep = 0;

// A four-bar walking bassline in A minor, one note per beat.
const BASSLINE = [55, 0, 55, 65.41, 49, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 49];

export function startAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.32;
  master.connect(ctx.destination);
  bassTimer = window.setInterval(() => {
    if (muted || !ctx || ctx.state !== 'running') return;
    const freq = BASSLINE[bassStep % BASSLINE.length];
    bassStep++;
    if (freq > 0) tone(freq, 0.26, 'triangle', 0.10);
  }, 300);
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
  gain.gain.setValueAtTime(vol || 0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function noise(dur, vol, cutoff) {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff || 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(now);
}

export function playSfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shoot': noise(0.09, 0.25, 3200); tone(190, 0.08, 'square', 0.10, 70); break;
    case 'punch': noise(0.08, 0.22, 700); break;
    case 'pickup': tone(660, 0.09, 'sine', 0.16); tone(990, 0.12, 'sine', 0.14); break;
    case 'cash': tone(880, 0.08, 'sine', 0.14); tone(1320, 0.14, 'sine', 0.12); break;
    case 'crash': noise(0.25, 0.3, 500); tone(90, 0.2, 'sawtooth', 0.12, 45); break;
    case 'siren': tone(720, 0.35, 'sine', 0.05, 980); break;
    case 'mission': tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16); tone(784, 0.22, 'sine', 0.16); break;
    case 'wasted': tone(392, 0.25, 'sawtooth', 0.12, 180); tone(311, 0.4, 'sawtooth', 0.12, 140); break;
    case 'spray': noise(0.4, 0.12, 5000); break;
    case 'car': tone(120, 0.25, 'sawtooth', 0.10, 240); break;
    case 'busted': tone(440, 0.3, 'square', 0.08, 220); break;
    default: tone(440, 0.08, 'sine', 0.08); break;
  }
}

export function engineHum(on, speedRatio) {
  if (!ctx || muted) return;
  if (on) tone(50 + speedRatio * 90, 0.09, 'sawtooth', 0.03);
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.32;
  return muted;
}

export function isMuted() {
  return muted;
}
