// Synthesized sound: no audio files, everything comes from WebAudio
// oscillators and noise. A lazy bassline loop plays while the game runs.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, low) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = low ? 'lowpass' : 'highpass';
    f.frequency.value = low ? 900 : 1800;
    const g = c.createGain();
    g.gain.value = vol || 0.12;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  // A minor walk, one note per beat at 112 bpm.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  function startMusic() {
    if (musicTimer || muted) return;
    ensure();
    musicTimer = setInterval(() => {
      if (muted) return;
      const f = BASS[musicStep % BASS.length];
      musicStep++;
      tone(f, 0.5, 'triangle', 0.05);
      if (musicStep % 4 === 1) tone(f * 2, 0.12, 'sine', 0.03);
    }, 536);
  }

  return {
    unlock() { ensure(); startMusic(); },
    toggleMute() {
      muted = !muted;
      if (muted && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (!muted) startMusic();
      return muted;
    },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.2); tone(220, 0.08, 'square', 0.1, 60); },
    punch() { noise(0.09, 0.16, true); },
    pickup() { tone(660, 0.09, 'sine', 0.09); tone(990, 0.14, 'sine', 0.09); },
    cash() { tone(880, 0.08, 'sine', 0.08); tone(1174, 0.16, 'sine', 0.08); },
    crash() { noise(0.25, 0.22, true); tone(90, 0.25, 'sawtooth', 0.1, 40); },
    siren() { tone(740, 0.4, 'sine', 0.04, 980); },
    mission() { tone(523, 0.12, 'sine', 0.1); tone(659, 0.12, 'sine', 0.1); tone(784, 0.25, 'sine', 0.1); },
    wasted() { tone(392, 0.3, 'sawtooth', 0.09, 196); tone(311, 0.5, 'sawtooth', 0.09, 155); },
    engine() { tone(70, 0.2, 'sawtooth', 0.03, 110); },
  };
}
