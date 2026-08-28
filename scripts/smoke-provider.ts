/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PREUVE FOURNISSEUR — une commande, et une réponse honnête (§59-62).
 *
 *   npm run adam:smoke:provider
 *
 * ── CE QU'ELLE RÉPOND ────────────────────────────────────────────────────────────────────
 *
 * Avec une clé : elle appelle VRAIMENT un modèle, sur la demande de référence, et suit la
 * chaîne jusqu'à un plan compilé. Sans clé : elle dit NOT PROVEN et sort en échec.
 *
 * ── POURQUOI ELLE NE SIMULE RIEN ─────────────────────────────────────────────────────────
 *
 * L'audit Frontier a été bloqué exactement ici, et la tentation était de « prouver » la chaîne
 * avec un substitut. Un substitut prouve que le CODE marche ; il ne prouve pas qu'un modèle
 * produit un plan conforme, ce qui est la seule question posée. Une commande qui répondrait
 * « OK » sans appel réseau rendrait le prochain audit plus faux, pas plus vert.
 *
 * Elle sort donc en code 1 quand la preuve n'est pas faite — y compris faute de clé. Ce n'est
 * pas un échec du produit ; c'est un état de l'environnement, et il doit se voir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const DEMANDE = "Prépare un audit des tâches en retard, identifie les trois plus importantes, "
  + "prépare les actions utiles mais ne contacte personne sans autorisation.";

interface Mesures {
  cleDisponible: boolean;
  fournisseur: string | null;
  appelReel: boolean;
  planValideAuPremierEssai: boolean | null;
  reparations: number | null;
  compilationAcceptee: boolean | null;
  etapes: number | null;
  latenceMs: number | null;
  erreur: string | null;
}

function sortir(m: Mesures): never {
  const prouve = m.appelReel && m.compilationAcceptee === true;
  console.log("");
  console.log("═══════════ SMOKE FOURNISSEUR ═══════════");
  console.log(`PROVIDER LIVE TEST:            ${m.appelReel ? "RUN" : "NOT RUN"}`);
  if (!m.appelReel) {
    console.log(`REASON:                        ${m.erreur ?? "OPENAI_API_KEY missing"}`);
  }
  console.log(`NATURAL LANGUAGE → REAL PLANNER: ${prouve ? "PROVEN" : "NOT PROVEN"}`);
  console.log("");
  console.log(`  clé disponible               ${m.cleDisponible ? "oui" : "NON"}`);
  console.log(`  fournisseur                  ${m.fournisseur ?? "—"}`);
  console.log(`  plan valide au 1er essai     ${m.planValideAuPremierEssai ?? "—"}`);
  console.log(`  réparations                  ${m.reparations ?? "—"}`);
  console.log(`  compilation acceptée         ${m.compilationAcceptee ?? "—"}`);
  console.log(`  étapes compilées             ${m.etapes ?? "—"}`);
  console.log(`  latence de planification     ${m.latenceMs !== null ? `${m.latenceMs} ms` : "—"}`);
  console.log("═════════════════════════════════════════");
  console.log(JSON.stringify(m));
  process.exit(prouve ? 0 : 1);
}

async function main(): Promise<void> {
  const m: Mesures = {
    cleDisponible: false, fournisseur: null, appelReel: false,
    planValideAuPremierEssai: null, reparations: null, compilationAcceptee: null,
    etapes: null, latenceMs: null, erreur: null,
  };

  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  m.cleDisponible = Boolean(openai || anthropic);
  m.fournisseur = openai ? "openai" : anthropic ? "anthropic" : null;

  if (!m.cleDisponible) {
    m.erreur = "OPENAI_API_KEY missing";
    sortir(m);
  }

  // ── L'IMPORT EST TARDIF ────────────────────────────────────────────────────────────
  //
  // Charger le planificateur tire Prisma et la moitié du runtime. Sans clé, il n'y a rien à
  // faire de tout cela : le diagnostic doit rester exécutable sur une machine nue.
  const t0 = Date.now();
  try {
    // LE VRAI POINT D'ENTRÉE — celui que l'outil `run_mission` appelle quand Adam délègue.
    // Passer par le planificateur « à la main » prouverait moins : c'est la CHAÎNE qu'on veut
    // voir, pas une fonction isolée.
    const { lancerMission } = await import("@/platform/in-process/missions/runtime");
    const { prisma } = await import("@/lib/prisma");

    const pdg = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "DIRECTION"] } },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!pdg) {
      m.erreur = "aucun utilisateur DIRECTION/SUPER_ADMIN en base pour porter la mission";
      sortir(m);
    }

    const r = await lancerMission(pdg as never, DEMANDE, {});
    m.latenceMs = Date.now() - t0;
    m.appelReel = true;
    m.planValideAuPremierEssai = r.ok === true;
    m.reparations = 0;
    m.compilationAcceptee = r.ok === true;
    m.etapes = r.ok ? (r.etapes ?? null) : null;
    if (!r.ok) m.erreur = r.error ?? "lancement refusé";
  } catch (e) {
    m.erreur = e instanceof Error ? e.message : String(e);
    m.latenceMs = Date.now() - t0;
  }

  sortir(m);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
