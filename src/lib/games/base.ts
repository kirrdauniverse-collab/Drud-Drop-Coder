// ===== Játékmódok közös alapja =====
// A folyamat-szerkesztő "game.*" blokkjai teljes képernyős minijátékokat indítanak:
// a léptetőfej megáll, míg a játékos játszik, aztán (győzelem/vereség után) megy tovább.

import type { EngineEvent } from "../types";

export type GameTone = EngineEvent["tone"];

export interface GameCtx {
  /** Lenyomott billentyűk (az éppen aktuális keretben). */
  keys: ReadonlySet<string>;
  /** Vászonon lévő egér-/ujjpozíció (0..100). */
  pointer: () => { x: number; y: number };
  /** Játék-változók (score, lives, és a sajátjaid). */
  vars: Record<string, number>;
  emit(label: string, tone?: GameTone): void;
  addScore(n: number): void;
  lives(): number;
  /** Egy élet levonása. true, ha ezzel vége a játéknak. */
  loseLife(): boolean;
  sfx(name: string, vol?: number): void;
  burst(x: number, y: number, count: number, color: string, speed?: number): void;
  finish(win: boolean, label: string, target: number): void;
}

export interface GameMode {
  update(dt: number, now: number): void;
  render(ctx: CanvasRenderingContext2D, now: number): void;
  click(xPct: number, yPct: number, now: number): void;
  isDone(): boolean;
  /** Takarítás (pl. socket lezárása) a mód leállításakor. */
  destroy?(): void;
}

export const GW = 960;
export const GH = 540;

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function keyDown(keys: ReadonlySet<string>, ...names: string[]): boolean {
  return names.some((n) => keys.has(n));
}

export function inRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

/** Szép HUD-gomb a vászonra (a játékok gombjaihoz). */
export function drawBtn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, color: string, hover: boolean, fontSize = 20,
) {
  ctx.fillStyle = hover ? color : "rgba(24,24,27,0.92)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hover ? "#09090f" : color;
  ctx.font = `700 ${fontSize}px Geist, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

/** Kicsi, körvonalas címke (pl. "Kör 2/3"). */
export function drawChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontSize = 18) {
  ctx.font = `700 ${fontSize}px Geist, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 22;
  ctx.fillStyle = "rgba(9,9,15,0.72)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y - 15, w, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x + 11, y + 1);
}
