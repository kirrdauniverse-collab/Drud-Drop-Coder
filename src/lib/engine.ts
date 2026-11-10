import type { Block, CustomAsset, EngineEvent, Project, Track } from "./types";
import { getBlockType } from "./blocks";
import { audioEngine } from "./audio";

// ===== Futtató motor =====
// Amikor a léptetőfej elér egy blokkot, a motor "kilövi" annak hatását:
// entitást hoz létre, hangot szólaltat meg, változót ír, vagy ugrik.

const W = 960;
const H = 540;
const VARS_KEY = "appmixer.vars.v1";

type Role = "player" | "enemy" | "pickup" | "deco" | "text" | "projectile";

interface Entity {
  id: number;
  kind: "ship" | "meteor" | "star" | "cloud" | "text" | "custom" | "projectile";
  role: Role;
  x: number; // 0..100 %
  y: number; // 0..100 %
  vx: number; // px/s
  vy: number; // px/s
  size: number; // px
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
  private clickUntil = 0;
  private clickMode: string = "shoot";

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
    this.invulnUntil = 0;
    this.keyboardUntil = 0;
    this.clickUntil = 0;
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
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (e.key === " ") e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys.delete(k);
  };

  handleCanvasClick(xPct: number, yPct: number) {
    if (!this.playing || this.paused || performance.now() > this.clickUntil) return;
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
      x: p.x, y: p.y,
      vx: p.vx ?? 0, vy: p.vy ?? 0,
      size: p.size ?? 24,
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
    };
    this.entities.push(e);
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
          this.spawn({
            kind: "star", role: "pickup",
            x: Number(pr.x ?? 50), y: Number(pr.y ?? 40),
            size: Number(pr.size ?? 18), color: "#fde047",
            sticky: true, life: null,
          });
          this.emit(b.start, "Csillag vár gyűjtésre", "gfx");
        } else if (b.typeId === "gfx.sprite.cloud") {
          this.spawn({
            kind: "cloud", role: "deco",
            x: Number(pr.x ?? 20), y: Number(pr.y ?? 25),
            vx: Number(pr.vx ?? 12), size: Number(pr.size ?? 36),
            color: String(pr.color ?? "#e2e8f0"), sticky: true, life: null,
          });
        }
        break;
      }
      case "text": {
        this.spawn({
          kind: "text", role: "text",
          x: Number(pr.x ?? 50), y: Number(pr.y ?? 20),
          text: String(pr.text ?? "Szöveg"), fontSize: Number(pr.size ?? 28),
          color: String(pr.color ?? "#ffffff"),
          sticky: Boolean(pr.sticky), life: pr.sticky ? null : b.length * p.tempoMs + 400,
          size: Number(pr.size ?? 28),
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
        this.emit(b.start, "Billentyű-irányítás aktív (nyilak/WASD, Space=lövés)", "info");
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
            const map: Record<string, string> = { laser: "sfx.laser", robbanas: "sfx.explosion", erme: "sfx.coin", pitty: "sfx.blip", suhintas: "sfx.swoosh", riasztas: "sfx.alarm" };
            audioEngine.playSfx(map[av] ?? "sfx.blip", 0.8, vol);
          } else if (action === "clear") {
            this.entities = this.entities.filter((e) => e.role === "player");
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
          const role: Role = mode === "player" ? "player" : mode === "enemy" ? "enemy" : mode === "pickup" ? "pickup" : "deco";
          if (role === "player") this.entities = this.entities.filter((e) => e.role !== "player");
          this.spawn({
            kind: "custom", role,
            x: Number(pr.x ?? 50), y: Number(pr.y ?? 50),
            vx: Number(pr.vx ?? 0), vy: Number(pr.vy ?? 0),
            size: Number(pr.size ?? 40), image: img,
            sticky: Boolean(pr.sticky ?? true), life: Boolean(pr.sticky ?? true) ? null : b.length * p.tempoMs + 400,
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

    // Játékos mozgása
    if (player && kbActive && !this.gameOver) {
      let dx = 0, dy = 0;
      if (this.keys.has("ArrowLeft") || this.keys.has("a")) dx -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("d")) dx += 1;
      if (this.keys.has("ArrowUp") || this.keys.has("w")) dy -= 1;
      if (this.keys.has("ArrowDown") || this.keys.has("s")) dy += 1;
      player.x += (dx * this.keyboardSpeed * dt / W) * 100;
      player.y += (dy * this.keyboardSpeed * dt / H) * 100;
      player.x = Math.max(2, Math.min(98, player.x));
      player.y = Math.max(4, Math.min(96, player.y));
      if (this.keys.has(" ")) this.shootAt(player.x, player.y - 30);
    }

    // Entitások mozgása
    for (const e of this.entities) {
      if (e.role === "player") continue;
      e.x += (e.vx * dt / W) * 100;
      e.y += (e.vy * dt / H) * 100;
      if (e.spin) e.rotation += e.spinSpeed * dt;
      if (e.kind === "cloud" || e.role === "deco") {
        if (e.x > 108) e.x = -8;
        if (e.x < -8) e.x = 108;
      }
      if (e.life !== null) {
        e.life -= dt * 1000;
      }
    }

    // Lejárt entitások törlése
    this.entities = this.entities.filter((e) => {
      if (e.life !== null && e.life <= 0) return false;
      if (e.role === "enemy" && (e.y * H / 100) > H + 80) return false;
      if (e.role === "projectile" && (e.y < -10 || e.x < -10 || e.x > 110 || (e.y * H / 100) > H + 10)) return false;
      return true;
    });

    // Ütközések
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
            this.entities = this.entities.filter((x) => x !== enemy);
            this.vars["lives"] = Math.max(0, (this.vars["lives"] ?? 3) - 1);
            this.invulnUntil = now + 1200;
            this.flash = { color: "#ef4444", t: 0.5 };
            this.shake = 12;
            this.burst((enemy.x / 100) * W, (enemy.y / 100) * H, 30, "#ef4444", 240);
            audioEngine.playSfx("sfx.explosion", 0.8);
            this.emit(this.step, `Találat értek! Életek: ${this.vars["lives"]}`, "warn");
            if (this.vars["lives"] <= 0) {
              this.gameOver = true;
              this.playing = false;
              this.paused = false;
              this.onGameOver(this.vars["score"] ?? 0);
              this.emit(this.step, "JÁTÉK VÉGE", "warn");
            }
            break;
          }
        }
        for (const pick of this.entities.filter((e) => e.role === "pickup")) {
          if (this.hit(player, pick, 1.1)) {
            this.entities = this.entities.filter((x) => x !== pick);
            this.vars["score"] = (this.vars["score"] ?? 0) + 5;
            this.burst((pick.x / 100) * W, (pick.y / 100) * H, 16, "#fde047", 120);
            audioEngine.playSfx("sfx.coin", 0.7);
            this.emit(this.step, "Csillag begyűjtve! +5 pont", "logic");
          }
        }
      }
    }

    // Részecskék
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.life -= dt * 1000;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.shake > 0) this.shake = Math.max(0, this.shake - 40 * dt);
    if (this.flash) this.flash.t = Math.max(0, this.flash.t - dt * 2.2);
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

    // HUD
    this.drawHud(ctx);

    // Játék vége réteg
    if (this.gameOver) {
      ctx.fillStyle = "rgba(2,2,10,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f87171";
      ctx.font = "800 58px Geist, system-ui, sans-serif";
      ctx.fillText("JÁTÉK VÉGE", W / 2, H / 2 - 30);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "600 30px Geist, system-ui, sans-serif";
      ctx.fillText(`Végső pontszám: ${this.vars["score"] ?? 0}`, W / 2, H / 2 + 24);
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
