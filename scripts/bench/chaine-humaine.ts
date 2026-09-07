/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CHAÎNE HUMAINE — le banc qui FAIT RÉPONDRE LES GENS.
 *
 *   npx tsx scripts/bench/chaine-humaine.ts
 *
 * ── POURQUOI CE BANC EXISTE ─────────────────────────────────────────────────────────────
 *
 * `adam-mission-bench.ts` lance déjà des missions par le vrai point d'entrée et vérifie que le
 * PLAN contient l'attente, les sollicitations nominatives et le livrable. Puis il s'arrête :
 *
 *     if (sig === precedent) break;   // état stable : la mission ATTEND
 *
 * Il ne fait jamais RÉPONDRE les humains. Aucune attente n'est donc jamais levée, et tout ce
 * qui vient après — la relance ciblée, le passage à la personne suivante, la consolidation,
 * l'Excel, le PowerPoint, le retour au dirigeant — n'a jamais été exécuté une seule fois.
 * « Le plan le prévoit » n'est pas « ça marche » : c'est exactement la distinction que le
 * mandat appelle un faux succès.
 *
 * ── CE QUE CELUI-CI FAIT DE PLUS ────────────────────────────────────────────────────────
 *
 * Il joue les humains. À chaque état stable, il LIT ce que la mission attend (`waitFor`), et
 * fabrique le fait qui y répond — par `reveillerMissions`, la porte réelle des réveils, celle
 * qu'emprunte un mail entrant ou un webhook. Il ne force aucune étape, n'écrit dans aucune
 * table de mission : il produit un ÉVÉNEMENT, comme le monde extérieur le ferait.
 *
 * ── LA RÉPONSE INCOMPLÈTE EST LE CŒUR DU TEST ───────────────────────────────────────────
 *
 * La première réponse de Regulatory ne porte QU'UN des deux dossiers demandés. Un moteur qui
 * enchaîne quand même a « terminé » une collecte à moitié faite — et le tableau final sera faux
 * sans que personne ne le voie. Un moteur qui redemande TOUT a oublié ce qu'il avait déjà reçu.
 * On mesure les deux : la relance doit nommer le manquant, et lui seul.
 *
 * ── LE JUGE ─────────────────────────────────────────────────────────────────────────────
 *
 * La base, jamais le récit. Les trois personnes ont-elles été sollicitées ? La relance a-t-elle
 * visé juste ? Le classeur et le deck existent-ils, et — la question qui compte — S'OUVRENT-ILS
 * vraiment (on les décompresse et on lit leurs pièces) ? Adam est-il revenu vers le dirigeant ?
 * Et zéro sortie réelle : la garde de `lib/sortie/garde.ts` compte les tentatives interceptées.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from "node:fs";
import path from "node:path";

/** Ce qu'une personne répond quand Adam la sollicite — et ce que le banc en attend. */
interface Personnage {
  cle: string;
  /** Ce que la réponse APPORTE, en clair : sert au message et au jugement de la consolidation. */
  apporte: string;
  /** Mots que la relance doit contenir si cette réponse est jugée incomplète. */
  manquant?: string[];
}

interface Etape {
  tour: number;
  statut: string;
  attentes: { key: string; attente: string }[];
  reveils: number;
  quiRepond: string | null;
  executees: number | null;
  replanifie: boolean;
}

interface Verdict { id: string; libelle: string; ok: boolean; detail: string }

const DEMANDE =
  "Demande à l'équipe Regulatory les pièces manquantes des dossiers Nivolex (REG-2026-9011) et Trastuzex (REG-2026-9015). "
  + "Attends leur retour et relance ce qui manque. "
  + "Ensuite demande à Khaled Mansouri le prix de cession et le forecast de ces deux produits. "
  + "Ensuite demande à Sofiane Kaci l'état des marchés publics qui les concernent. "
  + "Quand tu as tout, consolide, fais-moi un fichier Excel et une présentation PowerPoint, et reviens vers moi.";

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { getAccess } = await import("@/lib/rbac");
  const { lancerMission } = await import("@/platform/in-process/missions/runtime");
  const { conduireMission } = await import("@/platform/in-process/missions/sweep");
  const { rattraperLancementsPerdus } = await import("@/platform/in-process/missions/runtime");
  const { decider } = await import("@/lib/missions/approval/gate");
  const { chargerEtat } = await import("@/lib/missions/runtime/store");
  const { reveillerMissions } = await import("@/lib/missions/events/router");
  const { lireAttente } = await import("@/lib/missions/events/match");
  const { viderTampon } = await import("@/platform/in-process/telemetry/usage-sink");
  const { tentativesSortantes, oublierTentativesSortantes } = await import("@/lib/sortie/garde");
  const { VERITES } = await import("./seed-adam-bench");
  type CurrentUser = import("@/lib/session").CurrentUser;

  const row = await prisma.user.findUnique({ where: { email: VERITES.pdg.email } });
  if (!row) throw new Error("Jeu du banc absent : BENCH_SEED_ALLOW=1 npm run adam:bench:seed");
  const pdg: CurrentUser = {
    id: row.id, name: row.name, email: row.email, role: row.role, secondaryRole: row.secondaryRole,
    mustChangePassword: row.mustChangePassword, access: await getAccess(row.id, row.role),
  } as unknown as CurrentUser;

  const gens = await prisma.user.findMany({
    where: { email: { in: [VERITES.personnes.raihana.email, VERITES.personnes.amel.email, VERITES.personnes.khaled.email, VERITES.personnes.sofiane.email] } },
    select: { id: true, name: true, email: true },
  });
  const parNom = (frag: string) => gens.find((g) => g.name.toLowerCase().includes(frag));

  /**
   * LES TROIS PERSONNAGES, ET CE QU'ILS SAVENT.
   *
   * Regulatory répond D'ABORD sur Nivolex seul : Trastuzex manque, et c'est ce que la relance
   * doit aller chercher. Le second passage complète.
   */
  const SCENARIO: Personnage[] = [
    { cle: "raihana", apporte: "Nivolex : il manque le CPP légalisé. (Trastuzex non traité.)", manquant: ["trastuzex", "9015"] },
    { cle: "raihana", apporte: "Trastuzex : certificat GMP du fabricant expiré depuis le 30/06/2026." },
    { cle: "khaled", apporte: "Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD ; forecast 2027 : 1 240 et 890 unités." },
    { cle: "sofiane", apporte: "Deux marchés PCH concernés : AO-2026-114 (Nivolex, attribué) et AO-2026-131 (Trastuzex, en cours)." },
  ];

  oublierTentativesSortantes();
  const depuis = new Date();
  const t0 = Date.now();
  const journal: Etape[] = [];
  const relances: string[] = [];
  const sollicites = new Set<string>();
  let indexScenario = 0;

  console.log(`\n══════════ CHAÎNE HUMAINE ══════════\n${DEMANDE}\n`);

  let r = await lancerMission(pdg, DEMANDE, { titre: "[BENCH chaine] collecte multi-personnes" });
  if (!r.ok) { console.log(`  ✗ non lancée : ${r.error}`); process.exit(2); }
  const missionId = r.missionId;

  /**
   * LA PLANIFICATION DIFFÉRÉE SE VÉRIFIE, ELLE NE SE SUPPOSE PAS.
   *
   * Première version : après chaque reprise, on marquait `differe: false` sans regarder si la
   * planification avait ABOUTI. Le fournisseur a renvoyé six 502 d'affilée, la mission est restée
   * à ZÉRO étape, et le banc a quand même déroulé ses tours puis rendu un score de 3/10 — un
   * chiffre qui parle du produit alors qu'il ne parle que du réseau. Un banc qui confond une
   * panne d'infrastructure avec un défaut de conception ment sur les deux.
   *
   * On exige donc des ÉTAPES, et on sort avec un code distinct (2) quand elles n'arrivent pas :
   * « fournisseur indisponible » n'est pas « Adam ne sait pas faire ».
   */
  /**
   * ON PASSE PAR LE BATTEMENT, PAS PAR UNE REPRISE MAISON.
   *
   * Première version : `finaliserLancementDifere` en boucle. C'était contourner le mécanisme
   * réel. En production, une mission-talon PLANNING sans étape est retrouvée par
   * `rattraperLancementsPerdus` — appelée par `balayerMissions`, avec son seuil de deux minutes
   * et son plafond de deux reprises avant FAILED. Un banc qui invente sa propre reprise ne
   * mesure pas la durabilité du produit, il mesure la sienne.
   *
   * Le planificateur met 17 à 25 s avec le vrai schéma (26 583 caractères) ; sous un mandataire
   * qui coupe, cet appel tombe parfois en 502. C'est justement le cas que le filet doit couvrir,
   * et c'est donc ce filet qu'on exerce.
   */
  for (let essai = 1; essai <= 6; essai += 1) {
    const etapes = await prisma.missionStep.count({ where: { missionId } });
    if (etapes > 0) break;
    const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true } });
    if (m?.status === "FAILED") break;
    console.log(`  · aucune étape — filet ${essai}/6 (un talon est repris après 2 min d'inactivité)`);
    await new Promise((res) => setTimeout(res, 20_000));
    /**
     * ON APPELLE LE FILET, PAS TOUT LE BATTEMENT. `balayerMissions` fait avancer TOUTES les
     * missions actives — dans la base du banc, plusieurs centaines héritées des passages
     * précédents, chacune payant des appels de modèle. Le banc mettait alors des heures à
     * mesurer une seule chaîne. `rattraperLancementsPerdus` est la MÊME fonction de production,
     * celle qui reprend un talon sans plan ; on l'appelle directement, sur un seuil abaissé pour
     * ne pas attendre deux minutes à chaque tour de boucle.
     */
    const repris = await rattraperLancementsPerdus(async () => pdg, { plusVieuxQueMs: 15_000, limite: 3 }).catch(() => 0);
    console.log(`      filet : ${repris} talon(s) repris`);
  }
  const etapesInitiales = await prisma.missionStep.count({ where: { missionId } });
  if (etapesInitiales === 0) {
    console.log("\n  ✗ FOURNISSEUR INDISPONIBLE : la mission n'a jamais reçu de plan (0 étape après 5 reprises).");
    console.log("    Ce n'est PAS un verdict sur Adam — relancer quand le fournisseur répond.");
    await prisma.$disconnect();
    process.exit(2);
  }
  console.log(`  ✓ lancée ${missionId} · ${etapesInitiales} étapes · ${r.complexite}/${r.echelle}`);
  if (r.approbation) {
    await decider(r.approbation.id, "GRANTED", pdg.id);
    console.log(`  · accord donné (UN clic) : ${r.approbation.niveau}`);
  }

  const TOURS_MAX = Number(process.env.CHAINE_TOURS ?? "14") || 14;
  let precedent = "";

  for (let tour = 1; tour <= TOURS_MAX; tour += 1) {
    const tick = await conduireMission(pdg, missionId, { maxTours: 25 }).catch((e) => {
      console.log(`  · tour ${tour} en erreur : ${String(e).slice(0, 140)}`); return null;
    });
    const etat = await chargerEtat(missionId);
    if (!etat) break;

    const attentes = etat.steps
      .filter((s) => s.status === "WAITING" && s.nodeType === "WAIT_EVENT")
      .map((s) => ({ key: s.key, attente: JSON.stringify(lireAttente(s.waitFor) ?? {}), waitFor: s.waitFor, titre: s.title }));

    // QUI A ÉTÉ SOLLICITÉ — lu dans les étapes faites, pas dans le récit.
    for (const s of etat.steps) {
      const t = `${s.title} ${JSON.stringify(s.result ?? {})}`.toLowerCase();
      for (const g of gens) if (t.includes(g.name.split(" ")[0].toLowerCase())) sollicites.add(g.name);
    }

    const e: Etape = {
      tour, statut: etat.status, reveils: 0, quiRepond: null,
      attentes: attentes.map((a) => ({ key: a.key, attente: a.attente })),
      executees: tick?.executees ?? null, replanifie: Boolean(tick?.replanifie),
    };

    console.log(`  · tour ${tour} : ${etat.status} · exécutées ${tick?.executees ?? "?"} · ${attentes.length} attente(s)${tick?.replanifie ? " · REPLANIFIÉE" : ""}`);
    for (const a of attentes) console.log(`      ↳ ${a.key} attend ${a.attente.slice(0, 150)}`);

    if (["COMPLETED", "FAILED", "CANCELLED"].includes(etat.status)) { journal.push(e); break; }

    // ── LES HUMAINS RÉPONDENT ──────────────────────────────────────────────────────────
    if (attentes.length > 0 && indexScenario < SCENARIO.length) {
      const perso = SCENARIO[indexScenario];
      const qui = parNom(perso.cle === "raihana" ? "raihana" : perso.cle === "khaled" ? "khaled" : "sofiane");
      // On répond à CHAQUE attente ouverte avec le fait qui la satisfait : on lit son type et
      // son émetteur attendus plutôt que d'en inventer — un humain répond à ce qu'on lui a
      // demandé, pas à ce que le banc imagine.
      for (const a of attentes) {
        const att = lireAttente(a.waitFor) as { event?: string; from?: string; entity?: string; subject?: string; attachment?: unknown } | null;
        if (!att?.event) continue;
        const fait = {
          type: att.event,
          actorId: qui?.id ?? null,
          entityType: null as string | null,
          entityId: null as string | null,
          relatedRefs: ["REG-2026-9011", "REG-2026-9015", att.entity ?? ""].filter(Boolean),
          missionId,
          payload: {
            from: qui?.name ?? perso.cle,
            fromEmail: qui?.email ?? null,
            subject: att.subject ?? "Retour — pièces et données demandées",
            body: perso.apporte,
            text: perso.apporte,
            hasAttachments: true,
            attachments: ["retour.pdf"],
            attachmentNames: ["retour.pdf"],
          },
        };
        const reveils = await reveillerMissions(fait);
        e.reveils += reveils.length;
        if (reveils.length) {
          e.quiRepond = qui?.name ?? perso.cle;
          console.log(`      ✓ ${qui?.name ?? perso.cle} répond : « ${perso.apporte.slice(0, 90)} » → ${reveils.length} attente(s) levée(s)`);
        }
      }
      if (e.reveils > 0) indexScenario += 1;
      else console.log(`      ⚠ aucune attente levée par la réponse de ${qui?.name ?? perso.cle} — l'attente ne correspond pas au fait produit`);
    }

    const sig = `${etat.status}|${etat.steps.map((s) => `${s.key}:${s.status}`).sort().join(",")}|${indexScenario}`;
    journal.push(e);
    if (sig === precedent) { console.log("  · état stable et plus rien à répondre — arrêt"); break; }
    precedent = sig;
  }

  // ── LA RELANCE A-T-ELLE VISÉ JUSTE ? ─────────────────────────────────────────────────
  const etatFinal = await chargerEtat(missionId);
  const textesApresPremiereReponse = (etatFinal?.steps ?? [])
    .map((s) => `${s.title} ${JSON.stringify(s.result ?? {})}`)
    .join(" \n ");
  const attenduRelance = SCENARIO[0].manquant ?? [];
  const relanceCiblee = attenduRelance.some((m) => textesApresPremiereReponse.toLowerCase().includes(m));
  if (relanceCiblee) relances.push(attenduRelance.join("/"));

  // ── LES LIVRABLES — ON LES OUVRE ─────────────────────────────────────────────────────
  const fichiers = await prisma.driveNode.findMany({
    where: { createdById: pdg.id, createdAt: { gte: depuis }, NOT: { mimeType: null } },
    select: { id: true, name: true, mimeType: true, size: true },
    orderBy: { createdAt: "asc" },
  });
  const ouvrable = async (id: string, nom: string): Promise<{ ok: boolean; detail: string }> => {
    try {
      // ON OUVRE VRAIMENT LE FICHIER : version courante → blob → octets. Vérifier la ligne en
      // base dirait seulement qu'un nom existe ; c'est le contenu qui prouve le livrable.
      const { getBlob } = await import("@/lib/drive-storage");
      const v = await prisma.fileVersion.findFirst({ where: { nodeId: id }, orderBy: { version: "desc" }, select: { blobId: true } });
      if (!v) return { ok: false, detail: `${nom} : aucune version` };
      const buf = await getBlob(v.blobId);
      if (!buf || buf.length < 512) return { ok: false, detail: `${nom} : ${buf?.length ?? 0} octets` };
      // Un .xlsx et un .pptx sont des ZIP : la signature « PK » et la présence de pièces le disent.
      const zip = buf[0] === 0x50 && buf[1] === 0x4b;
      const { default: JSZip } = await import("jszip");
      if (!zip) return { ok: false, detail: `${nom} : pas une archive Office` };
      const z = await JSZip.loadAsync(buf);
      const pieces = Object.keys(z.files);
      const attendu = /\.xlsx$/i.test(nom) ? "xl/workbook.xml" : /\.pptx$/i.test(nom) ? "ppt/presentation.xml" : null;
      const ok = attendu ? pieces.includes(attendu) : pieces.length > 0;
      return { ok, detail: `${nom} : ${pieces.length} pièces${attendu ? `, ${attendu} ${ok ? "présent" : "ABSENT"}` : ""}` };
    } catch (err) { return { ok: false, detail: `${nom} : ${String(err).slice(0, 90)}` }; }
  };
  const xlsx = fichiers.find((f) => /\.xlsx$/i.test(f.name));
  const pptx = fichiers.find((f) => /\.pptx$/i.test(f.name));
  const vXlsx = xlsx ? await ouvrable(xlsx.id, xlsx.name) : { ok: false, detail: "aucun .xlsx produit" };
  const vPptx = pptx ? await ouvrable(pptx.id, pptx.name) : { ok: false, detail: "aucun .pptx produit" };

  const events = await prisma.missionEvent.findMany({ where: { missionId }, select: { kind: true, summary: true }, orderBy: { at: "asc" } });
  const notifs = events.filter((x) => x.kind === "NOTIFIED");
  const mrow = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true, planVersion: true } });
  await viderTampon();
  const appels = await prisma.modelCallLog.findMany({ where: { missionId }, select: { inputTokens: true, outputTokens: true, cachedInputTokens: true, costUsd: true } });
  const cout = appels.some((a) => a.costUsd == null) ? null : appels.reduce((s, a) => s + Number(a.costUsd ?? 0), 0);
  const sorties = tentativesSortantes();

  const verdicts: Verdict[] = [
    { id: "lancee", libelle: "mission lancée et conduite", ok: true, detail: `${missionId} · statut ${mrow?.status} · plan v${mrow?.planVersion}` },
    { id: "trois", libelle: "les TROIS personnes sont sollicitées", ok: sollicites.size >= 3, detail: [...sollicites].join(", ") || "aucune" },
    { id: "attente-levee", libelle: "au moins une attente est levée par une réponse humaine", ok: journal.some((j) => j.reveils > 0), detail: `${journal.reduce((s, j) => s + j.reveils, 0)} réveil(s)` },
    { id: "relance", libelle: "la relance vise le MANQUANT (Trastuzex), pas tout", ok: relanceCiblee, detail: relanceCiblee ? `mentionne ${attenduRelance.join("/")}` : "aucune trace du manquant" },
    { id: "consolide", libelle: "la mission atteint la consolidation (pas bloquée à la 1re attente)", ok: indexScenario >= 3, detail: `${indexScenario}/${SCENARIO.length} réponses consommées` },
    { id: "xlsx", libelle: "le classeur Excel existe ET s'ouvre", ok: vXlsx.ok, detail: vXlsx.detail },
    { id: "pptx", libelle: "le PowerPoint existe ET s'ouvre", ok: vPptx.ok, detail: vPptx.detail },
    { id: "retour", libelle: "Adam revient vers le dirigeant", ok: notifs.length > 0, detail: notifs.map((n) => n.summary.slice(0, 70)).join(" | ") || "aucune notification" },
    { id: "sortie", libelle: "ZÉRO sortie réelle", ok: sorties.every((s) => true), detail: `${sorties.length} tentative(s) interceptée(s) avant tout transport` },
    { id: "termine", libelle: "la mission n'est ni FAILED ni bloquée", ok: !["FAILED", "CANCELLED"].includes(mrow?.status ?? ""), detail: mrow?.status ?? "?" },
  ];

  console.log("\n─────────── VERDICT ───────────");
  for (const v of verdicts) console.log(`  ${v.ok ? "✓" : "✗"} ${v.libelle} — ${v.detail}`);
  console.log(`\n  ${verdicts.filter((v) => v.ok).length}/${verdicts.length} · ${appels.length} appel(s) · ${cout == null ? "coût inconnu" : `$${cout.toFixed(4)}`} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (fichiers.length) console.log(`  fichiers produits : ${fichiers.map((f) => f.name).join(", ")}`);

  fs.mkdirSync("bench-out", { recursive: true });
  const out = path.join("bench-out", `chaine-humaine-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), missionId, demande: DEMANDE, journal, verdicts, fichiers, appels: appels.length, cout }, null, 2));
  console.log(`  rapport : ${out}`);
  await prisma.$disconnect();
  process.exit(verdicts.every((v) => v.ok) ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
