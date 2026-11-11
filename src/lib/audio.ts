// ===== WebAudio szintetizátor =====
// Minden hang és zenei loop kódolással készül, külső fájl nélkül.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVolume = 0.8;
  private noiseBuffer: AudioBuffer | null = null;
  private audioPool: HTMLAudioElement[] = [];

  ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.masterVolume;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  // ---------- Hanghatások ----------
  // rate: lejátszási sebesség szorzó (1 = normál). A frekvenciák arányosan
  // tolódnak, az időtartamok rövidülnek/hosszabbodnak – mint egy minta gyorsítása.
  playSfx(kind: string, volume01: number, trackVol = 1, rate = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const v = Math.max(0, Math.min(1, volume01)) * Math.max(0, Math.min(1, trackVol));
    if (v <= 0.001) return;
    const r = Math.max(0.25, Math.min(4, rate));
    const t = ctx.currentTime;
    switch (kind) {
      case "sfx.laser": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(920 * r, t);
        o.frequency.exponentialRampToValueAtTime(120 * r, t + 0.22 / r);
        g.gain.setValueAtTime(0.16 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.26 / r);
        break;
      }
      case "sfx.explosion": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(1100 * r, t);
        f.frequency.exponentialRampToValueAtTime(60 * r, t + 0.55 / r);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 / r);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 0.65 / r);
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(120 * r, t);
        o.frequency.exponentialRampToValueAtTime(35 * r, t + 0.4 / r);
        og.gain.setValueAtTime(0.4 * v, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45 / r);
        o.connect(og).connect(this.master);
        o.start(t); o.stop(t + 0.5 / r);
        break;
      }
      case "sfx.coin": {
        [660, 990].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          const st = t + (i * 0.085) / r;
          o.frequency.setValueAtTime(freq * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.22 * v, st + 0.012 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.24 / r);
        });
        break;
      }
      case "sfx.blip": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(520 * r, t);
        g.gain.setValueAtTime(0.18 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.14 / r);
        break;
      }
      case "sfx.swoosh": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.Q.value = 1.1;
        f.frequency.setValueAtTime(300 * r, t);
        f.frequency.exponentialRampToValueAtTime(2400 * r, t + 0.35 / r);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.16 * v, t + 0.12 / r);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4 / r);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 0.45 / r);
        break;
      }
      case "sfx.alarm": {
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "square";
          const st = t + (i * 0.3) / r;
          o.frequency.setValueAtTime((i % 2 === 0 ? 620 : 460) * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.1 * v, st + 0.03 / r);
          g.gain.setValueAtTime(0.1 * v, st + 0.2 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.26 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.3 / r);
        }
        break;
      }
      case "sfx.jump": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(220 * r, t);
        o.frequency.exponentialRampToValueAtTime(680 * r, t + 0.16 / r);
        g.gain.setValueAtTime(0.2 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.22 / r);
        break;
      }
      case "sfx.powerup": {
        [392, 523, 659, 784].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "square";
          const st = t + (i * 0.07) / r;
          o.frequency.setValueAtTime(freq * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.14 * v, st + 0.01 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.18 / r);
        });
        break;
      }
      case "sfx.hurt": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(190 * r, t);
        o.frequency.exponentialRampToValueAtTime(70 * r, t + 0.2 / r);
        g.gain.setValueAtTime(0.2 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.26 / r);
        break;
      }
      case "sfx.win": {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          const st = t + (i * 0.14) / r;
          const dur = (i === 3 ? 0.5 : 0.18) / r;
          o.frequency.setValueAtTime(freq * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.18 * v, st + 0.02 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + dur + 0.05 / r);
        });
        break;
      }
      case "sfx.gameover": {
        [440, 349, 262].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          const st = t + (i * 0.22) / r;
          o.frequency.setValueAtTime(freq * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.16 * v, st + 0.02 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.34 / r);
        });
        break;
      }
      case "sfx.pop": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(380 * r, t);
        o.frequency.exponentialRampToValueAtTime(120 * r, t + 0.1 / r);
        g.gain.setValueAtTime(0.24 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.14 / r);
        break;
      }
      case "sfx.click": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(1400 * r, t);
        g.gain.setValueAtTime(0.09 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.06 / r);
        break;
      }
      case "sfx.thunder": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(900 * r, t);
        f.frequency.exponentialRampToValueAtTime(50 * r, t + 1.0 / r);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.5 * v, t + 0.05 / r);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 / r);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 1.15 / r);
        break;
      }
      case "sfx.boing": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(140 * r, t);
        o.frequency.exponentialRampToValueAtTime(560 * r, t + 0.09 / r);
        o.frequency.exponentialRampToValueAtTime(110 * r, t + 0.3 / r);
        g.gain.setValueAtTime(0.22 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.36 / r);
        break;
      }
      case "sfx.chime": {
        [880, 1174.7, 1568].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          const st = t + (i * 0.14) / r;
          o.frequency.setValueAtTime(freq * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.16 * v, st + 0.015 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 1.0 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 1.05 / r);
        });
        break;
      }
      case "sfx.splash": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.Q.value = 0.8;
        f.frequency.setValueAtTime(1400 * r, t);
        f.frequency.exponentialRampToValueAtTime(200 * r, t + 0.3 / r);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 / r);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 0.4 / r);
        // cseppek
        [900, 1300].forEach((fr, i) => {
          const o = ctx.createOscillator();
          const og = ctx.createGain();
          o.type = "sine";
          const st = t + (0.12 + i * 0.1) / r;
          o.frequency.setValueAtTime(fr * r, st);
          o.frequency.exponentialRampToValueAtTime(fr * 1.8 * r, st + 0.08 / r);
          og.gain.setValueAtTime(0.1 * v, st);
          og.gain.exponentialRampToValueAtTime(0.0001, st + 0.12 / r);
          o.connect(og).connect(this.master!);
          o.start(st); o.stop(st + 0.14 / r);
        });
        break;
      }
      case "sfx.drumroll": {
        const hits = 22;
        for (let i = 0; i < hits; i++) {
          const st = t + (i * (0.045 + (i / hits) * 0.02)) / r;
          const src = ctx.createBufferSource();
          src.buffer = this.getNoise(ctx);
          const f = ctx.createBiquadFilter();
          f.type = "bandpass";
          f.frequency.value = 1900;
          const g = ctx.createGain();
          const vol = (0.05 + (i / hits) * 0.2) * v;
          g.gain.setValueAtTime(vol, st);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.05 / r);
          src.connect(f).connect(g).connect(this.master);
          src.start(st); src.stop(st + 0.06 / r);
        }
        // záró ütés
        this.kick(t + (hits * 0.055) / r + 0.05 / r, v * 0.9);
        break;
      }
      case "sfx.phone": {
        for (let ring = 0; ring < 2; ring++) {
          const base = t + ring * 0.55 / r;
          for (let i = 0; i < 8; i++) {
            const st = base + (i * 0.05) / r;
            [440, 480].forEach((fr) => {
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.type = "sine";
              o.frequency.setValueAtTime(fr * r, st);
              g.gain.setValueAtTime(0.0001, st);
              g.gain.linearRampToValueAtTime(0.09 * v, st + 0.012 / r);
              g.gain.setValueAtTime(0.09 * v, st + 0.04 / r);
              g.gain.exponentialRampToValueAtTime(0.0001, st + 0.05 / r);
              o.connect(g).connect(this.master!);
              o.start(st); o.stop(st + 0.06 / r);
            });
          }
        }
        break;
      }
      case "sfx.magic": {
        const notes = [659.3, 784, 987.8, 1318.5, 1568, 2093];
        notes.forEach((fr, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          const st = t + (i * 0.06) / r;
          o.frequency.setValueAtTime(fr * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.13 * v, st + 0.01 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.35 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.38 / r);
        });
        break;
      }
      case "sfx.bubble": {
        [520, 760, 980].forEach((fr, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          const st = t + (i * 0.09) / r;
          o.frequency.setValueAtTime(fr * 0.6 * r, st);
          o.frequency.exponentialRampToValueAtTime(fr * 1.4 * r, st + 0.07 / r);
          g.gain.setValueAtTime(0.14 * v, st);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.12 / r);
        });
        break;
      }
      case "sfx.whistle": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(2100 * r, t);
        lfo.frequency.setValueAtTime(28, t);
        lfoG.gain.setValueAtTime(140, t);
        lfo.connect(lfoG).connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12 * v, t + 0.03 / r);
        g.gain.setValueAtTime(0.12 * v, t + 0.3 / r);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38 / r);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.4 / r);
        lfo.start(t); lfo.stop(t + 0.4 / r);
        break;
      }
      case "sfx.buzzer": {
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o2.type = "square";
        o.frequency.setValueAtTime(110 * r, t);
        o2.frequency.setValueAtTime(113 * r, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11 * v, t + 0.02 / r);
        g.gain.setValueAtTime(0.11 * v, t + 0.45 / r);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / r);
        o.connect(g);
        o2.connect(g);
        g.connect(this.master);
        o.start(t); o.stop(t + 0.52 / r);
        o2.start(t); o2.stop(t + 0.52 / r);
        break;
      }
      case "sfx.ding": {
        [1318.5, 1975.5].forEach((fr, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          const st = t;
          o.frequency.setValueAtTime(fr * r, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime((i === 0 ? 0.18 : 0.08) * v, st + 0.01 / r);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9 / r);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.95 / r);
        });
        break;
      }
      case "sfx.typewriter": {
        const clicks = 7;
        for (let i = 0; i < clicks; i++) {
          const st = t + (i * (0.075 + Math.random() * 0.02)) / r;
          const src = ctx.createBufferSource();
          src.buffer = this.getNoise(ctx);
          const f = ctx.createBiquadFilter();
          f.type = "highpass";
          f.frequency.value = 2500 + Math.random() * 1500;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.12 * v, st);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.03 / r);
          src.connect(f).connect(g).connect(this.master);
          src.start(st); src.stop(st + 0.04 / r);
        }
        // kocogás
        const st2 = t + (clicks * 0.08) / r;
        const src2 = ctx.createBufferSource();
        src2.buffer = this.getNoise(ctx);
        const f2 = ctx.createBiquadFilter();
        f2.type = "bandpass";
        f2.frequency.value = 900;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.16 * v, st2);
        g2.gain.exponentialRampToValueAtTime(0.0001, st2 + 0.08 / r);
        src2.connect(f2).connect(g2).connect(this.master);
        src2.start(st2); src2.stop(st2 + 0.1 / r);
        break;
      }
      case "sfx.engine": {
        const o = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(42 * r, t);
        o.frequency.exponentialRampToValueAtTime(88 * r, t + 0.5 / r);
        o.frequency.exponentialRampToValueAtTime(60 * r, t + 1.1 / r);
        f.type = "lowpass";
        f.frequency.setValueAtTime(300 * r, t);
        f.frequency.exponentialRampToValueAtTime(900 * r, t + 0.5 / r);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.2 * v, t + 0.08 / r);
        g.gain.setValueAtTime(0.2 * v, t + 0.8 / r);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15 / r);
        o.connect(f).connect(g).connect(this.master);
        o.start(t); o.stop(t + 1.2 / r);
        break;
      }
    }
  }

  // ---------- Zenei minták ----------
  // A minta a blokk hosszára (lengthSteps * tempoMs) ütemeződik be.
  playMusic(
    typeId: string,
    params: Record<string, string | number | boolean>,
    lengthSteps: number,
    tempoMs: number,
    volume01: number,
    trackVol = 1,
    rate = 1,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const v = Math.max(0, Math.min(1, volume01)) * Math.max(0, Math.min(1, trackVol));
    if (v <= 0.001) return;
    const t0 = ctx.currentTime + 0.02;
    // Lejátszási sebesség: a lépések hossza rövidül/hosszabbodik arányosan
    const stepDur = (tempoMs / 1000) / Math.max(0.25, Math.min(4, rate));
    const steps = Math.max(1, lengthSteps);

    if (typeId === "music.beat") {
      const pattern = String(params.pattern ?? "techno");
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const beatPos = s % 8;
        const kick = pattern === "techno" ? beatPos % 2 === 0 : pattern === "house" ? beatPos === 0 || beatPos === 4 || beatPos === 6 : beatPos === 0 || beatPos === 4;
        const snare = pattern === "techno" ? beatPos === 4 : beatPos === 4;
        const hatEvery = pattern === "lounge" ? 2 : 1;
        if (kick) this.kick(t, v * 0.9);
        if (snare) this.snare(t, v * 0.5);
        if (s % hatEvery === 0) this.hihat(t, v * (pattern === "techno" ? 0.22 : 0.14));
      }
    } else if (typeId === "music.bass") {
      const pattern = String(params.pattern ?? "dark");
      const roots: Record<string, number[]> = {
        dark: [55, 55, 65.4, 55, 49, 49, 58.3, 55],
        bouncy: [65.4, 82.4, 65.4, 98, 73.4, 87.3, 73.4, 110],
        walk: [55, 61.7, 65.4, 73.4, 65.4, 61.7, 58.3, 55],
      };
      const seq = roots[pattern] ?? roots.dark;
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        this.bassNote(seq[s % seq.length], t, stepDur * 0.9, v * 0.5);
      }
    } else if (typeId === "music.pad") {
      const chord = String(params.chord ?? "minor");
      const base = 220;
      const chords: Record<string, number[]> = {
        minor: [base, base * 1.189, base * 1.498],
        major: [base, base * 1.26, base * 1.498],
        sus: [base, base * 1.26, base * 1.335],
      };
      const notes = chords[chord] ?? chords.minor;
      const dur = steps * stepDur;
      notes.forEach((f, i) => this.padNote(f, t0, dur, v * 0.16, i * 0.02));
    } else if (typeId === "music.arpeggio") {
      const scale = String(params.scale ?? "minor");
      const scales: Record<string, number[]> = {
        minor: [220, 261.6, 246.9, 293.7, 329.6, 392, 440],
        major: [220, 277.2, 293.7, 329.6, 370, 440, 493.9],
        pentatonic: [220, 261.6, 293.7, 329.6, 392, 440, 523.3],
      };
      const seq = scales[scale] ?? scales.minor;
      const sub = stepDur / 2;
      for (let s = 0; s < steps * 2; s++) {
        const t = t0 + s * sub;
        const idx = s % 14;
        const freq = seq[idx < 7 ? idx : 13 - idx];
        this.arpNote(freq, t, sub * 0.85, v * 0.14);
      }
    } else if (typeId === "music.rock") {
      const pattern = String(params.pattern ?? "power");
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const beatPos = s % 4;
        if (beatPos === 0) this.kick(t, v * 0.8);
        if (beatPos === 2) this.snare(t, v * 0.55);
        if (s % 2 === 0) this.hihat(t, v * 0.16);
        const riff = pattern === "power" ? [82.4, 82.4, 98, 82.4, 110, 98, 82.4, 73.4] : [110, 110, 98, 110, 130.8, 110, 98, 110];
        this.distGuitar(riff[s % riff.length], t, stepDur * 0.8, v * 0.16);
      }
    } else if (typeId === "music.chip") {
      const tune = String(params.tune ?? "adventure");
      const mel = tune === "happy"
        ? [523, 523, 587, 659, 523, 659, 784, 659]
        : [392, 523, 440, 349, 392, 523, 587, 440];
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        this.chipNote(mel[s % mel.length], t, stepDur * 0.7, v * 0.13);
        if (s % 2 === 0) this.chipNote(mel[s % mel.length] / 4, t, stepDur * 0.9, v * 0.1);
        if (s % 4 === 0) this.kick(t, v * 0.35);
      }
    } else if (typeId === "music.waltz") {
      const chord = String(params.chord ?? "major");
      const base = chord === "major" ? 261.6 : 246.9;
      const third = chord === "major" ? base * 1.26 : base * 1.189;
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 3;
        if (pos === 0) this.bassNote(base / 2, t, stepDur * 0.9, v * 0.4);
        else { this.chipNote(base, t, stepDur * 0.5, v * 0.09); this.chipNote(third, t, stepDur * 0.5, v * 0.09); }
      }
    } else if (typeId === "music.hiphop") {
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 4;
        if (pos === 0) this.kick(t, v * 0.95);
        if (pos === 2) this.snare(t, v * 0.5);
        if (pos === 1 || pos === 3) this.hihat(t, v * 0.18);
        if (pos === 0 || pos === 3) this.bassNote([49, 49, 58.3, 49][s % 4], t, stepDur * 0.7, v * 0.45);
      }
    } else if (typeId === "music.ambient") {
      const dur = steps * stepDur;
      [220, 261.6, 329.6, 392].forEach((f, i) => this.padNote(f, t0, dur, v * 0.1, i * 0.04));
      for (let s = 0; s < steps; s += 2) {
        const t = t0 + s * stepDur + Math.random() * stepDur;
        const scale2 = [523.3, 587.3, 659.3, 784, 880];
        this.arpNote(scale2[Math.floor(Math.random() * scale2.length)], t, stepDur * 1.6, v * 0.06);
      }
    } else if (typeId === "music.samba") {
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 8;
        // surdo (mély dob) az erős ütemeken
        if (pos === 0 || pos === 3 || pos === 4 || pos === 6) this.kick(t, v * 0.65);
        // rim
        if (pos === 2 || pos === 5 || pos === 7) this.snare(t, v * 0.3);
        // pergő (shaker) minden fél lépésben
        this.hihat(t, v * (s % 2 === 0 ? 0.14 : 0.08));
        // szinkópált basszus
        const bass = [98, 0, 0, 98, 110, 0, 98, 0][pos];
        if (bass) this.bassNote(bass, t, stepDur * 0.6, v * 0.4);
      }
    } else if (typeId === "music.disco") {
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 8;
        if (pos % 2 === 0) this.kick(t, v * 0.85);
        if (pos % 2 === 1) this.hihat(t, v * 0.22);
        if (pos === 4) this.snare(t, v * 0.5);
        // funky basszus
        const bassSeq = [98, 0, 110, 98, 0, 123.5, 116.5, 0];
        if (bassSeq[pos]) this.bassNote(bassSeq[pos], t, stepDur * 0.75, v * 0.4);
        // csillogás a leosztásokon
        if (pos % 2 === 1) this.arpNote(1046.5 * (pos === 3 ? 1.19 : 1), t, stepDur * 0.4, v * 0.05);
      }
    } else if (typeId === "music.polka") {
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 4;
        // oom-pah-pah 2/4-es érzés
        if (pos === 0 || pos === 2) this.kick(t, v * 0.7);
        this.hihat(t, v * 0.12);
        if (pos === 1 || pos === 3) {
          this.chipNote(392, t, stepDur * 0.4, v * 0.08);
          this.chipNote(493.9, t, stepDur * 0.4, v * 0.08);
        }
        if (pos === 0) this.bassNote(98, t, stepDur * 0.8, v * 0.45);
        if (pos === 2) this.bassNote(116.5, t, stepDur * 0.8, v * 0.45);
      }
    } else if (typeId === "music.reggae") {
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const pos = s % 8;
        // one-drop: üres az 1-esen, dob a 4-esen
        if (pos === 3) { this.kick(t, v * 0.75); this.snare(t, v * 0.5); }
        if (pos === 7) this.snare(t, v * 0.3);
        // skank (off-beat akkordok)
        if (pos % 2 === 1) {
          this.chipNote(329.6, t, stepDur * 0.25, v * 0.06);
          this.chipNote(392, t, stepDur * 0.25, v * 0.06);
          this.chipNote(493.9, t, stepDur * 0.25, v * 0.06);
        }
        // lüktető basszus
        const bass = [73.4, 0, 0, 0, 82.4, 0, 87.3, 0][pos];
        if (bass) this.bassNote(bass, t, stepDur * 0.9, v * 0.5);
      }
    } else if (typeId === "music.lullaby") {
      const mel = [523.3, 0, 587.3, 0, 659.3, 0, 587.3, 0, 523.3, 0, 493.9, 0, 523.3, 0, 0, 0];
      const dur = steps * stepDur;
      this.padNote(261.6, t0, dur, v * 0.08);
      this.padNote(329.6, t0, dur, v * 0.06, 0.03);
      for (let s = 0; s < steps; s++) {
        const t = t0 + s * stepDur;
        const note = mel[s % mel.length];
        if (note) {
          // zenedoboz-feeling: lágy háromszög hullám + visszhang-szerű ismétlés
          this.arpNote(note, t, stepDur * 1.4, v * 0.12);
          this.arpNote(note * 2, t + 0.015, stepDur * 0.8, v * 0.03);
        }
      }
    }
  }

  private distGuitar(freq: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(64);
    for (let i = 0; i < 64; i++) { const x = (i / 32) - 1; curve[i] = Math.tanh(2.6 * x); }
    sh.curve = curve;
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    f.type = "lowpass";
    f.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(sh).connect(f).connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private chipNote(freq: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.03);
  }

  private kick(t: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v * 0.75, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + 0.2);
  }

  private snare(t: number, v: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t); src.stop(t + 0.16);
  }

  private hihat(t: number, v: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t); src.stop(t + 0.06);
  }

  private bassNote(freq: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    f.type = "lowpass";
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private padNote(freq: number, t: number, dur: number, v: number, detuneDelay = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    o.detune.setValueAtTime(6, t);
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.3);
    g.gain.setValueAtTime(v, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.05 + detuneDelay);
  }

  private arpNote(freq: number, t: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // ---------- Feltöltött hang ----------
  playDataUrl(dataUrl: string, volume01: number, rate = 1) {
    const v = Math.max(0, Math.min(1, volume01)) * this.masterVolume;
    if (v <= 0.001) return;
    const audio = new Audio(dataUrl);
    audio.volume = v;
    audio.playbackRate = Math.max(0.25, Math.min(4, rate));
    this.audioPool.push(audio);
    if (this.audioPool.length > 12) this.audioPool.shift();
    audio.onended = () => {
      const i = this.audioPool.indexOf(audio);
      if (i >= 0) this.audioPool.splice(i, 1);
    };
    void audio.play().catch(() => {});
  }

  stopAll() {
    this.audioPool.forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    this.audioPool = [];
  }
}

export const audioEngine = new AudioEngine();
