// E2E: /api/projects végpontok biztonsági viselkedésének ellenőrzése
const BASE = "http://localhost:3000/api/projects";

function validProject(name) {
  return {
    id: "proj-" + Math.random().toString(36).slice(2, 10),
    name,
    tracks: [
      { id: "t1", name: "Grafika", category: "graphics", volume: 0.8, muted: false, solo: false },
    ],
    blocks: [
      { id: "b1", typeId: "gfx.sprite.ship", trackId: "t1", start: 0, length: 2, params: { size: 50 } },
    ],
    assets: [],
    stepCount: 32,
    tempoMs: 300,
    loop: false,
    masterVolume: 0.8,
  };
}

let pass = 0, failCount = 0;
function check(label, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}${extra ? " | " + extra : ""}`);
  if (cond) pass++; else failCount++;
}

async function main() {
  // 1. érvényes mentés → 200 + ownerToken
  const p = validProject("E2E teszt projekt");
  let res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: p.id, name: p.name, data: p }),
  });
  let body = await res.json();
  check("érvényes mentés 200", res.status === 200);
  const token = body.ownerToken;
  check("ownerToken visszaadva", typeof token === "string" && token.length > 20);

  // 2. felülírás token nélkül → 403
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: p.id, name: "más neve", data: p }),
  });
  body = await res.json();
  check("felülírás token nélkül → 403", res.status === 403, body?.error?.code);

  // 3. felülírás ROSSZ tokennel → 403
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-owner-token": "rossz-token" },
    body: JSON.stringify({ id: p.id, name: "más neve", data: p }),
  });
  check("rossz token → 403", res.status === 403);

  // 4. felülírás jó tokennel (fejléc) → 200
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-owner-token": token },
    body: JSON.stringify({ id: p.id, name: p.name + " v2", data: p }),
  });
  body = await res.json();
  check("felülírás jó tokennel → 200", res.status === 200);

  // 5. érvénytelen projekt → 400 invalid_project
  const bad = { ...validProject("rossz") };
  bad.tracks = undefined;
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "rossz", data: bad }),
  });
  body = await res.json();
  check("érvénytelen projekt → 400", res.status === 400 && body?.error?.code === "invalid_project", body?.error?.message?.slice(0, 60));

  // 6. mélyen beágyazott "mérgezett" param → 400
  const poisoned = validProject("poison");
  poisoned.blocks[0].params = { x: { nested: Array(1000).fill("a") } };
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "poison", data: poisoned }),
  });
  check("objektum-paraméter elutasítva → 400", res.status === 400);

  // 7. GET lista → 200, tartalmazza az elemt
  res = await fetch(BASE);
  body = await res.json();
  check("GET lista 200", res.status === 200 && Array.isArray(body.projects));
  check("lista tartalmazza a mentettet", body.projects.some((x) => x.id === p.id));
  check("lista NEM tartalmazza az adatot (nincs adatöntés)", !body.projects.some((x) => x.data));

  // 8. GET egy projekt → 200
  res = await fetch(`${BASE}/${p.id}`);
  body = await res.json();
  check("GET egy projekt 200", res.status === 200 && body?.project?.data?.tracks?.length === 1);

  // 9. GET nemlétező → 404
  res = await fetch(`${BASE}/nem-letezo-12345`);
  check("GET nemlétező → 404", res.status === 404);

  // 10. DELETE jó token nélkül → 403
  res = await fetch(`${BASE}/${p.id}`, { method: "DELETE" });
  check("DELETE token nélkül → 403", res.status === 403);

  // 11. DELETE jó tokennel → 200, utána már 404
  res = await fetch(`${BASE}/${p.id}`, { method: "DELETE", headers: { "x-owner-token": token } });
  check("DELETE jó tokennel → 200", res.status === 200);
  res = await fetch(`${BASE}/${p.id}`);
  check("törlés után GET → 404", res.status === 404);

  // 12. fork-ág: token nélküli új mentés (id nélkül) → 200, saját tokent kap
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "fork teszt", data: validProject("fork") }),
  });
  body = await res.json();
  check("id nélküli mentés → 200 + token", res.status === 200 && typeof body.ownerToken === "string");
  const forkId = body.project?.id;
  const forkToken = body.ownerToken;

  // 13. rate limit: 31 kérés egy percen belül → 429
  let limited = false;
  for (let i = 0; i < 32; i++) {
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "rl", data: validProject("rl" + i) }),
    });
    if (r.status === 429) { limited = true; break; }
  }
  check("32. mentésre rate limit → 429", limited);

  // 14. takarítás: a fork és a rate-limit hulladék törlése a tokennel
  if (forkId && forkToken) {
    res = await fetch(`${BASE}/${forkId}`, { method: "DELETE", headers: { "x-owner-token": forkToken } });
    check("fork takarítása 200", res.status === 200);
  }

  console.log(`\nÖsszesen: ${pass} PASS, ${failCount} FAIL`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Teszt hiba:", e); process.exit(1); });
