// All sound is synthesized with WebAudio: no audio files, no network. A small
// music loop (bass + hats) runs under the game; effects are short synth bursts.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let beat = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc.connect(engineGain);
      engineOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // Bassline in A minor over a hat tick; 8 steps a bar, 132 bpm.
  const BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
  function musicStep() {
    if (!ctx || muted) return;
    const note = BASS[beat % BASS.length];
    if (note > 0) {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.5, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    }
    if (beat % 2 === 0) noise(0.03, 0.05, 8000);
    beat += 1;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx && !musicTimer) musicTimer = window.setInterval(musicStep, 227);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setEngine(speedRatio, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speedRatio * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    punch() {
      noise(0.08, 0.4, 900);
    },
    shoot() {
      noise(0.12, 0.5, 2600);
      tone(180, 0.1, 'square', 0.2, 60);
    },
    hit() {
      tone(140, 0.12, 'sawtooth', 0.25, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      window.setTimeout(() => tone(990, 0.12, 'sine', 0.3), 90);
    },
    cash() {
      tone(880, 0.07, 'sine', 0.25);
      window.setTimeout(() => tone(1174, 0.1, 'sine', 0.25), 70);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, 'triangle', 0.3), i * 110));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => window.setTimeout(() => tone(f, 0.2, 'sawtooth', 0.2), i * 140));
    },
    siren() {
      tone(700, 0.4, 'sine', 0.12, 950);
    },
    crash() {
      noise(0.25, 0.5, 700);
    },
    door() {
      tone(220, 0.08, 'square', 0.15, 160);
    },
  };
}
