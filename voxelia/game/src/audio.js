// Sonidos sintetizados con Web Audio (sin archivos): romper, colocar, pasos, daño.
export class Sound {
  constructor() { this.ctx = null; this.volume = 0.6; this.musicVolume = 0.5; this.musicTimer = 4; this.lastChord = -1; }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  noise(dur, { freq = 800, q = 1, gain = 0.4, type = 'bandpass', decay = dur } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.volume) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * this.volume, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }
  tone(freq, dur, gain = 0.2, type = 'square') {
    const ctx = this.ensure();
    if (!ctx || !this.volume) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain * this.volume, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  }
  material(kind) {
    return { stone: { freq: 1200, q: 0.8 }, grass: { freq: 700, q: 0.6 }, sand: { freq: 2500, q: 0.4 }, wood: { freq: 420, q: 2.5 }, glass: { freq: 3500, q: 4 }, wool: { freq: 300, q: 0.4 } }[kind] ?? { freq: 900, q: 1 };
  }
  dig(kind) { const m = this.material(kind); this.noise(0.22, { ...m, gain: 0.55 }); }
  place(kind) { const m = this.material(kind); this.noise(0.12, { ...m, freq: m.freq * 0.7, gain: 0.45 }); }
  step(kind) { const m = this.material(kind); this.noise(0.08, { ...m, gain: 0.12 }); }
  hurt() { this.tone(180, 0.25, 0.25, 'sawtooth'); }
  splash() { this.noise(0.4, { freq: 600, q: 0.3, gain: 0.3, type: 'lowpass' }); }
  click() { this.tone(660, 0.05, 0.08, 'sine'); }

  // ───────── Música ambiental generada ─────────
  // Acordes suaves y espaciados (no un loop): mayores y luminosos de día, menores y graves de noche,
  // con alguna nota de melodía arriba. Se apoya en silencios para no cansar.
  updateMusic(dt, { night, underground }) {
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.musicVolume || !this.volume) { this.musicTimer = 5; return; }
    const DAY = [[60, 64, 67, 71], [65, 69, 72, 76], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 67]];
    const NIGHT = [[57, 60, 64], [50, 53, 57, 60], [52, 55, 59], [53, 57, 60, 64], [45, 52, 57]];
    const set = night || underground ? NIGHT : DAY;
    let k = Math.floor(Math.random() * set.length);
    if (k === this.lastChord) k = (k + 1) % set.length;
    this.lastChord = k;
    const shift = underground ? -12 : 0;
    const dur = 7 + Math.random() * 3;
    set[k].forEach((n, i) => this.pad(n + shift, dur, i * 0.25, 0.05));
    if (Math.random() < 0.7) {
      const top = set[k][set[k].length - 1] + 12 + shift;
      [0, 2, 4].slice(0, 1 + Math.floor(Math.random() * 3)).forEach((step, i) => this.pad(top + [0, -3, -5, 2][Math.floor(Math.random() * 4)], 2.5, 1.5 + i * 1.6 + step * 0.1, 0.035, 'triangle'));
    }
    // Siguiente frase después de un silencio.
    this.musicTimer = dur + 6 + Math.random() * 14;
  }

  pad(midi, dur, delay, gain, type = 'sine') {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    const peak = gain * this.musicVolume * this.volume;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(1.8, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.1);
    }
    lp.connect(g).connect(ctx.destination);
  }
}
