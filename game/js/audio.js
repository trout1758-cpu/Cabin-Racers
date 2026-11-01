// Synthesised sound (no audio files): an engine per car plus race effects.
export class Audio {
  constructor() {
    this.ctx = null;
    this.engines = [];
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  // ---- engines ---------------------------------------------------------------
  startEngines(n) {
    this.stopEngines();
    if (!this.ready) return;
    for (let i = 0; i < n; i++) {
      const saw = this.ctx.createOscillator();
      saw.type = 'sawtooth';
      const sub = this.ctx.createOscillator();
      sub.type = 'square';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.35;
      saw.connect(filter);
      sub.connect(subGain).connect(filter);
      filter.connect(gain).connect(this.master);
      saw.start();
      sub.start();
      this.engines.push({ saw, sub, filter, gain });
    }
  }

  engine(i, speed, throttle) {
    const e = this.engines[i];
    if (!e) return;
    const t = this.ctx.currentTime;
    const f = 48 + Math.abs(speed) * 0.85;
    e.saw.frequency.setTargetAtTime(f, t, 0.05);
    e.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
    e.filter.frequency.setTargetAtTime(300 + throttle * 1200 + Math.abs(speed) * 2, t, 0.08);
    e.gain.gain.setTargetAtTime(0.025 + throttle * 0.03, t, 0.08);
  }

  stopEngines() {
    for (const e of this.engines) {
      try {
        e.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        e.saw.stop(this.ctx.currentTime + 0.3);
        e.sub.stop(this.ctx.currentTime + 0.3);
      } catch (err) { /* already stopped */ }
    }
    this.engines = [];
  }

  // ---- effects --------------------------------------------------------------------
  tone(freq, dur, vol, type = 'square', at = 0, to = null) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  hiss(dur, vol, freq, to) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  beep() { this.tone(660, 0.18, 0.12); }
  go() { this.tone(1320, 0.45, 0.12); this.tone(990, 0.45, 0.08, 'triangle'); }
  land(impact) { this.tone(110, 0.15, Math.min(0.3, impact / 800), 'sine', 0, 50); this.hiss(0.08, Math.min(0.15, impact / 1500), 600); }
  wall(impact) { this.hiss(0.18, Math.min(0.2, impact / 900), 2400, 900); }
  bump() { this.tone(180, 0.1, 0.15, 'triangle', 0, 90); }
  fall() { this.tone(700, 0.6, 0.08, 'triangle', 0, 120); }
  lap(final) { [784, 988, final ? 1319 : 1175].forEach((f, i) => this.tone(f, 0.12, 0.08, 'triangle', i * 0.08)); }
  finish(place) {
    const notes = place === 1 ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    notes.forEach((f, i) => this.tone(f, 0.18, 0.09, 'square', i * 0.11));
  }
  click() { this.tone(700, 0.05, 0.08, 'triangle', 0, 500); }
}
