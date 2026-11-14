# AppMixer – fejlesztési prioritások

A Copilot-review (stabilitás, biztonság, skálázhatóság) és a demójáték-javítások egyesített
prioritási listája. A P0 tételek implementálva és ellenőrzve (commit `2095fa0`), a következő
körök sorrendben veszik a P1 → P2 → P3 tételeket.

## P0 – Kritikus javítások (KÉSZ)

| # | Tétel | Hol |
|---|-------|-----|
| 1 | Tulajdonosi védelem a felhő-API-n: véletlen token (csak SHA-256 hash tárolva), felülírás/törlés csak tokennel, 403-nál automatikus fork | `src/lib/cloud-guard.ts`, `prisma/schema.prisma` |
| 2 | Szigorú Zod-séma a projekt-JSON-ra, mentésnél ÉS betöltésnél ÉS fájlimportnál; 8 MB felhő- / 10 MB fájlkorlát | `src/lib/projectSchema.ts` |
| 3 | Rate limit (30 kérés/perc/IP → 429), strukturált hibaobjektum (`{error:{code,message}}`) | API route-ok |
| 4 | Prisma query-naplózás csak developmentben | `src/lib/db.ts` |
| 5 | Motor lifecycle: minden `setTimeout` követve, `destroy()` teljes felszabadítás (rAF, listenerek, játékmód/socket, `audioEngine.stopAll()`, képtár), dupla-destroy védő | `src/lib/engine.ts` |
| 6 | Drag & drop validáció: sáv-létezés, hossz nem lóg ki a rácsból | `src/store/drag.ts`, `src/store/editor.ts` |
| 7 | CI: GitHub Actions (install → prisma generate → typecheck → lint → test → build) + 17 unit teszt | `.github/workflows/ci.yml`, `src/lib/__tests__/` |
| 8 | Felhő-dialógus: méret-előellenőrzés, hiba-toastok szerverüzenettel, tokenkezelés | `src/components/editor/dialogs.tsx` |

E2E-bizonyíték: 18/18 API-biztonsági teszt (`scripts/e2e-api-security.mjs`), 17/17 unit teszt,
böngészős demó-futás ellenőrzve.

## P1 – Stabilitás és tartalom (következő kör)

1. **Engine unit tesztek a tiszta logikára** (review 10): ütközés-detektálás, ugrás/platform,
   győzelem + pontszám-frissítés – a `src/lib/games/` modulok tiszta segédfüggvényeire,
   mínusz a canvas/window függőség.
2. **Demó-regressziós E2E**: agent-browser szkript, ami végigjátsza a 14 demót
   (főmenü → Indítás → game over) – új motorváltoztatás ne törhesse el őket csendben.
3. **Megosztási link**: `?project=<id>` betöltés URL-ből (a nyilvános olvasás már van).
4. **Publish/private flag** a `SavedProject`-ben – a lista csak publikusat mutat, a link privátot is.
5. **Auto-save restore pontok** (könnyített versioning): az autosave mellé 5 állapot-rollback
   localStorage-ban.

## P2 – Architektúra refaktor (csak a P1 tesztek után)

1. **`engine.ts` szétbontása** (review 5): `gameState.ts`, `systems/{physics,collision,render,logic}.ts`,
   game-rules modul – fokozatosan, téma-módra (circle) kivonva, minden lépés után a demó-regressziós
   E2E mint védőháló.
2. **Editor store felparcellázása** (review 8): `project/history/assets/ui` store-ok.
3. **Drag state machine** (review 7): átfedés-szabályok, snap-to-grid, művelet-konfliktus kezelés.
4. **Asset pipeline v1** (review 9): thumbnail generálás kép-assetekhez, feltöltési méretkorlát,
   hosszú távon object storage + checksum (a projekt JSON csak refeket tárol).

## P3 – Bővítési irányok (ötletpool)

- Teljes auth (NextAuth/Clerk + userId), amikor van éles szerverdomain; csak ezután multi-user
- ZIP export/import, embed mode, webes „Publikálás" flow
- Dialogue graph / elágazó történet szerkesztő, AI NPC viselkedés
- Accessibility: keyboard-only navigáció, screen-reader címkék, high-contrast mód
- Együttszerkesztés (conflict resolution), AI-asszisztált blokkgenerálás
  (a `z-ai-web-dev-sdk` már a függőségekben van)

## Tudatos halasztások (indoklással)

- **engine.ts teljes szétbontása és store-split most nem történt meg**: 2000+ sor működő kód
  regressziós tesztek nélkül átírva több hibát szül, mint javít. Sorrend: P1-tesztek → P2-refaktor.
- **Névtelen token helyett igazi auth**: domain/regisztráció nélkül nincs értelme session-t vezetni;
  a token-mechanizmus a valós fenyegetést (idegen törlés/felülírás) már fedi.
