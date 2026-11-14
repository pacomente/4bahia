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
  // Trueno: estruendo grave que retumba.
  thunder(k = 1) { this.noise(2.6, { freq: 90, q: 0.4, gain: 0.9 * k, type: 'lowpass', decay: 2.6 }); setTimeout(() => this.noise(1.4, { freq: 160, q: 0.5, gain: 0.5 * k, type: 'lowpass' }), 250); }

  // ───────── Ambiente: capas continuas de ruido filtrado (viento, olas, lluvia) y sonidos sueltos ─────────
  // env: { wind 0..1, waves 0..1, rain 0..1, birds 0..1, crickets 0..1, market 0..1, cave 0..1 }
  updateAmbience(dt, env) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.amb) {
      const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < len; i++) { b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = b * 6 + (Math.random() * 2 - 1) * 0.15; }   // ruido "marrón" + un poco de blanco
      const layer = (type, freq, q) => {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(ctx.destination); src.start();
        return { f, g, base: freq };
      };
      this.amb = { wind: layer('bandpass', 420, 0.6), waves: layer('lowpass', 520, 0.7), rain: layer('highpass', 2400, 0.4), cave: layer('lowpass', 140, 1.2), t: 0 };
    }
    const a = this.amb; a.t += dt;
    const set = (L, v) => L.g.gain.setTargetAtTime(Math.max(0, v) * this.volume, ctx.currentTime, 0.6);
    set(a.wind, 0.06 + env.wind * 0.22); a.wind.f.frequency.setTargetAtTime(a.wind.base * (0.7 + 0.5 * (0.5 + 0.5 * Math.sin(a.t * 0.37))), ctx.currentTime, 1.2);
    set(a.waves, env.waves * (0.18 + 0.14 * Math.max(0, Math.sin(a.t * 0.7))));   // vaivén de las olas
    set(a.rain, env.rain * 0.16);
    set(a.cave, env.cave * 0.12);
    // Pájaros de día, grillos de noche, gente en el mercado.
    this.birdT = (this.birdT ?? 2) - dt;
    if (this.birdT <= 0) {
      this.birdT = 1.5 + Math.random() * 4;
      if (Math.random() < env.birds) this.chirp();
      if (Math.random() < env.crickets) this.cricket();
      if (Math.random() < env.market) this.babble();
    }
  }
  chirp() {
    const ctx = this.ctx; const n = 2 + Math.floor(Math.random() * 4); const base = 2200 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine'; const t0 = ctx.currentTime + i * 0.11;
      o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t0 + 0.07);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.035 * this.volume, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.1);
    }
  }
  cricket() {
    const ctx = this.ctx;
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 4300; const t0 = ctx.currentTime + i * 0.05;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.018 * this.volume, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.05);
    }
  }
  babble() {
    // Murmullo: sílabas cortas con tonos de voz al azar.
    const ctx = this.ctx; const n = 3 + Math.floor(Math.random() * 5); const pitch = 160 + Math.random() * 120;
    for (let i = 0; i < n; i++) {
      const t0 = ctx.currentTime + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch * (0.85 + Math.random() * 0.4), t0);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.02 * this.volume, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      o.connect(f).connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.1);
    }
  }

  // ───────── Música ambiental generada ─────────
  // Acordes suaves y espaciados (no un loop): mayores y luminosos de día, menores y graves de noche,
  // con alguna nota de melodía arriba. Se apoya en silencios para no cansar.
  updateMusic(dt, { night, underground, zone = null }) {
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.musicVolume || !this.volume) { this.musicTimer = 5; return; }
    const DAY = [[60, 64, 67, 71], [65, 69, 72, 76], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 67]];
    const NIGHT = [[57, 60, 64], [50, 53, 57, 60], [52, 55, 59], [53, 57, 60, 64], [45, 52, 57]];
    // Cada zona tiene su color: el pueblo alegre, el mar abierto, el desierto con escala árabe, la nieve fría.
    const ZONES = {
      village: [[60, 64, 67, 72], [65, 69, 72, 77], [67, 71, 74, 79], [62, 65, 69, 74]],
      sea: [[55, 62, 67], [53, 60, 65], [57, 64, 69], [50, 57, 62]],
      desert: [[57, 58, 61, 64], [53, 57, 58, 62], [55, 58, 61, 65], [57, 61, 64, 65]],
      snow: [[59, 62, 66, 71], [57, 61, 64, 69], [55, 59, 62, 66], [52, 59, 64, 67]],
      battle: [[45, 48, 52], [43, 46, 50], [41, 45, 48], [40, 43, 47]],
    };
    const set = zone && ZONES[zone] ? ZONES[zone] : night || underground ? NIGHT : DAY;
    let k = Math.floor(Math.random() * set.length);
    if (k === this.lastChord) k = (k + 1) % set.length;
    this.lastChord = k;
    const shift = underground ? -12 : 0;
    const dur = zone === 'battle' ? 3.5 : 7 + Math.random() * 3;
    set[k].forEach((n, i) => this.pad(n + shift, dur, i * 0.25, 0.05));
    if (Math.random() < 0.7) {
      const top = set[k][set[k].length - 1] + 12 + shift;
      [0, 2, 4].slice(0, 1 + Math.floor(Math.random() * 3)).forEach((step, i) => this.pad(top + [0, -3, -5, 2][Math.floor(Math.random() * 4)], 2.5, 1.5 + i * 1.6 + step * 0.1, 0.035, 'triangle'));
    }
    // Siguiente frase después de un silencio.
    this.musicTimer = zone === 'battle' ? dur : dur + 6 + Math.random() * 14;
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
