// Sonidos sintetizados con Web Audio (sin archivos): romper, colocar, pasos, daño.
export class Sound {
  constructor() { this.ctx = null; this.volume = 0.6; }
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
}
