// A rate-limit E2E teszt által generált "rl…" tesztprojektek törlése a felhő-DB-ből
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const gone = await db.savedProject.deleteMany({
    where: { OR: [{ name: { startsWith: "rl" } }, { name: "E2E teszt projekt" }, { name: "E2E teszt projekt v2" }, { name: "fork" }] },
  });
  console.log("Törölt tesztsorok:", gone.count);
  const left = await db.savedProject.count();
  console.log("Hátralévő felhőprojektek:", left);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
