import { prisma } from "@/lib/prisma";
(async () => {
  const s = await prisma.missionStep.findFirst({
    where: { missionId: "cmts7u8nr0001lv6kmvvzhy9a", key: "consolidation" }, include: { workerRuns: true },
  });
  const run = s!.workerRuns[0]!;
  const inp = JSON.stringify(run.input);
  console.log("ENTRÉE contient « 84 500 » :", inp.includes("84 500"), "| « AO-2026-114 » :", inp.includes("AO-2026-114"));
  const out = JSON.stringify(s!.result);
  console.log("SORTIE contient 84 500 / 84500 :", out.includes("84 500") || out.includes("84500"));
  console.log("SORTIE contient AO-2026-114 :", out.includes("AO-2026-114"));
  console.log("\n--- donneesConsolidees ---");
  const r = s!.result as Record<string, string>;
  console.log((r.donneesConsolidees ?? "").slice(0, 1600));
  console.log("\n--- syntheseExecutive ---");
  console.log((r.syntheseExecutive ?? "").slice(0, 700));
  await prisma.$disconnect();
})();
