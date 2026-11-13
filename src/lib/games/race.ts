// ===== GOKART VERSENY – felülnézetes, gépi ellenfelekkel =====
// Egyjátékos módban a teljes pálya látszik; KÉT JÁTÉKOS módban a képernyő
// kettéosztva követi mindkét versenyzőt (osztott képernyő!).
// 1. játékos: W/A/S/D · 2. játékos: nyilak. 3 kör, a fű lassít!

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, keyDown } from "./base";

interface Car {
  x: number; y: number;
  heading: number;
  speed: number;
  idx: number;      // legközelebbi pálya-pont indexe
  lap: number;
  color: string;
  name: string;
  ai: boolean;
  aiMul: number;
  finished: boolean;
  finishTime: number;
  progress: number; // lap*N + idx
}

const N = 240; // középvonal pontjainak száma
const TRACK_HALF = 48;

function buildTrack(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = 1 + 0.17 * Math.sin(2 * t + 0.7) + 0.1 * Math.cos(3 * t - 1.2);
    pts.push({ x: 480 + Math.cos(t) * r * 318, y: 272 + Math.sin(t) * r * 196 });
  }
  return pts;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class RaceGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private pts = buildTrack();
  private cars: Car[] = [];
  private twoPlayers: boolean;
  private laps: number;
  private state: "count" | "race" | "done" = "count";
  private stateAt: number;
  private raceAt = 0;
  private done = false;
  private over = false;
  private resultsAt = 0;
  private finalLabel = "";

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    this.twoPlayers = Number(pr.players ?? 1) === 2;
    this.laps = clamp(Math.round(Number(pr.laps ?? 3)), 1, 6);
    const rivals = clamp(Math.round(Number(pr.rivals ?? 2)), 0, 3);
    this.stateAt = performance.now();

    const start = this.pts[0];
    const tangent = Math.atan2(this.pts[1].y - start.y, this.pts[1].x - start.x);
    const mk = (color: string, name: string, ai: boolean, aiMul: number, lane: number): Car => ({
      x: start.x - Math.cos(tangent) * 30 + Math.cos(tangent + Math.PI / 2) * lane,
      y: start.y - Math.sin(tangent) * 30 + Math.sin(tangent + Math.PI / 2) * lane,
      heading: tangent,
      speed: 0,
      idx: 0,
      lap: 1,
      color,
      name,
      ai,
      aiMul,
      finished: false,
      finishTime: 0,
      progress: 0,
    });
    this.cars.push(mk("#fbbf24", "1. játékos", false, 1, -18));
    if (this.twoPlayers) {
      this.cars.push(mk("#22d3ee", "2. játékos", false, 1, 18));
    } else {
      // egyjátékos módban a nyilak is az 1. játékost vezetik – jelezzük
    }
    const aiColors = ["#ef4444", "#a3e635", "#c084fc"];
    const aiNames = ["Vörös Villám", "Zöld Zápor", "Lila Gőz"];
    for (let i = 0; i < rivals; i++) {
      this.cars.push(mk(aiColors[i % 3], aiNames[i % 3], true, 0.88 + i * 0.045, 34 + i * 16));
    }
    ctx.emit(`Verseny indul: ${this.cars.length} versenyző, ${this.laps} kör${this.twoPlayers ? ", OSZTOTT KÉPERNYŐ" : ""}`, "logic");
  }

  isDone() { return this.done; }

  click() { /* a verseny csak billentyűvel irányítható */ }

  private nearestIdx(car: Car): number {
    let best = car.idx, bd = Infinity;
    for (let k = -30; k <= 60; k++) {
      const i = (car.idx + k + N) % N;
      const d = (car.x - this.pts[i].x) ** 2 + (car.y - this.pts[i].y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  update(dt: number, now: number) {
    if (this.over) return;
    if (this.state === "count") {
      if (now - this.stateAt > 3400) {
        this.state = "race";
        this.raceAt = now;
        this.ctx.sfx("sfx.powerup", 0.8);
      }
      return;
    }
    if (this.state === "done") {
      if (now - this.resultsAt > 5200) {
        this.done = true;
        const p1 = this.cars[0];
        const pos = this.positionOf(p1);
        this.ctx.finish(pos === 1 || this.twoPlayers, this.finalLabel, this.target);
      }
      return;
    }

    const keys = this.ctx.keys;
    const elapsed = (now - this.raceAt) / 1000;

    for (const car of this.cars) {
      let up = false, down = false, left = false, right = false;
      if (car.ai) {
        const look = this.pts[(car.idx + 14) % N];
        const desired = Math.atan2(look.y - car.y, look.x - car.x);
        const diff = angleDiff(desired, car.heading);
        if (diff < -0.05) left = true;
        if (diff > 0.05) right = true;
        up = true;
        if (Math.abs(diff) > 1.0) { up = false; down = true; }
        // gumi-paraszt: ha le van maradva, kap plusz tempót
        const behind = this.cars[0].progress - car.progress;
        if (behind > 55) up = true;
      } else if (car === this.cars[0]) {
        up = keyDown(keys, "w") || (!this.twoPlayers && keyDown(keys, "ArrowUp"));
        down = keyDown(keys, "s") || (!this.twoPlayers && keyDown(keys, "ArrowDown"));
        left = keyDown(keys, "a") || (!this.twoPlayers && keyDown(keys, "ArrowLeft"));
        right = keyDown(keys, "d") || (!this.twoPlayers && keyDown(keys, "ArrowRight"));
      } else {
        up = keyDown(keys, "ArrowUp");
        down = keyDown(keys, "ArrowDown");
        left = keyDown(keys, "ArrowLeft");
        right = keyDown(keys, "ArrowRight");
      }

      const near = this.pts[car.idx];
      const off = Math.hypot(car.x - near.x, car.y - near.y) > TRACK_HALF + 6;
      const throttle = up ? 1 : down ? -0.55 : 0;
      car.speed += (throttle * 430 - car.speed * 1.15) * dt;
      if (off) car.speed *= 1 - 2.4 * dt;
      const maxSpeed = (off ? 150 : 335) * (car.ai ? car.aiMul : 1);
      car.speed = clamp(car.speed, -130, maxSpeed);
      const steerIn = (left ? -1 : 0) + (right ? 1 : 0);
      if (steerIn !== 0 && Math.abs(car.speed) > 8) {
        car.heading += steerIn * 2.7 * dt * clamp(Math.abs(car.speed) / 230, 0.15, 1) * Math.sign(car.speed);
      }
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.y += Math.sin(car.heading) * car.speed * dt;

      // por a füvön
      if (off && Math.abs(car.speed) > 60 && Math.random() < 0.35) {
        this.ctx.burst(car.x, car.y, 2, "rgba(120,90,60,0.8)", 60);
      }

      // kör-számolás (átfordulás a középvonal-indexen)
      const idx = this.nearestIdx(car);
      const delta = idx - car.idx;
      if (delta < -N * 0.5) car.lap++;
      else if (delta > N * 0.5) car.lap--;
      car.idx = idx;
      car.progress = car.lap * N + idx;

      if (!car.finished && car.lap > this.laps) {
        car.finished = true;
        car.finishTime = elapsed;
        this.ctx.sfx(car.ai ? "sfx.pop" : "sfx.win", car.ai ? 0.5 : 0.9);
        this.ctx.emit(`${car.name} célba ért! (${car.finishTime.toFixed(1)}s)`, "logic");
        if (!car.ai) this.ctx.addScore(car === this.cars[0] ? 100 : 60);
        if (this.cars.every((c) => c.finished) || this.cars.slice(0, this.twoPlayers ? 2 : 1).every((c) => c.finished)) {
          this.settleResults(now);
        }
      }
    }

    // idő túllépés: ha valaki beragadna
    if (elapsed > 200) this.settleResults(now);
  }

  private positionOf(car: Car): number {
    const sorted = [...this.cars].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.progress - a.progress;
    });
    return sorted.indexOf(car) + 1;
  }

  private settleResults(now: number) {
    if (this.state === "done") return;
    this.state = "done";
    this.resultsAt = now;
    for (const c of this.cars) if (!c.finished) c.finishTime = Infinity;
    const sorted = [...this.cars].sort((a, b) => a.finishTime - b.finishTime);
    const winner = sorted[0];
    if (this.twoPlayers) {
      this.finalLabel = `${winner.name} nyerte a futamot!`;
    } else {
      const p1 = this.cars[0];
      const pos = this.positionOf(p1);
      this.finalLabel = pos === 1
        ? `ELSŐ LETÉL! ${p1.finishTime === Infinity ? "" : `Idő: ${p1.finishTime.toFixed(1)}s`}`
        : `${pos}. helyezettél${p1.finished && p1.finishTime !== Infinity ? ` (${p1.finishTime.toFixed(1)}s)` : ""}`;
      if (pos === 1) this.ctx.addScore(40);
    }
    this.ctx.emit(`Verseny vége: ${this.finalLabel}`, "logic");
  }

  // ---------- Rajzolás ----------
  render(ctx: CanvasRenderingContext2D, now: number) {
    if (this.twoPlayers) {
      this.drawView(ctx, this.cars[0], 0, 0, GW, GH / 2 - 1, now);
      this.drawView(ctx, this.cars[1], 0, GH / 2 + 1, GW, GH / 2 - 1, now);
      ctx.fillStyle = "#09090f";
      ctx.fillRect(0, GH / 2 - 1, GW, 2);
    } else {
      this.drawView(ctx, this.cars[0], 0, 0, GW, GH, now);
    }
    this.drawTopHud(ctx, now);
    if (this.state === "count") this.drawCountdown(ctx, now);
    if (this.state === "done") this.drawResults(ctx);
  }

  private drawView(ctx: CanvasRenderingContext2D, focus: Car, vx: number, vy: number, vw: number, vh: number, now: number) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    // fű
    ctx.fillStyle = "#166534";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < 12; i++) {
      const gx = vx + ((i * 137) % vw);
      const gy = vy + ((i * 251) % vh);
      ctx.fillRect(gx, gy, 60, 8);
    }

    ctx.translate(vx + vw / 2 - focus.x, vy + vh / 2 - focus.y);
    this.drawTrack(ctx);
    for (const car of this.cars) this.drawCar(ctx, car, now);
    ctx.restore();
  }

  private drawTrack(ctx: CanvasRenderingContext2D) {
    // pálya szegély (világos), majd aszfalt
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.pts[0].x, this.pts[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = (TRACK_HALF + 8) * 2;
    ctx.stroke();
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = TRACK_HALF * 2;
    ctx.stroke();
    // középvonal szaggatva
    ctx.setLineDash([16, 20]);
    ctx.strokeStyle = "rgba(212,212,216,0.75)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    // rajtvonal (sakktábla)
    const s = this.pts[0];
    const t = Math.atan2(this.pts[1].y - s.y, this.pts[1].x - s.x);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(t);
    for (let r = 0; r < 2; r++) {
      for (let c = -6; c < 6; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#fafafa" : "#18181b";
        ctx.fillRect(-12 + r * 12, c * 8, 12, 8);
      }
    }
    ctx.restore();
  }

  private drawCar(ctx: CanvasRenderingContext2D, car: Car, now: number) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    // árnyék
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 3, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // kerekek
    ctx.fillStyle = "#18181b";
    ctx.fillRect(-13, -13, 9, 5);
    ctx.fillRect(-13, 8, 9, 5);
    ctx.fillRect(6, -13, 9, 5);
    ctx.fillRect(6, 8, 9, 5);
    // karosszéria
    ctx.fillStyle = car.color;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-17, -10, 34, 20, 6);
    ctx.fill();
    ctx.stroke();
    // kabin
    ctx.fillStyle = "rgba(9,9,15,0.75)";
    ctx.beginPath();
    ctx.roundRect(-6, -6, 12, 12, 3);
    ctx.fill();
    // orr-csík
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(12, -9, 4, 18);
    ctx.restore();

    // névcímke (csak nem osztott nézetben, hogy ne zsúfolt legyen)
    if (!this.twoPlayers) {
      ctx.fillStyle = "rgba(9,9,15,0.6)";
      ctx.font = "600 12px Geist, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(car.name, car.x, car.y - 24);
    }
    if (car.finished) {
      ctx.fillStyle = "rgba(9,9,15,0.6)";
      ctx.beginPath();
      ctx.arc(car.x + 22, car.y - 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a3e635";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(car.x + 17, car.y - 18);
      ctx.lineTo(car.x + 21, car.y - 14);
      ctx.lineTo(car.x + 27, car.y - 23);
      ctx.stroke();
    }
  }

  private drawTopHud(ctx: CanvasRenderingContext2D, now: number) {
    const p1 = this.cars[0];
    ctx.fillStyle = "rgba(9,9,15,0.66)";
    ctx.beginPath();
    ctx.roundRect(GW / 2 - 170, 12, 340, 40, 10);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "700 20px Geist, system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    const lapShown = Math.min(p1.lap, this.laps);
    ctx.fillText(`Kör ${lapShown}/${this.laps}`, GW / 2 - 100, 33);
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText(`Helyezés: ${this.positionOf(p1)}.`, GW / 2 + 30, 33);
    if (this.state === "race") {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 16px Geist, system-ui, sans-serif";
      ctx.fillText(`${((now - this.raceAt) / 1000).toFixed(1)}s`, GW / 2 + 120, 33);
    }
    if (this.twoPlayers) {
      ctx.textAlign = "left";
      ctx.font = "800 17px Geist, system-ui, sans-serif";
      ctx.fillStyle = this.cars[0].color;
      ctx.fillText("P1: WASD", 16, GH / 4);
      ctx.fillStyle = this.cars[1].color;
      ctx.fillText("P2: NYILAK", 16, GH * 3 / 4);
    }
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, now: number) {
    const t = (now - this.stateAt) / 1000;
    let label = "3";
    if (t > 1) label = "2";
    if (t > 2) label = "1";
    if (t > 3) label = "RAJT!";
    const scale = 1 + (t % 1) * 0.25;
    ctx.save();
    ctx.translate(GW / 2, GH / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = label === "RAJT!" ? "#a3e635" : "#fbbf24";
    ctx.font = "800 110px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 18;
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(9,9,15,0.6)";
    ctx.font = "600 20px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      this.twoPlayers ? "1. játékos: WASD · 2. játékos: Nyilak · 3 kör, a fű lassít!" : "WASD vagy Nyilak · 3 kör, a fű lassít!",
      GW / 2, GH - 30,
    );
  }

  private drawResults(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(9,9,15,0.78)";
    ctx.fillRect(GW / 2 - 260, GH / 2 - 150, 520, 300);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.strokeRect(GW / 2 - 260, GH / 2 - 150, 520, 300);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 34px Geist, system-ui, sans-serif";
    ctx.fillText("EREDMÉNY", GW / 2, GH / 2 - 108);
    const sorted = [...this.cars].sort((a, b) => a.finishTime - b.finishTime);
    sorted.forEach((c, i) => {
      const y = GH / 2 - 55 + i * 40;
      ctx.textAlign = "left";
      ctx.fillStyle = c.color;
      ctx.font = i === 0 ? "800 24px Geist, system-ui, sans-serif" : "600 22px Geist, system-ui, sans-serif";
      ctx.fillText(`${i + 1}. ${c.name}`, GW / 2 - 200, y);
      ctx.textAlign = "right";
      ctx.fillStyle = "#e4e4e7";
      ctx.fillText(c.finishTime === Infinity ? "—" : `${c.finishTime.toFixed(1)}s`, GW / 2 + 200, y);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "#a3e635";
    ctx.font = "700 24px Geist, system-ui, sans-serif";
    ctx.fillText(this.finalLabel, GW / 2, GH / 2 + 122);
  }
}
