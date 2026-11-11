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

- **🎛️ Blokk-könyvtár – a nagy „tömlő"** – **145 elem** 7 kategóriában, mindegyik **külön húzható**, **előnézeti képpel**, és **bármiből több is** bedobható a sávokra:
  - *Grafika*: **19 animált háttér** (űr, éjszakai város, naplemente, napos ég, óceán, víz alatti világ, tengerpart, erdő, sivatag, havas hegyek, téli táj, neon rács, város, országút, holdfelszín, cukorvilág, szivárvány, láva, sakktábla) + szín/átmenet háttér, **59 sprite** külön blokkként (űrhajó, meteor, UFO, műhold, bolygó · cica, kutya, nyuszi, pingvin, méhecske, lepke, sárkány, robot, pók, béka, teknős, bálna, polip, rák, hal, madár, szellem · korona, kard, pajzs, kulcs, kincsesláda, torta, fánk, ajándék, ajtó, ház, autó, bomba, érme…), szöveg, robbanás, tűzijáték, eső/hó/villámlás
  - *Hang*: **25 szintetizált hanghatás** (lézer, robbanás, érme, csobbanás, dobszóló, telefon, varázscsengés, síp, berregő, gépírogatás, motor…) + **14 zenei loop** (techno, rock, chiptune, keringő, hip-hop, ambient, **szamba, disco, pólka, reggae, altatódal**…) – a könyvtárban ▸ gombbal azonnal meghallgathatók
  - *Logika*: számláló, feltételvizsgálat, ugrás (ciklusok!), véletlen esemény, rendszeres megjelenítés, takarítás, győzelem/játék vége
  - *Bemenet*: billentyű-irányítás (szabad / ugrálós platformer / vízszintes), egérkövetés, kattintás-események
  - *App*: választó gombok (kvízek, menük), beszédbuborék
  - *Adat*: változók, életek, mentés/betöltés
  - *Saját*: feltöltött képek és hangok szintén blokkmá alakítva
- **🎚️ Tartalomhez illő blokk-beállítások** – minden blokktípusnak **saját, hasznos** paraméterkészlete van, csoportosítva:
  - *Sprite / Alak* → Megjelenés (**Stílus** – átváltható bármelyik 59 sprite-ra!, méret, szín, **átlátszóság**, pörgés) · Szerep (játékos/ellenség/gyűjtendő/dísz/platform, pontérték) · Mozgás (zuhan/emelkedik/sodródik/pattog/üldöz/kering/hullám, **sebesség**, **haladási irány**) · Elhelyezés (X, Y, véletlen hely, **mennyi jelenjen meg egyszerre**)
  - *Zene és hang* → **hangerő**, **lejátszási sebesség** (25–200%, a loop ténylegesen gyorsul/lassul!), **némítás** (a blokk a helyén marad, de nem szól)
  - *Háttér* → **Típus** (bármikor átváltható másik színtérre!) vagy szín + **színátmenet** fentről lefelé + **sötétítés** (hogy a sprite-ok előre ugorjanak)
  - *Szöveg* → igazítás (bal/közép/jobb), **beúszás** (fokozatos megjelenés), ragadós mód
  - *Robbanás* → részecskeszám, **erő** (részecske-sebesség), szín
- **🎚️ Sok folyamat-sáv** – korlátlan sáv, **kategóriának megfelelő vezérlőkkel**: hangsávnál hangerő + némítás (M) + szóló (S), grafikai sávnál elrejtés (szem ikon), logikai/bemeneti/adat sávnál be/ki kapcsoló. A szóló csak a hangokat némítja el – a kép tovább fut!
- **🖱️ Drag & drop** – blokkok húzása a könyvtárból és a sávok között, átméretezés húzással
- **🖼️ Saját tartalmak** – kép (PNG/JPG/SVG) és hang (MP3/WAV/OGG) feltöltés; a feltöltött kép lehet dísz, játékos, ellenség, gyűjtendő vagy háttér, a hang hangerővel és lejátszási sebességgel
- **▶️ Élő lejátszó** – léptetőfejes futtatás, canvas előnézet, eseménynapló, pont/élet HUD
- **🧠 Vezérlés** – feltételekkel és ugrásokkal igazi játékmenetet építhetsz (pl. „ha pont ≥ 50 → új szint")
- **💾 Projektkezelés** – mentés böngészőbe, felhő-gyűjtemény (API), undo/redo; a régebben mentett projektek automatikusan megkapják az új paramétereket
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
