/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DEEP LIVE SMOKE — 60-80 missions variées sur les VRAIES données de l'ERP.
 *
 *   npm run adam:smoke:deep
 *
 * À lancer dans le Shell Render du service (OPENAI_API_KEY y est déjà — le script vérifie sa
 * PRÉSENCE, ne l'affiche jamais). Réglages par variables d'environnement :
 *
 *   DEEP_SMOKE_CIBLE=70        combien de missions viser (60-80 recommandé ; borné à 120)
 *   DEEP_SMOKE_CONCURRENCE=3   combien de missions mener DE FRONT (borné à 6)
 *   DEEP_SMOKE_GARDER=1        conserver les missions du run en base pour inspection
 *
 * Toutes les missions sont plafonnées ANALYZE (lecture seule), passent par le MÊME harnais que
 * le smoke fournisseur, et le nettoyage ne touche QUE les missions créées par ce run. Chaque
 * mission paie de VRAIS appels de modèle : à ~70 missions, compter plusieurs dizaines de
 * minutes et un coût API réel — le rapport final chiffre les jetons consommés.
 *
 * Code de sortie : 0 quand AUCUN DÉFAUT (les conclusions honnêtes ne sont pas des défauts),
 * 1 sinon. La logique vit dans `src/platform/in-process/missions/deep-smoke.ts`, testée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

async function main(): Promise<void> {
  if (!(process.env.OPENAI_API_KEY ?? "").trim()) {
    console.log("");
    console.log("═══════════════ DEEP LIVE SMOKE — ADAM ═══════════════");
    console.log("Raison : OPENAI_API_KEY absente de l'environnement de ce processus.");
    console.log("         Lancer cette commande dans le Shell Render du service,");
    console.log("         où la variable est déjà définie.");
    console.log("══════════════════════════════════════════════════════");
    process.exit(1);
  }

  const { deepSmoke, rendreTexteDeep, carteDeScore } = await import("@/platform/in-process/missions/deep-smoke");
  const { prisma } = await import("@/lib/prisma");
  const { getAccess } = await import("@/lib/rbac");

  // LE PORTEUR est un compte réel de la direction — même règle que le smoke fournisseur : le
  // catalogue, donc ce que chaque mission peut faire, dépend de SES droits effectifs.
  const pdg = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "DIRECTION"] }, isActive: true, isSystem: false },
    orderBy: { role: "asc" },
  });
  if (!pdg) {
    console.error("Aucun utilisateur DIRECTION/SUPER_ADMIN actif en base pour porter les missions.");
    process.exit(1);
  }
  const user = {
    id: pdg.id, name: pdg.name, email: pdg.email, role: pdg.role,
    secondaryRole: pdg.secondaryRole, mustChangePassword: pdg.mustChangePassword,
    access: await getAccess(pdg.id, pdg.role),
  };

  const cible = Number(process.env.DEEP_SMOKE_CIBLE ?? "") || 70;
  const concurrence = Number(process.env.DEEP_SMOKE_CONCURRENCE ?? "") || 3;
  const garder = process.env.DEEP_SMOKE_GARDER === "1";
  // Mode CHARGE (§29) : DEEP_SMOKE_PALIERS="3,5,10" joue les missions par lots à concurrence
  // croissante, et l'escalade s'arrête d'elle-même dès qu'un palier dégrade le système.
  const paliers = (process.env.DEEP_SMOKE_PALIERS ?? "")
    .split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);

  console.log("");
  console.log(paliers.length > 0
    ? `Deep Live Smoke — MODE PALIERS : cible ${cible} missions, concurrences ${paliers.join(" → ")}, plafond ANALYZE.`
    : `Deep Live Smoke : cible ${cible} missions, ${concurrence} de front, plafond ANALYZE.`);
  console.log("Chaque ligne ci-dessous est une mission RÉELLE menée à son état stable.");
  console.log("");

  const r = await deepSmoke(user, { cible, concurrence, garder, ...(paliers.length > 0 ? { paliers } : {}), onMission: (l) => console.log(l) });

  console.log("");
  console.log(rendreTexteDeep(r));
  console.log("");
  // La ligne machine — verdicts et mesures, sans avoir à analyser le texte.
  console.log(JSON.stringify({
    jeton: r.jeton, modele: r.modele, missions: r.missions.length,
    succes: r.missions.filter((m) => m.verdict === "SUCCES").length,
    honnetes: r.missions.filter((m) => m.verdict === "CONCLUSION_HONNETE").length,
    defauts: r.missions.filter((m) => m.verdict === "DEFAUT").length,
    directes: r.missions.filter((m) => m.resultat.cascade?.voiePlan === "DIRECTE").length,
    replanifications: r.missions.reduce((s, m) => s + m.resultat.replanifications, 0),
    appelsModele: r.appelsModele, jetons: { entree: r.jetonsEntree, sortie: r.jetonsSortie },
    latenceTotaleMs: r.latenceTotaleMs, ecartes: r.ecartes, nettoyage: r.nettoyage,
    paliers: r.paliers, arretEscalade: r.arretEscalade, concurrenceRetenue: r.concurrenceRetenue,
    // LA CARTE DE SCORE §71 — les taux qui décident, agrégés par le code, pas par un lecteur.
    carte: carteDeScore(r),
    parMission: r.missions.map((m) => ({
      genre: m.genre, titre: m.titre, verdict: m.verdict, missionId: m.resultat.missionId,
      statut: m.resultat.statutFinal, stable: m.resultat.stable, goal: m.resultat.goalSatisfied,
      voie: m.resultat.cascade?.voiePlan ?? null, totalMs: m.resultat.cascade?.totalMs ?? null,
      replans: m.resultat.replanifications,
      appels: Object.values(m.resultat.appelsParUsage).reduce((a, b) => a + b, 0),
      // LE POURQUOI, pas juste le combien : le motif d'arrêt et le verdict du juge, tronqués.
      motif: m.resultat.motifArret.slice(0, 160),
      verdictJuge: m.resultat.goalVerdict?.slice(0, 220) ?? null,
    })),
  }));

  process.exit(r.missions.some((m) => m.verdict === "DEFAUT") ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Portée de MODULE : sans cette ligne, `main` percute celui des autres scripts globaux.
export {};
