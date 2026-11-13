// ===== ŰRPÁRBAJ ONLINE – kétjátékos duel webszerveren keresztül =====
// A mini-services/duel-service socket.io szerverével működik: egyik játékos
// szobát nyit (kap egy 4 betűs kódot), a másik csatlakozik – aztán űrhajós
// párbaj: egérrel mozgás, kattintásra lövés. 5 találat, és vége.

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, inRect } from "./base";

type Phase = "lobby" | "join" | "connecting" | "waiting" | "playing" | "over" | "error";

interface DuelState {
  players: { x: number; y: number; hp: number; name: string }[];
  bullets: { x: number; y: number }[];
  you: number;
}

const CODE_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const KEY_ROWS = ["QWERTZUIOP", "ASDFGHJKL", "YXCVBNM"];
// A join-képernyő billentyűzetének geometriája (közös a rajzhoz és a kattintáshoz):
// három sor a 205–363 sávban, az akciógombok külön sorban lejjebb (380–426) –
// így a legszélesebb sor (YXCVBNM → 756-ig) sem laphat át a MEHET-gombbal.
const KEY_Y = 205;
const KEY_X0 = [173, 204, 266];

export class OnlineGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private phase: Phase = "lobby";
  private socket: { emit: (ev: string, data?: unknown) => void; disconnect: () => void } | null = null;
  private code = "";
  private typed = "";
  private state: DuelState | null = null;
  private myX = 50; private myY = 82;
  private lastSent = 0;
  private shootQueued = false;
  private done = false;
  private ended = false;
  private status = "";
  private startedAt = performance.now();
  private hitFlash = 0;
  private stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * GW, y: Math.random() * GH,
    r: Math.random() * 1.6 + 0.4, tw: Math.random() * Math.PI * 2,
  }));

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    ctx.emit("Online párbaj – várakozás a kapcsolatra", "info");
  }

  isDone() { return this.done; }

  destroy() {
    try { this.socket?.disconnect(); } catch { /* már lezárva */ }
    this.socket = null;
  }

  private randomCode(): string {
    let c = "";
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }

  private async connect(code: string, created: boolean) {
    this.phase = "connecting";
    this.status = "Kapcsolódás a szerverhez…";
    try {
      const { io } = await import("socket.io-client");
      const socket = io("/?XTransformPort=3004", {
        transports: ["websocket", "polling"],
        reconnection: false,
        timeout: 6000,
      });
      this.socket = socket;
      socket.on("connect", () => {
        socket.emit("join", { code, name: "Pilóta" });
        this.phase = "waiting";
        this.status = `Várakozás az ellenfélre… · Szoba kód: ${code}`;
        this.ctx.emit(created ? `Online szoba nyitva – kód: ${code}` : `Csatlakozva a(z) ${code} szobához`, "info");
      });
      socket.on("connect_error", () => this.failConnect());
      socket.on("disconnect", () => {
        if (this.phase === "playing") {
          this.phase = "error";
          this.status = "Megszakadt a kapcsolat az ellenféllel.";
        }
      });
      socket.on("start", (st: DuelState) => {
        this.phase = "playing";
        this.state = st;
        this.ctx.emit("Az ellenfél csatlakozott – MEGY A PÁRBAJ!", "logic");
        this.ctx.sfx("sfx.powerup", 0.8);
      });
      socket.on("state", (st: DuelState) => {
        this.state = st;
        if (st.you === 0 || st.you === 1) {
          const me = st.players[st.you];
          if (me && me.hp <= 0) this.onOver(false);
          const foe = st.players[1 - st.you];
          if (foe && foe.hp <= 0) this.onOver(true);
        }
      });
      socket.on("hit", (d: { you: boolean }) => {
        if (d.you) {
          this.hitFlash = performance.now();
          this.ctx.sfx("sfx.hurt", 0.8);
        }
      });
      socket.on("over", (d: { winner: number }) => {
        if (!this.state) return;
        this.onOver(d.winner === this.state.you);
      });
      socket.on("again-wait", () => {
        this.phase = "waiting";
        this.status = "Új parti – várakozás az ellenfélre…";
        this.state = null;
      });
    } catch {
      this.failConnect();
    }
  }

  private failConnect() {
    this.phase = "error";
    this.status = "Nem sikerült elérni a párbaj-szervert. (A szolgáltatás lehet, hogy nem fut.)";
    this.ctx.emit("Online szerver nem elérhető", "warn");
  }

  private onOver(won: boolean) {
    if (this.phase === "over" || this.ended) return;
    this.phase = "over";
    this.ended = true;
    this.ctx.sfx(won ? "sfx.win" : "sfx.gameover", 0.9);
    this.ctx.addScore(won ? 100 : 20);
  }

  click(xPct: number, yPct: number, now: number) {
    const px = (xPct / 100) * GW;
    const py = (yPct / 100) * GH;

    if (this.phase === "lobby") {
      if (inRect(px, py, GW / 2 - 210, 250, 200, 56)) {
        this.code = this.randomCode();
        this.typed = "";
        void this.connect(this.code, true);
      } else if (inRect(px, py, GW / 2 + 10, 250, 200, 56)) {
        this.phase = "join";
        this.typed = "";
      }
      return;
    }
    if (this.phase === "join") {
      // betű-billentyűzet (három sor, az akciógombok FELETTÜK)
      for (let r = 0; r < KEY_ROWS.length; r++) {
        for (let i = 0; i < KEY_ROWS[r].length; i++) {
          const bx = KEY_X0[r] + i * 62;
          if (inRect(px, py, bx, KEY_Y + r * 56, 56, 46)) {
            if (this.typed.length < 4) this.typed += KEY_ROWS[r][i];
            this.ctx.sfx("sfx.click", 0.5);
            return;
          }
        }
      }
      if (inRect(px, py, 660, 380, 120, 46)) { // ⌫
        this.typed = this.typed.slice(0, -1);
        this.ctx.sfx("sfx.pop", 0.5);
        return;
      }
      if (inRect(px, py, 160, 380, 140, 46)) { // vissza
        this.phase = "lobby";
        return;
      }
      if (inRect(px, py, 520, 380, 140, 46) && this.typed.length === 4) { // mehet
        this.code = this.typed;
        void this.connect(this.code, false);
      }
      return;
    }
    if (this.phase === "waiting" || this.phase === "error") {
      if (inRect(px, py, GW / 2 - 100, 430, 200, 50)) {
        this.destroy();
        this.done = true; // csendes kilépés, a léptető megy tovább
        this.ctx.emit("Kiléptél az online párbajból", "info");
      }
      return;
    }
    if (this.phase === "over") {
      if (inRect(px, py, GW / 2 - 210, 400, 200, 54)) {
        this.socket?.emit("again");
        this.phase = "waiting";
        this.status = "Új parti – várakozás az ellenfélre…";
        this.ended = false;
        this.state = null;
      } else if (inRect(px, py, GW / 2 + 10, 400, 200, 54)) {
        this.destroy();
        this.done = true;
        this.ctx.emit("Kiléptél az online párbajból", "info");
      }
      return;
    }
    if (this.phase === "playing") {
      this.shootQueued = true;
      return;
    }
  }

  update(dt: number, now: number) {
    if (this.phase === "playing") {
      const ptr = this.ctx.pointer();
      const k = Math.min(1, dt * 10);
      this.myX += (ptr.x - this.myX) * k;
      this.myY += (ptr.y - this.myY) * k;
      this.myX = clamp(this.myX, 4, 96);
      this.myY = clamp(this.myY, 6, 94);
      if (now - this.lastSent > 66) {
        this.lastSent = now;
        this.socket?.emit("input", { x: this.myX, y: this.myY, shoot: this.shootQueued });
        this.shootQueued = false;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    // csillagos űr
    ctx.fillStyle = "#09090f";
    ctx.fillRect(0, 0, GW, GH);
    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + Math.sin(now / 700 + s.tw) * 0.3;
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.phase === "lobby") this.renderLobby(ctx);
    else if (this.phase === "join") this.renderJoin(ctx);
    else if (this.phase === "waiting" || this.phase === "connecting") this.renderWaiting(ctx);
    else if (this.phase === "playing" || this.phase === "over") this.renderGame(ctx, now);
    else if (this.phase === "error") this.renderError(ctx);
  }

  private title(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pulse = 0.5 + Math.sin(performance.now() / 500) * 0.5;
    ctx.fillStyle = "#22d3ee";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 18 + pulse * 12;
    ctx.font = "800 52px Geist, system-ui, sans-serif";
    ctx.fillText("ŰRPÁRBAJ ONLINE", GW / 2, 120);
    ctx.shadowBlur = 0;
  }

  private renderLobby(ctx: CanvasRenderingContext2D) {
    this.title(ctx);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "600 20px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Játssz egy baráttal két böngészőből – az egyik nyit szobát,", GW / 2, 180);
    ctx.fillText("a másik csatlakozik a 4 betűs kóddal.", GW / 2, 206);

    const hover = this.ctx.pointer();
    const hx = (hover.x / 100) * GW, hy = (hover.y / 100) * GH;
    // Új szoba
    const h1 = inRect(hx, hy, GW / 2 - 210, 250, 200, 56);
    ctx.fillStyle = h1 ? "#22d3ee" : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(GW / 2 - 210, 250, 200, 56, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = h1 ? "#09090f" : "#22d3ee";
    ctx.font = "800 20px Geist, system-ui, sans-serif";
    ctx.fillText("ÚJ SZOBA NYITÁSA", GW / 2 - 110, 279);
    // Csatlakozás
    const h2 = inRect(hx, hy, GW / 2 + 10, 250, 200, 56);
    ctx.fillStyle = h2 ? "#fbbf24" : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = "#fbbf24";
    ctx.beginPath(); ctx.roundRect(GW / 2 + 10, 250, 200, 56, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = h2 ? "#09090f" : "#fbbf24";
    ctx.fillText("CSATLAKOZÁS", GW / 2 + 110, 279);

    ctx.fillStyle = "#71717a";
    ctx.font = "600 16px Geist, system-ui, sans-serif";
    ctx.fillText("A játékban: egér = mozgás, kattintás = lövés · 5 találat dönt", GW / 2, 350);
  }

  private renderJoin(ctx: CanvasRenderingContext2D) {
    this.title(ctx);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "700 22px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Írd be a szoba kódját (4 betű):", GW / 2, 130);

    // kijelző
    ctx.fillStyle = "rgba(24,24,27,0.92)";
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(GW / 2 - 150, 140, 300, 44, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "800 28px Geist, system-ui, sans-serif";
    let shown = "";
    for (let i = 0; i < 4; i++) shown += this.typed[i] ?? "_";
    ctx.fillText(shown.split("").join(" "), GW / 2, 163);

    const ptr = this.ctx.pointer();
    const hx = (ptr.x / 100) * GW, hy = (ptr.y / 100) * GH;
    for (let r = 0; r < KEY_ROWS.length; r++) {
      const row = KEY_ROWS[r];
      for (let i = 0; i < row.length; i++) {
        const bx = KEY_X0[r] + i * 62;
        const by = KEY_Y + r * 56;
        const h = inRect(hx, hy, bx, by, 56, 46);
        ctx.fillStyle = h ? "#22d3ee" : "rgba(39,39,42,0.95)";
        ctx.strokeStyle = "rgba(34,211,238,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(bx, by, 56, 46, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = h ? "#09090f" : "#e0f2fe";
        ctx.font = "800 20px Geist, system-ui, sans-serif";
        ctx.fillText(row[i], bx + 28, by + 24);
      }
    }
    // ⌫ / Vissza / Mehet – SAJÁT sorban a billentyűzet alatt
    const drawAction = (x: number, w: number, label: string, color: string, enabled: boolean) => {
      const h = inRect(hx, hy, x, 380, w, 46) && enabled;
      ctx.fillStyle = h ? color : "rgba(24,24,27,0.92)";
      ctx.strokeStyle = color;
      ctx.globalAlpha = enabled ? 1 : 0.45;
      ctx.beginPath(); ctx.roundRect(x, 380, w, 46, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = h ? "#09090f" : color;
      ctx.font = "800 18px Geist, system-ui, sans-serif";
      ctx.fillText(label, x + w / 2, 404);
      ctx.globalAlpha = 1;
    };
    drawAction(160, 140, "← Vissza", "#a1a1aa", true);
    drawAction(660, 120, "⌫ Törlés", "#f87171", true);
    drawAction(520, 140, "MEHET →", "#fbbf24", this.typed.length === 4);
  }

  private renderWaiting(ctx: CanvasRenderingContext2D) {
    this.title(ctx);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "700 22px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.status || "Kapcsolódás…", GW / 2, 230);
    if (this.code) {
      ctx.fillStyle = "#09090f";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(GW / 2 - 130, 260, 260, 80, 12);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.font = "800 44px Geist, system-ui, sans-serif";
      ctx.fillText(this.code.split("").join(" "), GW / 2, 300);
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "600 17px Geist, system-ui, sans-serif";
      ctx.fillText("Ezt a kódot add meg a barátodnak is (másik böngésző, „Csatlakozás”)", GW / 2, 368);
    }
    const dots = ".".repeat(Math.floor(performance.now() / 400) % 3 + 1);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "700 20px Geist, system-ui, sans-serif";
    ctx.fillText(`Várakozás${dots}`, GW / 2, 402);
    this.drawExit(ctx);
  }

  private renderError(ctx: CanvasRenderingContext2D) {
    this.title(ctx);
    ctx.fillStyle = "#f87171";
    ctx.font = "700 22px Geist, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.status, GW / 2, 240);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 17px Geist, system-ui, sans-serif";
    ctx.fillText("A többi demó offline is működik – próbáld azokat, vagy próbáld újra később.", GW / 2, 272);
    this.drawExit(ctx);
  }

  private drawExit(ctx: CanvasRenderingContext2D) {
    const ptr = this.ctx.pointer();
    const hx = (ptr.x / 100) * GW, hy = (ptr.y / 100) * GH;
    const h = inRect(hx, hy, GW / 2 - 100, 430, 200, 50);
    ctx.fillStyle = h ? "#f87171" : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(GW / 2 - 100, 430, 200, 50, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = h ? "#09090f" : "#f87171";
    ctx.font = "800 19px Geist, system-ui, sans-serif";
    ctx.fillText("Kilépés", GW / 2, 456);
  }

  private renderGame(ctx: CanvasRenderingContext2D, now: number) {
    const st = this.state;
    if (!st) {
      ctx.fillStyle = "#71717a";
      ctx.font = "700 22px Geist, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Szinkronizálás…", GW / 2, GH / 2);
      return;
    }
    const you = st.you ?? 0;
    // golyók
    ctx.fillStyle = "#fde047";
    ctx.shadowColor = "#fde047";
    ctx.shadowBlur = 10;
    for (const b of st.bullets) {
      ctx.beginPath();
      ctx.arc((b.x / 100) * GW, (b.y / 100) * GH, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // hajók
    st.players.forEach((p, i) => {
      if (p.hp <= 0) return;
      const mine = i === you;
      const col = mine ? "#fbbf24" : "#22d3ee";
      ctx.save();
      ctx.translate((p.x / 100) * GW, (p.y / 100) * GH);
      if (mine) ctx.rotate(0);
      // egyszerű hajó-trófea
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(14, 16);
      ctx.lineTo(0, 9);
      ctx.lineTo(-14, 16);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // név + HP
      ctx.textAlign = "center";
      ctx.font = "700 14px Geist, system-ui, sans-serif";
      ctx.fillStyle = col;
      ctx.fillText(mine ? "TE" : "ELLENFÉL", (p.x / 100) * GW, (p.y / 100) * GH - 34);
      for (let h = 0; h < 5; h++) {
        ctx.fillStyle = h < p.hp ? (mine ? "#4ade80" : "#f87171") : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc((p.x / 100) * GW - 30 + h * 15, (p.y / 100) * GH + 36, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // találat-villanás
    if (now - this.hitFlash < 350) {
      ctx.fillStyle = `rgba(239,68,68,${0.35 * (1 - (now - this.hitFlash) / 350)})`;
      ctx.fillRect(0, 0, GW, GH);
    }
    ctx.textAlign = "left";
    ctx.font = "600 17px Geist, system-ui, sans-serif";
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText("Egér: mozgás · Kattintás: lövés", 16, GH - 18);

    if (this.phase === "over") {
      ctx.fillStyle = "rgba(9,9,15,0.8)";
      ctx.fillRect(GW / 2 - 260, 240, 520, 260);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.strokeRect(GW / 2 - 260, 240, 520, 260);
      ctx.textAlign = "center";
      const st2 = this.state;
      const won = st2 && st2.players[1 - st2.you] && st2.players[1 - st2.you].hp <= 0;
      ctx.fillStyle = won ? "#a3e635" : "#f87171";
      ctx.font = "800 44px Geist, system-ui, sans-serif";
      ctx.fillText(won ? "GYŐZTÉL!" : "VESZTETTÉL!", GW / 2, 300);
      ctx.fillStyle = "#d4d4d8";
      ctx.font = "600 19px Geist, system-ui, sans-serif";
      ctx.fillText(won ? "Az ellenfél hajója porrá égett. +100 pont" : "Hajóstörést szenvedtél… +20 pont", GW / 2, 344);

      const ptr = this.ctx.pointer();
      const hx = (ptr.x / 100) * GW, hy = (ptr.y / 100) * GH;
      const h1 = inRect(hx, hy, GW / 2 - 210, 400, 200, 54);
      ctx.fillStyle = h1 ? "#22d3ee" : "rgba(24,24,27,0.92)";
      ctx.strokeStyle = "#22d3ee";
      ctx.beginPath(); ctx.roundRect(GW / 2 - 210, 400, 200, 54, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = h1 ? "#09090f" : "#22d3ee";
      ctx.font = "800 20px Geist, system-ui, sans-serif";
      ctx.fillText("ÚJRA!", GW / 2 - 110, 428);
      const h2 = inRect(hx, hy, GW / 2 + 10, 400, 200, 54);
      ctx.fillStyle = h2 ? "#f87171" : "rgba(24,24,27,0.92)";
      ctx.strokeStyle = "#f87171";
      ctx.beginPath(); ctx.roundRect(GW / 2 + 10, 400, 200, 54, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = h2 ? "#09090f" : "#f87171";
      ctx.fillText("Kilépés", GW / 2 + 110, 428);
    }
  }
}
