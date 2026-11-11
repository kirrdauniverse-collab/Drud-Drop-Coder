// ===== Háttér-rajzoló modul =====
// A motor és a könyvtár-előnézetek közösen használják.
// Mindig 960×540-es koordinátákban rajzol – a hívó skálázhatja (ctx.scale).

export interface BgStar { x: number; y: number; r: number; tw: number; }

export const BG_W = 960;
export const BG_H = 540;

// Előnézetekhez determinisztikus csillagmező
export const THUMB_STARS: BgStar[] = Array.from({ length: 90 }, (_, i) => {
  const seed = ((i + 1) * 2654435761) % 4294967296;
  const r1 = (seed % 1000) / 1000;
  const r2 = ((seed >>> 8) % 1000) / 1000;
  const r3 = ((seed >>> 16) % 1000) / 1000;
  return { x: r1 * BG_W, y: r2 * BG_H, r: r3 * 1.6 + 0.4, tw: r3 * Math.PI * 2 };
});

export function makeStarfield(): BgStar[] {
  return Array.from({ length: 90 }, () => ({
    x: Math.random() * BG_W,
    y: Math.random() * BG_H,
    r: Math.random() * 1.6 + 0.4,
    tw: Math.random() * Math.PI * 2,
  }));
}

export interface BgPresetDef {
  value: string;
  label: string;
  icon: string;
}

// A választható háttér-készlet (a blokk-könyvtár is ebből épül)
export const BG_PRESETS: BgPresetDef[] = [
  { value: "space", label: "Űr (csillagokkal)", icon: "Sparkles" },
  { value: "night", label: "Éjszakai város", icon: "Moon" },
  { value: "sunset", label: "Naplemente", icon: "Sunset" },
  { value: "sky", label: "Napos ég (felhős)", icon: "CloudSun" },
  { value: "ocean", label: "Óceán", icon: "Waves" },
  { value: "underwater", label: "Víz alatti világ", icon: "Fish" },
  { value: "beach", label: "Tengerpart", icon: "Umbrella" },
  { value: "forest", label: "Erdő", icon: "TreePine" },
  { value: "desert", label: "Sivatag (dűnékkel)", icon: "Sun" },
  { value: "mountains", label: "Havas hegyek", icon: "MountainSnow" },
  { value: "snow", label: "Téli táj (havazás)", icon: "CloudSnow" },
  { value: "neon", label: "Neon rács (synthwave)", icon: "AudioWaveform" },
  { value: "city", label: "Város nappal", icon: "Building2" },
  { value: "road", label: "Országút (futópálya)", icon: "Car" },
  { value: "moon", label: "Holdfelszín", icon: "CircleDot" },
  { value: "candy", label: "Cukorborsó világ", icon: "Candy" },
  { value: "rainbow", label: "Szivárványos ég", icon: "Rainbow" },
  { value: "lava", label: "Lávafolyam", icon: "Flame" },
  { value: "checker", label: "Sakktábla", icon: "LayoutGrid" },
];

export function bgPresetLabel(v: string): string {
  return BG_PRESETS.find((p) => p.value === v)?.label ?? v;
}

// Előre definiált hátterek rajzolása (960×540 koordináta-rendszerben)
export function drawBgPreset(ctx: CanvasRenderingContext2D, preset: string, now: number, stars: BgStar[]) {
  const W = BG_W, H = BG_H;
  switch (preset) {
    case "space": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b0b23");
      g.addColorStop(0.6, "#141033");
      g.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
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
    case "sky": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#38bdf8");
      g.addColorStop(0.7, "#7dd3fc");
      g.addColorStop(1, "#bae6fd");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // nap
      ctx.fillStyle = "#fef9c3";
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 70;
      ctx.beginPath();
      ctx.arc(W * 0.78, H * 0.22, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // sodródó felhők
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 260 + now / 60) % (W + 260)) - 130;
        const cy = H * (0.16 + (i % 3) * 0.14);
        const cs = 34 + (i % 2) * 16;
        ctx.beginPath();
        ctx.arc(cx - cs * 0.7, cy, cs * 0.5, 0, Math.PI * 2);
        ctx.arc(cx, cy - cs * 0.28, cs * 0.65, 0, Math.PI * 2);
        ctx.arc(cx + cs * 0.75, cy, cs * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      // zöld rét
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.ellipse(W * 0.3, H * 0.88, 260, 42, 0, 0, Math.PI * 2);
      ctx.ellipse(W * 0.75, H * 0.94, 300, 50, 0, 0, Math.PI * 2);
      ctx.fill();
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
      for (const s of stars.slice(0, 60)) {
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
    case "beach": {
      // ég
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      g.addColorStop(0, "#38bdf8");
      g.addColorStop(1, "#bae6fd");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H * 0.55);
      // tenger
      const sg = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.75);
      sg.addColorStop(0, "#0284c7");
      sg.addColorStop(1, "#0ea5e9");
      ctx.fillStyle = sg;
      ctx.fillRect(0, H * 0.45, W, H * 0.3);
      // habos hullámok
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const by = H * (0.52 + i * 0.07);
        for (let x = 0; x <= W; x += 12) {
          const y = by + Math.sin(x / 70 + now / 500 + i * 2) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // homok
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.moveTo(0, H * 0.72);
      ctx.quadraticCurveTo(W * 0.5, H * 0.66, W, H * 0.74);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      // napernyő
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(W * 0.78, H * 0.62);
      ctx.lineTo(W * 0.74, H * 0.82);
      ctx.stroke();
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.moveTo(W * 0.78, H * 0.62);
      ctx.arc(W * 0.78, H * 0.62, 74, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.moveTo(W * 0.78, H * 0.62);
      ctx.arc(W * 0.78, H * 0.62, 74, Math.PI + 0.5, Math.PI + 1.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "rainbow": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#e0f2fe");
      g.addColorStop(0.6, "#f0f9ff");
      g.addColorStop(1, "#fef9c3");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // felhők
      ctx.fillStyle = "#f8fafc";
      for (const cx of [W * 0.16, W * 0.84]) {
        ctx.beginPath();
        ctx.arc(cx - 40, H * 0.74, 30, 0, Math.PI * 2);
        ctx.arc(cx, H * 0.68, 42, 0, Math.PI * 2);
        ctx.arc(cx + 44, H * 0.74, 30, 0, Math.PI * 2);
        ctx.fill();
      }
      // szivárvány
      const cols = ["#f87171", "#fb923c", "#fde047", "#a3e635", "#22d3ee", "#818cf8"];
      ctx.lineWidth = 22;
      for (let i = 0; i < cols.length; i++) {
        ctx.strokeStyle = cols[i];
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.78, 300 - i * 24, Math.PI, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "lava": {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#18181b");
      g.addColorStop(0.55, "#292524");
      g.addColorStop(1, "#450a0a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // izzó repedések
      const glow = 0.55 + 0.45 * Math.sin(now / 600);
      ctx.strokeStyle = `rgba(249,115,22,${0.55 + glow * 0.35})`;
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.82);
      for (let x = 0; x <= W; x += 60) {
        ctx.lineTo(x, H * (0.78 + Math.sin(x / 130) * 0.06));
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W * 0.1, 0);
      ctx.quadraticCurveTo(W * 0.25, H * 0.4, W * 0.18, H * 0.78);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W * 0.86, 0);
      ctx.quadraticCurveTo(W * 0.72, H * 0.45, W * 0.8, H * 0.78);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // bugyborékoló láva-tavak
      for (let i = 0; i < 5; i++) {
        const bx = W * (0.12 + i * 0.19);
        const pulse = 0.6 + 0.4 * Math.sin(now / 400 + i * 2);
        ctx.fillStyle = `rgba(234,88,12,${0.5 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(bx, H * (0.9 + (i % 2) * 0.04), 46 + pulse * 14, 12 + pulse * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "checker": {
      const c1 = "#1e293b", c2 = "#334155";
      const cell = 60;
      for (let y = 0; y < H / cell; y++) {
        for (let x = 0; x < W / cell; x++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      // halvány fény-ugrás
      const sweep = ((now / 24) % (W + 300)) - 150;
      const g = ctx.createLinearGradient(sweep - 150, 0, sweep + 150, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.07)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
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
      for (const s of stars) {
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
      for (const s of stars.slice(0, 40)) {
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
