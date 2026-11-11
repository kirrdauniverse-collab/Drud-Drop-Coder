import type { Block, CustomAsset, EngineEvent, Project, Track } from "./types";
import { getBlockType } from "./blocks";
import { audioEngine } from "./audio";
import { drawSprite, drawShipSprite, drawMeteorSprite, drawStarSprite, drawCloudSprite, shade } from "./sprites";
import { drawBgPreset, bgPresetLabel } from "./backgrounds";

// ===== Futtató motor =====
// Amikor a léptetőfej elér egy blokkot, a motor "kilövi" annak hatását:
// entitást hoz létre, hangot szólaltat meg, változót ír, vagy ugrik.

const W = 960;
const H = 540;
const VARS_KEY = "appmixer.vars.v1";
const HS_KEY = "appmixer.highscore.";

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
  alpha: number;      // átlátszóság (1 = opak)
  align?: string;     // szöveg igazítása
  fade?: boolean;     // fokozatos beúszás
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
  color2?: string;  // átmenet alsó színe
  dim?: number;     // sötétítés 0..0.8
  image?: HTMLImageElement;
}

// Főmenü-állapot (a léptető megáll, míg a játékos választ)
interface MenuState {
  title: string;
  subtitle: string;
  options: string[];
  targets: number[];   // gordonként hova ugorjon (-1 = csak folytatás)
  variable: string;
}

// Pontlista-állapot (top-10 a böngésző tárolójában)
interface HighscoreState {
  board: string;
  title: string;
  rows: { name: string; score: number }[];
  savedIndex: number;  // az épp mentett sor (kiemeléshez)
  until: number;
  target: number;      // bezáráskor ide ugorjon (-1 = nincs)
}

// Táblás játék (amőba / 3-soros) állapota
interface BoardState {
  size: number;
  winLen: number;
  vsAI: boolean;
  grid: number[];    // 0 üres, 1 = X (te), 2 = O (ellenfél)
  turn: number;
  over: boolean;
  winner: number;    // 0 folyamatban, 1 = X, 2 = O, 3 = döntetlen
  variable: string;
  target: number;
  lastMove: number;
  aiAt: number;
}

function readHS(board: string): { name: string; score: number }[] {
  try {
    const raw = localStorage.getItem(HS_KEY + board);
    return raw ? (JSON.parse(raw) as { name: string; score: number }[]) : [];
  } catch {
    return [];
  }
}

function writeHS(board: string, rows: { name: string; score: number }[]) {
  try { localStorage.setItem(HS_KEY + board, JSON.stringify(rows)); } catch {}
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
  private menu: MenuState | null = null;
  private hs: HighscoreState | null = null;
  private board: BoardState | null = null;
  private spawners: {
    until: number; nextAt: number; everyMs: number;
    spec: { style: string; role: string; move: string; speed: number; size: number; color: string; value: number; randomX: boolean; dir: number; alpha: number; spin: boolean; count: number };
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
    this.menu = null;
    this.hs = null;
    this.board = null;
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
    this.menu = null;
    this.hs = null;
    this.board = null;
    this.onStep(0);
    audioEngine.stopAll();
    this.emit(0, "Megállítva – a képernyő tartalma megmarad", "info");
  }

  // Van-e épp teljes képernyős réteg (menü / pontlista / táblás játék)?
  // A Előnézet panel ez alapján rejti el a ▶ gombot, hogy a rétegre lehessen kattintani.
  overlayActive(): boolean {
    return this.menu !== null || this.hs !== null || this.board !== null;
  }

  // Álljon-e a léptető? (Rétegek + választó gombok alatt megvárjuk a játékost.)
  private stepPaused(now: number): boolean {
    return this.menu !== null || this.hs !== null || this.board !== null
      || (this.activeChoice !== null && now < this.activeChoice.until);
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
    const now = performance.now();
    // 1) Főmenü gombok – a léptető addig áll, míg választasz
    if (this.menu) {
      const rects = this.menuButtonRects();
      const px = (xPct / 100) * W;
      const py = (yPct / 100) * H;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
          const m = this.menu;
          this.menu = null;
          this.vars[m.variable] = i + 1;
          audioEngine.playSfx("sfx.click", 0.8);
          this.emit(this.step, `Menü: „${m.options[i]}” (${m.variable} = ${i + 1})`, "logic");
          const t = m.targets[i] ?? -1;
          if (t >= 0) this.jumpTo(t);
          else this.stepDeadline = now;
          return;
        }
      }
      return; // a menü elnyeli a kattintást
    }
    // 2) Pontlista bezárása (kattintásra)
    if (this.hs) {
      const t = this.hs.target;
      this.hs = null;
      audioEngine.playSfx("sfx.click", 0.6);
      if (t >= 0 && (!this.playing || this.gameOver)) this.restartAt(t);
      else if (t >= 0) { this.jumpTo(t); this.stepDeadline = now; }
      else this.stepDeadline = now;
      return;
    }
    // 3) Táblás játék (amőba / 3-soros)
    if (this.board) {
      this.boardClick(xPct, yPct);
      return;
    }
    if (!this.playing || this.paused) return;
    // 4) Választó gombok kezelése (ha aktív)
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
      alpha: p.alpha ?? 1,
      align: p.align,
      fade: p.fade,
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
    const dir = String(pr.direction ?? "right") === "left" ? -1 : 1;
    const alpha = pr.opacity === undefined ? 1 : Math.max(0.05, Math.min(1, Number(pr.opacity) / 100));
    const spin = Boolean(pr.spin ?? false);
    const count = Math.max(1, Math.min(12, Math.round(Number(pr.count ?? 1))));
    // Iránymozgások (zuhanás / emelkedés / sodródás / hullámzás) NEM halnak el a blokk
    // hosszával: mennek, míg ki nem érnek a képernyőből – így a meteor tényleg lezuhan,
    // a lufi tényleg felszáll. Csak a helyben álló elemek élnek a blokk hosszáig.
    const directional = move === "fall" || move === "rise" || move === "drift" || move === "wave";
    // Mozgásból adódó kezdő sebesség (a futtatókörben a move-vezérlés tartja karban)
    let vx = 0, vy = 0;
    if (move === "fall") vy = speed;
    else if (move === "rise") vy = -speed;
    else if (move === "drift") vx = speed * dir;
    else if (move === "bounce") { vx = speed * dir; vy = speed * 0.7; }
    else if (move === "patrol") vx = speed * dir;
    else if (move === "wave") { vy = speed * 0.5; vx = speed * dir; }
    // Több darab: szétterítve jelenik meg, kis véletlen eltolással
    let e: Entity | undefined;
    for (let i = 0; i < count; i++) {
      const spread = count > 1 ? (i / (count - 1) - 0.5) * 72 : 0;
      const jitter = count > 1 ? (Math.random() - 0.5) * 6 : 0;
      e = this.spawn({
        kind: "shape", role, style, move, speed,
        x: Math.max(-8, Math.min(108, x + spread + jitter)),
        y: y + (count > 1 ? (Math.random() - 0.5) * 8 : 0),
        vx, vy,
        size: Number(pr.size ?? 30),
        w: Number(pr.size ?? 30) * 1.6,
        h: Number(pr.height ?? 26),
        value: Number(pr.value ?? 5),
        color: String(pr.color ?? "#fbbf24"),
        alpha, spin,
        sticky, life: sticky ? null : (directional ? null : opts.life),
        srcId: opts.srcId,
      });
    }
    const ent = e!;
    if (role === "pickup" && style === "heart") ent.value = Math.max(1, Number(pr.value ?? 1));
    const roleLabel = role === "player" ? "Játékos" : role === "enemy" ? "Ellenség" : role === "pickup" ? "Gyűjtendő" : role === "platform" ? "Akadály" : "Dísz";
    const countLabel = count > 1 ? ` ×${count}` : "";
    this.emit(step, `${label}${countLabel} (${roleLabel.toLowerCase()}, ${move})`, role === "platform" ? "logic" : "gfx");
    return ent;
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
    let dx = (xPct / 100) * W - (sx / 100) * W;
    let dy = (yPct / 100) * H - (sy / 100) * H;
    // Ha a cél pont a lövöcskén van (pl. célkereszt-játék), alapból felfelé lőjünk
    if (Math.hypot(dx, dy) < 24) { dx = 0; dy = -1; }
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

    if (this.playing && !this.paused && !this.gameOver && !this.stepPaused(now)) {
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
    } else if (this.stepPaused(now)) {
      // Réteg (menü / pontlista / tábla / kvíz) alatt ne halmozódjanak a lépések:
      // a határidő kövesse a "most"-ot, így bezáráskor azonnal, ugrás nélkül megy tovább.
      this.stepDeadline = now;
    }

    this.update(dt, now);
    this.render(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private fireStep(step: number, p: Project) {
    // A Szóló csak a hangokat némítja el – a grafika és a logika tovább fut
    const anySolo = p.tracks.some((t) => t.solo);
    const audioTrackIds = new Set<string>();
    for (const b of p.blocks) {
      let isAudio = false;
      if (b.typeId.startsWith("custom:")) {
        isAudio = this.findAsset(p, b.typeId.slice(7))?.kind === "audio";
      } else {
        const k = getBlockType(b.typeId)?.kind;
        isAudio = k === "sfx" || k === "music";
      }
      if (isAudio) audioTrackIds.add(b.trackId);
    }
    for (const track of p.tracks) {
      const muted = track.muted || (anySolo && audioTrackIds.has(track.id) && !track.solo);
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

  // A blokk paramétereinek összeolvasztása a blokktípus alapértelmezéseivel:
  // így a régebben mentett projektek és a demók is megkapják az új paramétereket.
  private mergedParams(b: Block): Record<string, string | number | boolean> {
    const def = getBlockType(b.typeId);
    if (!def) return b.params;
    const out: Record<string, string | number | boolean> = { ...b.params };
    for (const pd of def.params) {
      if (out[pd.key] === undefined) out[pd.key] = pd.default;
    }
    return out;
  }

  private applyBlock(b: Block, track: Track, p: Project) {
    const isCustom = b.typeId.startsWith("custom:");
    const def = getBlockType(b.typeId);
    const assetId = isCustom ? b.typeId.slice(7) : undefined;
    const asset = assetId ? this.findAsset(p, assetId) : undefined;
    const kind = isCustom ? (asset?.kind === "audio" ? "customAudio" : "customImage") : def?.kind;
    const pr = this.mergedParams(b);
    const vol = track.volume;

    switch (kind) {
      case "bg": {
        const dim = Math.max(0, Math.min(0.8, Number(pr.dim ?? 0) / 100));
        if (pr.preset !== undefined) {
          // Kész háttér: minden preset külön blokk, de a paraméterben át váltható
          this.bg = { type: "preset", preset: String(pr.preset), dim };
          this.emit(b.start, `Háttér: ${bgPresetLabel(String(pr.preset))}${dim > 0 ? ` (sötétítés ${Math.round(dim * 100)}%)` : ""}`, "gfx");
        } else {
          this.bg = {
            type: "color",
            color: String(pr.color ?? "#1e1b4b"),
            color2: Boolean(pr.gradient) ? String(pr.color2 ?? "#0ea5e9") : undefined,
            dim,
          };
          this.emit(b.start, `Háttérszín beállítva${Boolean(pr.gradient) ? " (átmenettel)" : ""}`, "gfx");
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
          align: String(pr.align ?? "center"),
          fade: Boolean(pr.fade ?? false),
          sticky: Boolean(pr.sticky), life: pr.sticky ? null : b.length * p.tempoMs + 400,
          size: Number(pr.size ?? 28),
          srcId: b.id,
        });
        this.emit(b.start, `Szöveg: „${String(pr.text ?? "").slice(0, 24)}”`, "gfx");
        break;
      }
      case "effect": {
        if (b.typeId === "gfx.effect.explosion") {
          this.burst((Number(pr.x) / 100) * W, (Number(pr.y) / 100) * H, Number(pr.count ?? 26), String(pr.color ?? "#fb923c"), Number(pr.power ?? 180));
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
        if (Boolean(pr.mute)) {
          this.emit(b.start, `Hang lenémítva: ${def?.label ?? b.typeId}`, "sfx");
          break;
        }
        const rate = Math.max(0.25, Math.min(4, Number(pr.speed ?? 100) / 100));
        audioEngine.playSfx(b.typeId, Number(pr.volume ?? 70) / 100, vol, rate);
        this.emit(b.start, `Hang: ${def?.label ?? b.typeId}${rate !== 1 ? ` (${Math.round(rate * 100)}% sebesség)` : ""}`, "sfx");
        break;
      }
      case "music": {
        if (Boolean(pr.mute)) {
          this.emit(b.start, `Zene lenémítva: ${def?.label ?? b.typeId}`, "sfx");
          break;
        }
        const mrate = Math.max(0.25, Math.min(4, Number(pr.speed ?? 100) / 100));
        audioEngine.playMusic(b.typeId, pr, b.length, p.tempoMs, Number(pr.volume ?? 70) / 100, vol, mrate);
        this.emit(b.start, `Zene: ${def?.label ?? b.typeId} (${b.length} lépés${mrate !== 1 ? `, ${Math.round(mrate * 100)}% sebesség` : ""})`, "sfx");
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
          until: performance.now() + Math.max(b.length * p.tempoMs, 9000),
        };
        this.emit(b.start, `Választó gombok: „${this.activeChoice.question}”`, "logic");
        break;
      }
      case "menu": {
        const opts = String(pr.options ?? "Indítás")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);
        const targets = String(pr.targets ?? "")
          .split(",")
          .map((s) => {
            const n = parseInt(s.trim(), 10);
            return Number.isNaN(n) ? -1 : n;
          })
          .slice(0, 4);
        this.menu = {
          title: String(pr.title ?? "FŐMENÜ"),
          subtitle: String(pr.subtitle ?? ""),
          options: opts.length > 0 ? opts : ["Indítás"],
          targets,
          variable: String(pr.variable ?? "menu"),
        };
        this.emit(b.start, `Főmenü: ${this.menu.title} (${this.menu.options.join(" / ")})`, "logic");
        break;
      }
      case "highscore": {
        const boardName = String(pr.board ?? "appmixer");
        if (String(pr.mode ?? "save") === "reset") {
          try { localStorage.removeItem(HS_KEY + boardName); } catch {}
          this.emit(b.start, `Toplista törölve: ${boardName}`, "data");
          break;
        }
        this.showHighscore(
          p,
          boardName,
          String(pr.mode ?? "save") === "save",
          String(pr.title ?? "TOP 10"),
          String(pr.name ?? "Játékos"),
          b.length,
          Number(pr.target ?? -1),
        );
        break;
      }
      case "board": {
        const mode = String(pr.mode ?? "amoba");
        const size = mode === "3soros" ? 3 : Math.max(5, Math.min(15, Math.round(Number(pr.size ?? 12))));
        const winLen = mode === "3soros" ? 3 : 5;
        const vsAI = String(pr.opponent ?? "ai") !== "human";
        this.board = {
          size, winLen, vsAI,
          grid: new Array(size * size).fill(0),
          turn: 1, over: false, winner: 0,
          variable: String(pr.variable ?? "tabla"),
          target: Number(pr.target ?? -1),
          lastMove: -1, aiAt: 0,
        };
        this.emit(
          b.start,
          `Táblás játék indul: ${mode === "3soros" ? "3-soros (3×3)" : `amőba (${size}×${size}, ${winLen}-ös)`} – ${vsAI ? "gép ellen" : "két játékos"}`,
          "logic",
        );
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
        this.autoHighscore();
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
            dir: String(pr.direction ?? "right") === "left" ? -1 : 1,
            alpha: pr.opacity === undefined ? 1 : Math.max(0.05, Math.min(1, Number(pr.opacity) / 100)),
            spin: Boolean(pr.spin ?? false),
            count: Math.max(1, Math.min(6, Math.round(Number(pr.count ?? 1)))),
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
              kattanas: "sfx.click", mennydorges: "sfx.thunder", rugozas: "sfx.boing", harang: "sfx.chime",
              csobbanas: "sfx.splash", dobszolo: "sfx.drumroll", telefon: "sfx.phone", varazs: "sfx.magic",
              buborek: "sfx.bubble", sip: "sfx.whistle", berrego: "sfx.buzzer", kongas: "sfx.ding",
              gepirogas: "sfx.typewriter", motor: "sfx.engine",
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
            this.autoHighscore();
          } else if (action === "lose") {
            this.finished = "lose";
            this.finishLabel = av || "Vesztettél!";
            this.playing = false;
            this.paused = false;
            audioEngine.playSfx("sfx.gameover", 0.9, vol);
            this.emit(b.start, `Játék vége: ${this.finishLabel}`, "warn");
            this.onGameOver(this.vars["score"] ?? 0);
            this.autoHighscore();
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
            alpha: pr.opacity === undefined ? 1 : Math.max(0.05, Math.min(1, Number(pr.opacity) / 100)),
            sticky, life: sticky ? null : b.length * p.tempoMs + 400,
            srcId: b.id,
          });
          this.emit(b.start, `Kép megjelenítve: ${asset.name} (${mode})`, "gfx");
        }
        break;
      }
      case "customAudio": {
        if (!asset) { this.emit(b.start, "Hiányzó feltöltött hang", "warn"); break; }
        if (Boolean(pr.mute)) { this.emit(b.start, `Saját hang lenémítva: ${asset.name}`, "sfx"); break; }
        const crate = Math.max(0.25, Math.min(4, Number(pr.speed ?? 100) / 100));
        audioEngine.playDataUrl(asset.dataUrl, Number(pr.volume ?? 80) / 100, crate);
        this.emit(b.start, `Saját hang: ${asset.name}${crate !== 1 ? ` (${Math.round(crate * 100)}% sebesség)` : ""}`, "sfx");
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

  // Tiszta újraindítás egy adott lépésre (pl. pontlista → főmenü a játék végén)
  private restartAt(step: number) {
    this.entities = [];
    this.particles = [];
    this.spawners = [];
    this.weather = null;
    this.gameOver = false;
    this.finished = null;
    this.finishLabel = "";
    this.invulnUntil = 0;
    this.playing = true;
    this.paused = false;
    this.jumpTo(step);
  }

  // Toplista megjelenítése (és opcionálisan az aktuális pont mentése)
  private showHighscore(
    p: Project,
    boardName: string,
    save: boolean,
    title: string,
    name: string,
    lenSteps: number,
    target: number,
  ) {
    let rows = readHS(boardName);
    let savedIndex = -1;
    if (save) {
      const score = this.vars["score"] ?? 0;
      rows.push({ name, score });
      rows.sort((a, b) => b.score - a.score);
      rows = rows.slice(0, 10);
      savedIndex = rows.findIndex((r) => r.name === name && r.score === score);
      writeHS(boardName, rows);
      this.emit(this.step, `Toplista mentve: ${name} – ${score} pont`, "data");
    } else {
      this.emit(this.step, `Toplista megjelenítve: ${boardName}`, "data");
    }
    this.hs = {
      board: boardName,
      title,
      rows,
      savedIndex,
      until: performance.now() + Math.max(lenSteps * p.tempoMs, 9000),
      target,
    };
  }

  // Ha a projektben van Pontlista blokk, a játék végén automatikusan mentsen és mutassa.
  // Mentős blokkot keresünk először; ha csak "mutatós" van, azt használjuk.
  private autoHighscore() {
    const p = this.getProject();
    const all = p.blocks.filter((x) => x.typeId === "data.highscore");
    if (all.length === 0) return;
    const b =
      all.find((x) => String(this.mergedParams(x).mode ?? "save") === "save") ?? all[0];
    const pr = this.mergedParams(b);
    const mode = String(pr.mode ?? "save");
    if (mode === "reset") return;
    this.showHighscore(
      p,
      String(pr.board ?? "appmixer"),
      mode === "save",
      String(pr.title ?? "TOP 10"),
      String(pr.name ?? "Játékos"),
      16,
      Number(pr.target ?? -1),
    );
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
        else if (move === "drift") vx = s.speed * s.dir;
        else if (move === "bounce") { vx = s.speed * s.dir; vy = s.speed * 0.7; }
        else if (move === "patrol") vx = s.speed * s.dir;
        else if (move === "wave") { vy = s.speed * 0.5; vx = s.speed * s.dir; }
        const baseX = s.randomX ? 6 + Math.random() * 88 : 50;
        const baseY = move === "fall" ? -6 : move === "rise" ? 105 : 50;
        for (let i = 0; i < s.count; i++) {
          const spread = s.count > 1 ? (i / (s.count - 1) - 0.5) * 60 : 0;
          this.spawn({
            kind: "shape", role: roleRaw as Role, style: s.style, move, speed: s.speed,
            x: Math.max(-8, Math.min(108, baseX + spread + (Math.random() - 0.5) * 4)),
            y: baseY + (s.count > 1 ? (Math.random() - 0.5) * 6 : 0),
            vx, vy, size: s.size, w: s.size * 1.6, h: 26, value: s.value, color: s.color,
            alpha: s.alpha, spin: s.spin,
            sticky: false, life: move === "static" || move === "orbit" || move === "patrol" || move === "bounce" ? 14000 : null,
          });
        }
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

    // Lejárt / képernyőn kívülre került entitások törlése
    this.entities = this.entities.filter((e) => {
      if (e.life !== null && e.life <= 0) return false;
      if (e.role === "player" || e.role === "platform") return true;
      if (e.kind === "cloud") return true; // a felhők körbe-körbe sodródnak
      if (e.move === "static" || e.move === "orbit" || e.move === "patrol" || e.move === "chase" || e.move === "bounce") return true;
      if (e.role === "projectile" && (e.y < -10 || e.x < -10 || e.x > 110 || (e.y * H / 100) > H + 10)) return false;
      // Zuhanó / emelkedő / sodródó elemek: ha kiértek a képből, távozzanak
      if (e.y > 120 || e.y < -20 || e.x > 120 || e.x < -20) return false;
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
                this.autoHighscore();
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

    // Lejárt pontlista réteg letakarítása
    if (this.hs && now > this.hs.until) this.hs = null;

    // Gép lépése a táblás játékban (kis "gondolkodási" idő után)
    if (this.board && this.board.vsAI && !this.board.over && this.board.turn === 2 && now >= this.board.aiAt) {
      this.aiMove();
    }
  }

  private isHeartLike(e: Entity): boolean {
    return e.style === "heart";
  }

  // ---------- Táblás játék (amőba / 3-soros) ----------

  // A tábla négyszöge vászon-koordinátákban
  private boardRect(): { x: number; y: number; side: number } {
    const side = Math.min(W * 0.74, H * 0.72);
    return { x: (W - side) / 2, y: (H - side) / 2 + 12, side };
  }

  private cellAt(px: number, py: number): number {
    const b = this.board;
    if (!b) return -1;
    const r = this.boardRect();
    const cell = r.side / b.size;
    const cx = Math.floor((px - r.x) / cell);
    const cy = Math.floor((py - r.y) / cell);
    if (cx < 0 || cx >= b.size || cy < 0 || cy >= b.size) return -1;
    return cy * b.size + cx;
  }

  // A parti végi gombok (Új játék / Tovább) téglalépái
  private boardButtonRects(): { again: { x: number; y: number; w: number; h: number }; next: { x: number; y: number; w: number; h: number } } {
    const bw = 200, bh = 52, gap = 24;
    const y = H * 0.88;
    return {
      again: { x: W / 2 - bw - gap / 2, y, w: bw, h: bh },
      next: { x: W / 2 + gap / 2, y, w: bw, h: bh },
    };
  }

  private boardClick(xPct: number, yPct: number) {
    const b = this.board;
    if (!b) return;
    const now = performance.now();
    const px = (xPct / 100) * W;
    const py = (yPct / 100) * H;
    if (b.over) {
      const rb = this.boardButtonRects();
      const inR = (r: { x: number; y: number; w: number; h: number }) =>
        px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
      if (inR(rb.again)) {
        b.grid = new Array(b.size * b.size).fill(0);
        b.turn = 1;
        b.over = false;
        b.winner = 0;
        b.lastMove = -1;
        b.aiAt = 0;
        audioEngine.playSfx("sfx.click", 0.7);
        this.emit(this.step, "Új parti a táblán", "logic");
        return;
      }
      if (inR(rb.next)) {
        const t = b.target;
        this.board = null;
        audioEngine.playSfx("sfx.click", 0.6);
        if (t >= 0 && (!this.playing || this.gameOver)) this.restartAt(t);
        else if (t >= 0) { this.jumpTo(t); this.stepDeadline = now; }
        else this.stepDeadline = now;
        return;
      }
      return;
    }
    // Gép ellenében a gép lép; két játékos módban mindketten kattintotok
    if (b.turn !== 1 && b.vsAI) return;
    const cell = this.cellAt(px, py);
    if (cell < 0 || b.grid[cell] !== 0) return;
    this.placeMark(cell, b.turn);
  }

  private placeMark(cell: number, p: number) {
    const b = this.board;
    if (!b) return;
    b.grid[cell] = p;
    b.lastMove = cell;
    audioEngine.playSfx(p === 1 ? "sfx.click" : "sfx.pop", 0.5);
    if (this.boardWin(cell, p)) {
      b.over = true;
      b.winner = p;
      this.vars[b.variable] = p;
      if (p === 1) {
        this.vars["score"] = (this.vars["score"] ?? 0) + 100;
        audioEngine.playSfx("sfx.win", 0.8);
        this.burst(W / 2, H * 0.2, 42, "#a3e635", 240);
        this.emit(this.step, "Győztél a táblán! +100 pont", "logic");
      } else {
        audioEngine.playSfx("sfx.gameover", 0.7);
        this.emit(this.step, b.vsAI ? "A gép nyerte a partit!" : "A 2. játékos nyert!", "warn");
      }
    } else if (b.grid.every((v) => v !== 0)) {
      b.over = true;
      b.winner = 3;
      this.vars[b.variable] = 3;
      this.vars["score"] = (this.vars["score"] ?? 0) + 25;
      audioEngine.playSfx("sfx.chime", 0.7);
      this.emit(this.step, "Döntetlen! +25 pont", "logic");
    } else {
      b.turn = p === 1 ? 2 : 1;
      if (b.vsAI && b.turn === 2) b.aiAt = performance.now() + 550;
    }
  }

  // Győztes sor ellenőrzése a (cell) mező körül
  private boardWin(cell: number, p: number): boolean {
    const b = this.board;
    if (!b) return false;
    const size = b.size, wl = b.winLen;
    const r = Math.floor(cell / size), c = cell % size;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
      let cnt = 1;
      for (let s = 1; s < wl; s++) {
        const rr = r + dr * s, cc = c + dc * s;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size || b.grid[rr * size + cc] !== p) break;
        cnt++;
      }
      for (let s = 1; s < wl; s++) {
        const rr = r - dr * s, cc = c - dc * s;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size || b.grid[rr * size + cc] !== p) break;
        cnt++;
      }
      if (cnt >= wl) return true;
    }
    return false;
  }

  // Egyszerű, de okos gép: azonnal nyer, ha tud; blokkol, ha kell;
  // egyébként a legígéretesebb mezőt választja (saját + ellenfél vonalak, középre törekvés).
  private aiMove() {
    const b = this.board;
    if (!b || b.over || b.turn !== 2) return;
    const size = b.size, wl = b.winLen;

    const lineScore = (cell: number, p: number): number => {
      const r = Math.floor(cell / size), c = cell % size;
      let total = 0;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
        let cnt = 1, open = 2;
        for (let s = 1; s < wl; s++) {
          const rr = r + dr * s, cc = c + dc * s;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) { open--; break; }
          const v = b.grid[rr * size + cc];
          if (v === p) cnt++;
          else { if (v !== 0) open--; break; }
        }
        for (let s = 1; s < wl; s++) {
          const rr = r - dr * s, cc = c - dc * s;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) { open--; break; }
          const v = b.grid[rr * size + cc];
          if (v === p) cnt++;
          else { if (v !== 0) open--; break; }
        }
        if (cnt >= wl) return 1e9;
        if (open > 0) total += cnt * cnt * cnt;
      }
      return total;
    };

    let best = -1, bestScore = -Infinity;
    for (let cell = 0; cell < b.grid.length; cell++) {
      if (b.grid[cell] !== 0) continue;
      const own = lineScore(cell, 2);
      const foe = lineScore(cell, 1);
      if (own >= 1e9) { best = cell; break; } // azonnali győzelem
      let score = own + foe * 0.85;
      if (foe >= 1e9) score += 5e8; // blokkolás kényszer
      const r = Math.floor(cell / size), c = cell % size;
      const mid = (size - 1) / 2;
      score -= (Math.abs(r - mid) + Math.abs(c - mid)) * 2; // középre törekvés
      score += Math.random() * 4;
      if (score > bestScore) { bestScore = score; best = cell; }
    }
    if (best >= 0) this.placeMark(best, 2);
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
      // Átlátszóság és beúszás kezelése
      this.applyEntityAlpha(ctx, e, now);
      switch (e.kind) {
        case "ship":
          drawShipSprite(ctx, e.size, e.color);
          break;
        case "meteor":
          ctx.rotate(e.rotation);
          drawMeteorSprite(ctx, e.size, e.poly);
          break;
        case "star":
          drawStarSprite(ctx, e.size, e.id, now);
          break;
        case "cloud":
          drawCloudSprite(ctx, e.size, e.color);
          break;
        case "text":
          ctx.font = `700 ${e.fontSize ?? 28}px Geist, system-ui, sans-serif`;
          ctx.textAlign = e.align === "left" ? "left" : e.align === "right" ? "right" : "center";
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
          else drawSprite(ctx, e.style, {
            size: e.size, color: e.color, vx: e.vx, id: e.id, now,
            rotation: e.spin ? e.rotation : 0, poly: e.poly,
          });
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

    // Játék vége / győzelem réteg (a menü/pontlista még fölé kerül)
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
      if (!this.hs) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 19px Geist, system-ui, sans-serif";
        ctx.fillText("Nyomd meg újra a Lejátszás gombot az újrakezdéshez", W / 2, H / 2 + 66);
      }
    }

    // Választó gombok (kvíz / menü)
    if (this.activeChoice) this.drawChoice(ctx, now);

    // Rétegek: táblás játék → főmenü → pontlista (a pontlista legfelül)
    if (this.board) this.drawBoard(ctx, now);
    if (this.menu) this.drawMenu(ctx, now);
    if (this.hs) this.drawHighscore(ctx);

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
  // Entitás átlátszóság + beúszás alkalmazása (a drawShape klasszikus ágai is használják,
  // mert ott a ctx.restore() után újra kell állítani)
  private applyEntityAlpha(ctx: CanvasRenderingContext2D, e: Entity, now: number) {
    let a = e.alpha;
    if (e.fade) a *= Math.min(1, (now - e.bornAt) / 500);
    if (a < 1) ctx.globalAlpha = Math.max(0.03, a);
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

  // ---------- Főmenü / pontlista / tábla rajzolói ----------

  // A menügombok téglalépei vászon-koordinátákban
  private menuButtonRects(): { x: number; y: number; w: number; h: number }[] {
    const m = this.menu;
    if (!m) return [];
    const bw = Math.min(460, W * 0.5), bh = 62, gap = 20;
    const y0 = H * 0.42;
    return m.options.map((_, i) => ({
      x: (W - bw) / 2,
      y: y0 + i * (bh + gap),
      w: bw,
      h: bh,
    }));
  }

  private drawMenu(ctx: CanvasRenderingContext2D, now: number) {
    const m = this.menu;
    if (!m) return;
    ctx.fillStyle = "rgba(9,9,15,0.8)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // cím
    const pulse = 0.5 + Math.sin(now / 600) * 0.5;
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 24 + pulse * 14;
    ctx.font = "800 56px Geist, system-ui, sans-serif";
    ctx.fillText(m.title.toUpperCase(), W / 2, H * 0.2);
    ctx.shadowBlur = 0;
    if (m.subtitle) {
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "500 22px Geist, system-ui, sans-serif";
      ctx.fillText(m.subtitle, W / 2, H * 0.31);
    }
    // gombok (egér fölött világítanak)
    const rects = this.menuButtonRects();
    const px = (this.pointerX / 100) * W;
    const py = (this.pointerY / 100) * H;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const hover = px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
      ctx.fillStyle = hover ? "#fbbf24" : `rgba(251,191,36,${0.32 + i * 0.08})`;
      ctx.strokeStyle = hover ? "#fde68a" : "rgba(251,191,36,0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hover ? "#09090f" : "#fde68a";
      ctx.font = "700 26px Geist, system-ui, sans-serif";
      ctx.fillText(m.options[i], r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.fillStyle = "#71717a";
    ctx.font = "500 17px Geist, system-ui, sans-serif";
    ctx.fillText("Kattints a kiválasztott gombra", W / 2, H * 0.92);
  }

  private drawHighscore(ctx: CanvasRenderingContext2D) {
    const h = this.hs;
    if (!h) return;
    ctx.fillStyle = "rgba(9,9,15,0.9)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 42px Geist, system-ui, sans-serif";
    ctx.fillText(h.title, W / 2, H * 0.13);
    if (h.rows.length === 0) {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "500 24px Geist, system-ui, sans-serif";
      ctx.fillText("Még nincs pontszám – legyél az első!", W / 2, H * 0.5);
    } else {
      const y0 = H * 0.24, lh = Math.min(40, (H * 0.58) / h.rows.length);
      ctx.textAlign = "left";
      for (let i = 0; i < h.rows.length; i++) {
        const r = h.rows[i];
        const y = y0 + i * lh;
        const hl = i === h.savedIndex;
        if (hl) {
          ctx.fillStyle = "rgba(251,191,36,0.16)";
          ctx.fillRect(W * 0.2, y - lh / 2 + 2, W * 0.6, lh - 4);
        }
        ctx.fillStyle = hl ? "#fbbf24" : "#d4d4d8";
        ctx.font = hl ? "700 23px Geist, system-ui, sans-serif" : "500 22px Geist, system-ui, sans-serif";
        ctx.fillText(`${i + 1}.  ${r.name}`, W * 0.24, y);
        ctx.textAlign = "right";
        ctx.fillText(`${r.score}`, W * 0.76, y);
        if (hl) {
          ctx.textAlign = "left";
          ctx.fillStyle = "#fbbf24";
          ctx.font = "600 15px Geist, system-ui, sans-serif";
          ctx.fillText("← most", W * 0.78, y);
        }
        ctx.textAlign = "left";
      }
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#71717a";
    ctx.font = "500 18px Geist, system-ui, sans-serif";
    ctx.fillText(h.target >= 0 ? "Kattints a visszatéréshez" : "Kattints a folytatáshoz", W / 2, H * 0.93);
  }

  private drawBoard(ctx: CanvasRenderingContext2D, now: number) {
    const b = this.board;
    if (!b) return;
    ctx.fillStyle = "rgba(9,9,15,0.88)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Cím és sorrend-jelzés
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "700 26px Geist, system-ui, sans-serif";
    const label = b.winLen === 3 ? "3-soros" : `Amőba (${b.size}×${b.size}, ${b.winLen}-es)`;
    ctx.fillText(`${label} – Te: X ${b.vsAI ? "· Gép: O" : "· 2. játékos: O"}`, W / 2, H * 0.085);

    // Tábla
    const r = this.boardRect();
    ctx.fillStyle = "#18181b";
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(r.x - 10, r.y - 10, r.side + 20, r.side + 20, 12);
    ctx.fill();
    ctx.stroke();
    const cell = r.side / b.size;
    ctx.strokeStyle = "rgba(82,82,91,0.55)";
    ctx.lineWidth = 1;
    for (let i = 1; i < b.size; i++) {
      ctx.beginPath();
      ctx.moveTo(r.x + i * cell, r.y);
      ctx.lineTo(r.x + i * cell, r.y + r.side);
      ctx.moveTo(r.x, r.y + i * cell);
      ctx.lineTo(r.x + r.side, r.y + i * cell);
      ctx.stroke();
    }

    // Egér alatti cella halvány jelzése
    if (!b.over && b.turn === 1) {
      const px = (this.pointerX / 100) * W;
      const py = (this.pointerY / 100) * H;
      const c = this.cellAt(px, py);
      if (c >= 0 && b.grid[c] === 0) {
        const cx = r.x + (c % b.size) * cell;
        const cy = r.y + Math.floor(c / b.size) * cell;
        ctx.fillStyle = "rgba(34,211,238,0.14)";
        ctx.fillRect(cx, cy, cell, cell);
      }
    }

    // Jelek
    const pad = cell * 0.24;
    for (let i = 0; i < b.grid.length; i++) {
      const v = b.grid[i];
      if (v === 0) continue;
      const cx = r.x + (i % b.size) * cell + cell / 2;
      const cy = r.y + Math.floor(i / b.size) * cell + cell / 2;
      if (v === 1) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = Math.max(2.5, cell * 0.11);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - cell / 2 + pad, cy - cell / 2 + pad);
        ctx.lineTo(cx + cell / 2 - pad, cy + cell / 2 - pad);
        ctx.moveTo(cx + cell / 2 - pad, cy - cell / 2 + pad);
        ctx.lineTo(cx - cell / 2 + pad, cy + cell / 2 - pad);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = Math.max(2.5, cell * 0.11);
        ctx.beginPath();
        ctx.arc(cx, cy, cell / 2 - pad, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (i === b.lastMove) {
        ctx.strokeStyle = "rgba(251,191,36,0.5)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(r.x + (i % b.size) * cell + 1, r.y + Math.floor(i / b.size) * cell + 1, cell - 2, cell - 2);
      }
    }

    // Állapotsáv / eredmény
    if (!b.over) {
      ctx.fillStyle = b.turn === 1 ? "#22d3ee" : "#fb7185";
      ctx.font = "600 22px Geist, system-ui, sans-serif";
      const dots = Math.floor(now / 400) % 3;
      ctx.fillText(
        b.turn === 1 ? "Te jössz (X) – kattints egy mezőre" : `${b.vsAI ? "A gép gondolkodik" : "2. játékos (O)"}${".".repeat(dots)}`,
        W / 2, H * 0.945,
      );
    } else {
      const msg = b.winner === 1 ? "GYŐZTÉL! +100 pont" : b.winner === 3 ? "Döntetlen! +25 pont" : (b.vsAI ? "A gép nyert!" : "A 2. játékos nyert!");
      ctx.fillStyle = b.winner === 1 ? "#a3e635" : b.winner === 3 ? "#fbbf24" : "#f87171";
      ctx.font = "800 34px Geist, system-ui, sans-serif";
      ctx.fillText(msg, W / 2, H * 0.845);
      const rb = this.boardButtonRects();
      const px = (this.pointerX / 100) * W;
      const py = (this.pointerY / 100) * H;
      for (const [rect, text, col] of [
        [rb.again, "Új játék", "#22d3ee"],
        [rb.next, b.target >= 0 ? "Tovább →" : "Kilépés", "#fbbf24"],
      ] as const) {
        const hover = px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
        ctx.fillStyle = hover ? col : "rgba(24,24,27,0.9)";
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = hover ? "#09090f" : col;
        ctx.font = "700 21px Geist, system-ui, sans-serif";
        ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }
    }
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
    this.drawBgBase(ctx, now);
    // Sötétítés: a sprite-ok és feliratok így előreugranak
    if (this.bg.dim && this.bg.dim > 0) {
      ctx.globalAlpha = this.bg.dim;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  private drawBgBase(ctx: CanvasRenderingContext2D, now: number) {
    if (this.bg.type === "color" && this.bg.color) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      if (this.bg.color2) {
        grad.addColorStop(0, this.bg.color);
        grad.addColorStop(1, this.bg.color2);
      } else {
        grad.addColorStop(0, shade(this.bg.color, 18));
        grad.addColorStop(1, this.bg.color);
      }
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
    // Előre definiált hátterek a közös modulból (ua. mint a könyvtár-előnézetben)
    drawBgPreset(ctx, this.bg.type === "preset" ? (this.bg.preset ?? "space") : "none", now, this.starfield);
  }}

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
