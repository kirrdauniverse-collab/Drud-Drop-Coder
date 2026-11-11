# 🎛️ AppMixer – Drud-Drop-Coder

Több sávos **applikáció- és játékszerkesztő** a Music Maker / Ejay zeneszerkesztők elvén – csak nem zenét, hanem **működő alkalmazást és játékot** komponálsz vele.

## Hogyan működik?

Ahogy a zeneszerkesztőkben a hangmintákat teszed az idővonalra, itt **blokkokat** (rutinok, grafikák, hangok, bemenetek) húzol a **folyamat-sávokra**. A léptetőfej áthalad a sávokon, és minden blokk „elszól", amikor a fej eléri – párhuzamos folyamatok, élő eredménnyel.

```
┌─────────────┬──────────────────────────────────────────┐
│ Blokk-      │  Sáv 1 · Grafika   ▓▓▓░░░▓▓▓░░░▓▓▓░░░    │
│ könyvtár    │  Sáv 2 · Sprite    ░▓▓░░░░░▓▓░░░░░▓▓░    │
│  → húzd a   │  Sáv 3 · Zene      ▓▓▓▓▓░░▓▓▓▓▓░░▓▓▓▓    │
│  sávokra!   │  Sáv 4 · Hangok    ░░▓░░░░░░░▓░░░░░░░    │
│             │  Sáv 5 · Logika    ░░░░▓░░░░░░░▓░░░░░    │
└─────────────┴──────────────────────────────────────────┘
                    ↓  ▶ Lejátszás  ↓
        ┌────────────────────────────┐
        │   Élő canvas előnézet      │
        │   (játék + eseménynapló)   │
        └────────────────────────────┘
```

## Fő funkciók

- **🎛️ Blokk-könyvtár** – 28 előre definiált blokk 5 kategóriában:
  - *Grafika*: animált háttérképek (űr, óceán, neon…), űrhajó, meteor, csillag, felhő, szöveg, robbanás, tűzijáték
  - *Hang*: lézer, robbanás, érme, sziréna + szintetizált dob-, basszus-, akkord- és arpeggio-loopok
  - *Logika*: számláló, feltételvizsgálat, ugrás (ciklusok!), véletlen esemény, takarítás
  - *Bemenet*: billentyű-irányítás (WASD/nyilak + lövés), kattintás-események
  - *Adat*: változók, életek, mentés/betöltés
- **🎚️ Sok folyamat-sáv** – korlátlan sáv, mindegyik saját hangerővel, mute/solo-val, kategória-színnel
- **🖱️ Drag & drop** – blokkok húzása a könyvtárból és a sávok között, átméretezés húzással
- **🖼️ Saját tartalmak** – kép (PNG/JPG/SVG) és hang (MP3/WAV/OGG) feltöltés; a feltöltött kép lehet dísz, játékos, ellenség, gyűjtendő vagy háttér
- **▶️ Élő lejátszó** – léptetőfejes futtatás, canvas előnézet, eseménynapló, pont/élet HUD
- **🧠 Vezérlés** – feltételekkel és ugrásokkal igazi játékmenetet építhetsz (pl. „ha pont ≥ 50 → új szint")
- **💾 Projektkezelés** – mentés böngészőbe, felhő-gyűjtemény (API), undo/redo
- **📱 Reszponzív** – mobilon panel-tabokkal

## Gyors kezdés

```bash
bun install
bun run dev
```

Majd: nyisd meg az oldalt → ▶ (Szóköz) – a betöltött **Űr-támadás demó** azonnal fut: mozgass a nyilakkal/WASD-dal, lőj a Szóközzel!

## Technológia

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Zustand · Prisma (SQLite) · Canvas API · Web Audio API

## Licenc

MIT
