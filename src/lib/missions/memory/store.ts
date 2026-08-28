import { prisma } from "@/lib/prisma";
import { Assemblage, BUDGET_MEMOIRE_DEFAUT, Morceau, composer, estimerJetons } from "@/lib/missions/memory/budget";
import { Episode, Fidelite, SEUILS_JOURS, fideliteVisee } from "@/lib/missions/memory/compact";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MÉMOIRE, CÔTÉ BASE — et l'assemblage du contexte réel.
 *
 * ── CE QUE CE FICHIER RÉUTILISE PLUTÔT QUE DE LE RECRÉER ─────────────────────────────────
 *
 * `AssistantMemoryItem` porte déjà les préférences, alias et principes ; `ExecutiveCommitment`
 * les engagements ; `MissionApproval` les accords en attente. Aucun n'est dupliqué ici. Le seul
 * objet neuf est l'ÉPISODE, parce qu'aucun des trois ne sait porter « ce qui s'est dit en mars »
 * distinctement de « ce qui s'est dit hier » — voir l'en-tête du modèle.
 *
 * ── L'ORDRE DES REQUÊTES N'EST PAS L'ORDRE DU CONTEXTE ───────────────────────────────────
 *
 * On lit tout en parallèle, puis on COMPOSE selon la priorité. Lire dans l'ordre de priorité
 * serait plus lent sans rien changer au résultat : c'est `composer` qui décide ce qui rentre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export interface Span {
  threadId?: string | null;
  fromMessageId?: string | null;
  toMessageId?: string | null;
  turns: number;
  startedAt: Date;
  endedAt: Date;
  tokensBefore: number;
}

/**
 * ENREGISTRE UN ÉPISODE — une fois, et une seule, par tranche.
 *
 * L'unicité porte sur (personne, premier message, dernier message) et vit en BASE. Sans elle,
 * deux passes du compacteur produiraient deux souvenirs du même moment, et le contexte les
 * compterait tous les deux — le même échange pèserait double dans une fenêtre déjà contrainte.
 */
export async function enregistrerEpisode(
  userId: string,
  ep: Episode,
  span: Span,
  fidelite: Fidelite = "RICH",
): Promise<string> {
  const donnees = {
    fidelity: fidelite,
    summary: ep.summary,
    entities: ep.entities as never,
    decisions: ep.decisions as never,
    commitments: ep.commitments as never,
    openQuestions: ep.openQuestions as never,
    corrections: ep.corrections as never,
    threadId: span.threadId ?? null,
    turns: span.turns,
    tokensBefore: span.tokensBefore,
    tokensAfter: estimerJetons(ep.summary),
    startedAt: span.startedAt,
    endedAt: span.endedAt,
  };

  if (span.fromMessageId && span.toMessageId) {
    const e = await prisma.assistantEpisode.upsert({
      where: {
        userId_fromMessageId_toMessageId: {
          userId, fromMessageId: span.fromMessageId, toMessageId: span.toMessageId,
        },
      },
      create: { userId, fromMessageId: span.fromMessageId, toMessageId: span.toMessageId, ...donnees },
      update: {},
      select: { id: true },
    });
    return e.id;
  }

  const e = await prisma.assistantEpisode.create({
    data: { userId, ...donnees },
    select: { id: true },
  });
  return e.id;
}

/**
 * OÙ S'EST ARRÊTÉ LE DERNIER ÉPISODE DE CE FIL — le marqueur de reprise du découpage.
 *
 * Rendre `null` fait repartir du premier message du fil, ce qui est le comportement voulu la
 * toute première fois. Ensuite, on ne relit jamais ce qui a déjà été mémorisé : c'est ce qui
 * rend le découpage linéaire au lieu de quadratique, et c'est aussi ce qui garantit qu'un tour
 * n'entre que dans UN épisode.
 */
export async function dernierePosition(userId: string, threadId: string): Promise<string | null> {
  const e = await prisma.assistantEpisode.findFirst({
    where: { userId, threadId, toMessageId: { not: null } },
    orderBy: { endedAt: "desc" },
    select: { toMessageId: true },
  });
  return e?.toMessageId ?? null;
}

/**
 * LES PERSONNES DONT LA MÉMOIRE A VIEILLI — la file du battement.
 *
 * On ne balaie pas « tous les comptes » : la très grande majorité n'a rien à compresser, et les
 * interroger un par un ferait N requêtes pour N fois rien. On demande donc à la base QUI a au
 * moins un épisode assez vieux pour changer de fidélité, et l'on ne s'occupe que de ceux-là.
 *
 * Le seuil lu ici est le PLUS PETIT des seuils de descente (`STRUCTURED`) : au-delà, un épisode
 * est forcément candidat ; en deçà, aucun ne l'est. `aCompacter` fait ensuite le tri exact.
 */
export async function personnesACompacter(maintenant = new Date(), limite = 10): Promise<string[]> {
  const bord = new Date(maintenant.getTime() - SEUILS_JOURS.STRUCTURED * 24 * 3600 * 1000);
  const rows = await prisma.assistantEpisode.findMany({
    where: { endedAt: { lt: bord }, fidelity: { not: "FACTS" } },
    select: { userId: true },
    orderBy: { endedAt: "asc" },
    take: 500,
  });
  return [...new Set(rows.map((r) => r.userId))].slice(0, limite);
}

/** Les épisodes dont la fidélité est en retard sur leur âge — la file du compacteur. */
export async function aCompacter(userId: string, maintenant = new Date(), limite = 20) {
  const tous = await prisma.assistantEpisode.findMany({
    where: { userId },
    select: {
      id: true, fidelity: true, summary: true, endedAt: true,
      entities: true, decisions: true, commitments: true, openQuestions: true, corrections: true,
    },
    orderBy: { endedAt: "asc" },
    take: 200,
  });

  return tous
    .map((e) => {
      const ageJours = (maintenant.getTime() - e.endedAt.getTime()) / (24 * 3600 * 1000);
      const visee = fideliteVisee(ageJours, e.fidelity as Fidelite);
      return { id: e.id, actuelle: e.fidelity as Fidelite, visee, episode: lireEpisode(e) };
    })
    .filter((x) => x.visee !== x.actuelle)
    .slice(0, limite);
}

function lireEpisode(e: {
  summary: string; entities: unknown; decisions: unknown;
  commitments: unknown; openQuestions: unknown; corrections: unknown;
}): Episode {
  return {
    summary: e.summary,
    entities: strings(e.entities),
    decisions: strings(e.decisions),
    commitments: strings(e.commitments),
    openQuestions: strings(e.openQuestions),
    corrections: strings(e.corrections),
  };
}

/** Applique une compression ACCEPTÉE. Le refus, lui, ne touche pas la base — voir `compact.ts`. */
export async function appliquerFidelite(
  episodeId: string,
  ep: Episode,
  fidelite: Fidelite,
): Promise<void> {
  await prisma.assistantEpisode.update({
    where: { id: episodeId },
    data: {
      fidelity: fidelite,
      summary: ep.summary,
      entities: ep.entities as never,
      decisions: ep.decisions as never,
      commitments: ep.commitments as never,
      openQuestions: ep.openQuestions as never,
      corrections: ep.corrections as never,
      tokensAfter: estimerJetons(ep.summary),
      compactedAt: new Date(),
    },
  });
}

export interface ContexteOptions {
  budget?: number;
  /** L'identité dont on parle — jamais coupée (§97). */
  identiteActive?: string;
  /** La contrainte que la personne vient d'énoncer — jamais coupée non plus. */
  contrainteCourante?: string;
  /** Les tours récents, déjà mis en forme par l'appelant. */
  toursRecents?: string;
  /** Combien d'épisodes au maximum. Borné : la mémoire ne doit pas noyer la question. */
  maxEpisodes?: number;
}

/**
 * ASSEMBLE LE CONTEXTE D'UNE PERSONNE.
 *
 * ── CE QUI EST LU, ET POURQUOI CHAQUE SOURCE ─────────────────────────────────────────────
 *
 *   les approbations en attente — parce qu'oublier un accord donné est la faute la plus visible ;
 *   les engagements ouverts     — pour ne pas relancer ce qui est fait, ni oublier ce qui ne l'est pas ;
 *   la mémoire typée            — préférences, alias, terminologie : ce qui fait qu'Adam parle
 *                                  la langue de la maison ;
 *   les épisodes                — le souvenir, du plus récent au plus ancien.
 *
 * Ce qui n'est PAS lu ici : les tours bruts. C'est l'appelant qui décide combien de tours vifs
 * il veut, et lui seul le sait — la mémoire, elle, commence là où les tours s'arrêtent.
 */
export async function assemblerContexte(
  userId: string,
  opts: ContexteOptions = {},
): Promise<Assemblage> {
  const t0 = Date.now();
  const maxEpisodes = opts.maxEpisodes ?? 12;

  const [approbations, engagements, memoires, episodes] = await Promise.all([
    prisma.missionApproval.findMany({
      where: { status: "PENDING", mission: { ownerId: userId } },
      select: { summary: true, level: true, mission: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.executiveCommitment.findMany({
      where: { ownerId: userId, status: "OPEN" },
      select: { who: true, what: true, dueAt: true },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.assistantMemoryItem.findMany({
      where: { userId, active: true },
      select: { type: true, content: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.assistantEpisode.findMany({
      where: { userId },
      select: {
        summary: true, fidelity: true, endedAt: true,
        entities: true, decisions: true, commitments: true, openQuestions: true, corrections: true,
      },
      orderBy: { endedAt: "desc" },
      take: maxEpisodes,
    }),
  ]);

  const morceaux: Morceau[] = [];

  for (const a of approbations) {
    morceaux.push({
      couche: "APPROBATION_EN_ATTENTE",
      texte: `EN ATTENTE DE VOTRE ACCORD — « ${a.mission.title} » : ${a.summary}`,
    });
  }
  if (opts.identiteActive) {
    morceaux.push({ couche: "IDENTITE_ACTIVE", texte: `Sujet en cours : ${opts.identiteActive}` });
  }
  if (opts.contrainteCourante) {
    morceaux.push({ couche: "CONTRAINTE_COURANTE", texte: `Contrainte donnée : ${opts.contrainteCourante}` });
  }
  if (opts.toursRecents) {
    morceaux.push({ couche: "TOURS_RECENTS", texte: opts.toursRecents });
  }
  for (const e of engagements) {
    const quand = e.dueAt ? ` (attendu le ${e.dueAt.toLocaleDateString("fr-FR")})` : "";
    morceaux.push({ couche: "ENGAGEMENTS", texte: `${e.who} doit : ${e.what}${quand}` });
  }
  for (const m of memoires) {
    morceaux.push({ couche: "PREFERENCES", texte: `${m.type} — ${m.content}` });
  }

  // LES ÉPISODES SONT PONDÉRÉS PAR LEUR FRAÎCHEUR : à budget serré, on garde les récents. Ce
  // n'est pas qu'ils comptent davantage — c'est qu'un souvenir ancien a déjà été réduit à ses
  // faits, et que ses faits, eux, sont ailleurs (mémoire typée, décisions, engagements).
  episodes.forEach((e, i) => {
    const ep = lireEpisode(e);
    const lignes = [
      ep.summary,
      ep.entities.length > 0 ? `entités : ${ep.entities.join(", ")}` : "",
      ep.decisions.length > 0 ? `décidé : ${ep.decisions.join(" ; ")}` : "",
      ep.corrections.length > 0 ? `corrections : ${ep.corrections.join(" ; ")}` : "",
      ep.openQuestions.length > 0 ? `en suspens : ${ep.openQuestions.join(" ; ")}` : "",
    ].filter(Boolean);
    morceaux.push({ couche: "EPISODES", texte: lignes.join("\n"), poids: episodes.length - i });
  });

  return composer(morceaux, opts.budget ?? BUDGET_MEMOIRE_DEFAUT, { debutMs: t0 });
}
