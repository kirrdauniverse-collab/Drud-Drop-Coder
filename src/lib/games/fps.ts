// ===== VALÓDI FPS: első személyű lövöldöző raycasting motorral =====
// Wolfenstein 3D stílusú 3D labirintus: DDA sugárvetés falanként, billboard
// szörny-sprite-ok mélységi vágással, minimap, pisztoly és találat-ellenőrzés.
// Irányítás: WASD = mozgás, A/D oldalra, egér oldalra húzása vagy ←/→ = fordulás,
// kattintás vagy Szóköz = lövés.

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, keyDown } from "./base";

interface FpsEnemy {
  x: number; y: number;
  hp: number; maxHp: number;
  type: "demon" | "golem" | "wraith";
  alive: boolean;
  hurtAt: number;
  vx: number; vy: number; // hátradobás
  wobble: number;
}

const MAPS: Record<string, string[]> = {
  bunker: [
    "################",
    "#....#.....#...#",
    "#.P..#..E..#.E.#",
    "#....#.....#...#",
    "#.##.#..#..##.##",
    "#....#..#......#",
    "#.E..........E.#",
    "#.##.####.##...#",
    "#..........#.E.#",
    "###.###.##.#...#",
    "#.....#..#..##.#",
    "#..E..#..#.....#",
    "#.....#..###.###",
    "#.###.....#....#",
    "#...#..E..#..E.#",
    "################",
  ],
  erod: [
    "================",
    "=....=..E..=..==",
    "=.P..=.....=..E=",
    "=....=..======.=",
    "=..E.=..=......=",
    "=....=..=..%%..=",
    "==.===..=..%%..=",
    "=........=....=",
    "=..%%..E.=..E..=",
    "=..%%....=.....=",
    "=.....====.=====",
    "=..E..=......E.=",
    "=.....=..%%....=",
    "==.===...%%..===",
    "=..............=",
    "================",
  ],
    raktar: [
    "################",
    "#..E.......#..##",
    "#.%%..%%...#E..#",
    "#.%%..%%...#...#",
    "#..............#",
    "#...P......%%..#",
    "##.#####...%%..#",
    "#..E...#......E#",
    "#......#..%%%%.#",
    "#.%%%%.#..%%%%.#",
    "#.%%%%..........#",
    "#......###..##.#",
    "#..E......#..E.#",
    "#...%%%...#....#",
    "#...%.%...#..%.#",
    "################",
  ],
};

const WALL_COLORS: Record<number, [number, number, number]> = {
  1: [158, 74, 58],   // tégla
  2: [108, 118, 134], // acél
  3: [84, 120, 78],   // moha-kő
};

const ENEMY_STATS: Record<FpsEnemy["type"], { hp: number; speed: number; scale: number; score: number; color: string }> = {
  demon: { hp: 2, speed: 1.55, scale: 0.78, score: 25, color: "#ef4444" },
  golem: { hp: 4, speed: 0.8, scale: 0.92, score: 35, color: "#94a3b8" },
  wraith: { hp: 1, speed: 2.1, scale: 0.6, score: 20, color: "#67e8f9" },
};

const DIFF_SPEED: Record<string, number> = { easy: 0.7, normal: 1, hard: 1.35 };

export class FpsGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private grid: number[][] = [];
  private size = 16;
  private px = 2.5; private py = 2.5;
  private a = 0; // nézőirány (radián)
  private enemies: FpsEnemy[] = [];
  private zbuf = new Float32Array(GW);
  private walkPhase = 0;
  private lastShot = -9999;
  private lastHurt = -9999;
  private muzzle = 0;
  private timeLimit: number;
  private timeLeft: number;
  private moveSpeed: number;
  private diff: number;
  private startedAt: number;
  private over = false;
  private done = false;
  private shots = 0;
  private hits = 0;
  private spriteCache = new Map<string, HTMLCanvasElement>();

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    this.moveSpeed = Number(pr.speed ?? 3.4);
    this.diff = DIFF_SPEED[String(pr.difficulty ?? "normal")] ?? 1;
    this.timeLimit = Number(pr.timeLimit ?? 120);
    this.timeLeft = this.timeLimit;
    this.startedAt = performance.now();

    const rows = MAPS[String(pr.map ?? "bunker")] ?? MAPS.bunker;
    const spots: { x: number; y: number }[] = [];
    for (let y = 0; y < 16; y++) {
      const row = (rows[y] ?? "").padEnd(16, "#").slice(0, 16);
      const line: number[] = [];
      for (let x = 0; x < 16; x++) {
        const c = row[x];
        if (c === "#") line.push(1);
        else if (c === "=") line.push(2);
        else if (c === "%") line.push(3);
        else {
          line.push(0);
          if (c === "P") { this.px = x + 0.5; this.py = y + 0.5; }
          if (c === "E") spots.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
      this.grid.push(line);
    }
    // játékos nézzen a nyitott tér felé
    this.a = this.openDirection();

    const want = clamp(Math.round(Number(pr.enemies ?? 8)), 2, 16);
    // keverjük a spawn-pontokat és egészítsük ki üres cellákkal, messze a játékostól
    const pool = spots.sort(() => Math.random() - 0.5);
    while (pool.length < want) {
      const x = 1 + Math.floor(Math.random() * 14);
      const y = 1 + Math.floor(Math.random() * 14);
      if (this.grid[y][x] === 0 && Math.hypot(x + 0.5 - this.px, y + 0.5 - this.py) > 4) {
        pool.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    const types: FpsEnemy["type"][] = ["demon", "golem", "wraith"];
    for (let i = 0; i < want; i++) {
      const t = types[i % types.length];
      const st = ENEMY_STATS[t];
      this.enemies.push({
        x: pool[i].x, y: pool[i].y,
        hp: st.hp, maxHp: st.hp, type: t,
        alive: true, hurtAt: -9999, vx: 0, vy: 0,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    ctx.emit(`FPS küldetés indul: ${this.enemies.length} szörny a labirintusban`, "logic");
  }

  private openDirection(): number {
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const x = this.px + Math.cos(a) * 0.8;
      const y = this.py + Math.sin(a) * 0.8;
      if (!this.solid(x, y)) return a;
    }
    return 0;
  }

  isDone() { return this.done; }

  click(xPct: number, yPct: number, now: number) {
    if (this.over) return;
    this.tryShoot(now);
  }

  private solid(x: number, y: number): boolean {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gx < 0 || gy < 0 || gx >= this.size || gy >= this.size) return true;
    return this.grid[gy][gx] > 0;
  }

  /** Sichtlinie (láthatóság) két pont közt – kis lépésekben haladva. */
  private los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 0.12);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solid(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  private tryShoot(now: number) {
    if (now - this.lastShot < 270) return;
    this.lastShot = now;
    this.muzzle = now;
    this.shots++;
    this.ctx.sfx("sfx.laser", 0.8);
    // Hitscan: leghamarabb eső szörny a nézőirány ±4 fokban, fal nélkül
    let best: FpsEnemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.px, dy = e.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > 14) continue;
      let da = Math.atan2(dy, dx) - this.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < 0.075 && d < bestD && this.los(this.px, this.py, e.x, e.y)) {
        best = e; bestD = d;
      }
    }
    if (best) {
      this.hits++;
      best.hp--;
      best.hurtAt = now;
      best.vx += Math.cos(this.a) * 2.4;
      best.vy += Math.sin(this.a) * 2.4;
      const sp = this.screenPos(best);
      if (sp) this.ctx.burst(sp.x, sp.y, 12, "#f87171", 170);
      this.ctx.sfx("sfx.hurt", 0.55);
      if (best.hp <= 0) {
        best.alive = false;
        const st = ENEMY_STATS[best.type];
        this.ctx.addScore(st.score);
        const sp2 = this.screenPos(best);
        if (sp2) this.ctx.burst(sp2.x, sp2.y, 36, "#fb923c", 260);
        this.ctx.sfx("sfx.explosion", 0.8);
        this.ctx.emit(`Szörny leverve! +${st.score} pont`, "logic");
        if (this.enemies.every((e) => !e.alive) && !this.over) {
          this.over = true;
          const acc = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
          this.ctx.addScore(50);
          setTimeout(() => {
            this.done = true;
            this.ctx.finish(true, `Bunker kitisztítva! Pontosság: ${acc}% · +50 bónusz`, this.target);
          }, 650);
        }
      }
    } else {
      // falról pattanó szikra a kereszt előtt
      this.ctx.burst(GW / 2 + (Math.random() - 0.5) * 30, GH / 2 + (Math.random() - 0.5) * 20, 5, "#d4d4d8", 120);
    }
  }

  update(dt: number, now: number) {
    if (this.over) return;
    if (this.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.over = true;
        this.done = true;
        this.ctx.finish(false, "Lejárt az idő – a szörnyek győztek…", this.target);
        return;
      }
    }

    const keys = this.ctx.keys;
    // fordulás: egér oldalra húzása (virtuális joystick) + nyilak / Q,E
    const ptr = this.ctx.pointer();
    const steer = (ptr.x - 50) / 50;
    if (Math.abs(steer) > 0.26) {
      this.a += clamp(steer, -1, 1) * 2.9 * dt * Math.min(1, Math.abs(steer) * 1.35);
    }
    if (keyDown(keys, "ArrowLeft", "q")) this.a -= 2.5 * dt;
    if (keyDown(keys, "ArrowRight", "e")) this.a += 2.5 * dt;

    // mozgás: előre-hátra + oldalra
    let fw = 0, st = 0;
    if (keyDown(keys, "w", "ArrowUp")) fw += 1;
    if (keyDown(keys, "s", "ArrowDown")) fw -= 1;
    if (keyDown(keys, "a")) st -= 1;
    if (keyDown(keys, "d")) st += 1;
    if (fw !== 0 || st !== 0) {
      const len = Math.hypot(fw, st);
      fw /= len; st /= len;
      const dx = (Math.cos(this.a) * fw + Math.cos(this.a + Math.PI / 2) * st) * this.moveSpeed * dt;
      const dy = (Math.sin(this.a) * fw + Math.sin(this.a + Math.PI / 2) * st) * this.moveSpeed * dt;
      if (!this.solid(this.px + dx, this.py)) this.px += dx;
      if (!this.solid(this.px, this.py + dy)) this.py += dy;
      this.walkPhase += dt * 8.5;
    }
    if (keyDown(keys, " ")) this.tryShoot(now);

    // szörnyek: üldözés, ha látnak; ütés, ha túl közel érnek
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.88; e.vy *= 0.88;
      if (this.solid(e.x, e.y)) { e.x -= e.vx * dt * 2; e.y -= e.vy * dt * 2; e.vx = 0; e.vy = 0; }
      const dx = this.px - e.x, dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = ENEMY_STATS[e.type].speed * this.diff;
      if (d > 0.62) {
        if (this.los(e.x, e.y, this.px, this.py)) {
          if (!this.solid(e.x + (dx / d) * sp * dt, e.y)) e.x += (dx / d) * sp * dt;
          if (!this.solid(e.x, e.y + (dy / d) * sp * dt)) e.y += (dy / d) * sp * dt;
        } else {
          // nem látnak: imbolyogva kerülnek közelebb
          e.wobble += dt * 3;
          if (!this.solid(e.x + Math.sin(e.wobble) * sp * dt * 0.5, e.y)) e.x += Math.sin(e.wobble) * sp * dt * 0.5;
          if (!this.solid(e.x, e.y + (dy / d) * sp * dt * 0.5)) e.y += (dy / d) * sp * dt * 0.5;
        }
      } else if (now - this.lastHurt > 950) {
        this.lastHurt = now;
        this.ctx.sfx("sfx.alarm", 0.5);
        const fatal = this.ctx.loseLife();
        if (!fatal) {
          // kis hátralökés a falig
          const bx = this.px - (dx / d) * 0.5;
          const by = this.py - (dy / d) * 0.5;
          if (!this.solid(bx, this.py)) this.px = bx;
          if (!this.solid(this.px, by)) this.py = by;
        } else {
          this.over = true;
          this.done = true;
        }
      }
    }
  }

  /** Szörny képernyő-pozíciója (ha látszik) – robbanásokhoz. */
  private screenPos(e: FpsEnemy): { x: number; y: number } | null {
    const dirX = Math.cos(this.a), dirY = Math.sin(this.a);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;
    const sx = e.x - this.px, sy = e.y - this.py;
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const tY = invDet * (-planeY * sx + planeX * sy);
    if (tY <= 0.25) return null;
    const tX = invDet * (dirY * sx - dirX * sy);
    return { x: (GW / 2) * (1 + tX / tY), y: GH / 2 };
  }

  // ---------- Rajzolás ----------
  render(ctx: CanvasRenderingContext2D, now: number) {
    // ég / padló
    const ceil = ctx.createLinearGradient(0, 0, 0, GH / 2);
    ceil.addColorStop(0, "#1a1208");
    ceil.addColorStop(1, "#3b2410");
    ctx.fillStyle = ceil;
    ctx.fillRect(0, 0, GW, GH / 2);
    const floor = ctx.createLinearGradient(0, GH / 2, 0, GH);
    floor.addColorStop(0, "#241a10");
    floor.addColorStop(1, "#4a3520");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GH / 2, GW, GH / 2);

    const dirX = Math.cos(this.a), dirY = Math.sin(this.a);
    const planeX = -dirY * 0.66, planeY = dirX * 0.66;

    // falak oszloponként (DDA)
    for (let x = 0; x < GW; x++) {
      const camX = (2 * x) / GW - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;
      let mapX = Math.floor(this.px), mapY = Math.floor(this.py);
      const ddx = Math.abs(1 / (rdx || 1e-9));
      const ddy = Math.abs(1 / (rdy || 1e-9));
      let stepX: number, stepY: number, sdx: number, sdy: number;
      if (rdx < 0) { stepX = -1; sdx = (this.px - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - this.px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (this.py - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - this.py) * ddy; }
      let side = 0, tile = 0, guard = 0;
      while (guard++ < 64) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
        else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= this.size || mapY >= this.size) { tile = 1; break; }
        tile = this.grid[mapY][mapX];
        if (tile > 0) break;
      }
      const perp = side === 0
        ? (mapX - this.px + (1 - stepX) / 2) / (rdx || 1e-9)
        : (mapY - this.py + (1 - stepY) / 2) / (rdy || 1e-9);
      const dist = Math.max(0.05, perp);
      this.zbuf[x] = dist;
      const h = Math.min(GH * 8, GH / dist);
      const y0 = GH / 2 - h / 2;
      const base = WALL_COLORS[tile] ?? WALL_COLORS[1];
      const fog = clamp(1 - dist / 12.5, 0.1, 1) * (side === 1 ? 0.68 : 1);
      ctx.fillStyle = `rgb(${Math.round(base[0] * fog)},${Math.round(base[1] * fog)},${Math.round(base[2] * fog)})`;
      ctx.fillRect(x, y0, 1, h);
      // téglavonalak
      if (tile === 1 && x % 5 === 0 && h > 40) {
        ctx.fillStyle = `rgba(0,0,0,${0.16 * fog})`;
        ctx.fillRect(x, y0, 1, h);
      }
    }

    // szörny-sprite-ok (mélység szerint rendezve, oszloponként vágva)
    const vis = this.enemies
      .filter((e) => e.alive)
      .map((e) => ({ e, d: (e.x - this.px) ** 2 + (e.y - this.py) ** 2 }))
      .sort((p, q) => q.d - p.d);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const { e } of vis) {
      const sx = e.x - this.px, sy = e.y - this.py;
      const tX = invDet * (dirY * sx - dirX * sy);
      const tY = invDet * (-planeY * sx + planeX * sy);
      if (tY <= 0.25) continue;
      const scrX = (GW / 2) * (1 + tX / tY);
      const wallH = GH / tY;
      const st = ENEMY_STATS[e.type];
      const sprH = wallH * st.scale;
      const sprW = sprH * 0.72;
      const floorY = GH / 2 + wallH / 2;
      const y0 = floorY - sprH;
      const x0 = Math.round(scrX - sprW / 2);
      const x1 = Math.round(scrX + sprW / 2);
      if (x1 < 0 || x0 > GW) continue;
      const img = this.spriteFor(e.type);
      const bob = Math.sin(now / 240 + e.wobble) * sprH * 0.02;
      for (let col = Math.max(0, x0); col < Math.min(GW, x1); col += 2) {
        if (this.zbuf[col] <= tY) continue;
        const u = (col - x0) / (x1 - x0);
        ctx.drawImage(img, Math.floor(u * img.width), 0, Math.max(1, Math.floor(img.width / ((x1 - x0) / 2))), img.height, col, y0 + bob, 2, sprH);
      }
      // HP-pontok a szörny felett
      if (tY < 7) {
        const bw = sprW * 0.7;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(scrX - bw / 2, y0 + bob - 10, bw, 6);
        ctx.fillStyle = "#f87171";
        ctx.fillRect(scrX - bw / 2 + 1, y0 + bob - 9, (bw - 2) * (e.hp / e.maxHp), 4);
      }
      // találat-villanás
      if (now - e.hurtAt < 110) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(x0, y0 + bob, x1 - x0, sprH);
      }
    }

    // kereszt
    ctx.strokeStyle = "rgba(251,191,36,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(GW / 2 - 14, GH / 2); ctx.lineTo(GW / 2 - 5, GH / 2);
    ctx.moveTo(GW / 2 + 5, GH / 2); ctx.lineTo(GW / 2 + 14, GH / 2);
    ctx.moveTo(GW / 2, GH / 2 - 14); ctx.lineTo(GW / 2, GH / 2 - 5);
    ctx.moveTo(GW / 2, GH / 2 + 5); ctx.lineTo(GW / 2, GH / 2 + 14);
    ctx.stroke();

    // pisztoly (járásnál kileng)
    const bobX = Math.sin(this.walkPhase) * 7;
    const bobY = Math.abs(Math.cos(this.walkPhase)) * 6;
    const gx = GW / 2 + 90 + bobX;
    const gy = GH - 10 + bobY;
    ctx.fillStyle = "#3f3f46";
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx - 34, gy);
    ctx.lineTo(gx - 26, gy - 66);
    ctx.lineTo(gx + 2, gy - 74);
    ctx.lineTo(gx + 26, gy - 48);
    ctx.lineTo(gx + 40, gy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#71717a";
    ctx.fillRect(gx - 22, gy - 58, 16, 20);
    if (now - this.muzzle < 90) {
      const r = 20 + Math.random() * 16;
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.4;
        const px2 = gx - 10 + Math.cos(ang) * rr;
        const py2 = gy - 78 + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.fill();
    }

    this.drawMinimap(ctx);
    this.drawHud(ctx, now);
  }

  private spriteFor(type: FpsEnemy["type"]): HTMLCanvasElement {
    const cached = this.spriteCache.get(type);
    if (cached) return cached;
    const c = document.createElement("canvas");
    c.width = 72; c.height = 100;
    const g = c.getContext("2d")!;
    const col = ENEMY_STATS[type].color;
    if (type === "golem") {
      g.fillStyle = col;
      g.strokeStyle = "#3f3f46";
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(10, 18, 52, 72, 10);
      g.fill(); g.stroke();
      g.fillStyle = "#52525b";
      g.fillRect(18, 34, 36, 14); // szemek helye
      g.fillStyle = "#fbbf24";
      g.fillRect(24, 37, 8, 8);
      g.fillRect(40, 37, 8, 8);
      g.fillStyle = col;
      g.beginPath(); g.roundRect(2, 30, 12, 34, 5); g.fill();
      g.beginPath(); g.roundRect(58, 30, 12, 34, 5); g.fill();
    } else if (type === "wraith") {
      g.fillStyle = col;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.moveTo(36, 8);
      g.bezierCurveTo(64, 26, 60, 70, 36, 92);
      g.bezierCurveTo(12, 70, 8, 26, 36, 8);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = "#09090f";
      g.beginPath(); g.arc(27, 34, 6, 0, Math.PI * 2); g.arc(45, 34, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e0f2fe";
      g.beginPath(); g.arc(27, 34, 2.5, 0, Math.PI * 2); g.arc(45, 34, 2.5, 0, Math.PI * 2); g.fill();
    } else {
      // démon
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(36, 58, 26, 34, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath(); // szarvak
      g.moveTo(16, 34); g.lineTo(6, 8); g.lineTo(26, 26);
      g.moveTo(56, 34); g.lineTo(66, 8); g.lineTo(46, 26);
      g.closePath();
      g.fill();
      g.fillStyle = "#fef08a";
      g.beginPath(); g.ellipse(27, 48, 6, 8, 0.3, 0, Math.PI * 2); g.ellipse(45, 48, 6, 8, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#09090f";
      g.beginPath(); g.arc(27, 48, 2.6, 0, Math.PI * 2); g.arc(45, 48, 2.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#fca5a5";
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(28, 70); g.lineTo(44, 70); g.stroke();
    }
    this.spriteCache.set(type, c);
    return c;
  }

  private drawMinimap(ctx: CanvasRenderingContext2D) {
    const s = 9, ox = GW - 16 - this.size * s, oy = 16;
    ctx.fillStyle = "rgba(9,9,15,0.78)";
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(ox - 6, oy - 6, this.size * s + 12, this.size * s + 12, 8);
    ctx.fill(); ctx.stroke();
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const t = this.grid[y][x];
        if (t > 0) {
          ctx.fillStyle = t === 1 ? "#78716c" : t === 2 ? "#64748b" : "#4d7c0f";
          ctx.fillRect(ox + x * s, oy + y * s, s, s);
        }
      }
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = ENEMY_STATS[e.type].color;
      ctx.beginPath();
      ctx.arc(ox + e.x * s, oy + e.y * s, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // játékos: nyíl a nézőirányban
    ctx.save();
    ctx.translate(ox + this.px * s, oy + this.py * s);
    ctx.rotate(this.a);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-4, -4.5); ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, now: number) {
    const left = this.enemies.filter((e) => e.alive).length;
    // állapotsáv alul
    ctx.fillStyle = "rgba(9,9,15,0.7)";
    ctx.fillRect(0, GH - 44, GW, 44);
    ctx.textBaseline = "middle";
    ctx.font = "700 20px Geist, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Szörnyek: ${left}`, 20, GH - 22);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Találat: ${this.hits}/${this.shots}`, 190, GH - 22);
    if (this.timeLimit > 0) {
      ctx.fillStyle = this.timeLeft < 20 ? "#f87171" : "#d4d4d8";
      ctx.fillText(`Idő: ${Math.ceil(this.timeLeft)}s`, 390, GH - 22);
    }
    ctx.fillStyle = "#71717a";
    ctx.font = "600 16px Geist, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("WASD: mozgás · egér oldalra: fordulás · kattints/Szóköz: lövés", GW - 20, GH - 22);

    // belépő üzenet
    const t = (now - this.startedAt) / 1000;
    if (t < 4) {
      const a = t < 3 ? 1 : 4 - t;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(9,9,15,0.75)";
      ctx.fillRect(0, GH * 0.3, GW, 110);
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.font = "800 40px Geist, system-ui, sans-serif";
      ctx.fillText("KÜLDETÉS: TISZTÍTSD KI A LABIRINTUST!", GW / 2, GH * 0.3 + 44);
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "600 22px Geist, system-ui, sans-serif";
      ctx.fillText("Írj le minden szörnyet, mielőtt ők érnek el téged…", GW / 2, GH * 0.3 + 84);
      ctx.globalAlpha = 1;
    }
    // sérülés-vignetta
    if (now - this.lastHurt < 500) {
      const a = (1 - (now - this.lastHurt) / 500) * 0.4;
      const grad = ctx.createRadialGradient(GW / 2, GH / 2, GH * 0.3, GW / 2, GH / 2, GH * 0.75);
      grad.addColorStop(0, "rgba(239,68,68,0)");
      grad.addColorStop(1, `rgba(239,68,68,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GW, GH);
    }
  }
}
