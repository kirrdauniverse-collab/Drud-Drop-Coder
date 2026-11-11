// ===== Sprite-rajzoló modul =====
// A motor ÉS a könyvtár-előnézetek közösen használják: így a bal oldali
// "tömböben" pontosan azt látod, ami a vászonra is kerül.

export interface SpriteOpts {
  size: number;
  color: string;
  vx?: number;       // haladási irány (pl. a hal fordulása)
  id?: number;       // animációs fázis eltoltatásához
  now?: number;      // idő (ms) az animációkhoz
  rotation?: number; // pörgés (radián)
  poly?: number[];   // meteor alak-változatosság
}

// Szín árnyalása (világosít / sötétít százalékban)
export function shade(hex: string, percent: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const n = parseInt(m, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r + 255 * percent / 100));
  g = Math.min(255, Math.round(g + 255 * percent / 100));
  b = Math.min(255, Math.round(b + 255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}

// ---------- Klasszikus űrkészlet (a motor örökölt fajtáihoz) ----------

export function drawShipSprite(ctx: CanvasRenderingContext2D, s: number, color: string) {
  ctx.rotate(Math.PI);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s / 2);
  ctx.lineTo(s / 2, s / 2 * 0.85);
  ctx.lineTo(0, s / 2 * 0.45);
  ctx.lineTo(-s / 2, s / 2 * 0.85);
  ctx.closePath();
  ctx.fill();
  const flame = 0.7 + Math.random() * 0.5;
  ctx.fillStyle = "#fb923c";
  ctx.shadowColor = "#fb923c";
  ctx.beginPath();
  ctx.moveTo(-s / 6, s / 2 * 0.45);
  ctx.lineTo(0, s / 2 * 0.9 * flame + s / 2 * 0.4);
  ctx.lineTo(s / 6, s / 2 * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

export function drawMeteorSprite(ctx: CanvasRenderingContext2D, s: number, poly: number[]) {
  ctx.fillStyle = "#78716c";
  ctx.strokeStyle = "#a8a29e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = (s / 2) * (poly[i] ?? 1);
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

export function drawStarSprite(ctx: CanvasRenderingContext2D, s: number, id: number, now: number) {
  const ss = s * (0.85 + Math.sin(now / 260 + id) * 0.15);
  ctx.rotate(Math.sin(now / 900 + id) * 0.25);
  ctx.shadowColor = "#fde047";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#fde047";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? ss / 2 : ss / 2 * 0.45;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

export function drawCloudSprite(ctx: CanvasRenderingContext2D, s: number, color: string) {
  ctx.save();
  ctx.globalAlpha = ctx.globalAlpha * 0.75;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(-s / 3, 0, s / 3.2, 0, Math.PI * 2);
  ctx.arc(0, -s / 6, s / 2.4, 0, Math.PI * 2);
  ctx.arc(s / 3, 0, s / 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- Általános alak-rajzoló (minden stílus) ----------
// A hívó kötelezően a (0,0) középpontba transzformál (ctx.translate).
export function drawSprite(ctx: CanvasRenderingContext2D, style: string, o: SpriteOpts) {
  const s = o.size;
  const c = o.color;
  const now = o.now ?? 0;
  const id = o.id ?? 1;
  const vx = o.vx ?? 0;
  if (o.rotation) ctx.rotate(o.rotation);
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  ctx.fillStyle = c;
  const wob = Math.sin(now / 300 + id) * 0.06;

  switch (style) {
    case "ship":
      drawShipSprite(ctx, s, c);
      break;
    case "meteor":
      drawMeteorSprite(ctx, s, o.poly ?? Array(8).fill(1));
      break;
    case "star":
      drawStarSprite(ctx, s, id, now);
      break;
    case "cloud":
      drawCloudSprite(ctx, s, c);
      break;
    case "ball": {
      const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.1, 0, 0, s / 2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.25, c);
      g.addColorStop(1, shade(c, -30));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "cube": {
      ctx.fillStyle = shade(c, 12);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = c;
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.3);
      ctx.strokeStyle = shade(c, -25);
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
      ctx.strokeStyle = shade(c, 35);
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
      ctx.rotate(vx < 0 ? Math.PI : 0);
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
      const flap = Math.sin(now / 140 + id) * 0.5 + 0.7;
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
      ctx.strokeStyle = shade(c, 40);
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
      const sq = Math.abs(Math.sin(now / 400 + id));
      ctx.scale(0.35 + sq * 0.65, 1);
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = shade(c, 30);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = shade(c, -25);
      ctx.font = `700 ${Math.max(9, s * 0.5)}px system-ui, sans-serif`;
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
      ctx.fillStyle = shade(c, -25);
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
      ctx.strokeStyle = shade(c, 40);
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
      ctx.fillStyle = shade(c, -18);
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
      ctx.strokeStyle = shade(c, 40);
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

    case "satellite": {
      ctx.rotate(Math.sin(now / 1200 + id) * 0.15);
      ctx.shadowBlur = 0;
      // napelemek
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.roundRect(-s * 0.85, -s * 0.14, s * 0.5, s * 0.28, s * 0.03);
      ctx.roundRect(s * 0.35, -s * 0.14, s * 0.5, s * 0.28, s * 0.03);
      ctx.fill();
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1.2;
      for (const bx of [-0.85, 0.35]) {
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo((bx + i * 0.16) * s, -s * 0.14);
          ctx.lineTo((bx + i * 0.16) * s, s * 0.14);
          ctx.stroke();
        }
      }
      // test
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.3, -s * 0.24, s * 0.6, s * 0.48, s * 0.08);
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // antenna
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.24);
      ctx.lineTo(0, -s * 0.42);
      ctx.stroke();
      const blink2 = 0.5 + 0.5 * Math.abs(Math.sin(now / 260 + id));
      ctx.fillStyle = `rgba(248,113,113,${0.4 + blink2 * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, -s * 0.46, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ---------- ÁLLATOK ----------
    case "cat": {
      // fej
      ctx.beginPath();
      ctx.arc(0, s * 0.05, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      // fülek
      ctx.beginPath();
      ctx.moveTo(-s * 0.34, -s * 0.12);
      ctx.lineTo(-s * 0.42, -s * 0.5);
      ctx.lineTo(-s * 0.06, -s * 0.32);
      ctx.closePath();
      ctx.moveTo(s * 0.34, -s * 0.12);
      ctx.lineTo(s * 0.42, -s * 0.5);
      ctx.lineTo(s * 0.06, -s * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // szemek
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(-s * 0.14, -s * 0.02, s * 0.055, s * 0.08, 0, 0, Math.PI * 2);
      ctx.ellipse(s * 0.14, -s * 0.02, s * 0.055, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      // orr + bajusz
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.moveTo(0, s * 0.12);
      ctx.lineTo(-s * 0.05, s * 0.05);
      ctx.lineTo(s * 0.05, s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.2;
      for (const dir of [-1, 1]) {
        for (const dy of [-0.02, 0.06]) {
          ctx.beginPath();
          ctx.moveTo(dir * s * 0.12, s * 0.1 + dy * s);
          ctx.lineTo(dir * s * 0.42, s * 0.06 + dy * s * 1.6);
          ctx.stroke();
        }
      }
      break;
    }
    case "dog": {
      ctx.beginPath();
      ctx.arc(0, s * 0.02, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
      // lógó fülek
      ctx.beginPath();
      ctx.ellipse(-s * 0.34, -s * 0.1, s * 0.12, s * 0.24, 0.3, 0, Math.PI * 2);
      ctx.ellipse(s * 0.34, -s * 0.1, s * 0.12, s * 0.24, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // pofa
      ctx.fillStyle = shade(c, 30);
      ctx.beginPath();
      ctx.ellipse(0, s * 0.16, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(0, s * 0.1, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-s * 0.14, -s * 0.08, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
      ctx.ellipse(s * 0.14, -s * 0.08, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      // nyelv
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.32, s * 0.08, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bunny": {
      // hosszú fülek
      const earTilt = Math.sin(now / 400 + id) * 0.08;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.rotate(dir * 0.28 + earTilt);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.42, s * 0.11, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fbcfe8";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.42, s * 0.05, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.1, s * 0.08, s * 0.04, 0, Math.PI * 2);
      ctx.arc(s * 0.1, s * 0.08, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.moveTo(0, s * 0.18);
      ctx.lineTo(-s * 0.04, s * 0.13);
      ctx.lineTo(s * 0.04, s * 0.13);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "penguin": {
      // test
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.34, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      // has
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.14, s * 0.22, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // szemek
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.1, -s * 0.14, s * 0.045, 0, Math.PI * 2);
      ctx.arc(s * 0.1, -s * 0.14, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      // csőr
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.06);
      ctx.lineTo(-s * 0.06, -s * 0.02);
      ctx.lineTo(s * 0.06, -s * 0.02);
      ctx.closePath();
      ctx.fill();
      // lábak
      ctx.beginPath();
      ctx.ellipse(-s * 0.12, s * 0.48, s * 0.1, s * 0.045, 0, 0, Math.PI * 2);
      ctx.ellipse(s * 0.12, s * 0.48, s * 0.1, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bee": {
      const buzz = Math.sin(now / 40 + id) * 0.1;
      ctx.rotate(buzz * 0.3);
      // szárnyak
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(224,242,254,0.75)";
      const wingFlap = 0.6 + Math.abs(Math.sin(now / 50 + id)) * 0.5;
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, -s * 0.26, s * 0.2, s * 0.12 * wingFlap, -0.5, 0, Math.PI * 2);
      ctx.ellipse(s * 0.1, -s * 0.26, s * 0.2, s * 0.12 * wingFlap, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // test
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.4, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // csíkok
      ctx.fillStyle = "#1e293b";
      for (const cx of [-0.12, 0.08, 0.26]) {
        ctx.beginPath();
        ctx.ellipse(cx * s, 0, s * 0.05, s * 0.27, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // fullánk
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, 0);
      ctx.lineTo(-s * 0.55, -s * 0.06);
      ctx.lineTo(-s * 0.42, s * 0.06);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "butterfly": {
      const flap = 0.55 + Math.abs(Math.sin(now / 160 + id)) * 0.45;
      ctx.shadowBlur = 0;
      // szárnyak
      ctx.fillStyle = c;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.scale(dir * flap, 1);
        ctx.beginPath();
        ctx.ellipse(s * 0.26, -s * 0.16, s * 0.26, s * 0.2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(c, 25);
        ctx.beginPath();
        ctx.ellipse(s * 0.22, s * 0.16, s * 0.18, s * 0.14, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.restore();
      }
      // test
      ctx.fillStyle = "#3f3f46";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.06, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      // tapogatók
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.48, -s * 0.16, -s * 0.44);
      ctx.moveTo(0, -s * 0.3);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.48, s * 0.16, -s * 0.44);
      ctx.stroke();
      break;
    }
    case "dragon": {
      // szárny
      ctx.shadowBlur = 0;
      const flap = 0.75 + Math.sin(now / 200 + id) * 0.25;
      ctx.fillStyle = shade(c, 35);
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.scale(1, 1);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.1);
        ctx.quadraticCurveTo(dir * s * 0.55, -s * 0.55 * flap, dir * s * 0.6, -s * 0.05);
        ctx.quadraticCurveTo(dir * s * 0.35, -s * 0.05, 0, s * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // test
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.24, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      // farok
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.quadraticCurveTo(s * 0.12, s * 0.6, -s * 0.05, s * 0.62);
      ctx.quadraticCurveTo(s * 0.02, s * 0.5, -s * 0.1, s * 0.42);
      ctx.closePath();
      ctx.fill();
      // fej
      ctx.beginPath();
      ctx.arc(0, -s * 0.38, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      // szarvak
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.48);
      ctx.lineTo(-s * 0.14, -s * 0.62);
      ctx.lineTo(-s * 0.04, -s * 0.5);
      ctx.moveTo(s * 0.1, -s * 0.48);
      ctx.lineTo(s * 0.14, -s * 0.62);
      ctx.lineTo(s * 0.04, -s * 0.5);
      ctx.fill();
      // szem
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.arc(-s * 0.06, -s * 0.4, s * 0.03, 0, Math.PI * 2);
      ctx.arc(s * 0.06, -s * 0.4, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "robot": {
      // antenna
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.4);
      ctx.lineTo(0, -s * 0.55);
      ctx.stroke();
      const blink = 0.5 + 0.5 * Math.abs(Math.sin(now / 300 + id));
      ctx.fillStyle = `rgba(248,113,113,${0.4 + blink * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, -s * 0.58, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // fej
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.32, -s * 0.4, s * 0.64, s * 0.5, s * 0.08);
      ctx.fill();
      // szemek
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(-s * 0.13, -s * 0.16, s * 0.075, 0, Math.PI * 2);
      ctx.arc(s * 0.13, -s * 0.16, s * 0.075, 0, Math.PI * 2);
      ctx.fill();
      // száj
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(-s * 0.16 + i * s * 0.1, -s * 0.02);
        ctx.lineTo(-s * 0.12 + i * s * 0.1, -s * 0.02);
      }
      ctx.stroke();
      // test
      ctx.fillStyle = shade(c, -15);
      ctx.beginPath();
      ctx.roundRect(-s * 0.24, s * 0.12, s * 0.48, s * 0.34, s * 0.06);
      ctx.fill();
      // gombok
      ctx.fillStyle = blink > 0.5 ? "#a3e635" : "#fb923c";
      ctx.beginPath();
      ctx.arc(-s * 0.09, s * 0.28, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(s * 0.09, s * 0.28, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "spider": {
      ctx.shadowBlur = 0;
      // lábak
      ctx.strokeStyle = shade(c, -20);
      ctx.lineWidth = Math.max(1.5, s * 0.045);
      const step = Math.sin(now / 120 + id) * 0.12;
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const ay = -s * 0.18 + i * s * 0.14;
          const bend = (i % 2 === 0 ? 1 : -1) * step;
          ctx.beginPath();
          ctx.moveTo(dir * s * 0.14, ay);
          ctx.quadraticCurveTo(dir * s * 0.38, ay - s * 0.12 + bend * s, dir * s * 0.46, ay + s * 0.08 - bend * s);
          ctx.stroke();
        }
      }
      // test
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.26, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(c, 25);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.16, s * 0.16, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      // szemek
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.arc(-s * 0.06, -s * 0.17, s * 0.03, 0, Math.PI * 2);
      ctx.arc(s * 0.06, -s * 0.17, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "frog": {
      ctx.shadowBlur = 0;
      // lábak
      ctx.fillStyle = shade(c, -15);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(dir * s * 0.26, s * 0.3, s * 0.16, s * 0.08, dir * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // test
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.08, s * 0.38, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // szemgumók
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.2, s * 0.13, 0, Math.PI * 2);
      ctx.arc(s * 0.18, -s * 0.2, s * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.22, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.18, -s * 0.22, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 0.22, s * 0.04, 0, Math.PI * 2);
      ctx.arc(s * 0.18, -s * 0.22, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // szájpersely
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, s * 0.02, s * 0.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
      break;
    }
    case "turtle": {
      ctx.shadowBlur = 0;
      // lábak
      ctx.fillStyle = shade(c, -18);
      for (const [dx, dy] of [[-0.32, 0.12], [0.32, 0.12], [-0.26, -0.22], [0.26, -0.22]]) {
        ctx.beginPath();
        ctx.ellipse(dx * s, dy * s, s * 0.12, s * 0.08, dx * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // fej
      ctx.beginPath();
      ctx.arc(0, -s * 0.34, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.05, -s * 0.36, s * 0.025, 0, Math.PI * 2);
      ctx.arc(s * 0.05, -s * 0.36, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
      // páncél
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.06, s * 0.34, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      // páncél minta
      ctx.strokeStyle = shade(c, -30);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.06, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.22, s * 0.06 + Math.sin(a) * s * 0.18);
        ctx.lineTo(Math.cos(a) * s * 0.34, s * 0.06 + Math.sin(a) * s * 0.28);
        ctx.stroke();
      }
      break;
    }
    case "whale": {
      ctx.rotate(vx < 0 ? Math.PI : 0);
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.2, -s * 0.35, s * 0.25, -s * 0.18);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.12, s * 0.5, s * 0.02);
      ctx.quadraticCurveTo(s * 0.3, s * 0.3, -s * 0.1, s * 0.28);
      ctx.quadraticCurveTo(-s * 0.42, s * 0.26, -s * 0.5, s * 0.05);
      ctx.closePath();
      ctx.fill();
      // farok
      ctx.beginPath();
      ctx.moveTo(-s * 0.46, s * 0.06);
      ctx.quadraticCurveTo(-s * 0.62, -s * 0.1, -s * 0.72, -s * 0.22);
      ctx.quadraticCurveTo(-s * 0.62, s * 0.05, -s * 0.66, s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // has
      ctx.fillStyle = shade(c, 40);
      ctx.beginPath();
      ctx.ellipse(s * 0.05, s * 0.16, s * 0.32, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // szem
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 0.06, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // vízsugár
      ctx.strokeStyle = "rgba(165,243,252,0.9)";
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.24, -s * 0.42, s * 0.14, -s * 0.5);
      ctx.moveTo(s * 0.2, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.32, -s * 0.38, s * 0.42, -s * 0.44);
      ctx.stroke();
      break;
    }
    case "octopus": {
      ctx.shadowBlur = 0;
      // tapogatók
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.11;
      ctx.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const bx = -s * 0.3 + i * s * 0.15;
        const sway = Math.sin(now / 300 + id + i) * s * 0.08;
        ctx.beginPath();
        ctx.moveTo(bx, s * 0.1);
        ctx.quadraticCurveTo(bx + sway, s * 0.34, bx + sway * 2 - s * 0.05, s * 0.48);
        ctx.stroke();
      }
      // fej
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, -s * 0.08, s * 0.36, Math.PI, 0);
      ctx.quadraticCurveTo(s * 0.38, s * 0.12, s * 0.22, s * 0.16);
      ctx.lineTo(-s * 0.22, s * 0.16);
      ctx.quadraticCurveTo(-s * 0.38, s * 0.12, -s * 0.36, -s * 0.08);
      ctx.closePath();
      ctx.fill();
      // szemek
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-s * 0.13, -s * 0.08, s * 0.08, 0, Math.PI * 2);
      ctx.arc(s * 0.13, -s * 0.08, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.13, -s * 0.08, s * 0.04, 0, Math.PI * 2);
      ctx.arc(s * 0.13, -s * 0.08, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // mosoly
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.12, 0.3, Math.PI - 0.3);
      ctx.stroke();
      break;
    }
    case "crab": {
      ctx.shadowBlur = 0;
      // lábak
      ctx.strokeStyle = shade(c, -15);
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(dir * s * 0.2, s * 0.1 + i * s * 0.08);
          ctx.lineTo(dir * s * 0.42, s * 0.2 + i * s * 0.1);
          ctx.stroke();
        }
      }
      // ollók
      ctx.fillStyle = c;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.24, -s * 0.1);
        ctx.lineTo(dir * s * 0.42, -s * 0.3);
        ctx.lineTo(dir * s * 0.5, -s * 0.16);
        ctx.lineTo(dir * s * 0.3, -s * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.46, -s * 0.22);
        ctx.lineTo(dir * s * 0.6, -s * 0.3);
        ctx.lineTo(dir * s * 0.48, -s * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      // test
      ctx.beginPath();
      ctx.ellipse(0, s * 0.08, s * 0.3, s * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // szem-nyelek
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.05;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.1, -s * 0.06);
        ctx.lineTo(dir * s * 0.12, -s * 0.28);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-s * 0.12, -s * 0.3, s * 0.06, 0, Math.PI * 2);
      ctx.arc(s * 0.12, -s * 0.3, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-s * 0.12, -s * 0.3, s * 0.03, 0, Math.PI * 2);
      ctx.arc(s * 0.12, -s * 0.3, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ---------- TÁRGYAK ----------
    case "cactus": {
      ctx.shadowBlur = 0;
      // cserép
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, s * 0.34);
      ctx.lineTo(s * 0.22, s * 0.34);
      ctx.lineTo(s * 0.16, s * 0.52);
      ctx.lineTo(-s * 0.16, s * 0.52);
      ctx.closePath();
      ctx.fill();
      // törzs
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.12, -s * 0.45, s * 0.24, s * 0.82, s * 0.12);
      ctx.fill();
      // karok
      ctx.beginPath();
      ctx.roundRect(-s * 0.42, -s * 0.2, s * 0.16, s * 0.4, s * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-s * 0.42, -s * 0.28, s * 0.34, s * 0.16, s * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(s * 0.26, -s * 0.32, s * 0.16, s * 0.36, s * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(s * 0.08, -s * 0.4, s * 0.34, s * 0.16, s * 0.08);
      ctx.fill();
      // virág
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(0, -s * 0.48, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sun": {
      const spin = now / 900;
      ctx.rotate(spin);
      ctx.strokeStyle = shade(c, 20);
      ctx.lineWidth = Math.max(2, s * 0.06);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34);
        ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
        ctx.stroke();
      }
      ctx.rotate(-spin);
      const g = ctx.createRadialGradient(-s * 0.08, -s * 0.08, s * 0.05, 0, 0, s * 0.32);
      g.addColorStop(0, "#fff7ed");
      g.addColorStop(0.5, c);
      g.addColorStop(1, shade(c, -15));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bolt": {
      ctx.beginPath();
      ctx.moveTo(s * 0.08, -s * 0.5);
      ctx.lineTo(-s * 0.28, s * 0.06);
      ctx.lineTo(-s * 0.02, s * 0.06);
      ctx.lineTo(-s * 0.12, s * 0.5);
      ctx.lineTo(s * 0.28, -s * 0.08);
      ctx.lineTo(s * 0.02, -s * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "gear": {
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? s * 0.5 : s * 0.36;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(c, 35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "gem": {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(s * 0.4, -s * 0.1);
      ctx.lineTo(s * 0.24, s * 0.45);
      ctx.lineTo(-s * 0.24, s * 0.45);
      ctx.lineTo(-s * 0.4, -s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // csillogás
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.1);
      ctx.lineTo(s * 0.4, -s * 0.1);
      ctx.moveTo(0, -s * 0.45);
      ctx.lineTo(-s * 0.16, -s * 0.1);
      ctx.lineTo(0, s * 0.45);
      ctx.lineTo(s * 0.16, -s * 0.1);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "crown": {
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.3);
      ctx.lineTo(-s * 0.42, -s * 0.1);
      ctx.lineTo(-s * 0.2, s * 0.08);
      ctx.lineTo(0, -s * 0.4);
      ctx.lineTo(s * 0.2, s * 0.08);
      ctx.lineTo(s * 0.42, -s * 0.1);
      ctx.lineTo(s * 0.42, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // drágakövek
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.arc(-s * 0.22, s * 0.16, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(0, s * 0.16, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a3e635";
      ctx.beginPath();
      ctx.arc(s * 0.22, s * 0.16, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "cake": {
      ctx.shadowBlur = 0;
      // tányér
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.ellipse(0, s * 0.44, s * 0.44, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      // alsó réteg
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.32, s * 0.08, s * 0.64, s * 0.34, s * 0.05);
      ctx.fill();
      // felső réteg
      ctx.fillStyle = shade(c, 18);
      ctx.beginPath();
      ctx.roundRect(-s * 0.22, -s * 0.18, s * 0.44, s * 0.26, s * 0.05);
      ctx.fill();
      // máz csepp
      ctx.fillStyle = "#fbcfe8";
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(-s * 0.18 + i * s * 0.09, -s * 0.18, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      // gyertya
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-s * 0.02, -s * 0.42, s * 0.04, s * 0.24);
      const flame = 0.8 + Math.sin(now / 90 + id) * 0.3;
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.48, s * 0.035, s * 0.07 * flame, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "donut": {
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // máz
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b45309";
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // szórszok
      const cols = ["#f87171", "#22d3ee", "#a3e635", "#fde047", "#f472b6"];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = s * 0.3;
        ctx.save();
        ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
        ctx.rotate(a + 0.8);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-s * 0.05, -s * 0.018, s * 0.1, s * 0.036);
        ctx.restore();
      }
      break;
    }
    case "gift": {
      ctx.shadowBlur = 0;
      // doboz
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.34, -s * 0.16, s * 0.68, s * 0.58, s * 0.05);
      ctx.fill();
      // fedél
      ctx.fillStyle = shade(c, 15);
      ctx.beginPath();
      ctx.roundRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.18, s * 0.04);
      ctx.fill();
      // szalag
      ctx.fillStyle = "#fde047";
      ctx.fillRect(-s * 0.07, -s * 0.3, s * 0.14, s * 0.72);
      // masni
      ctx.beginPath();
      ctx.ellipse(-s * 0.11, -s * 0.4, s * 0.12, s * 0.08, -0.4, 0, Math.PI * 2);
      ctx.ellipse(s * 0.11, -s * 0.4, s * 0.12, s * 0.08, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "chest": {
      ctx.shadowBlur = 0;
      // láda teste
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.roundRect(-s * 0.4, -s * 0.05, s * 0.8, s * 0.45, s * 0.05);
      ctx.fill();
      // fedél
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.05);
      ctx.quadraticCurveTo(0, -s * 0.55, s * 0.4, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      // fém sávok
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.05);
      ctx.lineTo(s * 0.4, -s * 0.05);
      ctx.moveTo(0, -s * 0.32);
      ctx.lineTo(0, s * 0.4);
      ctx.stroke();
      // zár
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.roundRect(-s * 0.07, -s * 0.12, s * 0.14, s * 0.16, s * 0.02);
      ctx.fill();
      break;
    }
    case "sword": {
      ctx.rotate(-Math.PI / 5);
      ctx.shadowBlur = 0;
      // penge
      const g = ctx.createLinearGradient(-s * 0.07, 0, s * 0.07, 0);
      g.addColorStop(0, "#94a3b8");
      g.addColorStop(0.5, "#f8fafc");
      g.addColorStop(1, "#64748b");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(s * 0.07, -s * 0.4);
      ctx.lineTo(s * 0.05, s * 0.12);
      ctx.lineTo(-s * 0.05, s * 0.12);
      ctx.lineTo(-s * 0.07, -s * 0.4);
      ctx.closePath();
      ctx.fill();
      // keresztvas
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.22, s * 0.12, s * 0.44, s * 0.08, s * 0.03);
      ctx.fill();
      // nyél + gomb
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-s * 0.035, s * 0.2, s * 0.07, s * 0.24);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, s * 0.48, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "door": {
      ctx.shadowBlur = 0;
      // keret
      ctx.fillStyle = shade(c, -30);
      ctx.beginPath();
      ctx.roundRect(-s * 0.32, -s * 0.5, s * 0.64, s, s * 0.06);
      ctx.fill();
      // ajtó
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-s * 0.25, -s * 0.43, s * 0.5, s * 0.86, s * 0.04);
      ctx.fill();
      // panelek
      ctx.strokeStyle = shade(c, -25);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-s * 0.17, -s * 0.33, s * 0.34, s * 0.3, s * 0.03);
      ctx.roundRect(-s * 0.17, s * 0.05, s * 0.34, s * 0.32, s * 0.03);
      ctx.stroke();
      // kilincs
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(s * 0.15, s * 0.04, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
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
