// ===== ÉPÍTŐMESTER – kattintásos építőjáték =====
// Rakj elemeket a rácsra a palettáról (1–8 vagy kattintás), és teljesítsd a
// célt: építs házat / kastélyt! A jobb felső lista mutatja, mi kell még.
// Pontot kapsz minden lerakott elemért, a kész cél nagy bónuszt hoz.

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, inRect } from "./base";

type PieceId = "fal" | "topo" | "ajto" | "ablak" | "fa" | "ut" | "lampa" | "viral" | "torol";

interface PieceDef {
  id: PieceId;
  label: string;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, now: number) => void;
}

const COLS = 16;
const ROWS = 8;
const CELL = 60;
const GRID_Y = 0;
const HUD_H = GH - ROWS * CELL; // 60 px

// Alsó sáv geometria (közös a rajzoláshoz és a kattintáshoz!)
function slotX(i: number): number { return 8 + i * 76; }
const SLOT_W = 72;
const BTN_DONE = { x: 700, y: 6, w: 118, h: 48 };
const BTN_EXIT = { x: 826, y: 6, w: 126, h: 48 };

function drawBricks(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#b45309";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "rgba(120,53,15,0.9)";
  ctx.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + (r * s) / 4);
    ctx.lineTo(x + s, y + (r * s) / 4);
    ctx.stroke();
    for (let c = 0; c < 2; c++) {
      const off = r % 2 === 0 ? s / 4 : (s * 3) / 4;
      ctx.beginPath();
      ctx.moveTo(x + off + c * s / 2 - s / 4, y + (r * s) / 4);
      ctx.lineTo(x + off + c * s / 2 - s / 4, y + ((r + 1) * s) / 4);
      ctx.stroke();
    }
  }
}

function drawRoof(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x + s / 2, y);
  ctx.lineTo(x + s, y + s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(127,29,29,0.9)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (s * i) / 8, y + s - (s * i) / 4);
    ctx.lineTo(x + s - (s * i) / 8, y + s - (s * i) / 4);
    ctx.stroke();
  }
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 4, s - 12, s - 4, 6);
  ctx.fill();
  ctx.strokeStyle = "#431407";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(x + s - 17, y + s / 2, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 10, s - 16, s - 22, 5);
  ctx.fill();
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + 12); ctx.lineTo(x + s / 2, y + s - 14);
  ctx.moveTo(x + 10, y + s / 2 - 1); ctx.lineTo(x + s - 10, y + s / 2 - 1);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(x + 12, y + s - 14);
  ctx.lineTo(x + s / 2 - 4, y + 14);
  ctx.lineTo(x + s / 2 + 6, y + 14);
  ctx.lineTo(x + 20, y + s - 14);
  ctx.closePath();
  ctx.fill();
}

function drawTreeCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, now: number) {
  const sway = Math.sin(now / 900 + x) * 2;
  ctx.fillStyle = "#78350f";
  ctx.fillRect(x + s / 2 - 4, y + s / 2, 8, s / 2 - 4);
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(x + s / 2 + sway, y + s / 2 - 8, s / 3.4, 0, Math.PI * 2);
  ctx.arc(x + s / 2 - 9 + sway, y + s / 2 + 2, s / 4.6, 0, Math.PI * 2);
  ctx.arc(x + s / 2 + 9 + sway, y + s / 2 + 2, s / 4.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoad(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#52525b";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 9]);
  ctx.beginPath();
  ctx.moveTo(x, y + s / 2);
  ctx.lineTo(x + s, y + s / 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, now: number) {
  ctx.fillStyle = "#3f3f46";
  ctx.fillRect(x + s / 2 - 2.5, y + 14, 5, s - 22);
  const glow = 0.65 + Math.sin(now / 300) * 0.12;
  ctx.fillStyle = `rgba(253,224,71,${glow})`;
  ctx.shadowColor = "#fde047";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x + s / 2, y + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(x + s / 2 - 2, y + s / 2, 4, s / 2 - 6);
  const cols = ["#f472b6", "#fbbf24", "#c084fc"];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.fillStyle = cols[(x + i) % 3];
    ctx.beginPath();
    ctx.arc(x + s / 2 + Math.cos(a) * 7, y + s / 2 - 6 + Math.sin(a) * 7, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2 - 6, 4, 0, Math.PI * 2);
  ctx.fill();
}

const PIECES: PieceDef[] = [
  { id: "fal", label: "Fal", draw: (c, x, y, s) => drawBricks(c, x, y, s) },
  { id: "topo", label: "Tető", draw: (c, x, y, s) => drawRoof(c, x, y, s) },
  { id: "ajto", label: "Ajtó", draw: (c, x, y, s) => drawDoor(c, x, y, s) },
  { id: "ablak", label: "Ablak", draw: (c, x, y, s) => drawWindow(c, x, y, s) },
  { id: "fa", label: "Fa", draw: (c, x, y, s, now) => drawTreeCell(c, x, y, s, now) },
  { id: "ut", label: "Út", draw: (c, x, y, s) => drawRoad(c, x, y, s) },
  { id: "lampa", label: "Lámpa", draw: (c, x, y, s, now) => drawLamp(c, x, y, s, now) },
  { id: "viral", label: "Virág", draw: (c, x, y, s) => drawFlower(c, x, y, s) },
];

const GOALS: Record<string, { title: string; winLabel: string; req: Partial<Record<PieceId, number>>; bonus: number }> = {
  haz: { title: "ÉPÍTS HÁZAT!", winLabel: "A ház felépült – remek munka!", req: { fal: 8, topo: 4, ajto: 1, ablak: 2 }, bonus: 50 },
  kastely: { title: "ÉPÍTS KASTÉLYT!", winLabel: "A kastély felépült – mesés!", req: { fal: 20, topo: 10, ajto: 2, ablak: 4 }, bonus: 120 },
};

export class BuildGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private goal: keyof typeof GOALS | null;
  private grid: (PieceId | null)[][] = [];
  private counts: Partial<Record<PieceId, number>> = {};
  private sel = 0; // paletta index (utolsó = törlő)
  private done = false;
  private over = false;
  private goalReached = false;
  private timeLimit: number;
  private timeLeft: number;
  private startedAt = performance.now();
  private flash = { x: -1, y: -1, at: 0 };
  private msg = "Válassz elemet a palettáról (vagy 1–8), és kattints a rácsra!";
  private msgAt = 0;

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    const g = String(pr.goal ?? "haz");
    this.goal = g === "szabad" ? null : g in GOALS ? (g as keyof typeof GOALS) : "haz";
    this.timeLimit = Number(pr.timeLimit ?? 0);
    this.timeLeft = this.timeLimit;
    for (let y = 0; y < ROWS; y++) this.grid.push(new Array<PieceId | null>(COLS).fill(null));
    ctx.emit(`Építőmód indul – ${this.goal ? `cél: ${GOALS[this.goal].title}` : "szabad építkezés"}`, "logic");
  }

  isDone() { return this.done; }

  private setMsg(m: string, now: number) {
    this.msg = m;
    this.msgAt = now;
  }

  click(xPct: number, yPct: number, now: number) {
    if (this.over) return;
    const px = (xPct / 100) * GW;
    const py = (yPct / 100) * GH;

    // paletta
    if (py >= GH - HUD_H && py <= GH) {
      for (let i = 0; i <= PIECES.length; i++) {
        const bx = slotX(i);
        if (inRect(px, py, bx, GH - HUD_H + 6, SLOT_W, HUD_H - 12)) {
          this.sel = i;
          this.ctx.sfx("sfx.click", 0.6);
          return;
        }
      }
      // Kész / Kilépés gombok
      if (inRect(px, py, BTN_DONE.x, GH - HUD_H + BTN_DONE.y, BTN_DONE.w, BTN_DONE.h)) {
        if (this.goalReached || !this.goal) {
          this.over = true;
          this.done = true;
          const label = this.goal
            ? GOALS[this.goal].winLabel
            : "Remek alkotás született!";
          this.ctx.finish(true, label, this.target);
        } else {
          this.setMsg("Még nem kész a cél – nézd a listát jobb felül!", now);
          this.ctx.sfx("sfx.buzzer", 0.5);
        }
        return;
      }
      if (inRect(px, py, BTN_EXIT.x, GH - HUD_H + BTN_EXIT.y, BTN_EXIT.w, BTN_EXIT.h)) {
        this.over = true;
        this.done = true;
        this.ctx.finish(false, "Félbehagytad az építkezést", this.target);
        return;
      }
      return;
    }

    // rács
    const cx = Math.floor(px / CELL);
    const cy = Math.floor((py - GRID_Y) / CELL);
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return;
    if (this.sel === PIECES.length) {
      // törlő
      if (this.grid[cy][cx]) {
        const id = this.grid[cy][cx]!;
        this.counts[id] = Math.max(0, (this.counts[id] ?? 0) - 1);
        this.grid[cy][cx] = null;
        this.ctx.sfx("sfx.pop", 0.6);
      }
      return;
    }
    if (this.grid[cy][cx] === null) {
      const id = PIECES[this.sel].id;
      this.grid[cy][cx] = id;
      this.counts[id] = (this.counts[id] ?? 0) + 1;
      this.ctx.addScore(2);
      this.ctx.sfx("sfx.click", 0.55);
      this.checkGoal(now);
    } else {
      this.flash = { x: cx, y: cy, at: now };
      this.ctx.sfx("sfx.buzzer", 0.4);
      this.setMsg("Oda már raktál valamit – előbb töröld ki a radírral!", now);
    }
  }

  private checkGoal(now: number) {
    if (!this.goal || this.goalReached) return;
    const g = GOALS[this.goal];
    const ok = Object.entries(g.req).every(([k, n]) => (this.counts[k as PieceId] ?? 0) >= (n as number));
    if (ok) {
      this.goalReached = true;
      this.ctx.addScore(g.bonus);
      this.ctx.sfx("sfx.win", 0.9);
      this.ctx.burst(GW / 2, GH / 2, 60, "#fbbf24", 260);
      this.setMsg(`CÉL TELJESÜLT! +${g.bonus} bónusz – nyomd meg a KÉSZ gombot!`, now);
      this.ctx.emit("Az építési cél teljesült!", "logic");
    }
  }

  update(dt: number, now: number) {
    if (this.over) return;
    // 1–8 választás
    const keys = this.ctx.keys;
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    for (let i = 0; i < PIECES.length; i++) {
      if (keys.has(digits[i])) { this.sel = i; }
    }
    if (keys.has(digits[8])) this.sel = PIECES.length; // 9 = radír
    if (this.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.over = true;
        this.done = true;
        this.ctx.finish(
          this.goalReached,
          this.goalReached ? "Pont időre kész lettél!" : "Lejárt az idő – a cél nem készült el",
          this.target,
        );
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    // ég
    const sky = ctx.createLinearGradient(0, 0, 0, GH - HUD_H);
    sky.addColorStop(0, "#7dd3fc");
    sky.addColorStop(1, "#e0f2fe");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GW, GH - HUD_H);
    // nap
    ctx.fillStyle = "#fde047";
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(60, 56, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // felhő
    const cx2 = ((now / 60) % (GW + 200)) - 100;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cx2 - 40, 80, 26, 0, Math.PI * 2);
    ctx.arc(cx2, 64, 34, 0, Math.PI * 2);
    ctx.arc(cx2 + 44, 82, 24, 0, Math.PI * 2);
    ctx.fill();

    // rács
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * CELL;
        const py = GRID_Y + y * CELL;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
        const piece = this.grid[y][x];
        if (piece) {
          const def = PIECES.find((p) => p.id === piece)!;
          def.draw(ctx, px, py, CELL, now);
        }
      }
    }
    // fű a rács alján
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(0, GH - HUD_H - 8, GW, 8);

    // hover jelzés
    const ptr = this.ctx.pointer();
    const hx = (ptr.x / 100) * GW;
    const hy = (ptr.y / 100) * GH;
    if (hy < GH - HUD_H) {
      const cx = Math.floor(hx / CELL);
      const cy = Math.floor(hy / CELL);
      if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) {
        ctx.strokeStyle = this.sel === PIECES.length ? "#f87171" : "#fbbf24";
        ctx.lineWidth = 3;
        ctx.strokeRect(cx * CELL + 2, GRID_Y + cy * CELL + 2, CELL - 4, CELL - 4);
      }
    }
    // hibás kattintás villanása
    if (now - this.flash.at < 250) {
      ctx.strokeStyle = "rgba(248,113,113,0.9)";
      ctx.lineWidth = 4;
      ctx.strokeRect(this.flash.x * CELL + 2, GRID_Y + this.flash.y * CELL + 2, CELL - 4, CELL - 4);
    }

    // cél-panel
    if (this.goal) {
      const g = GOALS[this.goal];
      const rows = Object.entries(g.req);
      const pw = 250, ph = 46 + rows.length * 30;
      const bx = GW - pw - 14, by = 14;
      ctx.fillStyle = "rgba(9,9,15,0.78)";
      ctx.strokeStyle = this.goalReached ? "#a3e635" : "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, pw, ph, 10);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "800 19px Geist, system-ui, sans-serif";
      ctx.fillStyle = this.goalReached ? "#a3e635" : "#fbbf24";
      ctx.fillText(this.goalReached ? "CÉL KÉSZ ✓" : g.title, bx + 14, by + 24);
      rows.forEach(([k, n], i) => {
        const have = this.counts[k as PieceId] ?? 0;
        const ok = have >= (n as number);
        const y = by + 52 + i * 30;
        ctx.font = "600 17px Geist, system-ui, sans-serif";
        ctx.fillStyle = ok ? "#a3e635" : "#e4e4e7";
        const label = PIECES.find((p) => p.id === k)?.label ?? k;
        ctx.fillText(`${ok ? "✓" : "•"} ${label}`, bx + 16, y);
        ctx.textAlign = "right";
        ctx.fillText(`${Math.min(have, n as number)}/${n}`, bx + pw - 16, y);
        ctx.textAlign = "left";
      });
    }

    // üzenet
    if (now - this.msgAt < 3500) {
      ctx.fillStyle = "rgba(9,9,15,0.8)";
      ctx.beginPath();
      ctx.roundRect(GW / 2 - 300, 16, 600, 44, 10);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.font = "600 18px Geist, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.msg, GW / 2, 39);
    }

    // alsó paletta
    ctx.fillStyle = "rgba(9,9,15,0.9)";
    ctx.fillRect(0, GH - HUD_H, GW, HUD_H);
    for (let i = 0; i <= PIECES.length; i++) {
      const bx = slotX(i);
      const isSel = this.sel === i;
      ctx.fillStyle = isSel ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.05)";
      ctx.strokeStyle = isSel ? "#fbbf24" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, GH - HUD_H + 6, SLOT_W, HUD_H - 12, 8);
      ctx.fill();
      ctx.stroke();
      if (i < PIECES.length) {
        // mini előnézet
        ctx.save();
        ctx.translate(bx + (SLOT_W - 40) / 2, GH - HUD_H + 9);
        PIECES[i].draw(ctx, 0, 0, 40, now);
        ctx.restore();
        ctx.fillStyle = isSel ? "#fbbf24" : "#a1a1aa";
        ctx.font = "600 12px Geist, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${PIECES[i].label} (${i + 1})`, bx + SLOT_W / 2, GH - 13);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.font = "800 22px Geist, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⌫", bx + SLOT_W / 2, GH - HUD_H + 32);
        ctx.font = "600 12px Geist, system-ui, sans-serif";
        ctx.fillStyle = this.sel === i ? "#f87171" : "#a1a1aa";
        ctx.fillText("Radír (9)", bx + SLOT_W / 2, GH - 13);
      }
    }
    // Kész / Kilépés gombok (a paletta után, külön zónában – nem laphatnak át!)
    const doneEnabled = this.goalReached || !this.goal;
    ctx.fillStyle = doneEnabled ? "#a3e635" : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = doneEnabled ? "#d9f99d" : "#52525b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(BTN_DONE.x, GH - HUD_H + BTN_DONE.y, BTN_DONE.w, BTN_DONE.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = doneEnabled ? "#09090f" : "#71717a";
    ctx.font = "800 20px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KÉSZ ✓", BTN_DONE.x + BTN_DONE.w / 2, GH - HUD_H + 32);
    ctx.fillStyle = "rgba(24,24,27,0.92)";
    ctx.strokeStyle = "#f87171";
    ctx.beginPath();
    ctx.roundRect(BTN_EXIT.x, GH - HUD_H + BTN_EXIT.y, BTN_EXIT.w, BTN_EXIT.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f87171";
    ctx.fillText("Kilépés", BTN_EXIT.x + BTN_EXIT.w / 2, GH - HUD_H + 32);

    // idő
    if (this.timeLimit > 0) {
      ctx.fillStyle = this.timeLeft < 20 ? "#f87171" : "#e4e4e7";
      ctx.font = "700 18px Geist, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⏱ ${Math.ceil(Math.max(0, this.timeLeft))}s`, 12, 30);
    }
  }
}
