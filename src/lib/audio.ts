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
  playSfx(kind: string, volume01: number, trackVol = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const v = Math.max(0, Math.min(1, volume01)) * Math.max(0, Math.min(1, trackVol));
    if (v <= 0.001) return;
    const t = ctx.currentTime;
    switch (kind) {
      case "sfx.laser": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(920, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.22);
        g.gain.setValueAtTime(0.16 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.26);
        break;
      }
      case "sfx.explosion": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(1100, t);
        f.frequency.exponentialRampToValueAtTime(60, t + 0.55);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 0.65);
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(35, t + 0.4);
        og.gain.setValueAtTime(0.4 * v, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.connect(og).connect(this.master);
        o.start(t); o.stop(t + 0.5);
        break;
      }
      case "sfx.coin": {
        [660, 990].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          const st = t + i * 0.085;
          o.frequency.setValueAtTime(freq, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.22 * v, st + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.24);
        });
        break;
      }
      case "sfx.blip": {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(520, t);
        g.gain.setValueAtTime(0.18 * v, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 0.14);
        break;
      }
      case "sfx.swoosh": {
        const src = ctx.createBufferSource();
        src.buffer = this.getNoise(ctx);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.Q.value = 1.1;
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.16 * v, t + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + 0.45);
        break;
      }
      case "sfx.alarm": {
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "square";
          const st = t + i * 0.3;
          o.frequency.setValueAtTime(i % 2 === 0 ? 620 : 460, st);
          g.gain.setValueAtTime(0.0001, st);
          g.gain.linearRampToValueAtTime(0.1 * v, st + 0.03);
          g.gain.setValueAtTime(0.1 * v, st + 0.2);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.26);
          o.connect(g).connect(this.master!);
          o.start(st); o.stop(st + 0.3);
        }
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
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const v = Math.max(0, Math.min(1, volume01)) * Math.max(0, Math.min(1, trackVol));
    if (v <= 0.001) return;
    const t0 = ctx.currentTime + 0.02;
    const stepDur = tempoMs / 1000;
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
    }
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
  playDataUrl(dataUrl: string, volume01: number) {
    const v = Math.max(0, Math.min(1, volume01)) * this.masterVolume;
    if (v <= 0.001) return;
    const audio = new Audio(dataUrl);
    audio.volume = v;
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
