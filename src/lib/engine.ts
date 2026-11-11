import type { Block, CustomAsset, EngineEvent, Project, Track } from "./types";
import { getBlockType } from "./blocks";
import { audioEngine } from "./audio";

// ===== Futtató motor =====
// Amikor a léptetőfej elér egy blokkot, a motor "kilövi" annak hatását:
// entitást hoz létre, hangot szólaltat meg, változót ír, vagy ugrik.

const W = 960;
const H = 540;
const VARS_KEY = "appmixer.vars.v1";

type Role = "player" | "enemy" | "pickup" | "deco" | "text" | "projectile" | "platform";

interface Entity {
  id: number;
  kind: "ship" | "meteor" | "star" | "cloud" | "text" | "custom" | "projectile" | "shape";
  role: Role;
  style: string;       // alak stílusa (shape-nél)
  move: string;        // mozgás-viselkedés (shape-nél)
  speed: number;       // mozgás-sebesség px/s
  x: number; // 0..100 %
  y: number; // 0..100 %
  vx: number; // px/s
  vy: number; // px/s
  size: number; // px (platformnál: szélesség)
  w: number;  // platform szélesség px
  h: number;  // platform magasság px
  value: number;       // pont/élet érték (gyűjtendőnél)
  color: string;
  text?: string;
  fontSize?: number;
  image?: HTMLImageElement;
  sticky: boolean;
  life: number | null; // ms; null = örök
  spin: boolean;
  rotation: number;
  spinSpeed: number;
  bornAt: number;
  poly: number[];
  baseX: number;       // eredeti hely (patrol/orbit)
  baseY: number;
  phase: number;       // véletlen fázis (hullám/keringés)
  onGround: boolean;   // platformer fizikához
  srcId?: string;      // létrehozó blokk azonosítója (körülfordulásnál a duplikátumok ellen)
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

interface BgState {
  type: "none" | "preset" | "color" | "image";
  preset?: string;
  color?: string;
  image?: HTMLImageElement;
}

export class RuntimeEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private lastFrame = 0;
  private entityId = 1;

  entities: Entity[] = [];
  particles: Particle[] = [];
  vars: Record<string, number> = { score: 0, lives: 3 };
  private bg: BgState = { type: "none" };
  private flash: { color: string; t: number } | null = null;
  private shake = 0;
  private invulnUntil = 0;
  private lastShot = 0;
  private gameOver = false;

  playing = false;
  paused = false;
  step = 0;
  private stepDeadline = 0;
  private jumpGuard = 0;
  private lastReportedStep = -1;

  private keys = new Set<string>();
  private keyboardUntil = 0;
  private keyboardSpeed = 220;
  private kbMode: "free" | "jump" | "horizontal" = "free";
  private jumpForce = 620;
  private jumpQueued = false;
  private pointerUntil = 0;
  private pointerSmooth = 70;
  private pointerX = 50;
  private pointerY = 50;
  private clickUntil = 0;
  private clickMode: string = "shoot";

  // Időjárás, villám, választó gombok, spawner-ek, vége-állapot
  private weather: "rain" | "snow" | null = null;
  private weatherStrength = 0.6;
  private bolt: { pts: number[]; until: number } | null = null;
  private activeChoice: {
    question: string; options: string[]; variable: string; target: number; until: number;
  } | null = null;
  private spawners: {
    until: number; nextAt: number; everyMs: number;
    spec: { style: string; role: string; move: string; speed: number; size: number; color: string; value: number; randomX: boolean };
  }[] = [];
  private finished: "win" | "lose" | null = null;
  private finishLabel = "";

  private getProject: () => Project;
  private onEvent: (e: EngineEvent) => void;
  private onStep: (s: number) => void;
  private onGameOver: (score: number) => void;
  private imageCache = new Map<string, HTMLImageElement>();
  private starfield: { x: number; y: number; r: number; tw: number }[] = [];

  constructor(
    getProject: () => Project,
    callbacks: {
      onEvent: (e: EngineEvent) => void;
      onStep: (s: number) => void;
      onGameOver: (score: number) => void;
    },
  ) {
    this.getProject = getProject;
    this.onEvent = callbacks.onEvent;
    this.onStep = callbacks.onStep;
    this.onGameOver = callbacks.onGameOver;
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
      this.starfield = Array.from({ length: 90 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
      }));
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  attachCanvas(c: HTMLCanvasElement | null) {
    this.canvas = c;
    this.ctx = c ? c.getContext("2d") : null;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  // ---------- Irányítás ----------
  play() {
    const p = this.getProject();
    audioEngine.ensureContext();
    audioEngine.setMasterVolume(p.masterVolume);
    this.entities = [];
    this.particles = [];
    this.vars = { score: 0, lives: 3 };
    this.bg = { type: "none" };
    this.flash = null;
    this.shake = 0;
    this.gameOver = false;
    this.finished = null;
    this.finishLabel = "";
    this.activeChoice = null;
    this.spawners = [];
    this.weather = null;
    this.bolt = null;
    this.invulnUntil = 0;
    this.keyboardUntil = 0;
    this.clickUntil = 0;
    this.pointerUntil = 0;
    this.kbMode = "free";
    this.step = 0;
    this.jumpGuard = 0;
    this.lastReportedStep = 0;
    this.playing = true;
    this.paused = false;
    this.stepDeadline = performance.now();
    this.emit(0, "Lejátszás indítása", "info");
  }

  pause() {
    if (!this.playing) return;
    this.paused = !this.paused;
    if (!this.paused) this.stepDeadline = performance.now();
    this.emit(this.step, this.paused ? "Szünet" : "Folytatás", "info");
  }

  stop() {
    this.playing = false;
    this.paused = false;
    this.step = 0;
    this.onStep(0);
    audioEngine.stopAll();
    this.emit(0, "Megállítva – a képernyő tartalma megmarad", "info");
  }

  resetView() {
    this.entities = [];
    this.particles = [];
    this.bg = { type: "none" };
    this.flash = null;
    this.gameOver = false;
    this.vars = { score: 0, lives: 3 };
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.playing || this.paused) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].includes(e.key)) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const first = !this.keys.has(k);
      this.keys.add(k);
      // Ugrálás módban a felfelé/Szóköz a lenyomás PILLANATÁBAN vált ugrást (él-vezérelt)
      if (first && this.kbMode === "jump" && (k === " " || k === "ArrowUp" || k === "w")) {
        this.jumpQueued = true;
      }
      if (e.key === " ") e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys.delete(k);
  };

  handleCanvasHover(xPct: number, yPct: number) {
    this.pointerX = xPct;
    this.pointerY = yPct;
  }

  handleCanvasClick(xPct: number, yPct: number) {
    if (!this.playing || this.paused) return;
    // 1) Választó gombok kezelése (ha aktív)
    if (this.activeChoice && performance.now() < this.activeChoice.until) {
      const c = this.activeChoice;
      const n = c.options.length;
      const bw = Math.min(30, 88 / n), gap = (92 - n * bw) / (n + 1);
      for (let i = 0; i < n; i++) {
        const bx = gap + i * (bw + gap);
        if (xPct >= bx && xPct <= bx + bw && yPct >= 74 && yPct <= 92) {
          this.vars[c.variable] = i + 1;
          audioEngine.playSfx("sfx.click", 0.7);
          this.emit(this.step, `Választás: „${c.options[i]}” (variáció ${c.variable} = ${i + 1})`, "logic");
          this.activeChoice = null;
          if (c.target > 0) this.jumpTo(c.target);
          return;
        }
      }
      return; // a gombokon kívüli kattintást a panel „elnyeli”
    }
    if (performance.now() > this.clickUntil) return;
    if (this.clickMode === "shoot") {
      this.shootAt(xPct, yPct);
    } else if (this.clickMode === "star") {
      this.spawn({
        kind: "star", role: "pickup", x: xPct, y: yPct, size: 18, color: "#fde047",
        sticky: false, life: 6000, value: 5,
      });
      this.emit(this.step, "Csillag a kattintásnál", "gfx");
    } else if (this.clickMode === "meteor") {
      this.spawn({
        kind: "meteor", role: "enemy", x: xPct, y: Math.max(2, yPct - 8), vy: 70, size: 24, color: "#9ca3af",
        sticky: false, life: null, spin: true,
      });
      this.emit(this.step, "Meteor a kattintásnál", "gfx");
    }
  }

  // ---------- Entitás segédek ----------
  private spawn(p: Partial<Entity> & { kind: Entity["kind"]; role: Role; x: number; y: number }) {
    if (this.entities.length > 300) this.entities.shift();
    const e: Entity = {
      id: this.entityId++,
      kind: p.kind,
      role: p.role,
      style: p.style ?? "ball",
      move: p.move ?? "static",
      speed: p.speed ?? 0,
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      size: p.size ?? 24,
      w: p.w ?? 0,
      h: p.h ?? 0,
      value: p.value ?? 5,
      color: p.color ?? "#ffffff",
      text: p.text,
      fontSize: p.fontSize,
      image: p.image,
      sticky: p.sticky ?? false,
      life: p.life ?? null,
      spin: p.spin ?? false,
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 4,
      bornAt: performance.now(),
      poly: Array.from({ length: 8 }, () => 0.75 + Math.random() * 0.5),
      baseX: p.x, baseY: p.y,
      phase: Math.random() * Math.PI * 2,
      onGround: false,
      srcId: p.srcId,
    };
    this.entities.push(e);
    return e;
  }

  // Ugyanazon blokk korábbi entitásainak törlése (körkörös lejátszásnál nem halmozódnak)
  private removeBySrc(srcId?: string) {
    if (!srcId) return;
    this.entities = this.entities.filter((e) => e.srcId !== srcId);
  }

  // Általános "Alak" létrehozása a blokk paramétereiből
  private spawnShape(
    pr: Record<string, string | number | boolean>,
    opts: { life: number | null; stickyDefault: boolean; srcId?: string },
    label: string,
    step: number,
  ) {
    const style = String(pr.style ?? "ball");
    const roleRaw = String(pr.role ?? "deco");
    const role: Role = (roleRaw === "player" || roleRaw === "enemy" || roleRaw === "pickup" || roleRaw === "platform") ? roleRaw : "deco";
    const sticky = Boolean(pr.sticky ?? opts.stickyDefault);
    if (role === "player") this.entities = this.entities.filter((e) => e.role !== "player");
    this.removeBySrc(opts.srcId);
    const randomX = Boolean(pr.randomX ?? false);
    const x = randomX ? 6 + Math.random() * 88 : Number(pr.x ?? 50);
    const yRaw = Number(pr.y ?? 50);
    const y = roleRaw === "enemy" && (String(pr.move ?? "") === "fall") ? -6 : yRaw;
    const move = String(pr.move ?? "static");
    const speed = Number(pr.speed ?? 60);
    // Mozgásból adódó kezdő sebesség (a futtatókörben a move-vezérlés tartja karban)
    let vx = 0, vy = 0;
    if (move === "fall") vy = speed;
    else if (move === "rise") vy = -speed;
    else if (move === "drift") vx = speed;
    else if (move === "bounce") { vx = speed; vy = speed * 0.7; }
    else if (move === "patrol") vx = speed;
    else if (move === "wave") { vy = speed * 0.5; vx = speed; }
    const e = this.spawn({
      kind: "shape", role, style, move, speed,
      x, y, vx, vy,
      size: Number(pr.size ?? 30),
      w: Number(pr.size ?? 30) * 1.6,
      h: Number(pr.height ?? 26),
      value: Number(pr.value ?? 5),
      color: String(pr.color ?? "#fbbf24"),
      sticky, life: sticky ? null : opts.life,
      srcId: opts.srcId,
    });
    if (role === "pickup" && style === "heart") e.value = Math.max(1, Number(pr.value ?? 1));
    const roleLabel = role === "player" ? "Játékos" : role === "enemy" ? "Ellenség" : role === "pickup" ? "Gyűjtendő" : role === "platform" ? "Akadály" : "Dísz";
    this.emit(step, `${label} (${roleLabel.toLowerCase()}, ${move})`, role === "platform" ? "logic" : "gfx");
    return e;
  }

  private getPlayer(): Entity | undefined {
    return this.entities.find((e) => e.role === "player");
  }

  private shootAt(xPct: number, yPct: number) {
    const now = performance.now();
    if (now - this.lastShot < 140) return;
    this.lastShot = now;
    const p = this.getPlayer();
    const sx = p ? p.x : 50;
    const sy = p ? p.y - 4 : 95;
    const dx = (xPct / 100) * W - (sx / 100) * W;
    const dy = (yPct / 100) * H - (sy / 100) * H;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 520;
    this.spawn({
      kind: "projectile", role: "projectile", x: sx, y: sy,
      vx: (dx / len) * speed, vy: (dy / len) * speed,
      size: 10, color: "#fbbf24", sticky: false, life: 2500,
    });
    audioEngine.playSfx("sfx.laser", 0.7);
  }

  private burst(x: number, y: number, count: number, color: string, speed = 180) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 500 + Math.random() * 500, maxLife: 1000,
        color, size: 2 + Math.random() * 3.5,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  private emit(step: number, label: string, tone: EngineEvent["tone"]) {
    this.onEvent({ step, label, tone });
  }

  // ---------- Léptető ----------
  private loop = () => {
    const now = performance.now();
    const dt = Math.min(50, now - this.lastFrame) / 1000;
    this.lastFrame = now;

    if (this.playing && !this.paused && !this.gameOver) {
      const p = this.getProject();
      while (now >= this.stepDeadline) {
        this.fireStep(this.step, p);
        this.step++;
        this.stepDeadline += p.tempoMs;
        if (this.step >= p.stepCount) {
          if (p.loop) {
            this.step = 0;
            this.emit(0, "Körülfordulás – újra az elejéről", "logic");
          } else {
            this.playing = false;
            this.emit(this.step, "A kompozíció véget ért", "info");
            break;
          }
        }
      }
      if (this.step !== this.lastReportedStep) {
        this.lastReportedStep = this.step;
        this.onStep(this.step);
      }
    }

    this.update(dt, now);
    this.render(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private fireStep(step: number, p: Project) {
    const anySolo = p.tracks.some((t) => t.solo);
    for (const track of p.tracks) {
      const muted = track.muted || (anySolo && !track.solo);
      if (muted) continue;
      for (const b of p.blocks) {
        if (b.trackId !== track.id || b.start !== step) continue;
        try {
          this.applyBlock(b, track, p);
        } catch {
          this.emit(step, "Hiba egy blokk futtatásakor", "warn");
        }
      }
    }
  }

  private findAsset(p: Project, id: string): CustomAsset | undefined {
    return p.assets.find((a) => a.id === id);
  }

  private getImage(asset: CustomAsset): HTMLImageElement | undefined {
    let img = this.imageCache.get(asset.id);
    if (!img) {
      img = new Image();
      img.src = asset.dataUrl;
      this.imageCache.set(asset.id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : undefined;
  }

  private applyBlock(b: Block, track: Track, p: Project) {
    const isCustom = b.typeId.startsWith("custom:");
    const def = getBlockType(b.typeId);
    const assetId = isCustom ? b.typeId.slice(7) : undefined;
    const asset = assetId ? this.findAsset(p, assetId) : undefined;
    const kind = isCustom ? (asset?.kind === "audio" ? "customAudio" : "customImage") : def?.kind;
    const pr = b.params;
    const vol = track.volume;

    switch (kind) {
      case "bg": {
        if (b.typeId === "gfx.bg.preset") {
          this.bg = { type: "preset", preset: String(pr.preset ?? "space") };
          this.emit(b.start, `Háttér: ${String(pr.preset)}`, "gfx");
        } else {
          this.bg = { type: "color", color: String(pr.color ?? "#1e1b4b") };
          this.emit(b.start, "Háttérszín beállítva", "gfx");
        }
        break;
      }
      case "sprite": {
        if (b.typeId === "gfx.sprite.ship") {
          this.entities = this.entities.filter((e) => e.role !== "player");
          this.spawn({
            kind: "ship", role: "player",
            x: Number(pr.x ?? 50), y: Number(pr.y ?? 82),
            size: Number(pr.size ?? 34), color: String(pr.color ?? "#fbbf24"),
            sticky: true, life: null,
          });
          this.emit(b.start, "Űrhajó (játékos) kész", "gfx");
        } else if (b.typeId === "gfx.sprite.meteor") {
          this.spawn({
            kind: "meteor", role: "enemy",
            x: Number(pr.x ?? 50), y: -4,
            vy: Number(pr.vy ?? 55), size: Number(pr.size ?? 26),
            color: "#9ca3af", spin: Boolean(pr.spin), sticky: false, life: null,
          });
          this.emit(b.start, `Meteor hullik (x${pr.x})`, "gfx");
        } else if (b.typeId === "gfx.sprite.star") {
          this.removeBySrc(b.id);
          this.spawn({
            kind: "star", role: "pickup",
            x: Number(pr.x ?? 50), y: Number(pr.y ?? 40),
            size: Number(pr.size ?? 18), color: "#fde047",
            sticky: true, life: null, value: Number(pr.value ?? 5),
            srcId: b.id,
          });
          this.emit(b.start, "Csillag vár gyűjtésre", "gfx");
        } else if (b.typeId === "gfx.sprite.cloud") {
          this.removeBySrc(b.id);
          this.spawn({
            kind: "cloud", role: "deco",
            x: Number(pr.x ?? 20), y: Number(pr.y ?? 25),
            vx: Number(pr.vx ?? 12), size: Number(pr.size ?? 36),
            color: String(pr.color ?? "#e2e8f0"), sticky: true, life: null,
            srcId: b.id,
          });
        }
        break;
      }
      case "shape": {
        const def2 = getBlockType(b.typeId);
        this.spawnShape(pr, { life: b.length * p.tempoMs + 400, stickyDefault: true, srcId: b.id }, def2?.label ?? "Alak", b.start);
        break;
      }
      case "text": {
        this.removeBySrc(b.id);
        this.spawn({
          kind: "text", role: "text",
          x: Number(pr.x ?? 50), y: Number(pr.y ?? 20),
          text: String(pr.text ?? "Szöveg"), fontSize: Number(pr.size ?? 28),
          color: String(pr.color ?? "#ffffff"),
          sticky: Boolean(pr.sticky), life: pr.sticky ? null : b.length * p.tempoMs + 400,
          size: Number(pr.size ?? 28),
          srcId: b.id,
        });
        this.emit(b.start, `Szöveg: „${String(pr.text ?? "").slice(0, 24)}”`, "gfx");
        break;
      }
      case "effect": {
        if (b.typeId === "gfx.effect.explosion") {
          this.burst((Number(pr.x) / 100) * W, (Number(pr.y) / 100) * H, Number(pr.count ?? 26), String(pr.color ?? "#fb923c"));
        } else if (b.typeId === "gfx.effect.flash") {
          this.flash = { color: String(pr.color ?? "#ffffff"), t: Number(pr.strength ?? 60) / 100 };
        } else if (b.typeId === "gfx.effect.fireworks") {
          const n = Number(pr.count ?? 3);
          for (let i = 0; i < n; i++) {
            const fx = W * (0.15 + Math.random() * 0.7);
            const fy = H * (0.15 + Math.random() * 0.5);
            const hue = Math.floor(Math.random() * 360);
            setTimeout(() => this.burst(fx, fy, 34, `hsl(${hue} 90% 65%)`, 240), i * 350);
          }
        } else if (b.typeId === "gfx.effect.rain") {
          this.weather = String(pr.mode ?? "on") === "on" ? "rain" : null;
          this.weatherStrength = Number(pr.strength ?? 60) / 100;
          this.emit(b.start, this.weather ? "Eső elindítva" : "Eső leállítva", "gfx");
        } else if (b.typeId === "gfx.effect.snowfall") {
          this.weather = String(pr.mode ?? "on") === "on" ? "snow" : null;
          this.weatherStrength = Number(pr.strength ?? 60) / 100;
          this.emit(b.start, this.weather ? "Hóesés elindítva" : "Hóesés leállítva", "gfx");
        } else if (b.typeId === "gfx.effect.confetti") {
          const n = Number(pr.count ?? 120);
          for (let i = 0; i < n; i++) {
            const hue = Math.floor(Math.random() * 360);
            this.particles.push({
              x: Math.random() * W, y: -10 - Math.random() * H * 0.4,
              vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 140,
              life: 1800 + Math.random() * 1600, maxLife: 3400,
              color: `hsl(${hue} 90% 62%)`, size: 2.5 + Math.random() * 3.5,
            });
          }
          this.emit(b.start, "Konfetti hullik", "gfx");
        } else if (b.typeId === "gfx.effect.lightning") {
          const sx = W * (0.2 + Math.random() * 0.6);
          const pts: number[] = [sx, 0];
          let cx = sx;
          for (let i = 1; i <= 6; i++) {
            cx += (Math.random() - 0.5) * 90;
            pts.push(cx, (i / 6) * H * (0.55 + Math.random() * 0.25));
          }
          this.bolt = { pts, until: performance.now() + 260 };
          this.flash = { color: "#e2e8f0", t: 0.55 };
          audioEngine.playSfx("sfx.thunder", 0.8, vol);
          this.emit(b.start, "Villámlás!", "gfx");
        } else if (b.typeId === "gfx.effect.shake") {
          this.shake = Math.max(this.shake, Number(pr.strength ?? 14));
          this.emit(b.start, "Képernyőrázás", "gfx");
        }
        break;
      }
      case "sfx": {
        audioEngine.playSfx(b.typeId, Number(pr.volume ?? 70) / 100, vol);
        this.emit(b.start, `Hang: ${def?.label ?? b.typeId}`, "sfx");
        break;
      }
      case "music": {
        audioEngine.playMusic(b.typeId, pr, b.length, p.tempoMs, Number(pr.volume ?? 70) / 100, vol);
        this.emit(b.start, `Zene: ${def?.label ?? b.typeId} (${b.length} lépés)`, "sfx");
        break;
      }
      case "keyboard": {
        this.keyboardUntil = performance.now() + b.length * p.tempoMs;
        this.keyboardSpeed = Number(pr.speed ?? 220);
        const mode = String(pr.mode ?? "free");
        this.kbMode = mode === "jump" ? "jump" : mode === "horizontal" ? "horizontal" : "free";
        this.jumpForce = Number(pr.jump ?? 620);
        const modeLabel = this.kbMode === "jump" ? "Ugrálás (gravitáció, Szóköz/↑ = ugrás)" : this.kbMode === "horizontal" ? "Csak vízszintes" : "Szabad (nyilak/WASD, Space = lövés)";
        this.emit(b.start, `Billentyű-irányítás aktív: ${modeLabel}`, "info");
        break;
      }
      case "pointer": {
        this.pointerUntil = performance.now() + b.length * p.tempoMs;
        this.pointerSmooth = Math.max(5, Math.min(100, Number(pr.smooth ?? 70)));
        this.emit(b.start, "Egér/ujj követése aktív – a játékos a mutatót követi", "info");
        break;
      }
      case "choice": {
        const opts = String(pr.options ?? "A,B")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);
        this.activeChoice = {
          question: String(pr.question ?? "Válassz!"),
          options: opts.length > 0 ? opts : ["A", "B"],
          variable: String(pr.variable ?? "valasztas"),
          target: Number(pr.target ?? 0),
          until: performance.now() + Math.max(b.length * p.tempoMs, 6000),
        };
        this.emit(b.start, `Választó gombok: „${this.activeChoice.question}”`, "logic");
        break;
      }
      case "finish": {
        const mode = String(pr.mode ?? "win") === "lose" ? "lose" : "win";
        this.finished = mode;
        this.finishLabel = String(pr.label ?? (mode === "win" ? "Gratulálok!" : "Vesztettél!"));
        this.playing = false;
        this.paused = false;
        if (mode === "win") {
          this.vars["score"] = (this.vars["score"] ?? 0);
          audioEngine.playSfx("sfx.win", 0.9, vol);
          for (let i = 0; i < 3; i++) {
            setTimeout(() => this.burst(W * (0.2 + Math.random() * 0.6), H * 0.4, 40, `hsl(${Math.floor(Math.random() * 360)} 90% 65%)`, 260), i * 280);
          }
          this.emit(b.start, `GYŐZELEM: ${this.finishLabel}`, "logic");
        } else {
          audioEngine.playSfx("sfx.gameover", 0.9, vol);
          this.emit(b.start, `Játék vége: ${this.finishLabel}`, "warn");
        }
        this.onGameOver(this.vars["score"] ?? 0);
        break;
      }
      case "spawner": {
        const until = performance.now() + b.length * p.tempoMs;
        this.spawners.push({
          until,
          nextAt: performance.now() + (Number(pr.every ?? 2) * p.tempoMs),
          everyMs: Math.max(1, Number(pr.every ?? 2)) * p.tempoMs,
          spec: {
            style: String(pr.style ?? "meteor"),
            role: String(pr.role ?? "enemy"),
            move: String(pr.move ?? "fall"),
            speed: Number(pr.speed ?? 80),
            size: Number(pr.size ?? 24),
            color: String(pr.color ?? "#9ca3af"),
            value: Number(pr.value ?? 5),
            randomX: Boolean(pr.randomX ?? true),
          },
        });
        this.emit(b.start, `Rendszeres megjelenítés aktív: ${pr.style} minden ${pr.every}. lépésben (${b.length} lépésen át)`, "logic");
        break;
      }
      case "click": {
        this.clickUntil = performance.now() + b.length * p.tempoMs;
        this.clickMode = String(pr.mode ?? "shoot");
        this.emit(b.start, `Kattintás-esemény aktív (${this.clickMode})`, "info");
        break;
      }
      case "counter": {
        const name = String(pr.variable ?? "kor");
        this.vars[name] = (this.vars[name] ?? 0) + Number(pr.delta ?? 1);
        this.emit(b.start, `${name} = ${this.vars[name]}`, "data");
        break;
      }
      case "check": {
        let cond = true;
        let desc = "";
        if (b.typeId === "logic.random") {
          cond = Math.random() * 100 < Number(pr.chance ?? 50);
          desc = `véletlen (${pr.chance}%) ${cond ? "bekövetkezett" : "nem történt"}`;
        } else {
          const val = this.vars[String(pr.variable ?? "score")] ?? 0;
          const target = Number(pr.value ?? 0);
          const op = String(pr.op ?? ">=");
          cond = op === ">=" ? val >= target : op === "<=" ? val <= target : Math.abs(val - target) < 1e-9;
          desc = `${pr.variable}=${val} ${op} ${target} → ${cond ? "igaz" : "hamis"}`;
        }
        if (cond) {
          const action = String(pr.action ?? "text");
          const av = String(pr.actionValue ?? "");
          if (action === "text") {
            this.spawn({
              kind: "text", role: "text", x: Number(pr.x ?? 50), y: Number(pr.y ?? 50),
              text: av, fontSize: 34, color: "#a3e635", sticky: false, life: 2600, size: 34,
            });
          } else if (action === "jump") {
            this.jumpTo(parseInt(av, 10) || 0);
          } else if (action === "sound") {
            const map: Record<string, string> = {
              laser: "sfx.laser", robbanas: "sfx.explosion", erme: "sfx.coin", pitty: "sfx.blip",
              suhintas: "sfx.swoosh", riasztas: "sfx.alarm", ugras: "sfx.jump", bonusz: "sfx.powerup",
              talalat: "sfx.hurt", gyozelem: "sfx.win", jatek_vege: "sfx.gameover", pukkanas: "sfx.pop",
              kattanas: "sfx.click", mennydorges: "sfx.thunder",
            };
            audioEngine.playSfx(map[av] ?? "sfx.blip", 0.8, vol);
          } else if (action === "clear") {
            this.entities = this.entities.filter((e) => e.role === "player");
          } else if (action === "win") {
            this.finished = "win";
            this.finishLabel = av || "Gratulálok!";
            this.playing = false;
            this.paused = false;
            audioEngine.playSfx("sfx.win", 0.9, vol);
            for (let i = 0; i < 3; i++) {
              setTimeout(() => this.burst(W * (0.2 + Math.random() * 0.6), H * 0.4, 40, `hsl(${Math.floor(Math.random() * 360)} 90% 65%)`, 260), i * 280);
            }
            this.emit(b.start, `GYŐZELEM: ${this.finishLabel}`, "logic");
            this.onGameOver(this.vars["score"] ?? 0);
          } else if (action === "lose") {
            this.finished = "lose";
            this.finishLabel = av || "Vesztettél!";
            this.playing = false;
            this.paused = false;
            audioEngine.playSfx("sfx.gameover", 0.9, vol);
            this.emit(b.start, `Játék vége: ${this.finishLabel}`, "warn");
            this.onGameOver(this.vars["score"] ?? 0);
          } else if (action === "lives") {
            const delta = parseInt(av, 10) || 1;
            this.vars["lives"] = Math.max(0, (this.vars["lives"] ?? 3) + delta);
            audioEngine.playSfx(delta > 0 ? "sfx.powerup" : "sfx.hurt", 0.7, vol);
            this.emit(b.start, `Élet ${delta > 0 ? "+" : ""}${delta} → ${this.vars["lives"]}`, "data");
          } else if (action === "score") {
            const delta = parseInt(av, 10) || 10;
            this.vars["score"] = (this.vars["score"] ?? 0) + delta;
            audioEngine.playSfx("sfx.coin", 0.6, vol);
            this.emit(b.start, `Pont ${delta > 0 ? "+" : ""}${delta} → ${this.vars["score"]}`, "data");
          }
        }
        this.emit(b.start, `Feltétel: ${desc}`, "logic");
        break;
      }
      case "jump": {
        this.jumpTo(Number(pr.target ?? 0));
        this.emit(b.start, `Ugrás a ${pr.target}. lépésre`, "logic");
        break;
      }
      case "clear": {
        const mode = String(pr.mode ?? "enemies");
        if (mode === "all") this.entities = this.entities.filter((e) => e.role === "player");
        else if (mode === "enemies") this.entities = this.entities.filter((e) => e.role !== "enemy");
        else this.entities = this.entities.filter((e) => e.role === "player" || e.role === "enemy");
        this.emit(b.start, `Takarítás (${mode})`, "logic");
        break;
      }
      case "setvar": {
        const name = b.typeId === "data.lives" ? "lives" : String(pr.variable ?? "score");
        this.vars[name] = Number(pr.value ?? 0);
        this.emit(b.start, `${name} = ${pr.value}`, "data");
        break;
      }
      case "save": {
        try { localStorage.setItem(VARS_KEY, JSON.stringify(this.vars)); } catch {}
        this.emit(b.start, "Változók elmentve a böngészőbe", "data");
        break;
      }
      case "load": {
        try {
          const raw = localStorage.getItem(VARS_KEY);
          if (raw) this.vars = { ...this.vars, ...JSON.parse(raw) };
          this.emit(b.start, "Változók betöltve", "data");
        } catch {}
        break;
      }
      case "customImage": {
        if (!asset) { this.emit(b.start, "Hiányzó feltöltött kép", "warn"); break; }
        const img = this.getImage(asset);
        const mode = String(pr.mode ?? "deco");
        if (mode === "bg") {
          if (img) this.bg = { type: "image", image: img };
          this.emit(b.start, `Háttérkép: ${asset.name}`, "gfx");
        } else {
          const role: Role = mode === "player" ? "player" : mode === "enemy" ? "enemy" : mode === "pickup" ? "pickup" : mode === "platform" ? "platform" : "deco";
          if (role === "player") this.entities = this.entities.filter((e) => e.role !== "player");
          this.removeBySrc(b.id);
          const sticky = Boolean(pr.sticky ?? true);
          this.spawn({
            kind: "custom", role,
            x: Number(pr.x ?? 50), y: Number(pr.y ?? 50),
            vx: Number(pr.vx ?? 0), vy: Number(pr.vy ?? 0),
            size: Number(pr.size ?? 40),
            w: Number(pr.size ?? 40) * 1.6,
            h: Number(pr.height ?? 30),
            value: Number(pr.value ?? 5),
            image: img,
            sticky, life: sticky ? null : b.length * p.tempoMs + 400,
            srcId: b.id,
          });
          this.emit(b.start, `Kép megjelenítve: ${asset.name} (${mode})`, "gfx");
        }
        break;
      }
      case "customAudio": {
        if (!asset) { this.emit(b.start, "Hiányzó feltöltött hang", "warn"); break; }
        audioEngine.playDataUrl(asset.dataUrl, Number(pr.volume ?? 80) / 100);
        this.emit(b.start, `Saját hang: ${asset.name}`, "sfx");
        break;
      }
    }
  }

  private jumpTo(step: number) {
    if (this.jumpGuard > 40) return; // örök ciklus védő
    this.jumpGuard++;
    setTimeout(() => (this.jumpGuard = 0), 1500);
    this.step = Math.max(0, Math.min(this.getProject().stepCount - 1, step));
    this.stepDeadline = performance.now() + this.getProject().tempoMs;
    this.lastReportedStep = this.step;
    this.onStep(this.step);
  }

  // ---------- Frissítés ----------
  private update(dt: number, now: number) {
    const player = this.getPlayer();
    const kbActive = now < this.keyboardUntil;

    // ===== Játékos mozgása =====
    if (player && !this.gameOver) {
      // Egér/ujj követése
      if (now < this.pointerUntil) {
        const k = Math.min(1, (this.pointerSmooth / 100) * dt * 12);
        player.x += (this.pointerX - player.x) * k;
        player.y += (this.pointerY - player.y) * k;
        player.x = Math.max(2, Math.min(98, player.x));
        player.y = Math.max(4, Math.min(96, player.y));
      }

      if (kbActive) {
        const dx = (this.keys.has("ArrowLeft") || this.keys.has("a") ? -1 : 0) + (this.keys.has("ArrowRight") || this.keys.has("d") ? 1 : 0);
        const dy = (this.keys.has("ArrowUp") || this.keys.has("w") ? -1 : 0) + (this.keys.has("ArrowDown") || this.keys.has("s") ? 1 : 0);

        if (this.kbMode === "jump") {
          // Ugrálás: vízszintes irányítás + gravitáció + platformokra való leérkezés
          const px = (dx * this.keyboardSpeed * dt / W) * 100;
          const newX = Math.max(2, Math.min(98, player.x + px));
          player.vy += 1400 * dt; // gravitáció
          let newY = player.y + (player.vy * dt / H) * 100;
          player.onGround = false;
          // Platformokra érkezés (csak lefelé esés közben)
          if (player.vy > 0) {
            for (const plat of this.entities.filter((e) => e.role === "platform")) {
              const pl = (plat.x / 100) * W - plat.w / 2;
              const pr2 = (plat.x / 100) * W + plat.w / 2;
              const pt = (plat.y / 100) * H - plat.h / 2;
              const footOld = (player.y / 100) * H + player.size * 0.45;
              const footNew = (newY / 100) * H + player.size * 0.45;
              const pxw = (newX / 100) * W;
              if (footOld <= pt + 6 && footNew >= pt && pxw > pl - 8 && pxw < pr2 + 8) {
                newY = ((pt - player.size * 0.45) / H) * 100;
                player.vy = 0;
                player.onGround = true;
              }
            }
          }
          // Padló (képernyő alja) is platformként működik
          if (newY > 94) { newY = 94; player.vy = 0; player.onGround = true; }
          // Ugrás (él-vezérelt lenyomásra)
          if (this.jumpQueued && player.onGround) {
            player.vy = -this.jumpForce;
            audioEngine.playSfx("sfx.jump", 0.5);
            this.jumpQueued = false;
          }
          if (!player.onGround) this.jumpQueued = false;
          player.x = newX;
          player.y = Math.max(4, newY);
        } else if (this.kbMode === "horizontal") {
          player.x += (dx * this.keyboardSpeed * dt / W) * 100;
          player.x = Math.max(2, Math.min(98, player.x));
          if (this.keys.has(" ")) this.shootAt(player.x, player.y - 30);
        } else {
          // Szabad mozgás minden irányba + lövés
          player.x += (dx * this.keyboardSpeed * dt / W) * 100;
          player.y += (dy * this.keyboardSpeed * dt / H) * 100;
          player.x = Math.max(2, Math.min(98, player.x));
          player.y = Math.max(4, Math.min(96, player.y));
          if (this.keys.has(" ")) this.shootAt(player.x, player.y - 30);
        }
      } else {
        this.jumpQueued = false;
      }
    }

    // ===== Rendszeres megjelenítők (spawner) =====
    for (const sp of this.spawners) {
      while (now >= sp.nextAt && now < sp.until) {
        const s = sp.spec;
        const roleRaw = s.role;
        const move = s.move;
        let vx = 0, vy = 0;
        if (move === "fall") vy = s.speed;
        else if (move === "rise") vy = -s.speed;
        else if (move === "drift") vx = s.speed;
        else if (move === "bounce") { vx = s.speed; vy = s.speed * 0.7; }
        else if (move === "patrol") vx = s.speed;
        else if (move === "wave") { vy = s.speed * 0.5; vx = s.speed; }
        this.spawn({
          kind: "shape", role: roleRaw as Role, style: s.style, move, speed: s.speed,
          x: s.randomX ? 6 + Math.random() * 88 : 50,
          y: move === "fall" ? -6 : move === "rise" ? 105 : 50,
          vx, vy, size: s.size, w: s.size * 1.6, h: 26, value: s.value, color: s.color,
          sticky: false, life: move === "static" || move === "orbit" || move === "patrol" || move === "bounce" ? 14000 : null,
        });
        sp.nextAt += sp.everyMs;
      }
    }
    this.spawners = this.spawners.filter((sp) => now < sp.until);

    // ===== Időjárás részecskék (eső / hó) =====
    if (this.weather && this.playing) {
      const perSec = Math.round(40 + this.weatherStrength * 120);
      const count = Math.max(1, Math.round(perSec * dt));
      for (let i = 0; i < count; i++) {
        if (this.weather === "rain") {
          this.particles.push({
            x: Math.random() * W, y: -8,
            vx: -30, vy: 620 + Math.random() * 160,
            life: 1100, maxLife: 1100, color: "rgba(165,210,255,0.55)", size: 1.1,
          });
        } else {
          this.particles.push({
            x: Math.random() * W, y: -8,
            vx: (Math.random() - 0.5) * 40, vy: 55 + Math.random() * 50,
            life: 7000, maxLife: 7000, color: "rgba(255,255,255,0.85)", size: 1.8 + Math.random() * 1.8,
          });
        }
      }
    }

    // ===== Entitások mozgása (mozgás-viselkedés szerint) =====
    for (const e of this.entities) {
      if (e.role === "player") continue;
      switch (e.move) {
        case "chase": {
          if (player && !this.gameOver) {
            const dxp = ((player.x - e.x) / 100) * W;
            const dyp = ((player.y - e.y) / 100) * H;
            const len = Math.hypot(dxp, dyp) || 1;
            e.vx = (dxp / len) * e.speed;
            e.vy = (dyp / len) * e.speed;
          }
          e.x += (e.vx * dt / W) * 100;
          e.y += (e.vy * dt / H) * 100;
          break;
        }
        case "patrol": {
          // Oda-vissza a kiindulási X körül
          const range = 12 + (e.speed / 400) * 18;
          const t = (now - e.bornAt) / 1000;
          e.x = e.baseX + Math.sin(t * Math.max(0.2, e.speed / 110) + e.phase) * range;
          break;
        }
        case "orbit": {
          const r = 4 + (e.speed / 400) * 16;
          const t = (now - e.bornAt) / 1000;
          e.x = e.baseX + Math.cos(t * Math.max(0.2, e.speed / 90) + e.phase) * r;
          e.y = e.baseY + Math.sin(t * Math.max(0.2, e.speed / 90) + e.phase) * r * 0.7;
          break;
        }
        case "bounce": {
          e.x += (e.vx * dt / W) * 100;
          e.y += (e.vy * dt / H) * 100;
          if (e.x > 96 || e.x < 4) e.vx = -e.vx;
          if (e.y > 92 || e.y < 6) e.vy = -e.vy;
          e.x = Math.max(4, Math.min(96, e.x));
          e.y = Math.max(6, Math.min(92, e.y));
          break;
        }
        case "wave": {
          e.y += (e.vy * dt / H) * 100;
          const t = (now - e.bornAt) / 1000;
          e.x = e.baseX + Math.sin(t * 2.2 + e.phase) * 6;
          break;
        }
        case "static":
        case "orbit2":
          break;
        default: {
          // fall / rise / drift: sima mozgás
          e.x += (e.vx * dt / W) * 100;
          e.y += (e.vy * dt / H) * 100;
          if (e.move === "drift" || e.role === "deco" || e.kind === "cloud") {
            if (e.x > 108) e.x = -8;
            if (e.x < -8) e.x = 108;
          }
          break;
        }
      }
      if (e.spin) e.rotation += e.spinSpeed * dt;
      if (e.life !== null) {
        e.life -= dt * 1000;
      }
    }

    // Lejárt entitások törlése
    this.entities = this.entities.filter((e) => {
      if (e.life !== null && e.life <= 0) return false;
      if (e.role === "enemy" && (e.y * H / 100) > H + 80) return false;
      if (e.role === "pickup" && e.move !== "static" && (e.y * H / 100) > H + 60) return false;
      if (e.role === "projectile" && (e.y < -10 || e.x < -10 || e.x > 110 || (e.y * H / 100) > H + 10)) return false;
      return true;
    });

    // ===== Ütközések =====
    if (!this.gameOver) {
      const projectiles = this.entities.filter((e) => e.role === "projectile");
      for (const proj of [...projectiles]) {
        for (const enemy of this.entities.filter((e) => e.role === "enemy")) {
          if (this.hit(proj, enemy, 0.9)) {
            this.entities = this.entities.filter((x) => x !== proj && x !== enemy);
            this.vars["score"] = (this.vars["score"] ?? 0) + 10;
            this.burst((enemy.x / 100) * W, (enemy.y / 100) * H, 22, "#fb923c", 200);
            audioEngine.playSfx("sfx.explosion", 0.55);
            this.emit(this.step, "Találat! +10 pont", "logic");
            break;
          }
        }
      }
      if (player && now > this.invulnUntil) {
        for (const enemy of this.entities.filter((e) => e.role === "enemy")) {
          if (this.hit(player, enemy, 0.78)) {
            // Ugrálás módban fejről taposás: ha a játékos lefele esik és felülről érkezik
            const stomping = this.kbMode === "jump" && player.vy > 120 && (player.y < enemy.y - 3);
            if (stomping) {
              this.entities = this.entities.filter((x) => x !== enemy);
              this.vars["score"] = (this.vars["score"] ?? 0) + 10;
              player.vy = -this.jumpForce * 0.75; // visszapattan
              this.burst((enemy.x / 100) * W, (enemy.y / 100) * H, 24, "#a3e635", 200);
              audioEngine.playSfx("sfx.pop", 0.8);
              this.emit(this.step, "Lerúgtad! +10 pont", "logic");
            } else {
              this.entities = this.entities.filter((x) => x !== enemy);
              this.vars["lives"] = Math.max(0, (this.vars["lives"] ?? 3) - 1);
              this.invulnUntil = now + 1200;
              this.flash = { color: "#ef4444", t: 0.5 };
              this.shake = 12;
              this.burst((enemy.x / 100) * W, (enemy.y / 100) * H, 30, "#ef4444", 240);
              audioEngine.playSfx("sfx.hurt", 0.85);
              this.emit(this.step, `Találat értek! Életek: ${this.vars["lives"]}`, "warn");
              if (this.vars["lives"] <= 0) {
                this.gameOver = true;
                this.playing = false;
                this.paused = false;
                this.onGameOver(this.vars["score"] ?? 0);
                this.emit(this.step, "JÁTÉK VÉGE", "warn");
              }
            }
            break;
          }
        }
        for (const pick of this.entities.filter((e) => e.role === "pickup")) {
          if (this.hit(player, pick, 1.1)) {
            this.entities = this.entities.filter((x) => x !== pick);
            if (pick.style === "heart" || pick.kind === "custom" && this.isHeartLike(pick)) {
              this.vars["lives"] = (this.vars["lives"] ?? 3) + Math.max(1, pick.value);
              this.burst((pick.x / 100) * W, (pick.y / 100) * H, 16, "#f87171", 120);
              audioEngine.playSfx("sfx.powerup", 0.7);
              this.emit(this.step, `Plusz élet! Életek: ${this.vars["lives"]}`, "logic");
            } else {
              this.vars["score"] = (this.vars["score"] ?? 0) + Math.max(1, pick.value);
              this.burst((pick.x / 100) * W, (pick.y / 100) * H, 16, "#fde047", 120);
              audioEngine.playSfx("sfx.coin", 0.7);
              this.emit(this.step, `Begyűjtve! +${Math.max(1, pick.value)} pont`, "logic");
            }
          }
        }
      }
    }

    // Részecskék
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (this.weather !== "snow") p.vy += 60 * dt;
      p.life -= dt * 1000;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < H + 20);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - 40 * dt);
    if (this.flash) this.flash.t = Math.max(0, this.flash.t - dt * 2.2);
    if (this.bolt && performance.now() > this.bolt.until) this.bolt = null;
    if (this.activeChoice && performance.now() > this.activeChoice.until) this.activeChoice = null;
  }

  private isHeartLike(e: Entity): boolean {
    return e.style === "heart";
  }

  private hit(a: Entity, b: Entity, factor: number): boolean {
    const ax = (a.x / 100) * W, ay = (a.y / 100) * H;
    const bx = (b.x / 100) * W, by = (b.y / 100) * H;
    const r = ((a.size + b.size) / 2) * factor;
    return Math.hypot(ax - bx, ay - by) < r;
  }

  // ---------- Rajzolás ----------
  private render(now: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.drawBg(ctx, now);

    // Entitások
    const invuln = now < this.invulnUntil && Math.floor(now / 90) % 2 === 0;
    for (const e of this.entities) {
      if (e.role === "player" && invuln) continue;
      const x = (e.x / 100) * W;
      const y = (e.y / 100) * H;
      ctx.save();
      ctx.translate(x, y);
      switch (e.kind) {
        case "ship":
          this.drawShip(ctx, e);
          break;
        case "meteor":
          this.drawMeteor(ctx, e);
          break;
        case "star":
          this.drawStar(ctx, e, now);
          break;
        case "cloud":
          this.drawCloud(ctx, e);
          break;
        case "text":
          ctx.font = `700 ${e.fontSize ?? 28}px Geist, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = e.color;
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 12;
          ctx.fillText(e.text ?? "", 0, 0);
          break;
        case "custom":
          if (e.image) {
            const ar = e.image.naturalWidth / e.image.naturalHeight;
            const w = ar >= 1 ? e.size : e.size * ar;
            const h = ar >= 1 ? e.size / ar : e.size;
            ctx.drawImage(e.image, -w / 2, -h / 2, w, h);
          } else {
            ctx.fillStyle = "#fb923c";
            ctx.fillRect(-e.size / 2, -e.size / 2, e.size, e.size);
          }
          break;
        case "shape":
          if (e.role === "platform") this.drawPlatformBox(ctx, e);
          else this.drawShape(ctx, e, now);
          break;
        case "projectile":
          ctx.fillStyle = e.color;
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(0, 0, e.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      ctx.restore();
    }

    // Részecskék
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Villanás
    if (this.flash && this.flash.t > 0) {
      ctx.globalAlpha = Math.min(0.85, this.flash.t);
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Villámlás ága
    if (this.bolt) {
      ctx.strokeStyle = "#f0f9ff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#93c5fd";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(this.bolt.pts[0], this.bolt.pts[1]);
      for (let i = 2; i < this.bolt.pts.length; i += 2) ctx.lineTo(this.bolt.pts[i], this.bolt.pts[i + 1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // HUD
    this.drawHud(ctx);

    // Választó gombok (kvíz / menü)
    if (this.activeChoice) this.drawChoice(ctx, now);

    // Játék vége / győzelem réteg
    if (this.gameOver || (this.finished === "win")) {
      const win = this.finished === "win";
      ctx.fillStyle = win ? "rgba(10,26,6,0.72)" : "rgba(2,2,10,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = win ? "#a3e635" : "#f87171";
      ctx.font = "800 58px Geist, system-ui, sans-serif";
      ctx.fillText(win ? "GYŐZELEM!" : (this.finished === "lose" ? this.finishLabel : "JÁTÉK VÉGE"), W / 2, H / 2 - 30);
      if (win && this.finishLabel) {
        ctx.fillStyle = "#f0fdf4";
        ctx.font = "600 30px Geist, system-ui, sans-serif";
        ctx.fillText(this.finishLabel, W / 2, H / 2 + 24);
      } else if (this.finished === "lose" && this.finishLabel) {
        ctx.fillStyle = "#fecaca";
        ctx.font = "500 22px Geist, system-ui, sans-serif";
        ctx.fillText(this.finishLabel, W / 2, H / 2 - 72);
      } else {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "600 30px Geist, system-ui, sans-serif";
        ctx.fillText(`Végső pontszám: ${this.vars["score"] ?? 0}`, W / 2, H / 2 + 24);
      }
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 19px Geist, system-ui, sans-serif";
      ctx.fillText("Nyomd meg újra a Lejátszás gombot az újrakezdéshez", W / 2, H / 2 + 66);
    }

    // Üres állapot
    if (!this.playing && this.bg.type === "none" && this.entities.length === 0) {
      ctx.fillStyle = "rgba(148,163,184,0.75)";
      ctx.textAlign = "center";
      ctx.font = "500 22px Geist, system-ui, sans-serif";
      ctx.fillText("A kompozíció itt fog életre kelni — nyomd meg a ▶ gombot!", W / 2, H / 2);
    }

    ctx.restore();
  }

  // ---------- Általános alak rajzoló (31 stílus) ----------
  private drawShape(ctx: CanvasRenderingContext2D, e: Entity, now: number) {
    const s = e.size;
    const c = e.color;
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    ctx.fillStyle = c;
    const wob = Math.sin(now / 300 + e.id) * 0.06;
    switch (e.style) {
      case "ship":
        ctx.restore();
        ctx.save();
        ctx.translate((e.x / 100) * W, (e.y / 100) * H);
        this.drawShip(ctx, e);
        break;
      case "meteor":
        ctx.restore();
        ctx.save();
        ctx.translate((e.x / 100) * W, (e.y / 100) * H);
        this.drawMeteor(ctx, e);
        break;
      case "star":
        ctx.restore();
        ctx.save();
        ctx.translate((e.x / 100) * W, (e.y / 100) * H);
        this.drawStar(ctx, e, now);
        break;
      case "cloud":
        ctx.restore();
        ctx.save();
        ctx.translate((e.x / 100) * W, (e.y / 100) * H);
        this.drawCloud(ctx, e);
        break;
      case "ball": {
        const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.1, 0, 0, s / 2);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.25, c);
        g.addColorStop(1, this.shade(c, -30));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "cube": {
        ctx.fillStyle = this.shade(c, 12);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = c;
        ctx.fillRect(-s / 2, -s / 2, s, s * 0.3);
        ctx.strokeStyle = this.shade(c, -25);
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        break;
      }
      case "triangle":
        ctx.beginPath();
        ctx.moveTo(0, -s / 2);
        ctx.lineTo(s / 2, s / 2);
        ctx.lineTo(-s / 2, s / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case "diamond":
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.lineTo(s / 2, 0);
        ctx.lineTo(0, s * 0.55);
        ctx.lineTo(-s / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.shade(c, 35);
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case "heart": {
        const hs = s / 1.6;
        ctx.beginPath();
        ctx.moveTo(0, hs * 0.35);
        ctx.bezierCurveTo(hs, -hs * 0.55, hs * 0.55, -hs * 1.1, 0, -hs * 0.45);
        ctx.bezierCurveTo(-hs * 0.55, -hs * 1.1, -hs, -hs * 0.55, 0, hs * 0.35);
        ctx.fill();
        break;
      }
      case "car": {
        const cw = s * 1.25, ch = s * 0.7;
        ctx.beginPath();
        ctx.moveTo(-cw / 2, ch / 3);
        ctx.lineTo(-cw / 2 + ch * 0.3, -ch / 3);
        ctx.lineTo(cw / 2 - ch * 0.2, -ch / 3);
        ctx.lineTo(cw / 2, ch / 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(-cw * 0.28, ch / 3, ch * 0.22, 0, Math.PI * 2);
        ctx.arc(cw * 0.28, ch / 3, ch * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(224,242,254,0.85)";
        ctx.fillRect(-ch * 0.15, -ch / 3 + 2, ch * 0.55, ch * 0.34);
        break;
      }
      case "fish": {
        ctx.rotate(e.vx < 0 ? Math.PI : 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.5, s * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.45, 0);
        ctx.lineTo(-s * 0.75, -s * 0.22);
        ctx.lineTo(-s * 0.75, s * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(s * 0.22, -s * 0.06, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bird": {
        const flap = Math.sin(now / 140 + e.id) * 0.5 + 0.7;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-s * 0.1, -s * 0.15, s * 0.3, s * 0.13 * flap, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.4, -s * 0.05);
        ctx.lineTo(s * 0.58, 0);
        ctx.lineTo(s * 0.4, s * 0.06);
        ctx.closePath();
        ctx.fillStyle = "#fb923c";
        ctx.fill();
        break;
      }
      case "ghost": {
        const gs = s / 1.4;
        ctx.beginPath();
        ctx.arc(0, -gs * 0.15, gs * 0.52, Math.PI, 0);
        ctx.lineTo(gs * 0.52, gs * 0.42);
        const waves = 3;
        for (let i = 0; i < waves; i++) {
          const x0 = gs * 0.52 - (i * gs * 1.04) / waves;
          const x1 = x0 - gs * 1.04 / (waves * 2);
          ctx.quadraticCurveTo(x0, gs * 0.62, x1, gs * 0.42);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(-gs * 0.18, -gs * 0.18, gs * 0.09, 0, Math.PI * 2);
        ctx.arc(gs * 0.18, -gs * 0.18, gs * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bomb": {
        ctx.beginPath();
        ctx.arc(0, s * 0.06, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.shade(c, 40);
        ctx.lineWidth = s * 0.08;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.32);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.18, -s * 0.58);
        ctx.stroke();
        const spark = 2 + Math.random() * 3;
        ctx.fillStyle = "#fb923c";
        ctx.beginPath();
        ctx.arc(s * 0.18, -s * 0.58, spark, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "coin": {
        const sq = Math.abs(Math.sin(now / 400 + e.id));
        ctx.scale(0.35 + sq * 0.65, 1);
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.shade(c, 30);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = this.shade(c, -25);
        ctx.font = `700 ${Math.max(9, s * 0.5)}px Geist, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", 0, 1);
        break;
      }
      case "apple": {
        ctx.beginPath();
        ctx.arc(-s * 0.13, s * 0.05, s * 0.36, 0, Math.PI * 2);
        ctx.arc(s * 0.13, s * 0.05, s * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#65a30d";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.3);
        ctx.quadraticCurveTo(s * 0.1, -s * 0.5, s * 0.22, -s * 0.48);
        ctx.stroke();
        break;
      }
      case "balloon": {
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.12, s * 0.36, s * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.32);
        ctx.quadraticCurveTo(s * 0.1 + wob * 6, s * 0.45, 0, s * 0.58);
        ctx.stroke();
        break;
      }
      case "snowflake": {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
          ctx.stroke();
          const bx = Math.cos(a) * s * 0.5, by = Math.sin(a) * s * 0.5;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - Math.cos(a + 0.6) * s * 0.16, by - Math.sin(a + 0.6) * s * 0.16);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx - Math.cos(a - 0.6) * s * 0.16, by - Math.sin(a - 0.6) * s * 0.16);
          ctx.stroke();
        }
        break;
      }
      case "flower": {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28, s * 0.18, s * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "tree": {
        ctx.fillStyle = "#78350f";
        ctx.fillRect(-s * 0.08, s * 0.2, s * 0.16, s * 0.34);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.52);
        ctx.lineTo(s * 0.4, s * 0.24);
        ctx.lineTo(-s * 0.4, s * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.24);
        ctx.lineTo(s * 0.48, s * 0.42);
        ctx.lineTo(-s * 0.48, s * 0.42);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "house": {
        ctx.fillStyle = c;
        ctx.fillRect(-s * 0.35, -s * 0.05, s * 0.7, s * 0.45);
        ctx.fillStyle = this.shade(c, -25);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.45);
        ctx.lineTo(s * 0.45, -s * 0.02);
        ctx.lineTo(-s * 0.45, -s * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(-s * 0.1, s * 0.1, s * 0.2, s * 0.22);
        break;
      }
      case "planet": {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.shade(c, 40);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.62, s * 0.2, -0.4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "moon": {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = this.shade(c, -18);
        ctx.beginPath();
        ctx.arc(-s * 0.15, -s * 0.1, s * 0.09, 0, Math.PI * 2);
        ctx.arc(s * 0.14, s * 0.08, s * 0.12, 0, Math.PI * 2);
        ctx.arc(s * 0.02, -s * 0.22, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "rocket": {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.55);
        ctx.quadraticCurveTo(s * 0.22, -s * 0.1, s * 0.18, s * 0.3);
        ctx.lineTo(-s * 0.18, s * 0.3);
        ctx.quadraticCurveTo(-s * 0.22, -s * 0.1, 0, -s * 0.55);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.18, s * 0.12);
        ctx.lineTo(-s * 0.4, s * 0.38);
        ctx.lineTo(-s * 0.18, s * 0.3);
        ctx.moveTo(s * 0.18, s * 0.12);
        ctx.lineTo(s * 0.4, s * 0.38);
        ctx.lineTo(s * 0.18, s * 0.3);
        ctx.fill();
        ctx.fillStyle = "#fb923c";
        const flame = (0.7 + Math.random() * 0.5) * s * 0.3;
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, s * 0.3);
        ctx.lineTo(0, s * 0.3 + flame);
        ctx.lineTo(s * 0.1, s * 0.3);
        ctx.fill();
        break;
      }
      case "ufo": {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -s * 0.16, s * 0.24, Math.PI, 0);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fde047";
        for (let i = -1; i <= 1; i++) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(now / 200 + i));
          ctx.beginPath();
          ctx.arc(i * s * 0.26, s * 0.08, s * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "mushroom": {
        ctx.fillStyle = "#fef9ec";
        ctx.fillRect(-s * 0.16, 0, s * 0.32, s * 0.4);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.42, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = "#fff1f2";
        ctx.beginPath();
        ctx.arc(-s * 0.16, -s * 0.14, s * 0.07, 0, Math.PI * 2);
        ctx.arc(s * 0.14, -s * 0.18, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "egg": {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.32, s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "shield": {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.lineTo(s * 0.42, -s * 0.3);
        ctx.quadraticCurveTo(s * 0.42, s * 0.25, 0, s * 0.5);
        ctx.quadraticCurveTo(-s * 0.42, s * 0.25, -s * 0.42, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.shade(c, 40);
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case "key": {
        ctx.lineWidth = s * 0.14;
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(-s * 0.22, 0, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, 0);
        ctx.lineTo(s * 0.45, 0);
        ctx.moveTo(s * 0.28, 0);
        ctx.lineTo(s * 0.28, s * 0.18);
        ctx.moveTo(s * 0.45, 0);
        ctx.lineTo(s * 0.45, s * 0.2);
        ctx.stroke();
        break;
      }
      case "potion": {
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.arc(0, -s * 0.22, s * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-s * 0.1, -s * 0.34);
        ctx.lineTo(-s * 0.1, -s * 0.12);
        ctx.quadraticCurveTo(-s * 0.4, s * 0.12, 0, s * 0.48);
        ctx.quadraticCurveTo(s * 0.4, s * 0.12, s * 0.1, -s * 0.12);
        ctx.lineTo(s * 0.1, -s * 0.34);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        break;
      }
      case "snowman": {
        ctx.fillStyle = "#e2e8f0";
        ctx.shadowColor = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(0, s * 0.22, s * 0.26, 0, Math.PI * 2);
        ctx.arc(0, -s * 0.14, s * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(-s * 0.06, -s * 0.18, s * 0.025, 0, Math.PI * 2);
        ctx.arc(s * 0.06, -s * 0.18, s * 0.025, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fb923c";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.15);
        ctx.lineTo(s * 0.14, -s * 0.12);
        ctx.lineTo(0, -s * 0.1);
        ctx.fill();
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(-s * 0.14, -s * 0.34, s * 0.28, s * 0.05);
        ctx.fillRect(-s * 0.08, -s * 0.45, s * 0.16, s * 0.12);
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.shadowBlur = 0;
  }

  private drawPlatformBox(ctx: CanvasRenderingContext2D, e: Entity) {
    const w = e.w || e.size * 1.6;
    const h = e.h || 26;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = e.color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-w / 2, -h / 2, w, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
  }

  private drawChoice(ctx: CanvasRenderingContext2D, now: number) {
    const c = this.activeChoice!;
    const n = c.options.length;
    // Paneles háttér
    ctx.fillStyle = "rgba(9,9,15,0.82)";
    ctx.fillRect(0, H * 0.7, W, H * 0.24);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "600 26px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.question, W / 2, H * 0.76);
    const bw = Math.min(30, 88 / n), gap = (92 - n * bw) / (n + 1);
    for (let i = 0; i < n; i++) {
      const bx = (gap + i * (bw + gap)) / 100 * W;
      const by = H * 0.8;
      const bwpx = (bw / 100) * W;
      const bhpx = H * 0.12;
      const hover = Math.sin(now / 300 + i) * 0.5 + 0.5;
      ctx.fillStyle = `hsl(${60 + i * 40} 80% ${45 + hover * 8}%)`;
      ctx.beginPath();
      ctx.roundRect(bx, by, bwpx, bhpx, 10);
      ctx.fill();
      ctx.fillStyle = "#09090f";
      ctx.font = "700 22px Geist, system-ui, sans-serif";
      ctx.fillText(c.options[i], bx + bwpx / 2, by + bhpx / 2);
    }
  }

  private drawShip(ctx: CanvasRenderingContext2D, e: Entity) {
    const s = e.size;
    ctx.rotate(Math.PI);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.lineTo(s / 2, s / 2 * 0.85);
    ctx.lineTo(0, s / 2 * 0.45);
    ctx.lineTo(-s / 2, s / 2 * 0.85);
    ctx.closePath();
    ctx.fill();
    // Láng
    const flame = 0.7 + Math.random() * 0.5;
    ctx.fillStyle = "#fb923c";
    ctx.shadowColor = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(-s / 6, s / 2 * 0.45);
    ctx.lineTo(0, s / 2 * 0.9 * flame + s / 2 * 0.4);
    ctx.lineTo(s / 6, s / 2 * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, e: Entity) {
    const s = e.size;
    ctx.rotate(e.rotation);
    ctx.fillStyle = "#78716c";
    ctx.strokeStyle = "#a8a29e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = (s / 2) * e.poly[i];
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#57534e";
    ctx.beginPath();
    ctx.arc(-s / 6, -s / 8, s / 8, 0, Math.PI * 2);
    ctx.arc(s / 7, s / 9, s / 10, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, e: Entity, now: number) {
    const s = (e.size / 2) * (0.85 + Math.sin(now / 260 + e.id) * 0.15);
    ctx.rotate(Math.sin(now / 900 + e.id) * 0.25);
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.45;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, e: Entity) {
    const s = e.size;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(-s / 3, 0, s / 3.2, 0, Math.PI * 2);
    ctx.arc(0, -s / 6, s / 2.4, 0, Math.PI * 2);
    ctx.arc(s / 3, 0, s / 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const hearts = this.vars["lives"] ?? 0;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "700 24px Geist, system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(`${this.vars["score"] ?? 0} pont`, 24, 32);
    for (let i = 0; i < hearts; i++) {
      const hx = 30 + i * 30;
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.arc(hx - 6, 62, 6, 0, Math.PI * 2);
      ctx.arc(hx + 6, 62, 6, 0, Math.PI * 2);
      ctx.moveTo(hx - 11, 65);
      ctx.lineTo(hx, 76);
      ctx.lineTo(hx + 11, 65);
      ctx.closePath();
      ctx.fill();
    }
    const extra = Object.entries(this.vars).filter(([k]) => !["score", "lives"].includes(k));
    if (extra.length > 0) {
      ctx.font = "500 18px Geist, system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      extra.slice(0, 5).forEach(([k, v], i) => {
        ctx.fillText(`${k}: ${v}`, 24, 100 + i * 26);
      });
    }
    ctx.shadowBlur = 0;
  }

  private drawBg(ctx: CanvasRenderingContext2D, now: number) {
    if (this.bg.type === "color" && this.bg.color) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, this.shade(this.bg.color, 18));
      grad.addColorStop(1, this.bg.color);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.bg.type === "image" && this.bg.image) {
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);
      const img = this.bg.image;
      const ar = img.naturalWidth / img.naturalHeight;
      let w = W, h = W / ar;
      if (h < H) { h = H; w = H * ar; }
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }
    const preset = this.bg.type === "preset" ? this.bg.preset : undefined;
    switch (preset) {
      case "space": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0b0b23");
        g.addColorStop(0.6, "#141033");
        g.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const s of this.starfield) {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(now / 700 + s.tw));
          ctx.globalAlpha = tw;
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "sunset": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#312e81");
        g.addColorStop(0.45, "#9d174d");
        g.addColorStop(0.75, "#ea580c");
        g.addColorStop(1, "#7c2d12");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fde047";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 60;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.68, 74, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case "ocean": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#082f49");
        g.addColorStop(0.5, "#0e7490");
        g.addColorStop(1, "#134e4a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(165,243,252,0.25)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const baseY = H * 0.55 + i * 42;
          for (let x = 0; x <= W; x += 16) {
            const y = baseY + Math.sin(x / 90 + now / 600 + i) * 7;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }
      case "forest": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#14532d");
        g.addColorStop(1, "#052e16");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(5,46,22,0.9)";
        for (let i = 0; i < 7; i++) {
          const tx = 60 + i * 140 + Math.sin(i) * 30;
          const th = 150 + (i % 3) * 60;
          ctx.beginPath();
          ctx.moveTo(tx, H - th);
          ctx.lineTo(tx + 55, H);
          ctx.lineTo(tx - 55, H);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case "neon": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1a0533");
        g.addColorStop(0.55, "#2d0a4e");
        g.addColorStop(1, "#0f0a1f");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // Nap
        ctx.save();
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.42, 95, 0, Math.PI * 2);
        ctx.clip();
        const sg = ctx.createLinearGradient(0, H * 0.42 - 95, 0, H * 0.42 + 95);
        sg.addColorStop(0, "#fbbf24");
        sg.addColorStop(1, "#ec4899");
        ctx.fillStyle = sg;
        ctx.fillRect(W / 2 - 95, H * 0.42 - 95, 190, 190);
        ctx.fillStyle = "#2d0a4e";
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(W / 2 - 95, H * 0.42 - 20 + i * 24, 190, 8);
        }
        ctx.restore();
        // Rács
        ctx.strokeStyle = "#ec4899";
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "#ec4899";
        ctx.shadowBlur = 6;
        const horizon = H * 0.62;
        for (let i = -10; i <= 10; i++) {
          ctx.beginPath();
          ctx.moveTo(W / 2 + i * 46, horizon);
          ctx.lineTo(W / 2 + i * 240, H);
          ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
          const t = (i + ((now / 1400) % 1)) / 8;
          const y = horizon + Math.pow(t, 1.8) * (H - horizon);
          ctx.globalAlpha = 0.3 + t * 0.7;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      }
      case "desert": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#fdba74");
        g.addColorStop(0.55, "#fb923c");
        g.addColorStop(1, "#c2410c");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(W * 0.75, H * 0.25, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(194,65,12,0.85)";
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(W * (0.15 + i * 0.26), H * 0.86, 130 + i * 20, 34 + (i % 2) * 10, 0, Math.PI, 0);
          ctx.fill();
        }
        break;
      }
      case "mountains": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#bae6fd");
        g.addColorStop(1, "#e0f2fe");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const peaks = [[0.18, 0.55, 190], [0.5, 0.42, 240], [0.82, 0.58, 200]];
        for (const [px, py, ph] of peaks) {
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.moveTo(W * px - ph * 0.9, H);
          ctx.lineTo(W * px, H * py);
          ctx.lineTo(W * px + ph * 0.9, H);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.moveTo(W * px - ph * 0.22, H * py + ph * 0.22);
          ctx.lineTo(W * px, H * py);
          ctx.lineTo(W * px + ph * 0.22, H * py + ph * 0.22);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#16a34a";
        ctx.fillRect(0, H * 0.88, W, H * 0.12);
        break;
      }
      case "snow": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1e293b");
        g.addColorStop(0.7, "#64748b");
        g.addColorStop(1, "#cbd5e1");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const s of this.starfield.slice(0, 60)) {
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(now / 500 + s.tw));
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, H * 0.82, W, H * 0.18);
        break;
      }
      case "candy": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#fce7f3");
        g.addColorStop(1, "#fbcfe8");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 8; i++) {
          const hue = (i * 45) % 360;
          ctx.fillStyle = `hsl(${hue} 85% 78%)`;
          ctx.beginPath();
          ctx.arc(W * ((i * 0.13 + 0.05) % 1), H * (0.2 + (i % 3) * 0.22), 26 + (i % 3) * 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#f472b6";
        ctx.fillRect(0, H * 0.85, W, H * 0.15);
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 6;
        for (let x = 0; x < W; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, H);
          ctx.lineTo(x + 24, H * 0.85);
          ctx.stroke();
        }
        break;
      }
      case "underwater": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0e7490");
        g.addColorStop(1, "#083344");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = "rgba(103,232,249,0.18)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 14) {
            const y = (H * 0.2) + i * 70 + Math.sin(x / 80 + now / 700 + i * 2) * 10;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(6,78,59,0.9)";
        for (let i = 0; i < 6; i++) {
          const wx = 40 + i * 170 + Math.sin(i * 3) * 30;
          ctx.beginPath();
          ctx.ellipse(wx, H, 16, 70 + (i % 3) * 30, Math.sin(now / 900 + i) * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "road": {
        ctx.fillStyle = "#14532d";
        ctx.fillRect(0, 0, W, H * 0.35);
        ctx.fillStyle = "#166534";
        ctx.fillRect(0, H * 0.35, W, H * 0.65);
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, H * 0.38, W, H * 0.55);
        ctx.fillStyle = "#facc15";
        for (let y = H * 0.4; y < H; y += 60) {
          const phase = (now / 300) % 60;
          ctx.fillRect(W / 2 - 5, y + phase, 10, 30);
        }
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(0, H * 0.36, W, 6);
        ctx.fillRect(0, H, W, 4);
        break;
      }
      case "city": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#7dd3fc");
        g.addColorStop(1, "#bae6fd");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(W * 0.2, H * 0.2, 46, 0, Math.PI * 2);
        ctx.fill();
        let bx = 0;
        let seed = 13;
        const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        while (bx < W - 20) {
          const bw = 50 + rand() * 70;
          const bh = 120 + rand() * 200;
          ctx.fillStyle = rand() > 0.5 ? "#e2e8f0" : "#94a3b8";
          ctx.fillRect(bx, H - bh, bw, bh);
          ctx.fillStyle = "rgba(15,23,42,0.25)";
          for (let wy = H - bh + 16; wy < H - 20; wy += 28) {
            for (let wx = bx + 10; wx < bx + bw - 14; wx += 22) {
              if (rand() > 0.4) ctx.fillRect(wx, wy, 8, 12);
            }
          }
          bx += bw + 14;
        }
        ctx.fillStyle = "#475569";
        ctx.fillRect(0, H - 26, W, 26);
        break;
      }
      case "moon": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#020617");
        g.addColorStop(0.7, "#0f172a");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const s of this.starfield) {
          ctx.globalAlpha = 0.6 * Math.abs(Math.sin(now / 800 + s.tw)) + 0.2;
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.arc(s.x, s.y * 0.6, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(0, H * 0.7, W, H * 0.3);
        ctx.fillStyle = "#94a3b8";
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.ellipse(W * ((i * 0.16 + 0.07) % 1), H * (0.75 + (i % 3) * 0.08), 20 + (i % 3) * 14, 8 + (i % 2) * 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "night": {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0f172a");
        g.addColorStop(1, "#1e293b");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const s of this.starfield.slice(0, 40)) {
          ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(now / 800 + s.tw));
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(s.x, s.y * 0.5, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
        let bx = 20;
        let seed = 7;
        const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        while (bx < W - 40) {
          const bw = 50 + rand() * 60;
          const bh = 120 + rand() * 190;
          ctx.fillStyle = "#020617";
          ctx.fillRect(bx, H - bh, bw, bh);
          ctx.fillStyle = "rgba(251,191,36,0.75)";
          for (let wy = H - bh + 14; wy < H - 16; wy += 26) {
            for (let wx = bx + 10; wx < bx + bw - 12; wx += 20) {
              if (rand() > 0.55) ctx.fillRect(wx, wy, 7, 10);
            }
          }
          bx += bw + 18;
        }
        break;
      }
      default: {
        ctx.fillStyle = "#09090f";
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  private shade(hex: string, percent: number): string {
    const m = hex.replace("#", "");
    if (m.length !== 6) return hex;
    const n = parseInt(m, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r + 255 * percent / 100));
    g = Math.min(255, Math.round(g + 255 * percent / 100));
    b = Math.min(255, Math.round(b + 255 * percent / 100));
    return `rgb(${r},${g},${b})`;
  }
}

// Modul-szintű példány (csak böngészőben)
let engineRef: RuntimeEngine | null = null;

export function getEngine(): RuntimeEngine | null {
  if (typeof window === "undefined") return null;
  return engineRef;
}

export function initEngine(
  getProject: () => Project,
  callbacks: {
    onEvent: (e: EngineEvent) => void;
    onStep: (s: number) => void;
    onGameOver: (score: number) => void;
  },
): RuntimeEngine {
  if (engineRef) {
    engineRef.destroy();
  }
  engineRef = new RuntimeEngine(getProject, callbacks);
  return engineRef;
}
