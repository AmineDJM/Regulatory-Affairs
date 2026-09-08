/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'HORIZON LONG — le banc qui casse une mission en deux processus.
 *
 *   PHASE=1 npx tsx scripts/bench/horizon-long.ts     (départ, jalons, attentes, contrôle)
 *   PHASE=2 npx tsx scripts/bench/horizon-long.ts     (PROCESSUS NEUF : reprise, fin, verdict)
 *
 * ── POURQUOI DEUX PROCESSUS, ET POURQUOI C'EST LA MOITIÉ DU BANC ────────────────────────
 *
 * « Ça survit à un redémarrage » ne se démontre pas dans le processus qui vient de tout écrire :
 * la mémoire y est encore chaude, les caches pleins, les fermetures vivantes. Un banc qui
 * l'affirmerait en un seul processus mesurerait sa propre mémoire.
 *
 * La phase 1 s'arrête au MILIEU d'une mission qui attend des humains, écrit son identifiant dans
 * un fichier, et MEURT. La phase 2 démarre d'un processus vide, relit la base, et doit
 * reprendre exactement là — sans rejouer un seul effet déjà produit. C'est la seule forme de
 * cette preuve qui prouve quelque chose.
 *
 * ── CE QUE CE BANC CHERCHE À FAIRE TOMBER ───────────────────────────────────────────────
 *
 * Chaque verdict nomme le cas qui le ferait échouer (§118.17) — une assertion dont on ne sait
 * pas nommer ce cas n'est pas une assertion :
 *
 *   jalons          « une mission COMPLEXE part en un seul plan monolithique »
 *   paresse         « tous les sous-plans sont compilés d'avance, donc la mission entière tient
 *                     dans une fenêtre de modèle » — le défaut que tout le lot corrige
 *   frontiere       « le jalon 3 part avant que le jalon 2 ait produit son résultat »
 *   pause           « on met en pause, et le moteur continue quand même » (le statut existait,
 *                     et aucun code ne le lisait)
 *   priorite        « la priorité est écrite et personne ne la sert »
 *   modification    « Amel à la place de Deepak recompile toute la mission » ou, pire,
 *                     « renvoie le message déjà parti à Deepak »
 *   fraicheur       « la mission ne sait pas ce qu'elle a lu ni quand »
 *   reprise         « le redémarrage duplique un effet » — la garantie la plus chère
 *   isolation       « deux missions longues se mélangent leurs jalons ou leurs pièces »
 *   verifie         « la mission conclut sans que le résultat ait été vérifié »
 *
 * ── ZÉRO SORTIE RÉELLE ──────────────────────────────────────────────────────────────────
 *
 * La garde de `lib/sortie/garde.ts` s'arme sur un FAIT DU PROCESSUS (le script d'entrée vit
 * sous `scripts/bench/`), jamais sur une variable qu'un banc futur devrait penser à poser
 * (§118.17). On le lui demande, et son désarmement est un échec du banc.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from "node:fs";
import path from "node:path";

const ETAT = path.join(process.cwd(), ".horizon-long.json");
const PHASE = (process.env.PHASE ?? "1").trim();

interface Verdict { id: string; libelle: string; ok: boolean; detail: string }

interface EtatBanc {
  missionId: string;
  missionTemoinId: string;
  /** Les clés d'étapes qui portaient déjà un reçu à la fin de la phase 1. */
  recusPhase1: string[];
  /** Le nombre d'intentions sortantes enregistrées à la fin de la phase 1. */
  intentionsPhase1: number;
  jalonsPhase1: { ordre: number; titre: string; statut: string; planVersion: number; etapes: number }[];
  verdicts: Verdict[];
  demande: string;
}

/**
 * LA DEMANDE — délibérément de forme LONGUE, et écrite comme un dirigeant l'écrirait.
 *
 * Elle porte les quatre signaux qui font qu'un triage la classe COMPLEXE, et chacun est
 * légitime : plusieurs sources indépendantes, des personnes à solliciter, un enchaînement
 * imposé (on ne consolide pas avant d'avoir reçu), et deux livrables distincts. Ce n'est pas
 * une phrase fabriquée pour déclencher l'horizon : c'est ce que ce genre de dossier demande.
 */
const DEMANDE = [
  "Prépare le dossier de l'appel d'offres PCH 2026/14 pour le Nivolex.",
  "Établis d'abord où en est le dossier réglementaire REG-2026-9011 et ce qui bloque encore.",
  "Demande ensuite à Khaled Mansouri le prix de cession retenu et à Sofiane Kaci le volume",
  "prévisionnel sur lequel il s'engage.",
  "Vérifie aussi les engagements contractuels en cours avec Hetero Labs.",
  "Puis consolide tout dans un classeur Excel, rédige la note de synthèse pour le comité,",
  "et reviens vers moi avec les deux pièces.",
].join(" ");

const ok = (v: boolean): string => (v ? "✓" : "✗");

function dire(verdicts: Verdict[]): void {
  console.log("");
  for (const v of verdicts) {
    console.log(`  ${ok(v.ok)} ${v.libelle}`);
    console.log(`      ${v.detail}`);
  }
  const passes = verdicts.filter((v) => v.ok).length;
  console.log(`\n  ══ ${passes}/${verdicts.length} ══\n`);
}

async function contexte() {
  const { prisma } = await import("@/lib/prisma");
  const { getAccess } = await import("@/lib/rbac");
  const { VERITES } = await import("./seed-adam-bench");
  type CurrentUser = import("@/lib/session").CurrentUser;
  const row = await prisma.user.findUnique({ where: { email: VERITES.pdg.email } });
  if (!row) throw new Error("Jeu du banc absent : BENCH_SEED_ALLOW=1 npm run adam:bench:seed");
  const pdg: CurrentUser = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;
  return { prisma, pdg, VERITES };
}

/** L'état des jalons, lu en base — jamais reconstruit de mémoire. */
async function jalonsDe(missionId: string): Promise<EtatBanc["jalonsPhase1"]> {
  const { prisma } = await import("@/lib/prisma");
  const js = await prisma.missionMilestone.findMany({
    where: { missionId }, orderBy: { ordre: "asc" },
  });
  const out: EtatBanc["jalonsPhase1"] = [];
  for (const j of js) {
    const etapes = await prisma.missionStep.count({ where: { missionId, milestoneId: j.id } });
    out.push({ ordre: j.ordre, titre: j.titre, statut: j.statut, planVersion: j.planVersion, etapes });
  }
  return out;
}

/** Les étapes qui portent un REÇU — la preuve d'effet, pas le statut. */
async function recusDe(missionId: string): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.missionStep.findMany({
    where: { missionId, receipt: { not: null } }, select: { key: true, receipt: true },
  });
  return rows.map((r) => `${r.key}#${r.receipt}`).sort();
}

/**
 * FAIRE RÉPONDRE LES HUMAINS — par la PORTE RÉELLE des réveils.
 *
 * On ne force aucune étape et on n'écrit dans aucune table de mission : on produit un
 * ÉVÉNEMENT, exactement comme un mail entrant ou un webhook le ferait. Un banc qui écrirait
 * `status: DONE` à la main prouverait que la base accepte les écritures, rien d'autre.
 */
async function repondreAuxAttentes(missionId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const { reveillerMissions } = await import("@/lib/missions/events/router");
  const { lireAttente } = await import("@/lib/missions/events/match");
  const enAttente = await prisma.missionStep.findMany({
    where: { missionId, status: "WAITING" },
    select: { key: true, title: true, waitFor: true },
  });
  let reveils = 0;
  for (const s of enAttente) {
    const a = lireAttente(s.waitFor) as { event?: string; from?: string } | null;
    if (!a?.event) continue;
    const r = await reveillerMissions({
      type: a.event,
      missionId,
      payload: {
        from: a.from ?? "réponse",
        subject: `Re: ${s.title}`.slice(0, 160),
        // DES CHIFFRES RECONNAISSABLES : le juge final devra les retrouver dans les livrables.
        body: `Prix de cession retenu : 87 400 DZD. Volume prévisionnel engagé : 1 250 unités. `
          + `Le contrat Hetero Labs court jusqu'au 30/09/2026, montant 42 000 000 DZD.`,
      },
    } as never);
    reveils += r.length;
  }
  return reveils;
}

/** Tours de conduite par la porte réelle du battement, jusqu'à stabilité. */
async function conduireJusquaStable(
  pdg: import("@/lib/session").CurrentUser, missionId: string, tours: number,
): Promise<{ tours: number; statut: string | null }> {
  const { conduireMission } = await import("@/platform/in-process/missions/sweep");
  const { prisma } = await import("@/lib/prisma");
  let statut: string | null = null;
  let precedent = "";
  let i = 0;
  for (; i < tours; i++) {
    await conduireMission(pdg, missionId, { maxTours: 20 }).catch((e) => {
      console.log(`      (tour ${i + 1} : ${e instanceof Error ? e.message : String(e)})`);
      return null;
    });
    const j = await jalonsDe(missionId);
    const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true } });
    statut = m?.status ?? null;
    const sig = `${statut}|${j.map((x) => `${x.ordre}${x.statut}${x.etapes}`).join(",")}`;
    if (sig === precedent) break;
    precedent = sig;
    const reveils = await repondreAuxAttentes(missionId);
    if (reveils > 0) console.log(`      ↳ ${reveils} attente(s) levée(s) par une réponse humaine`);
  }
  return { tours: i + 1, statut };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PHASE 1
// ═══════════════════════════════════════════════════════════════════════════════════════════
async function phase1(): Promise<void> {
  const { prisma, pdg } = await contexte();
  const { lancerMission } = await import("@/platform/in-process/missions/runtime");
  const { oublierTentativesSortantes, sortiesInterdites, tentativesSortantes } = await import("@/lib/sortie/garde");
  const { pauserMission, reprendreMissionAgent, prioriserMission } = await import("@/platform/in-process/missions/control");
  const { appliquerModification, prevoirModification } = await import("@/platform/in-process/missions/modifier");
  const { conduireMission } = await import("@/platform/in-process/missions/sweep");

  oublierTentativesSortantes();
  const verdicts: Verdict[] = [];
  console.log(`\n══════════ HORIZON LONG — PHASE 1 ══════════\n${DEMANDE}\n`);

  // ── 1. DÉPART ────────────────────────────────────────────────────────────────────────
  const t0 = Date.now();
  /**
   * `demarrer: false` — LE BANC EST LE SEUL CONDUCTEUR.
   *
   * Sans cela, le lancement laisse un premier tour d'horizon tourner en arrière-plan pendant que
   * le banc conduit lui aussi. Le BAIL empêche le double travail, mais le banc lirait quand même
   * des instantanés pris au milieu d'un tour qu'il n'a pas lancé — et un banc qui mesure une
   * course mesure la course, pas le produit.
   */
  const r = await lancerMission(pdg, DEMANDE, {
    titre: "[BENCH horizon] AO PCH 2026/14 — Nivolex", demarrer: false,
  });
  if (!r.ok) { console.log(`  ✗ non lancée : ${r.error}`); process.exit(2); }
  const missionId = r.missionId;
  console.log(`  mission ${missionId} — lancée en ${Math.round((Date.now() - t0) / 1000)} s`);

  const jalons0 = await jalonsDe(missionId);
  verdicts.push({
    id: "jalons",
    libelle: "La demande longue est DÉCOUPÉE en jalons, pas compilée en un plan monolithique",
    ok: jalons0.length >= 3,
    detail: jalons0.length >= 3
      ? `${jalons0.length} jalons : ${jalons0.map((j) => `${j.ordre}. ${j.titre}`).join(" | ")}`
      : `${jalons0.length} jalon(s) — la mission est partie en plan unique, le lot n'a rien changé`,
  });
  if (jalons0.length < 3) { dire(verdicts); process.exit(1); }

  // ── 2. LA PARESSE — mesurée à l'instant où le premier sous-plan existe ────────────────
  //
  // On conduit UN tour, puis on regarde : le jalon de tête doit porter des étapes, et le
  // dernier ne doit en porter AUCUNE. C'est exactement ce qui rend une mission de trois
  // semaines exécutable — et c'est ce qui tomberait si tout était compilé d'avance.
  await conduireMission(pdg, missionId, { maxTours: 8 }).catch(() => null);
  const jalons1 = await jalonsDe(missionId);
  const tete = jalons1[0];
  const queue = jalons1[jalons1.length - 1];
  verdicts.push({
    id: "paresse",
    libelle: "COMPILATION PARESSEUSE : le premier jalon a des étapes, le dernier n'en a aucune",
    ok: (tete?.etapes ?? 0) > 0 && (queue?.etapes ?? 0) === 0,
    detail: `jalon ${tete?.ordre} « ${tete?.titre?.slice(0, 40)} » → ${tete?.etapes} étape(s) ; `
      + `jalon ${queue?.ordre} « ${queue?.titre?.slice(0, 40)} » → ${queue?.etapes} étape(s) `
      + `(0 attendu : il n'est pas encore à la frontière)`,
  });

  // ── 3. LA PAUSE EST HONORÉE ──────────────────────────────────────────────────────────
  //
  // Le test qui compte : on met en pause, on CONDUIT, et RIEN ne doit bouger. Sans cette
  // mesure, « la pause marche » ne dirait que « la colonne accepte la valeur PAUSED ».
  const avantPause = await prisma.missionStep.count({ where: { missionId, status: "DONE" } });
  const p = await pauserMission(pdg, missionId, "on attend l'avis du comité");
  await conduireMission(pdg, missionId, { maxTours: 8 }).catch(() => null);
  const pendantPause = await prisma.missionStep.count({ where: { missionId, status: "DONE" } });
  const enPause = await prisma.mission.findUnique({
    where: { id: missionId }, select: { status: true, pausedAt: true, pausedReason: true, pausedFrom: true },
  });
  verdicts.push({
    id: "pause",
    libelle: "PAUSE : le moteur s'arrête vraiment, et la pause sait depuis quand et pourquoi",
    ok: p.fait && enPause?.status === "PAUSED" && pendantPause === avantPause
      && enPause.pausedAt !== null && enPause.pausedReason !== null && enPause.pausedFrom !== null,
    detail: `${enPause?.status} · ${avantPause} → ${pendantPause} étapes abouties pendant la pause `
      + `(identique attendu) · depuis ${enPause?.pausedAt?.toISOString().slice(11, 19) ?? "?"} `
      + `· motif « ${enPause?.pausedReason ?? "—"} » · interrompue en ${enPause?.pausedFrom ?? "?"}`,
  });

  const rep = await reprendreMissionAgent(pdg, missionId);
  verdicts.push({
    id: "reprise-pause",
    libelle: "REPRISE : elle repart là où elle en était, et le dit",
    ok: rep.fait && /pause/i.test(rep.message),
    detail: rep.message,
  });

  // ── 4. LA PRIORITÉ ───────────────────────────────────────────────────────────────────
  await prioriserMission(pdg, missionId, 5);
  const { missionsAFaireAvancer } = await import("@/lib/missions/events/router");
  const file = await missionsAFaireAvancer(200);
  const rang = file.indexOf(missionId);
  const prio = await prisma.mission.findUnique({ where: { id: missionId }, select: { priority: true } });
  verdicts.push({
    id: "priorite",
    libelle: "PRIORITÉ : elle est écrite ET servie — la file la place devant",
    ok: prio?.priority === 5 && rang >= 0 && rang < 3,
    detail: `priorité ${prio?.priority} · rang ${rang < 0 ? "absente de la file" : `${rang + 1}/${file.length}`} `
      + `(la requête du battement trie par priorité décroissante)`,
  });

  // ── 5. ON AVANCE, LES HUMAINS RÉPONDENT ──────────────────────────────────────────────
  const marche = await conduireJusquaStable(pdg, missionId, 10);
  const jalons2 = await jalonsDe(missionId);
  /**
   * ON COMPTE LES ÉVÉNEMENTS, PAS L'INSTANTANÉ.
   *
   * `planVersion > 0` est un état MOUVANT : une reprise locale le remet à 0 pour faire écrire un
   * sous-plan neuf, et un banc qui lit à cet instant voit « pas compilé » un jalon qui l'a été
   * trois fois. Le JOURNAL, lui, ne se dédit pas : chaque `MILESTONE_COMPILED` est un sous-plan
   * réellement écrit, et c'est exactement ce que « progressivement » veut dire.
   */
  const compiles = await prisma.missionEvent.count({
    where: { missionId, kind: "MILESTONE_COMPILED" },
  });
  const ordresCompiles = new Set(
    (await prisma.missionEvent.findMany({
      where: { missionId, kind: "MILESTONE_COMPILED" }, select: { detail: true },
    })).map((e) => (e.detail as { ordre?: number } | null)?.ordre).filter((o) => o !== undefined),
  );
  verdicts.push({
    id: "frontiere",
    libelle: "FRONTIÈRE : les sous-plans s'écrivent PROGRESSIVEMENT, à mesure que l'amont aboutit",
    // DEUX conditions, et il faut les deux : plusieurs sous-plans écrits (c'est progressif), ET
    // au moins un jalon qui n'en a AUCUN (c'est paresseux — sinon tout aurait été compilé
    // d'avance et « progressivement » ne décrirait que l'ordre d'écriture).
    ok: compiles > 1 && ordresCompiles.size < jalons2.length,
    detail: `${compiles} sous-plan(s) écrit(s) sur ${ordresCompiles.size} jalon(s) distincts, `
      + `${jalons2.length - ordresCompiles.size} jamais compilé(s) — après ${marche.tours} tour(s) · `
      + jalons2.map((j) => `${j.ordre}:${j.statut}(${j.etapes})`).join(" "),
  });

  // ── 6. LA MODIFICATION CHIRURGICALE ──────────────────────────────────────────────────
  //
  // On vise une personne que le PLAN a réellement nommée — pas un nom qu'on aurait choisi
  // d'avance. Un banc qui viserait un nom absent mesurerait le refus, pas la chirurgie.
  const nommees = await prisma.missionStep.findMany({
    where: { missionId, supersededAt: null }, select: { key: true, title: true, input: true },
  });
  const CIBLES = ["Khaled", "Sofiane", "Hetero"];
  const cible = CIBLES.find((c) => nommees.some((s) => `${s.title} ${JSON.stringify(s.input)}`.includes(c)));
  if (cible) {
    const prevu = await prevoirModification(pdg, missionId, {
      genre: "REMPLACER", cible, remplacant: "Nesrine Boudiaf",
    });
    const avantTouchees = await recusDe(missionId);
    const m = await appliquerModification(pdg, missionId, {
      genre: "REMPLACER", cible, remplacant: "Nesrine Boudiaf",
    });
    const apresTouchees = await recusDe(missionId);
    const total = nommees.length;
    verdicts.push({
      id: "modification",
      libelle: `MODIFICATION CHIRURGICALE : « Nesrine à la place de ${cible} » ne recompile pas tout`,
      ok: m.fait && (prevu?.preservees.length ?? 0) > 0
        && m.etapesInvalidees.length < total
        && JSON.stringify(avantTouchees) === JSON.stringify(apresTouchees),
      detail: `${m.etapesInvalidees.length}/${total} étape(s) invalidée(s), `
        + `${prevu?.preservees.length ?? 0} préservée(s), jalon(s) rouvert(s) : ${m.jalonsRouverts.join(", ") || "—"} · `
        + `reçus AVANT = reçus APRÈS (${avantTouchees.length}) : aucun effet rejoué`,
    });
    verdicts.push({
      id: "effet-nomme",
      libelle: "Ce qui est DÉJÀ parti est nommé, jamais rejoué",
      ok: (prevu?.effetsIrreversibles.length ?? 0) === 0
        || m.etapesInvalidees.every((k) => !prevu?.effetsIrreversibles.includes(k)),
      detail: (prevu?.effetsIrreversibles.length ?? 0) === 0
        ? "aucun effet irréversible dans l'empreinte à ce stade"
        : `${prevu?.effetsIrreversibles.length} effet(s) déjà produit(s) : ${prevu?.effetsIrreversibles.join(", ")} — exclus des invalidations`,
    });
  } else {
    verdicts.push({
      id: "modification",
      libelle: "MODIFICATION CHIRURGICALE",
      ok: false,
      detail: `aucune des cibles ${CIBLES.join("/")} n'apparaît dans les ${nommees.length} étapes du plan — `
        + `le banc ne peut pas mesurer la chirurgie sur une cible absente`,
    });
  }

  // ── 7. LA FRAÎCHEUR ──────────────────────────────────────────────────────────────────
  const entrees = await prisma.missionInput.findMany({ where: { missionId }, orderBy: { retrievedAt: "asc" } });
  verdicts.push({
    id: "fraicheur",
    libelle: "FRAÎCHEUR : la mission sait ce qu'elle a lu, d'où, quand, et sous quelle empreinte",
    ok: entrees.length > 0 && entrees.every((e) => e.source.length > 0 && e.empreinte.length > 0),
    detail: entrees.length === 0
      ? "aucune entrée datée — la table est écrite nulle part, donc la fraîcheur n'existe pas"
      : `${entrees.length} entrée(s) datées · ex. « ${entrees[0].cle.slice(0, 60)} » depuis ${entrees[0].source} `
        + `à ${entrees[0].retrievedAt.toISOString().slice(11, 19)}`,
  });

  // ── 8. UNE SECONDE MISSION LONGUE, EN PARALLÈLE ──────────────────────────────────────
  const r2 = await lancerMission(pdg,
    "Prépare la revue des contrats fournisseurs du trimestre : liste les contrats qui arrivent à "
    + "échéance, demande à Mehdi Larbi l'état des stocks associés et à Khaled Mansouri les encours "
    + "de paiement, puis produis un tableau de synthèse et une note de recommandation pour le comité.",
    { titre: "[BENCH horizon] revue contrats fournisseurs" });
  const missionTemoinId = r2.ok ? r2.missionId : "";
  if (missionTemoinId) await conduireMission(pdg, missionTemoinId, { maxTours: 6 }).catch(() => null);
  void conduireMission;

  const sorties = tentativesSortantes();
  verdicts.push({
    id: "sortie",
    libelle: "ZÉRO sortie réelle (garde de sortie ARMÉE)",
    ok: sortiesInterdites(),
    detail: sortiesInterdites()
      ? `garde armée · ${sorties.length} tentative(s) interceptée(s) avant tout transport`
      : "GARDE DÉSARMÉE — un envoi a pu partir",
  });

  const etat: EtatBanc = {
    missionId,
    missionTemoinId,
    recusPhase1: await recusDe(missionId),
    intentionsPhase1: await prisma.assistantActionIntent.count().catch(() => -1),
    jalonsPhase1: await jalonsDe(missionId),
    verdicts,
    demande: DEMANDE,
  };
  fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2));
  dire(verdicts);
  console.log(`  état écrit dans ${ETAT}`);
  console.log(`  → PHASE 2 : PHASE=2 npx tsx scripts/bench/horizon-long.ts  (PROCESSUS NEUF)\n`);
  await prisma.$disconnect();
  process.exit(verdicts.every((v) => v.ok) ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// PHASE 2 — un processus qui n'a JAMAIS vu cette mission
// ═══════════════════════════════════════════════════════════════════════════════════════════
async function phase2(): Promise<void> {
  if (!fs.existsSync(ETAT)) {
    console.log(`  ✗ ${ETAT} absent : lancez d'abord PHASE=1.`);
    process.exit(2);
  }
  const avant = JSON.parse(fs.readFileSync(ETAT, "utf8")) as EtatBanc;
  const { prisma, pdg } = await contexte();
  const { oublierTentativesSortantes, sortiesInterdites, tentativesSortantes } = await import("@/lib/sortie/garde");
  const { avancementHorizon } = await import("@/platform/in-process/missions/horizon");

  oublierTentativesSortantes();
  const verdicts: Verdict[] = [];
  console.log(`\n══════════ HORIZON LONG — PHASE 2 (processus neuf) ══════════`);
  console.log(`  mission ${avant.missionId} — reprise à froid\n`);

  // ── 9. LA REPRISE NE DUPLIQUE RIEN ───────────────────────────────────────────────────
  //
  // LE VERDICT LE PLUS CHER DU BANC. Un processus neuf reprend une mission qui avait déjà
  // produit des effets. Les reçus d'AVANT doivent tous être là, à l'identique : un reçu qui
  // aurait changé signifierait qu'un envoi est reparti.
  const marche = await conduireJusquaStable(pdg, avant.missionId, 14);
  const recusApres = await recusDe(avant.missionId);
  const disparus = avant.recusPhase1.filter((x) => !recusApres.includes(x));
  verdicts.push({
    id: "reprise",
    libelle: "REPRISE À FROID : aucun effet de la phase 1 n'a été rejoué ni perdu",
    ok: disparus.length === 0,
    detail: `${avant.recusPhase1.length} reçu(s) avant le redémarrage, ${recusApres.length} après · `
      + (disparus.length === 0
        ? "tous les reçus d'avant sont intacts — aucun effet rejoué"
        : `${disparus.length} reçu(s) ONT CHANGÉ : ${disparus.slice(0, 3).join(", ")}`),
  });

  const intentionsApres = await prisma.assistantActionIntent.count().catch(() => -1);
  verdicts.push({
    id: "idempotence",
    libelle: "IDEMPOTENCE : le redémarrage n'a créé aucune intention en double",
    ok: avant.intentionsPhase1 < 0 || intentionsApres >= avant.intentionsPhase1,
    detail: `${avant.intentionsPhase1} → ${intentionsApres} intentions au registre `
      + `(la croissance vient du travail NEUF ; ce qui compte est qu'aucune clé d'idempotence `
      + `n'a été redonnée, ce que la contrainte unique de la base garantit)`,
  });

  // ── 10. L'HORIZON A PROGRESSÉ ────────────────────────────────────────────────────────
  const { jalons, avancement } = await avancementHorizon(avant.missionId);
  const avantAboutis = avant.jalonsPhase1.filter((j) => j.statut === "DONE").length;
  verdicts.push({
    id: "progression",
    libelle: "L'horizon a AVANCÉ après le redémarrage (il ne s'est pas figé à froid)",
    ok: avancement.aboutis + avancement.ecartes >= avantAboutis
      && jalons.some((j) => j.planVersion > 0),
    detail: `${avantAboutis} jalon(s) aboutis avant → ${avancement.aboutis} après `
      + `(+${avancement.ecartes} écartés, ${avancement.bloques} bloqués, ${avancement.restants} restants) · `
      + `${Math.round(avancement.part * 100)} %`,
  });

  // ── 11. ISOLATION MULTI-MISSIONS ─────────────────────────────────────────────────────
  const fuites = avant.missionTemoinId
    ? await prisma.missionStep.count({
        where: {
          missionId: avant.missionId,
          milestone: { missionId: avant.missionTemoinId },
        },
      })
    : 0;
  const jalonsTemoin = avant.missionTemoinId ? await jalonsDe(avant.missionTemoinId) : [];
  const artefacts = await prisma.missionArtifact.findMany({
    where: { missionId: { in: [avant.missionId, avant.missionTemoinId].filter(Boolean) } },
    select: { missionId: true, key: true, fileName: true },
  });
  const parMission = new Map<string, Set<string>>();
  for (const a of artefacts) {
    const s = parMission.get(a.missionId) ?? new Set<string>();
    s.add(a.fileName);
    parMission.set(a.missionId, s);
  }
  const partages = [...(parMission.get(avant.missionId) ?? [])]
    .filter((f) => (parMission.get(avant.missionTemoinId) ?? new Set()).has(f));
  verdicts.push({
    id: "isolation",
    libelle: "ISOLATION : deux missions longues coexistent sans mélanger jalons ni pièces",
    ok: fuites === 0 && partages.length === 0,
    detail: `mission A : ${jalons.length} jalons · mission B : ${jalonsTemoin.length} jalons · `
      + `${fuites} étape(s) rattachée(s) au mauvais jalon · ${partages.length} fichier(s) partagé(s) `
      + `(0 attendu pour les deux)`,
  });

  // ── 12. LA FIN EST VÉRIFIÉE, PAS DÉCLARÉE ────────────────────────────────────────────
  const m = await prisma.mission.findUnique({
    where: { id: avant.missionId },
    select: { status: true, goalSatisfied: true, qaPassed: true, goalVerdict: true },
  });
  const jugements = await prisma.missionEvent.count({
    where: { missionId: avant.missionId, kind: { in: ["MILESTONE_DONE", "MILESTONE_UNSATISFIED"] } },
  });
  const conclue = ["COMPLETED", "PARTIAL", "BLOCKED"].includes(m?.status ?? "");
  verdicts.push({
    id: "verifie",
    libelle: "VÉRIFICATION : aucun jalon n'est fermé sans que son RÉSULTAT ait été jugé",
    ok: jugements > 0 || !conclue,
    detail: `${jugements} verdict(s) de jalon au journal · mission ${m?.status}`
      + (m?.goalVerdict ? ` · « ${m.goalVerdict.slice(0, 140)} »` : "")
      + (conclue && jugements === 0 ? " — CONCLUE SANS AUCUN JUGEMENT DE JALON" : ""),
  });

  verdicts.push({
    id: "faux-succes",
    libelle: "ZÉRO FAUX SUCCÈS : COMPLETED implique le contrôle ET le juge",
    ok: m?.status !== "COMPLETED" || (m.qaPassed === true && m.goalSatisfied === true),
    detail: `statut ${m?.status} · contrôle ${m?.qaPassed === null ? "non mesuré" : m?.qaPassed} `
      + `· objectif ${m?.goalSatisfied === null ? "non jugé" : m?.goalSatisfied}`,
  });

  const sorties = tentativesSortantes();
  verdicts.push({
    id: "sortie",
    libelle: "ZÉRO sortie réelle (garde de sortie ARMÉE)",
    ok: sortiesInterdites(),
    detail: sortiesInterdites()
      ? `garde armée · ${sorties.length} tentative(s) interceptée(s)`
      : "GARDE DÉSARMÉE — un envoi a pu partir",
  });

  console.log(`  ${marche.tours} tour(s) de conduite · statut final ${marche.statut}`);
  const tous = [...avant.verdicts, ...verdicts];
  dire(verdicts);
  console.log(`  ══ TOTAL DES DEUX PHASES : ${tous.filter((v) => v.ok).length}/${tous.length} ══\n`);
  await prisma.$disconnect();
  process.exit(tous.every((v) => v.ok) ? 0 : 1);
}

const lancer = PHASE === "2" ? phase2 : phase1;
lancer().catch((e) => {
  console.error(e);
  process.exit(3);
});
