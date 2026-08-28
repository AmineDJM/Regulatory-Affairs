/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PREUVE FOURNISSEUR — une commande, et une réponse honnête (§59-62).
 *
 *   npm run adam:smoke:provider
 *
 * ── OÙ LA LANCER ─────────────────────────────────────────────────────────────────────────
 *
 * Dans le Shell Render du service déployé — le seul processus où `OPENAI_API_KEY` existe. Le
 * script ne lit cette variable que pour savoir si elle est PRÉSENTE ; il ne l'affiche jamais,
 * ne la tronque jamais, ne la journalise jamais.
 *
 * ── CE QU'ELLE PROUVE ────────────────────────────────────────────────────────────────────
 *
 *   langage naturel → vrai fournisseur OpenAI → planner → MissionPlan → validation de schéma →
 *   compilateur → mission persistée → exécution en lecture seule → QA + satisfaction d'objectif
 *
 * ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────────────────────────
 *
 * Elle ne simule rien. L'audit Frontier a été bloqué exactement ici, et la tentation était de
 * « prouver » la chaîne avec un substitut. Un substitut prouve que le CODE marche ; il ne prouve
 * pas qu'un modèle produit un plan conforme, ce qui est la seule question posée. Une commande
 * qui répondrait « OK » sans appel réseau rendrait le prochain audit plus faux, pas plus vert.
 *
 * Elle sort donc en code 1 quand la preuve n'est pas faite — y compris faute de clé. Ce n'est
 * pas un échec du produit ; c'est un état de l'environnement, et il doit se voir.
 *
 * ── LA MESURE N'EST PAS ICI ──────────────────────────────────────────────────────────────
 *
 * Tout le diagnostic vit dans `src/platform/in-process/missions/provider-smoke.ts`, où il est
 * couvert par des tests. Ce fichier ne fait que choisir un porteur de mission et imprimer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

async function main(): Promise<void> {
  // ── L'IMPORT EST TARDIF ────────────────────────────────────────────────────────────────
  // Charger le noyau tire Prisma et la moitié du runtime. Sans clé il n'y a rien à faire de
  // tout cela : le diagnostic doit rester exécutable sur une machine nue.
  const { MAILLONS } = await import("@/platform/in-process/missions/provider-smoke");

  if (!(process.env.OPENAI_API_KEY ?? "").trim()) {
    console.log("");
    console.log("═══════════════ SMOKE FOURNISSEUR & MISSION — ADAM ═══════════════");
    for (const m of MAILLONS) console.log(`  ${m.padEnd(24)} FAIL`);
    console.log(`  ${"PROVIDER_PROVEN".padEnd(24)} NO`);
    console.log(`  ${"MISSION_E2E_PROVEN".padEnd(24)} NO`);
    console.log("");
    console.log("Raison : OPENAI_API_KEY absente de l'environnement de ce processus.");
    console.log("         Lancer cette commande dans le Shell Render du service,");
    console.log("         où la variable est déjà définie.");
    console.log("══════════════════════════════════════════════════════════");
    process.exit(1);
  }

  const { smokeFournisseur, rendreTexte } = await import("@/platform/in-process/missions/provider-smoke");
  const { prisma } = await import("@/lib/prisma");

  // LE PORTEUR DE LA MISSION est un compte réel de la direction : le catalogue, donc ce que le
  // planner voit, dépend de ses droits. Diagnostiquer sous un compte fabriqué mesurerait une
  // configuration qui n'existe pour personne. `isSystem: false` écarte le compte d'Adam
  // lui-même — l'agent n'est pas un commanditaire.
  const pdg = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "DIRECTION"] }, isActive: true, isSystem: false },
    orderBy: { role: "asc" },
  });
  if (!pdg) {
    console.error("Aucun utilisateur DIRECTION/SUPER_ADMIN actif en base pour porter la mission.");
    process.exit(1);
  }

  // LES DROITS EFFECTIFS, pas le rôle brut : ce sont eux qui décident du nombre de capacités
  // ouvertes, donc de ce que le planner voit. Mesurer sur un rôle nu donnerait un catalogue
  // qui n'existe pour personne.
  const { getAccess } = await import("@/lib/rbac");
  const user = {
    id: pdg.id, name: pdg.name, email: pdg.email, role: pdg.role,
    secondaryRole: pdg.secondaryRole, mustChangePassword: pdg.mustChangePassword,
    access: await getAccess(pdg.id, pdg.role),
  };

  const r = await smokeFournisseur(user);
  console.log("");
  console.log(rendreTexte(r));
  console.log("");
  // La ligne machine — pour brancher un contrôle dessus sans analyser le texte.
  console.log(JSON.stringify({
    providerProven: r.providerProven,
    missionE2eProven: r.missionE2eProven,
    // L'INTÉGRITÉ DU BANC EST UNE DONNÉE DE PREMIER RANG. Un run dont la vérité terrain était
    // fausse, ou qui a laissé un artefact derrière lui, ne mesure pas ce qu'il annonce — et il
    // faut pouvoir le savoir sans lire le texte.
    setupValide: r.setupValide,
    raisonSetup: r.raisonSetup,
    artefactsInattendus: r.artefactsInattendus,
    jeton: r.jeton,
    chaine: r.chaine,
    modele: r.modele,
    jetons: { entree: r.jetonsEntree, sortie: r.jetonsSortie },
    appelsModele: r.appelsModele,
    capacitesOuvertes: r.capacitesOuvertes,
    latenceTotaleMs: r.latenceTotaleMs,
    scenarios: r.scenarios.map((s) => ({
      genre: s.genre, missionId: s.missionId, statutFinal: s.statutFinal, stable: s.stable,
      setupEchoue: s.setupEchoue,
      precondition: s.precondition ? { satisfaite: s.precondition.satisfaite, sources: s.precondition.sources } : null,
      motifArret: s.motifArret, toursMoteur: s.toursMoteur, replanifications: s.replanifications,
      appelsParUsage: s.appelsParUsage,
      recoursObserves: s.recoursObserves, qaPassed: s.qaPassed, goalSatisfied: s.goalSatisfied,
      // POLITIQUE / PLAN / EXÉCUTION : trois faits distincts, et les confondre est ce qui a
      // produit un `READ_ONLY_EXECUTION PASS` pendant que des fichiers partaient au Drive.
      effet: { autorise: s.effetMaxAutorise, planifie: s.effetMaxPlanifie, execute: s.effetMaxExecute },
      artefacts: { avant: s.artefactsAvant, apres: s.artefactsApres, crees: s.artefactsCrees },
      totalMs: s.cascade?.totalMs ?? null, modeleMs: s.cascade?.tempsModeleMs ?? null,
      horsModeleMs: s.cascade?.tempsHorsModeleMs ?? null, parallelisme: s.cascade?.parallelisme ?? null,
    })),
  }));

  // LE CODE DE SORTIE PORTE LA QUESTION LA PLUS EXIGEANTE. `providerProven` seul serait vert
  // alors que la mission ne conclut pas — et c'est exactement la confusion que ce lot corrige.
  process.exit(r.missionE2eProven ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Portée de MODULE : ce script n'a que des imports dynamiques ; sans cette ligne il vit
// dans la portée globale et son `main` percute celui de tout autre script global.
export {};
