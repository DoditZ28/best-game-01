// Sound for Starshard Drift: every effect is synthesised with WebAudio, so
// the game ships no audio files and plays fully offline. The context is
// created lazily on the first user gesture (browsers block audio before one).

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padNodes = null;
    this.lastShot = 0;
  }

  // Call from any user gesture; safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startPad();
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A quiet two-oscillator drone under the game, with a slow breathing LFO.
  startPad() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 82.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    o1.connect(gain);
    o2.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.padNodes = { o1, o2, lfo, gain };
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
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
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot() {
    const now = performance.now();
    if (now - this.lastShot < 70) return; // throttle the pew-pew
    this.lastShot = now;
    this.tone(880 + Math.random() * 120, 0.07, 'square', 0.08, 320);
  }

  enemyDie() {
    this.noise(0.18, 0.22, 1400);
    this.tone(220, 0.18, 'sawtooth', 0.12, 55);
  }

  shard() {
    this.tone(1320, 0.09, 'sine', 0.14, 1980);
  }

  hit() {
    this.noise(0.25, 0.3, 900);
    this.tone(160, 0.3, 'sawtooth', 0.2, 40);
  }

  dash() {
    this.noise(0.14, 0.12, 3200);
  }

  waveClear() {
    this.tone(523, 0.12, 'sine', 0.16);
    setTimeout(() => this.tone(659, 0.12, 'sine', 0.16), 110);
    setTimeout(() => this.tone(784, 0.22, 'sine', 0.18), 220);
  }

  bossHit() {
    this.tone(98, 0.4, 'sawtooth', 0.2, 49);
    this.noise(0.3, 0.18, 700);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.3, 'triangle', 0.18), i * 140));
  }

  lose() {
    [392, 311, 233, 175].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.35, 'triangle', 0.16), i * 160));
  }
}
