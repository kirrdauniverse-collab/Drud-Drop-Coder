// ===== FÉREGCSATA – Worms-szerű kör alapú tüzérségi játék =====
// Rombolható terep (heightmap), szél, kilőhető féregek, lövedékfizika,
// körváltás, gépi ellenfél (szimulált célzás) vagy két játékos.
// Zöld csapat: W/A/S/D + Szóköz (vagy TŰZ gomb) · Piros csapat: nyilak + Szóköz.

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, keyDown } from "./base";

interface Worm {
  x: number; y: number;
  vx: number; vy: number;
  hp: number;
  team: 0 | 1; // 0 = zöld (játékos), 1 = piros
  alive: boolean;
  face: 1 | -1;
}

interface Projectile {
  x: number; y: number;
  vx: number; vy: number;
  from: 0 | 1;
  trail: { x: number; y: number; life: number }[];
}

const COLS = 241; // 4 px oszloponként
const GROUND_BASE = 370;
const WATER_Y = 505;

export class WormsGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private vsAI: boolean;
  private terrain = new Float32Array(COLS);
  private worms: Worm[] = [];
  private cur = 0; // aktuális féreg indexe
  private angle = 60; // fok
  private power = 30;
  private charging = false;
  private chargeStart = 0;
  private proj: Projectile | null = null;
  private wind = 0; // -1..1
  private turnEndsAt = 0;
  private turnLimit = 30;
  private nextTurnAt = 0; // lövedék után kis várakozás
  private over = false;
  private done = false;
  private startedAt = performance.now();
  private clouds = [
    { x: 120, y: 70, s: 60, v: 6 },
    { x: 520, y: 46, s: 78, v: 9 },
    { x: 780, y: 90, s: 52, v: 5 },
  ];
  private aimHintUntil = 0;

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    this.vsAI = String(pr.opponent ?? "ai") !== "human";

    // terep: simított zaj
    const p1 = Math.random() * 10, p2 = Math.random() * 10, p3 = Math.random() * 10;
    for (let i = 0; i < COLS; i++) {
      const x = i / (COLS - 1);
      let h = GROUND_BASE
        + 58 * Math.sin(x * 6.2 + p1)
        + 30 * Math.sin(x * 13.7 + p2)
        + 14 * Math.sin(x * 29 + p3);
      // középen egy szép völgy, széleken magas part
      h += 46 * Math.exp(-((x - 0.5) ** 2) * 26);
      h -= 34 * Math.exp(-((x - 0.22) ** 2) * 90) + 34 * Math.exp(-((x - 0.78) ** 2) * 90);
      this.terrain[i] = clamp(h, 190, 470);
    }
    const teams: [number[], number[]] = [[110, 190], [770, 850]];
    for (const [team, xs] of [[0, teams[0]], [1, teams[1]]] as const) {
      for (const x of xs) {
        this.worms.push({
          x, y: this.groundAt(x) - 10,
          vx: 0, vy: 0, hp: 100,
          team: team as 0 | 1, alive: true,
          face: team === 0 ? 1 : -1,
        });
      }
    }
    this.rerollWind();
    this.turnEndsAt = performance.now() + this.turnLimit * 1000;
    ctx.emit(`Féregcsata indul – ${this.vsAI ? "gép ellen" : "két játékos"}! 100 HP/féreg`, "logic");
  }

  isDone() { return this.done; }

  private groundAt(x: number): number {
    const i = clamp(Math.round(x / 4), 0, COLS - 1);
    return this.terrain[i];
  }

  private rerollWind() {
    this.wind = (Math.random() * 2 - 1) * 0.85;
  }

  private curWorm(): Worm { return this.worms[this.cur]; }

  private isMyTurn(w: Worm): boolean {
    const c = this.curWorm();
    return this.proj === null && this.nextTurnAt === 0 && c === w && c.alive;
  }

  private controls(w: Worm): { up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean } {
    const keys = this.ctx.keys;
    if (this.vsAI || w.team === 0) {
      return {
        up: keyDown(keys, "w"),
        down: keyDown(keys, "s"),
        left: keyDown(keys, "a"),
        right: keyDown(keys, "d"),
        fire: keyDown(keys, " "),
      };
    }
    return {
      up: keyDown(keys, "ArrowUp"),
      down: keyDown(keys, "ArrowDown"),
      left: keyDown(keys, "ArrowLeft"),
      right: keyDown(keys, "ArrowRight"),
      fire: keyDown(keys, " "),
    };
  }

  click(xPct: number, yPct: number, now: number) {
    const px = (xPct / 100) * GW;
    const py = (yPct / 100) * GH;
    // TŰZ gomb
    if (px >= GW - 190 && px <= GW - 30 && py >= GH - 78 && py <= GH - 22) {
      if (!this.charging) { this.startCharge(now); }
      else { this.fire(now); }
      return;
    }
    // gyors célzás: kattintás a féreg fölé = arra céloz
    const w = this.curWorm();
    if (this.isMyTurn(w) && !this.vsAIOrAI(w)) {
      const dx = px - w.x;
      const dy = w.y - py;
      if (Math.hypot(dx, dy) > 24) {
        this.angle = clamp((Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI, 10, 170);
      }
    }
  }

  private vsAIOrAI(w: Worm): boolean {
    return this.vsAI && w.team === 1;
  }

  private startCharge(now: number) {
    if (this.proj !== null || this.nextTurnAt > 0) return;
    this.charging = true;
    this.chargeStart = now;
    this.ctx.sfx("sfx.drumroll", 0.35);
  }

  private fire(now: number) {
    const w = this.curWorm();
    // Megjegyzés: a "charging" guard NEM kell ide – a gép (aiAct) közvetlenül
    // hívja töltés nélkül, az emberi útvonalak maguk gondoskodnak róla.
    this.charging = false;
    const power = this.power;
    const rad = (this.angle * Math.PI) / 180;
    const dir = w.face;
    this.proj = {
      x: w.x + Math.cos(rad) * 16 * dir,
      y: w.y - Math.sin(rad) * 16,
      vx: Math.cos(rad) * power * 7.4 * dir,
      vy: -Math.sin(rad) * power * 7.4,
      from: w.team,
      trail: [],
    };
    this.ctx.sfx("sfx.laser", 0.7);
    this.ctx.emit(`${w.team === 0 ? "Zöld" : "Piros"} tüzel! (${Math.round(this.angle)}°, erő ${Math.round(power)})`, "logic");
    this.power = 30;
  }

  update(dt: number, now: number) {
    if (this.over) return;
    // beúszó üzenet
    if (now - this.startedAt < 5000) this.aimHintUntil = now + 100;

    // felhők
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > GW + 80) c.x = -80;
    }

    // féreg-fizika (repülés a robbanás után)
    for (const w of this.worms) {
      if (!w.alive) continue;
      if (w.vx !== 0 || w.vy !== 0 || w.y < this.groundAt(w.x) - 10.5) {
        w.vy += 900 * dt;
        w.x = clamp(w.x + w.vx * dt, 8, GW - 8);
        w.y += w.vy * dt;
        const g = this.groundAt(w.x) - 10;
        if (w.y >= g) {
          w.y = g;
          if (Math.abs(w.vy) > 220) { w.vy = -w.vy * 0.32; w.vx *= 0.6; }
          else { w.vy = 0; w.vx *= 0.82; if (Math.abs(w.vx) < 4) w.vx = 0; }
        }
        if (w.y > WATER_Y) this.killWorm(w, "a vízbe esett!");
      }
    }

    // lövedék
    if (this.proj) {
      const p = this.proj;
      p.vy += 500 * dt;
      p.vx += this.wind * 70 * dt;
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        p.x += (p.vx * dt) / steps;
        p.y += (p.vy * dt) / steps;
        p.trail.push({ x: p.x, y: p.y, life: 500 });
        if (p.trail.length > 26) p.trail.shift();
        if (p.x < -40 || p.x > GW + 40 || p.y > WATER_Y) {
          if (p.y > WATER_Y) this.ctx.sfx("sfx.splash", 0.7);
          this.proj = null;
          this.endTurn(now);
          return;
        }
        let hitWorm: Worm | null = null;
        for (const w of this.worms) {
          if (w.alive && Math.hypot(w.x - p.x, w.y - p.y) < 17) { hitWorm = w; break; }
        }
        if (hitWorm || p.y >= this.groundAt(p.x)) {
          this.explode(p.x, p.y, hitWorm);
          this.proj = null;
          this.endTurn(now);
          return;
        }
      }
      return; // lövedék repülés közben nincs irányítás
    }

    if (this.nextTurnAt > 0) {
      if (now >= this.nextTurnAt) {
        this.nextTurnAt = 0;
        this.advanceTurn(now);
      }
      return;
    }

    // időkorlát körönként
    if (now > this.turnEndsAt) {
      this.charging = false;
      this.ctx.emit("Lejárt az idő – kör átadás!", "warn");
      this.nextTurnAt = now + 600;
      return;
    }

    const w = this.curWorm();
    if (!w.alive) { this.advanceTurn(now); return; }

    // gépi lépés
    if (this.vsAIOrAI(w)) {
      this.aiAct(now);
      return;
    }

    const c = this.controls(w);
    // séta
    const walk = (c.left ? -1 : 0) + (c.right ? 1 : 0);
    if (walk !== 0) {
      const nx = w.x + walk * 46 * dt;
      const g = this.groundAt(nx);
      if (Math.abs(g - this.groundAt(w.x)) < 20 && nx > 10 && nx < GW - 10) {
        w.x = nx;
        w.y = g - 10;
        w.face = walk > 0 ? 1 : -1;
      }
    }
    // célzás
    if (c.up) this.angle = clamp(this.angle + 55 * dt, 10, 170);
    if (c.down) this.angle = clamp(this.angle - 55 * dt, 10, 170);
    // tűz: nyomva tartás = töltés, elengedés = lövés
    if (c.fire && !this.charging && this.proj === null) this.startCharge(now);
    if (!c.fire && this.charging) this.fire(now);
    if (this.charging) {
      const t = (now - this.chargeStart) / 1150;
      this.power = 25 + clamp(t, 0, 1) * 75;
      if (this.power >= 100) this.fire(now); // betelt: automatikus lövés
    }
  }

  private aiAct(now: number) {
    // gondolkodás jelzés, majd egyszeri "szimulált" lövés
    if (!this.aiPlanned) {
      this.aiPlanned = true;
      this.aiAt = now + 900;
      this.aiPlan = this.planShot();
      if (this.aiPlan) this.angle = this.aiPlan.angle;
    }
    if (now >= this.aiAt && this.aiPlan) {
      this.power = this.aiPlan.power;
      this.angle = this.aiPlan.angle + (Math.random() - 0.5) * 4;
      this.fire(now);
      this.aiPlanned = false;
      this.aiPlan = null;
    }
  }
  private aiPlanned = false;
  private aiAt = 0;
  private aiPlan: { angle: number; power: number } | null = null;

  /** Gép: sok lövés végigszimulálása, a legjobb kiválasztása (kis hibával). */
  private planShot(): { angle: number; power: number } | null {
    const me = this.curWorm();
    const target = this.worms.find((w) => w.alive && w.team !== me.team);
    if (!target) return null;
    let best: { angle: number; power: number; err: number } | null = null;
    for (let a = 20; a <= 160; a += 6) {
      for (let p = 30; p <= 100; p += 9) {
        const land = this.simulate(me, a, p);
        if (land === null) continue;
        const err = Math.abs(land - target.x);
        if (!best || err < best.err) best = { angle: a, power: p, err };
      }
    }
    if (!best) return { angle: 45, power: 60 };
    // kis emberi hiba
    return { angle: best.angle + (Math.random() - 0.5) * 5, power: clamp(best.power + (Math.random() - 0.5) * 8, 25, 100) };
  }

  private simulate(w: Worm, angleDeg: number, power: number): number | null {
    const rad = (angleDeg * Math.PI) / 180;
    const dir = w.face;
    let x = w.x + Math.cos(rad) * 16 * dir;
    let y = w.y - Math.sin(rad) * 16;
    let vx = Math.cos(rad) * power * 7.4 * dir;
    let vy = -Math.sin(rad) * power * 7.4;
    const dt = 1 / 40;
    for (let i = 0; i < 200; i++) {
      vy += 500 * dt;
      vx += this.wind * 70 * dt;
      x += vx * dt;
      y += vy * dt;
      if (x < -40 || x > GW + 40 || y > WATER_Y) return null;
      if (y >= this.groundAt(x)) return x;
    }
    return null;
  }

  private explode(ex: number, ey: number, directHit: Worm | null) {
    const R = 38;
    this.ctx.sfx("sfx.explosion", 0.9);
    this.ctx.burst(ex, ey, 42, "#fb923c", 280);
    this.ctx.burst(ex, ey, 20, "#fef08a", 180);
    // kráter
    for (let i = 0; i < COLS; i++) {
      const cx = i * 4;
      const d = Math.abs(cx - ex);
      if (d < R) {
        const bottom = ey + Math.sqrt(R * R - d * d);
        if (this.terrain[i] < bottom) this.terrain[i] = Math.min(505, bottom);
      }
    }
    // simítás a peremen
    for (let i = 1; i < COLS - 1; i++) {
      this.terrain[i] = this.terrain[i] * 0.94 + (this.terrain[i - 1] + this.terrain[i + 1]) * 0.03;
    }
    // sérülés + hátralökés
    for (const w of this.worms) {
      if (!w.alive) continue;
      const d = Math.hypot(w.x - ex, w.y - ey);
      const range = R + 16;
      if (d < range || w === directHit) {
        const dmg = Math.round((w === directHit ? 52 : 46) * clamp(1 - d / range, 0.15, 1));
        w.hp -= dmg;
        const ang = Math.atan2(w.y - ey, w.x - ex) || -Math.PI / 2;
        const kick = 260 * clamp(1 - d / range, 0.3, 1);
        w.vx += Math.cos(ang) * kick;
        w.vy += Math.sin(ang) * kick - 120;
        this.ctx.sfx("sfx.hurt", 0.7);
        this.ctx.emit(`${w.team === 0 ? "Zöld" : "Piros"} féreg: -${dmg} HP`, w.team === 0 ? "warn" : "logic");
        if (w.hp <= 0) this.killWorm(w, "elestetted!");
      }
    }
  }

  private killWorm(w: Worm, how: string) {
    w.alive = false;
    w.hp = 0;
    this.ctx.burst(w.x, w.y, 26, "#a3e635", 200);
    this.ctx.sfx("sfx.pop", 0.8);
    this.ctx.emit(`Egy féreg kimúlott (${how})`, "logic");
    this.checkTeams();
  }

  private checkTeams() {
    const green = this.worms.filter((w) => w.alive && w.team === 0).length;
    const red = this.worms.filter((w) => w.alive && w.team === 1).length;
    if (green === 0 || red === 0) {
      this.over = true;
      const greenWon = green > 0;
      this.ctx.addScore(greenWon ? 100 : 25);
      setTimeout(() => {
        this.done = true;
        this.ctx.finish(
          greenWon,
          greenWon ? "A ZÖLD csapat győzött! +100 pont" : (this.vsAI ? "A piros gép legyőzött…" : "A PIROS csapat győzött!"),
          this.target,
        );
      }, 900);
    }
  }

  private endTurn(now: number) {
    this.nextTurnAt = now + 1100;
  }

  private advanceTurn(now: number) {
    // A csapatok FELVÁLTVA jönnek (mint a klasszikus Wormsben): zöld → piros → zöld…
    const curTeam = this.worms[this.cur].team;
    let next = -1;
    for (let k = 1; k <= this.worms.length; k++) {
      const i = (this.cur + k) % this.worms.length;
      if (this.worms[i].alive && this.worms[i].team !== curTeam) { next = i; break; }
    }
    if (next < 0) {
      // nincs élő a másik csapatban – a saját csapat következő élő féregje
      for (let k = 1; k <= this.worms.length; k++) {
        const i = (this.cur + k) % this.worms.length;
        if (this.worms[i].alive) { next = i; break; }
      }
    }
    if (next >= 0) this.cur = next;
    this.power = 30;
    this.charging = false;
    this.rerollWind();
    this.turnEndsAt = now + this.turnLimit * 1000;
  }

  // ---------- Rajzolás ----------
  render(ctx: CanvasRenderingContext2D, now: number) {
    // ég
    const sky = ctx.createLinearGradient(0, 0, 0, GH);
    sky.addColorStop(0, "#0c4a6e");
    sky.addColorStop(0.7, "#38bdf8");
    sky.addColorStop(1, "#bae6fd");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, GW, GH);
    // nap
    ctx.fillStyle = "#fde047";
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(830, 70, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // felhők
    for (const c of this.clouds) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(c.x - c.s / 2.6, c.y, c.s / 3.1, 0, Math.PI * 2);
      ctx.arc(c.x, c.y - c.s / 6, c.s / 2.2, 0, Math.PI * 2);
      ctx.arc(c.x + c.s / 2.8, c.y, c.s / 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // terep
    ctx.beginPath();
    ctx.moveTo(0, this.terrain[0]);
    for (let i = 1; i < COLS; i++) ctx.lineTo(i * 4, this.terrain[i]);
    ctx.lineTo(GW, GH);
    ctx.lineTo(0, GH);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, 300, 0, GH);
    gr.addColorStop(0, "#8a6a44");
    gr.addColorStop(1, "#5c4426");
    ctx.fillStyle = gr;
    ctx.fill();
    // fű réteg
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, this.terrain[0] - 2);
    for (let i = 1; i < COLS; i++) ctx.lineTo(i * 4, this.terrain[i] - 2);
    ctx.stroke();
    // víz
    const wv = Math.sin(now / 500) * 4;
    ctx.fillStyle = "rgba(14,116,144,0.85)";
    ctx.fillRect(0, WATER_Y, GW, GH - WATER_Y);
    ctx.fillStyle = "rgba(125,211,252,0.5)";
    ctx.fillRect(0, WATER_Y + 6 + wv, GW, 5);

    // féregek
    for (const w of this.worms) {
      if (!w.alive) {
        // sírkő
        ctx.fillStyle = "#71717a";
        ctx.beginPath();
        ctx.roundRect(w.x - 10, this.groundAt(w.x) - 22, 20, 24, 8);
        ctx.fill();
        continue;
      }
      const isCur = this.worms[this.cur] === w && !this.over;
      ctx.save();
      ctx.translate(w.x, w.y);
      // test
      ctx.fillStyle = w.team === 0 ? "#86efac" : "#fca5a5";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // szemek a nézőirányba
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(w.face * 5, -7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#09090f";
      ctx.beginPath();
      ctx.arc(w.face * 6.5, -7, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // ágyú (a csapat színében)
      const rad = (this.angle * Math.PI) / 180;
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(Math.cos(rad) * 17 * w.face, -4 - Math.sin(rad) * 17);
      ctx.stroke();
      if (isCur) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * 20 * w.face, -4 - Math.sin(rad) * 20);
        ctx.lineTo(Math.cos(rad) * 78 * w.face, -4 - Math.sin(rad) * 78);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      // HP
      const bw = 46;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(w.x - bw / 2, w.y - 34, bw, 8);
      ctx.fillStyle = w.hp > 55 ? "#4ade80" : w.hp > 25 ? "#fbbf24" : "#f87171";
      ctx.fillRect(w.x - bw / 2 + 1, w.y - 33, (bw - 2) * clamp(w.hp / 100, 0, 1), 6);
      if (isCur) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "800 15px Geist, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("▼", w.x, w.y - 42);
      }
    }

    // lövedék + nyom
    if (this.proj) {
      for (const t of this.proj.trail) {
        t.life -= 16;
        ctx.fillStyle = `rgba(216,180,254,${clamp(t.life / 500, 0, 0.8)})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.arc(this.proj.x, this.proj.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    this.drawHud(ctx, now);
  }

  private drawHud(ctx: CanvasRenderingContext2D, now: number) {
    const w = this.curWorm();
    // felső sáv: kör, szél
    ctx.fillStyle = "rgba(9,9,15,0.66)";
    ctx.beginPath();
    ctx.roundRect(GW / 2 - 250, 10, 500, 42, 10);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "800 21px Geist, system-ui, sans-serif";
    const green = this.worms.filter((x) => x.alive && x.team === 0).length;
    const red = this.worms.filter((x) => x.alive && x.team === 1).length;
    ctx.fillStyle = w.team === 0 ? "#86efac" : "#fca5a5";
    const teamName = w.team === 0 ? "ZÖLD" : "PIROS";
    ctx.fillText(`${teamName} csapat jön`, GW / 2 - 130, 32);
    // szél-nyilak
    const wn = Math.round(Math.abs(this.wind) * 5);
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "700 18px Geist, system-ui, sans-serif";
    const arrows = this.wind >= 0 ? "→".repeat(Math.max(1, wn)) : "←".repeat(Math.max(1, wn));
    ctx.fillText(`Szél: ${arrows}`, GW / 2 + 105, 32);
    // kör-idő
    const left = Math.max(0, Math.ceil((this.turnEndsAt - now) / 1000));
    ctx.fillStyle = left <= 5 ? "#f87171" : "#d4d4d8";
    ctx.font = "700 20px Geist, system-ui, sans-serif";
    ctx.fillText(`${left}s`, GW / 2 + 235, 32);
    // HP összesítő
    ctx.textAlign = "left";
    ctx.font = "700 17px Geist, system-ui, sans-serif";
    ctx.fillStyle = "#86efac";
    ctx.fillText(`Zöld: ${green} él`, 16, 28);
    ctx.fillStyle = "#fca5a5";
    ctx.fillText(`Piros: ${red} él`, 16, 52);

    // alsó sáv: szög, erő, TŰZ gomb
    ctx.fillStyle = "rgba(9,9,15,0.7)";
    ctx.fillRect(0, GH - 96, GW, 96);
    ctx.textAlign = "left";
    ctx.font = "700 20px Geist, system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Szög: ${Math.round(this.angle)}°`, 24, GH - 66);
    // erőmérő
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.roundRect(160, GH - 74, 260, 16, 8);
    ctx.fill();
    const pcol = this.power > 75 ? "#f87171" : this.power > 45 ? "#fbbf24" : "#4ade80";
    ctx.fillStyle = pcol;
    ctx.beginPath();
    ctx.roundRect(161, GH - 73, 258 * (this.power / 100), 14, 7);
    ctx.fill();
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "600 16px Geist, system-ui, sans-serif";
    ctx.fillText(`Erő: ${Math.round(this.power)}%`, 170, GH - 46);
    // irányítás emlékeztető
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 15px Geist, system-ui, sans-serif";
    const meGreen = w.team === 0 || !this.vsAI;
    ctx.fillText(
      meGreen ? "W/S: szög · A/D: mozgás · Szóköz: tűz (tartsd!)" : "A gép célzó…",
      450, GH - 66,
    );
    // TŰZ gomb
    const ptr = this.ctx.pointer();
    const hx = (ptr.x / 100) * GW, hy = (ptr.y / 100) * GH;
    const bx = GW - 190, by = GH - 78;
    const hover = hx >= bx && hx <= bx + 160 && hy >= by && hy <= by + 56;
    ctx.fillStyle = this.charging ? "#f87171" : hover ? "#fbbf24" : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = this.charging ? "#fecaca" : "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, 160, 56, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.charging || hover ? "#09090f" : "#fbbf24";
    ctx.font = "800 24px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.charging ? "ENGEDD!" : "TŰZ", bx + 80, by + 29);

    // belépő üzenet
    const t = (now - this.startedAt) / 1000;
    if (t < 4.5) {
      ctx.globalAlpha = t < 3.6 ? 1 : (4.5 - t) / 0.9;
      ctx.fillStyle = "rgba(9,9,15,0.75)";
      ctx.fillRect(GW / 2 - 330, 150, 660, 96);
      ctx.fillStyle = "#a3e635";
      ctx.textAlign = "center";
      ctx.font = "800 32px Geist, system-ui, sans-serif";
      ctx.fillText("FÉREGCSATA!", GW / 2, 184);
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "600 19px Geist, system-ui, sans-serif";
      ctx.fillText("Döntsétek le a másik csapatot – figyelj a széllel és a domborzattal!", GW / 2, 220);
      ctx.globalAlpha = 1;
    }
  }
}
