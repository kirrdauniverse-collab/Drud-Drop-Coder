// ===== GRAFIKUS KALAND – pont-és-kattintós fejtörő =====
// Jelenetek, vizsgálható pontok, leltár (inventory) és tárgy-használat:
// kattints mindenre, gyűjtsd össze a kellő tárgyakat, és érd el a célt!

import type { GameCtx, GameMode } from "./base";
import { GW, GH, clamp, inRect } from "./base";
import { drawSprite } from "../sprites";
import { drawBgPreset, makeStarfield } from "../backgrounds";

interface Hotspot {
  x: number; y: number; w: number; h: number; // %-ban
  label: string;
  text: string;
  gives?: string;
  needs?: string;
  lockedText?: string;
  next?: number;
  win?: string;
  points?: number;
}

interface Scene {
  title: string;
  bg: string;
  props: { style: string; x: number; y: number; size: number; color?: string }[];
  hotspots: Hotspot[];
}

interface Story {
  title: string;
  scenes: Scene[];
}

const STORIES: Record<string, Story> = {
  kastely: {
    title: "A Kastély relikviája",
    scenes: [
      {
        title: "1. jelenet – Ködös erdő",
        bg: "forest",
        props: [
          { style: "tree", x: 10, y: 66, size: 120, color: "#14532d" },
          { style: "tree", x: 30, y: 72, size: 90, color: "#166534" },
          { style: "tree", x: 84, y: 68, size: 110, color: "#14532d" },
          { style: "flower", x: 18, y: 84, size: 26, color: "#f472b6" },
          { style: "flower", x: 64, y: 86, size: 22, color: "#fbbf24" },
          { style: "mushroom", x: 44, y: 84, size: 24, color: "#ef4444" },
        ],
        hotspots: [
          {
            x: 46, y: 62, w: 14, h: 24, label: "Öreg kút",
            text: "Bedugod a kezed a hideg vízbe… valami fémeset érsz el!",
            gives: "Kulcs", points: 30,
          },
          {
            x: 70, y: 54, w: 16, h: 20, label: "Furcsa kő",
            text: "A kő alatt béka alszik. „Hagyj aludni!” – mondja a tekintete.",
            points: 10,
          },
          {
            x: 12, y: 40, w: 16, h: 20, label: "Baglyocska",
            text: "A bagoly bölcsen bámul rád: „A kapu kulcsot kér, a láda fényt.”",
            points: 10,
          },
          {
            x: 30, y: 76, w: 30, h: 18, label: "Ösvény a dombra →",
            text: "Az ösvény a kastély kapujához vezet…",
            next: 1, points: 15,
          },
        ],
      },
      {
        title: "2. jelenet – A kastély kapuja",
        bg: "mountains",
        props: [
          { style: "castle", x: 50, y: 52, size: 230, color: "#a8a29e" },
          { style: "tree", x: 8, y: 74, size: 90, color: "#14532d" },
          { style: "tree", x: 92, y: 74, size: 90, color: "#14532d" },
          { style: "bat" as string, x: 76, y: 24, size: 26, color: "#71717a" },
        ],
        hotspots: [
          {
            x: 44, y: 46, w: 12, h: 22, label: "Kapcsos kapu",
            text: "A rozsdás zárban megfordul a kulcs – a kapu nyikorogva kitárul!",
            needs: "Kulcs",
            lockedText: "A kapu zárva. A kulcslyuk pókhálóktól nyálkás… kellene egy kulcs.",
            next: 2, points: 30,
          },
          {
            x: 20, y: 60, w: 14, h: 22, label: "Kőszobor",
            text: "Az öreg király szobra. Talapzatán vésett felirat: „A fény leplezi le, ami rejtve van.”",
            points: 10,
          },
          {
            x: 74, y: 62, w: 16, h: 18, label: "Tövisbokor",
            text: "A bokor mélyén csillog valami… de a tüskék túl erősek. Inkább nem.",
            points: 5,
          },
          {
            x: 4, y: 82, w: 18, h: 14, label: "← Vissza az erdőbe",
            text: "Visszalopódzol a ködös erdőbe.",
            next: 0,
          },
        ],
      },
      {
        title: "3. jelenet – A trónterem",
        bg: "checker",
        props: [
          { style: "chest", x: 70, y: 62, size: 80, color: "#b45309" },
          { style: "dragon", x: 24, y: 34, size: 100, color: "#475569" },
          { style: "sword", x: 88, y: 66, size: 56, color: "#e2e8f0" },
          { style: "gem", x: 12, y: 66, size: 30, color: "#67e8f9" },
        ],
        hotspots: [
          {
            x: 8, y: 30, w: 14, h: 22, label: "Fáklya a falon",
            text: "Leemeled a lobogó fáklyát – meleg, arany fényt áraszt.",
            gives: "Fáklya", points: 20,
          },
          {
            x: 62, y: 52, w: 16, h: 20, label: "Ősi láda",
            text: "A fáklya fényénél meglátod a zárat – a láda kinyílik! BENNE A RELIKVIA!",
            needs: "Fáklya",
            lockedText: "Odabent sötét honol – nem látsz semmit. Kellene valami világítás…",
            gives: "Relikvia", points: 40,
          },
          {
            x: 16, y: 22, w: 18, h: 22, label: "Sárkánycsontváz",
            text: "Az őrsárkány csontváza. Már nem éhes – szerencsédre.",
            points: 10,
          },
          {
            x: 4, y: 84, w: 26, h: 12, label: "← Ki a kastélyból (ha megvan a relikvia)",
            text: "",
            needs: "Relikvia",
            lockedText: "Kár lenne üres kézzel hazamenni – találd meg a relikviát!",
            win: "Visszahoztad a Szent Relikviát a falunak – HŐS VAGY!",
            points: 50,
          },
        ],
      },
    ],
  },
  urbazis: {
    title: "Űrbázis rejtélye",
    scenes: [
      {
        title: "1. jelenet – Dokk",
        bg: "space",
        props: [
          { style: "satellite", x: 84, y: 24, size: 60, color: "#e2e8f0" },
          { style: "planet", x: 12, y: 20, size: 60, color: "#a78bfa" },
          { style: "robot", x: 76, y: 70, size: 56, color: "#60a5fa" },
          { style: "crate" as string, x: 20, y: 74, size: 52, color: "#94a3b8" },
        ],
        hotspots: [
          {
            x: 68, y: 58, w: 16, h: 22, label: "Szervizrobot",
            text: "R2-HU piros szemekkel villog: „KÁR-TYAAA… engedééély…” – és mutogat az ajtó felé.",
            points: 15,
          },
          {
            x: 14, y: 62, w: 14, h: 20, label: "Rakládák",
            text: "A ládák közt egy eltévedt belépőkártya lapul!",
            gives: "Kártya", points: 30,
          },
          {
            x: 42, y: 46, w: 16, h: 24, label: "Biztonsági ajtó",
            text: "A kártya csippje zöldre vált – az ajtó szisszenve nyílik!",
            needs: "Kártya",
            lockedText: "„ÉRVÉNYES KÁRTYA SZÜKSÉGES” – villog a piros jelzés.",
            next: 1, points: 25,
          },
        ],
      },
      {
        title: "2. jelenet – Irányító terem",
        bg: "neon",
        props: [
          { style: "ufo", x: 50, y: 20, size: 70, color: "#a3e635" },
          { style: "gear", x: 16, y: 40, size: 50, color: "#94a3b8" },
          { style: "battery" as string, x: 80, y: 64, size: 44, color: "#a3e635" },
        ],
        hotspots: [
          {
            x: 74, y: 56, w: 14, h: 18, label: "Tartalék akku",
            text: "Felkapod a súlyos akkumulátort – megvan az energia forrása!",
            gives: "Akku", points: 30,
          },
          {
            x: 10, y: 32, w: 14, h: 18, label: "Kormánykerék",
            text: "A kerék az űr felé fordult – a kapszula kész az indulásra!",
            points: 10,
          },
          {
            x: 40, y: 62, w: 22, h: 22, label: "Menekülési kapszula →",
            text: "",
            needs: "Akku",
            lockedText: "A kapszula akkumulátora merült – kellene egy töltés…",
            win: "Bekapcsoltad az akkut és elrugaszkodtál – MEGSZÖKTÉL AZ ŰRBÁZISRÓL!",
            points: 60,
          },
        ],
      },
    ],
  },
};

// A "bat" és "battery" stílus nem létezik a sprite-készletben – cseréljük ismert stílusra
for (const st of Object.values(STORIES)) {
  for (const sc of st.scenes) {
    for (const p of sc.props) {
      if (p.style === "bat") p.style = "ghost";
      if (p.style === "crate") p.style = "cube";
      if (p.style === "battery") p.style = "potion";
    }
  }
}

export class AdventureGame implements GameMode {
  private ctx: GameCtx;
  private target: number;
  private story: Story;
  private scene = 0;
  private inventory = new Set<string>();
  private seen = new Set<string>();
  private msg = "";
  private msgAt = 0;
  private fade = 1; // 1 = teljesen látszik a jelenet
  private nextScene: number | null = null;
  private over = false;
  private done = false;
  private stars = makeStarfield();
  private startedAt = performance.now();

  constructor(pr: Record<string, string | number | boolean>, ctx: GameCtx) {
    this.ctx = ctx;
    this.target = Number(pr.target ?? -1);
    const key = String(pr.story ?? "kastely");
    this.story = STORIES[key] ?? STORIES.kastely;
    this.msg = this.story.scenes[0].title + " – kattints mindenhová, gyűjtsd a tárgyakat!";
    this.msgAt = performance.now();
    ctx.emit(`Kaland indul: „${this.story.title}”`, "logic");
  }

  isDone() { return this.done; }

  click(xPct: number, yPct: number, now: number) {
    if (this.over) return;
    if (this.nextScene !== null) return; // átmenet közben nem kattintható
    const sc = this.story.scenes[this.scene];
    for (const h of sc.hotspots) {
      if (inRect(xPct, yPct, h.x, h.y, h.w, h.h)) {
        this.activate(h, now);
        return;
      }
    }
    this.msg = "Erre nincs semmi érdekes…";
    this.msgAt = now;
  }

  private activate(h: Hotspot, now: number) {
    if (h.needs && !this.inventory.has(h.needs)) {
      this.msg = h.lockedText ?? "Nincs meg hozzá a megfelelő tárgyad…";
      this.msgAt = now;
      this.ctx.sfx("sfx.buzzer", 0.45);
      return;
    }
    const key = `${this.scene}:${h.label}`;
    const first = !this.seen.has(key);
    this.seen.add(key);
    if (first && h.points) {
      this.ctx.addScore(h.points);
      this.ctx.emit(`Felfedezted: ${h.label} (+${h.points})`, "logic");
    }
    if (h.gives) {
      this.inventory.add(h.gives);
      this.msg = `${h.text}  [${h.gives} – a leltáradba került!]`;
      this.msgAt = now;
      this.ctx.sfx("sfx.powerup", 0.7);
      this.ctx.burst((h.x + h.w / 2) / 100 * GW, (h.y + h.h / 2) / 100 * GH, 18, "#fde047", 160);
      return;
    }
    this.msg = h.text;
    this.msgAt = now;
    this.ctx.sfx("sfx.click", 0.6);
    if (h.win) {
      this.over = true;
      this.ctx.sfx("sfx.win", 0.9);
      setTimeout(() => {
        this.done = true;
        this.ctx.finish(true, h.win!, this.target);
      }, 700);
      return;
    }
    if (h.next !== undefined) {
      this.nextScene = h.next;
      this.fade = 1;
    }
  }

  update(dt: number, now: number) {
    if (this.over) return;
    if (this.nextScene !== null) {
      this.fade -= dt * 3;
      if (this.fade <= 0) {
        this.fade = 0;
        this.scene = clamp(this.nextScene, 0, this.story.scenes.length - 1);
        this.nextScene = null;
        this.msg = this.story.scenes[this.scene].title;
        this.msgAt = now;
      }
    } else if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 3);
    }
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    const sc = this.story.scenes[this.scene];
    drawBgPreset(ctx, sc.bg, now, this.stars);

    // kellékek
    for (const p of sc.props) {
      ctx.save();
      ctx.translate((p.x / 100) * GW, (p.y / 100) * GH);
      drawSprite(ctx, p.style, { size: p.size, color: p.color ?? "#e2e8f0", id: p.x + p.y, now, rotation: 0, poly: [] });
      ctx.restore();
    }

    // hotspot-ok: leheletfinom jelzés + hover
    const ptr = this.ctx.pointer();
    for (const h of sc.hotspots) {
      const hover = inRect(ptr.x, ptr.y, h.x, h.y, h.w, h.h);
      if (hover) {
        ctx.fillStyle = "rgba(251,191,36,0.13)";
        ctx.strokeStyle = "rgba(251,191,36,0.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.roundRect((h.x / 100) * GW + 2, (h.y / 100) * GH + 2, (h.w / 100) * GW - 4, (h.h / 100) * GH - 4, 8);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        // címke
        ctx.font = "700 16px Geist, system-ui, sans-serif";
        const tw = ctx.measureText(h.label).width + 18;
        const lx = clamp((h.x + h.w / 2) / 100 * GW - tw / 2, 6, GW - tw - 6);
        const ly = (h.y / 100) * GH - 34;
        ctx.fillStyle = "rgba(9,9,15,0.85)";
        ctx.beginPath();
        ctx.roundRect(lx, ly, tw, 26, 6);
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(h.label, lx + tw / 2, ly + 14);
      }
    }

    // átmenet
    if (this.fade < 1) {
      ctx.fillStyle = `rgba(9,9,15,${1 - this.fade})`;
      ctx.fillRect(0, 0, GW, GH);
    }

    // felső sáv: cím
    ctx.fillStyle = "rgba(9,9,15,0.62)";
    ctx.fillRect(0, 0, GW, 44);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 20px Geist, system-ui, sans-serif";
    ctx.fillText(`„${this.story.title}” · ${sc.title}`, 16, 23);

    // üzenetdoboz
    if (now - this.msgAt < 6000 || this.over) {
      const boxH = 64;
      ctx.fillStyle = "rgba(9,9,15,0.86)";
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, GH - 44 - boxH, GW - 24, boxH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f5f5f4";
      ctx.font = "600 18px Geist, system-ui, sans-serif";
      this.wrapText(ctx, this.msg, 28, GH - 44 - boxH + 26, GW - 56, 24);
    }

    // leltár
    const items = [...this.inventory];
    const iw = items.length > 0 ? items.length * 92 + 20 : 210;
    const ix = GW - iw - 12;
    ctx.fillStyle = "rgba(9,9,15,0.8)";
    ctx.strokeStyle = "rgba(163,230,53,0.5)";
    ctx.beginPath();
    ctx.roundRect(ix, GH - 44, iw, 34, 8);
    ctx.fill();
    ctx.stroke();
    if (items.length === 0) {
      ctx.fillStyle = "#71717a";
      ctx.font = "600 15px Geist, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Leltár: (üres – gyűjts tárgyakat!)", ix + 14, GH - 27);
    } else {
      ctx.fillStyle = "#a3e635";
      ctx.font = "700 14px Geist, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Leltár:", ix + 10, GH - 27);
      items.forEach((name, i) => {
        const bx = ix + 70 + i * 92;
        ctx.fillStyle = "rgba(251,191,36,0.2)";
        ctx.strokeStyle = "rgba(251,191,36,0.7)";
        ctx.beginPath();
        ctx.roundRect(bx, GH - 41, 86, 28, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fde68a";
        ctx.font = "700 14px Geist, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(name, bx + 43, GH - 26);
      });
    }

    // belépő üzenet
    const t = (now - this.startedAt) / 1000;
    if (t < 3.5) {
      ctx.globalAlpha = t < 2.8 ? 1 : (3.5 - t) / 0.7;
      ctx.fillStyle = "rgba(9,9,15,0.75)";
      ctx.fillRect(GW / 2 - 280, GH / 2 - 60, 560, 120);
      ctx.fillStyle = "#a3e635";
      ctx.textAlign = "center";
      ctx.font = "800 30px Geist, system-ui, sans-serif";
      ctx.fillText(this.story.title, GW / 2, GH / 2 - 22);
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "600 19px Geist, system-ui, sans-serif";
      ctx.fillText("Kattints mindenre! Gyűjtsd össze, ami kell…", GW / 2, GH / 2 + 16);
      ctx.globalAlpha = 1;
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
    const words = text.split(" ");
    let line = "";
    let yy = y;
    ctx.textAlign = "left";
    for (const w of words) {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxW && line !== "") {
        ctx.fillText(line, x, yy);
        line = w + " ";
        yy += lh;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }
}
