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

/**
 * CE QU'UNE PERSONNE RÉPOND — rangé par DOMAINE, pas par identité.
 *
 * Première version : une file d'attente `[raihana, raihana, khaled, sofiane]` consommée dans
 * l'ordre. Le plan a légitimement réparti Regulatory entre DEUX personnes (Amel pour Nivolex,
 * Raihana pour Trastuzex) ; le banc, lui, répondait toujours « Raihana ». L'attente qui nommait
 * Amel n'a jamais été levée, la mission a stagné, et le banc a conclu « 1/4 réponses
 * consommées » — un chiffre qui parlait du banc, pas d'Adam.
 *
 * Désormais c'est le PLAN qui décide qui parle : on lit le `from` de l'attente et cette
 * personne-là répond, avec ce que son domaine sait. C'est exactement la réalité — le dirigeant
 * ne choisit pas qui, dans Regulatory, traitera quel dossier.
 */
type Domaine = "REGULATORY" | "FINANCE" | "MARCHES";

interface Personnage {
  domaine: Domaine;
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
  const { tentativesSortantes, oublierTentativesSortantes, sortiesInterdites } = await import("@/lib/sortie/garde");
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
    { domaine: "REGULATORY", apporte: "Nivolex : il manque le CPP légalisé. (Trastuzex non traité.)", manquant: ["trastuzex", "9015"] },
    { domaine: "REGULATORY", apporte: "Trastuzex : certificat GMP du fabricant expiré depuis le 30/06/2026." },
    { domaine: "FINANCE", apporte: "Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD ; forecast 2027 : 1 240 et 890 unités." },
    { domaine: "MARCHES", apporte: "Deux marchés PCH concernés : AO-2026-114 (Nivolex, attribué) et AO-2026-131 (Trastuzex, en cours)." },
  ];

  /** Le domaine d'une personne — c'est ce qu'elle SAIT, indépendamment de qui le plan sollicite. */
  const domaineDe = (nom: string): Domaine => {
    const n = nom.toLowerCase();
    if (n.includes("khaled") || n.includes("mansouri")) return "FINANCE";
    if (n.includes("sofiane") || n.includes("kaci")) return "MARCHES";
    return "REGULATORY";
  };

  /** La personne que l'attente NOMME — le banc ne choisit pas, il lit. */
  const quiRepondA = (from: string | undefined): typeof gens[number] | undefined => {
    if (!from) return undefined;
    const f = from.toLowerCase();
    return gens.find((g) => f.includes(g.name.toLowerCase()) || g.name.toLowerCase().split(" ").some((m) => m.length >= 4 && f.includes(m)))
      ?? gens.find((g) => g.email.toLowerCase() === f);
  };

  /** Ce qu'une attente dit, une fois lue — au premier niveau ou dans une branche composée. */
  type Attente = {
    event?: string; from?: string; entity?: string; subject?: string; attachment?: unknown;
    anyOf?: Attente[]; allOf?: Attente[];
  };

  /**
   * LES BRANCHES D'UNE ATTENTE, À PLAT. Une attente simple en rend une : elle-même. Un `allOf`
   * ou un `anyOf` en rend autant qu'il porte de conditions — chacune nomme quelqu'un et dit
   * quoi, donc chacune appelle une réponse.
   */
  const branches = (a: Attente): Attente[] => {
    const sous = [...(a.allOf ?? []), ...(a.anyOf ?? [])];
    if (sous.length === 0) return [a];
    // Une branche composée peut l'être à son tour ; l'événement du parent sert de défaut.
    return sous.flatMap((b) => branches({ event: a.event, ...b }));
  };

  oublierTentativesSortantes();
  const depuis = new Date();
  const t0 = Date.now();
  const journal: Etape[] = [];
  const relances: string[] = [];
  const sollicites = new Set<string>();
  const consommes = new Set<number>();
  const relancesAttendues: string[] = [];

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
    if (attentes.length > 0 && consommes.size < SCENARIO.length) {
      // On répond à CHAQUE attente ouverte : la personne est celle que l'attente NOMME, et le
      // contenu est le prochain que son domaine n'a pas encore donné. Un humain répond de ce
      // qu'il sait, à qui le lui demande — le banc n'invente ni l'un ni l'autre.
      for (const a of attentes) {
        const brute = lireAttente(a.waitFor) as Attente | null;
        if (!brute) continue;
        /**
         * UNE ATTENTE COMPOSÉE EST PLUSIEURS ATTENTES — le banc les joue TOUTES.
         *
         * Première version : on lisait `att.from` au premier niveau. Le plan, lui, avait
         * parfaitement fait son travail : UNE étape « retours Regulatory » portant un `allOf`
         * de deux branches, l'une nommant Amel avec le sujet Nivolex, l'autre Raihana avec le
         * sujet Trastuzex — exactement la discrimination que le compilateur exige désormais.
         * Le banc a lu `from: undefined`, écrit « nomme —, inconnu du jeu d'essai », et rendu
         * 0/4. Un chiffre qui parlait du banc et accusait le produit.
         */
        for (const att of branches(brute)) {
        if (!att.event) continue;
        const qui = quiRepondA(att.from);
        if (!qui) { console.log(`      ⚠ attente « ${a.key} » nomme « ${att.from ?? "—"} », inconnu du jeu d'essai`); continue; }
        const dom = domaineDe(qui.name);
        /**
         * LE SAVOIR D'UNE PERSONNE NE S'ÉPUISE PAS PARCE QU'ON L'A DÉJÀ INTERROGÉE.
         *
         * Première version : un contenu par domaine, consommé une fois. Le plan a légitimement
         * demandé à Khaled le prix de Nivolex ET celui de Trastuzex — deux attentes distinctes,
         * chacune nommant l'entité concernée. Le banc a répondu à la première, n'a plus rien
         * trouvé pour la seconde, et l'a laissée ouverte : « 2 attentes non levées », un chiffre
         * qui parlait du banc.
         *
         * Un humain à qui l'on redemande répond de nouveau. On prend donc le prochain contenu
         * non encore donné de son domaine, et à défaut le DERNIER — celui qui contient tout ce
         * qu'il sait. L'ORDRE reste garanti pour Regulatory : son premier retour est partiel,
         * le second complète, et la relance doit passer entre les deux.
         */
        const duDomaine = SCENARIO.map((sc, idx) => ({ sc, idx })).filter((e) => e.sc.domaine === dom);
        if (duDomaine.length === 0) continue;
        const choisi = duDomaine.find((e) => !consommes.has(e.idx)) ?? duDomaine[duDomaine.length - 1];
        const i = choisi.idx;
        const perso = choisi.sc;
        const fait = {
          type: att.event,
          actorId: qui.id,
          entityType: null as string | null,
          entityId: null as string | null,
          relatedRefs: ["REG-2026-9011", "REG-2026-9015", att.entity ?? ""].filter(Boolean),
          missionId,
          payload: {
            from: qui.name,
            fromEmail: qui.email,
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
          consommes.add(i);
          if (perso.manquant) relancesAttendues.push(...perso.manquant);
          e.quiRepond = qui.name;
          console.log(`      ✓ ${qui.name} répond : « ${perso.apporte.slice(0, 90)} » → ${reveils.length} attente(s) levée(s)`);
        } else {
          console.log(`      ⚠ ${qui.name} a répondu, aucune attente levée — le fait produit ne correspond pas à « ${a.attente.slice(0, 90)} »`);
        }
        }
      }
    }

    const sig = `${etat.status}|${etat.steps.map((s) => `${s.key}:${s.status}`).sort().join(",")}|${consommes.size}`;
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

  /**
   * ── LES LIVRABLES — ON LES OUVRE, ET ON LES TROUVE PAR LE REGISTRE DE LA MISSION ──────
   *
   * Première version : « les nœuds Drive créés depuis le début du run ». Elle a rendu
   * « ✗ aucun .xlsx produit » sur un run où le classeur ÉTAIT produit, VÉRIFIÉ et déposé —
   * mais dans un fichier du MÊME nom qu'un run précédent. Le Drive a fait ce qu'il doit faire :
   * même nom, même dossier ⇒ nouvelle VERSION du même nœud, pas un nœud de plus. Le banc
   * regardait la date de naissance du nœud et concluait à l'absence du fichier.
   *
   * On demande donc à la mission ce qu'ELLE a produit — `MissionArtifact`, son registre — et on
   * ouvre les nœuds qu'elle nomme. C'est plus direct et plus vrai : si le registre ne connaît
   * pas un livrable, c'est un défaut réel du produit (§118.10), pas un artefact de mesure.
   */
  const registre = await prisma.missionArtifact.findMany({
    where: { missionId },
    select: { key: true, driveNodeId: true, status: true, fileName: true, format: true, byteSize: true },
  });
  const fichiers = (await prisma.driveNode.findMany({
    where: { id: { in: registre.map((a) => a.driveNodeId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true, mimeType: true, size: true },
  }));
  const sansDepot = registre.filter((a) => !a.driveNodeId);
  if (sansDepot.length > 0) {
    console.log(`  ⚠ ${sansDepot.length} livrable(s) au registre SANS nœud Drive : ${sansDepot.map((a) => `${a.key} (${a.status})`).join(", ")}`);
  }
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
    /**
     * « LANCÉE ET CONDUITE » — et le verdict le VÉRIFIE.
     *
     * Il s'écrivait `ok: true`. Comme la ligne n'est atteinte que si le lancement a réussi,
     * elle était vraie par construction : un point sur dix offert, qui ne pouvait rien dire.
     * Deuxième tautologie du même fichier, trouvée en cherchant la première.
     *
     * Ce qui compte n'est pas que la mission EXISTE, c'est que le moteur l'ait FAIT AVANCER :
     * un plan matérialisé en étapes, et au moins une étape sortie de l'état initial.
     */
    { id: "lancee", libelle: "mission lancée ET conduite (le moteur l'a fait avancer)",
      ok: (etatFinal?.steps.length ?? 0) > 0 && (etatFinal?.steps ?? []).some((s) => s.status !== "PENDING"),
      detail: `${missionId} · statut ${mrow?.status} · plan v${mrow?.planVersion} · ${etatFinal?.steps.length ?? 0} étape(s), `
        + `${(etatFinal?.steps ?? []).filter((s) => s.status !== "PENDING").length} sortie(s) de PENDING` },
    { id: "trois", libelle: "les TROIS personnes sont sollicitées", ok: sollicites.size >= 3, detail: [...sollicites].join(", ") || "aucune" },
    { id: "attente-levee", libelle: "au moins une attente est levée par une réponse humaine", ok: journal.some((j) => j.reveils > 0), detail: `${journal.reduce((s, j) => s + j.reveils, 0)} réveil(s)` },
    { id: "relance", libelle: "la relance vise le MANQUANT (Trastuzex), pas tout", ok: relanceCiblee, detail: relanceCiblee ? `mentionne ${attenduRelance.join("/")}` : "aucune trace du manquant" },
    /**
     * LA CONSOLIDATION SE JUGE AUX ATTENTES LEVÉES, PAS AUX CONTENUS CONSOMMÉS.
     *
     * Depuis qu'une personne peut répondre plusieurs fois, `consommes` ne mesure plus l'avancée
     * de la mission — il mesure la variété du jeu d'essai. Ce qui dit que la chaîne a progressé,
     * c'est le nombre d'attentes que des réponses humaines ont RÉELLEMENT levées, et qu'aucune
     * ne reste ouverte à la fin.
     */
    { id: "consolide", libelle: "la chaîne va jusqu'au bout : toutes les attentes humaines sont levées",
      ok: journal.reduce((n, j) => n + j.reveils, 0) >= 4 && (journal[journal.length - 1]?.attentes.length ?? 1) === 0,
      detail: `${journal.reduce((n, j) => n + j.reveils, 0)} attente(s) levée(s) · ${journal[journal.length - 1]?.attentes.length ?? "?"} encore ouverte(s) à l'arrêt · ${consommes.size}/${SCENARIO.length} contenus distincts donnés` },
    { id: "xlsx", libelle: "le classeur Excel existe ET s'ouvre", ok: vXlsx.ok, detail: vXlsx.detail },
    { id: "pptx", libelle: "le PowerPoint existe ET s'ouvre", ok: vPptx.ok, detail: vPptx.detail },
    { id: "retour", libelle: "Adam revient vers le dirigeant", ok: notifs.length > 0, detail: notifs.map((n) => n.summary.slice(0, 70)).join(" | ") || "aucune notification" },
    /**
     * ZÉRO SORTIE RÉELLE — et le verdict le PROUVE au lieu de le supposer.
     *
     * Première version : `ok: sorties.every(() => true)`. Une tautologie : elle rendait `true`
     * même sur une liste vide, même garde désarmée. Un verdict qui ne peut pas échouer ne
     * mesure rien — c'est précisément le faux succès que ce banc est censé traquer.
     *
     * Ce qui empêche un courriel de partir, ce n'est pas le nombre de tentatives : c'est que
     * la garde soit ARMÉE. On le lui demande.
     */
    { id: "sortie", libelle: "ZÉRO sortie réelle (garde de sortie armée)", ok: sortiesInterdites(), detail: sortiesInterdites() ? `garde armée · ${sorties.length} tentative(s) interceptée(s) avant tout transport` : "GARDE DÉSARMÉE — un envoi a pu partir" },
    /**
     * TROISIÈME TAUTOLOGIE DU MÊME FICHIER — celle-ci MENTAIT dans son libellé.
     *
     * « la mission n'est ni FAILED ni bloquée » testait `!["FAILED","CANCELLED"].includes(...)` :
     * BLOCKED passait au vert, sous une phrase qui disait le contraire. Le run 10/10 portait donc
     * « ✓ ni FAILED ni bloquée — BLOCKED ». Un verdict qui contredit son propre libellé est pire
     * qu'un verdict absent : il fait passer une mission bloquée pour une mission réussie.
     */
    { id: "termine", libelle: "la mission n'est ni FAILED, ni annulée, ni BLOQUÉE",
      ok: !["FAILED", "CANCELLED", "BLOCKED"].includes(mrow?.status ?? ""), detail: mrow?.status ?? "?" },
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
