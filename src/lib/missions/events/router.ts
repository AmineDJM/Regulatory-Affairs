import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/missions/runtime/store";
import { Attente, FaitObserve, correspond, echue, lireAttente } from "@/lib/missions/events/match";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE ROUTEUR D'ÉVÉNEMENTS — ce qui fait qu'une mission se réveille toute seule (§18).
 *
 * ── CE QU'IL N'EST PAS ───────────────────────────────────────────────────────────────────
 *
 * Ce n'est PAS un second registre d'événements. `BusinessEvent` existe, `recordEvent` en est la
 * seule porte, et il porte déjà `missionId`. En créer un deuxième donnerait deux histoires de
 * la même entreprise, dont l'une serait fausse (§17).
 *
 * Ce n'est PAS non plus un ordonnanceur. Il ne fait pas tourner de mission : il RÈGLE les
 * attentes qui viennent d'être satisfaites, et rend la liste des missions concernées. C'est
 * l'ordonnanceur déjà en place qui les fera avancer (§39).
 *
 * ── POURQUOI CETTE SÉPARATION EST NÉCESSAIRE, ET PAS SEULEMENT PROPRE ────────────────────
 *
 * `recordEvent` est appelé DEPUIS l'écriture métier — le dépôt d'un contrat, la réception d'un
 * mail. Si le réveil faisait tourner la mission sur place, le dépôt d'un contrat attendrait la
 * fin d'une mission de trente-trois envois avant de rendre la main.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface Reveil {
  missionId: string;
  stepKey: string;
}

/**
 * RÈGLE LES ATTENTES QUE CE FAIT SATISFAIT.
 *
 * ── LE CADRAGE PAR MISSION ───────────────────────────────────────────────────────────────
 *
 * Quand le fait porte un `missionId`, seules les étapes de CETTE mission sont candidates. Un
 * événement émis dans le cadre d'une mission ne doit pas en réveiller une autre qui attendait
 * quelque chose de ressemblant — le nom d'une personne suffirait à confondre deux dossiers.
 *
 * ── NE JAMAIS FAIRE TOMBER L'ÉMETTEUR ────────────────────────────────────────────────────
 *
 * Comme `recordEvent`, cette fonction avale ses erreurs. L'écriture métier qui a produit le
 * fait doit réussir même si aucune mission ne peut être réveillée : l'inverse ferait échouer un
 * dépôt de contrat à cause d'une mission mal formée.
 */
export async function reveillerMissions(fait: FaitObserve): Promise<Reveil[]> {
  try {
    const enAttente = await prisma.missionStep.findMany({
      where: {
        status: "WAITING",
        nodeType: "WAIT_EVENT",
        mission: {
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          ...(fait.missionId ? { id: fait.missionId } : {}),
        },
      },
      select: { id: true, missionId: true, key: true, title: true, waitFor: true },
    });

    const reveils: Reveil[] = [];
    for (const step of enAttente) {
      const attente = lireAttente(step.waitFor);
      if (!attente || !correspond(attente, fait)) continue;

      // LA MISE À JOUR EST CONDITIONNÉE À L'ÉTAT ATTENDU : deux faits qui arrivent en même
      // temps ne doivent pas régler deux fois la même attente, et c'est la base qui tranche.
      const r = await prisma.missionStep.updateMany({
        where: { id: step.id, status: "WAITING" },
        data: {
          status: "DONE",
          completedAt: new Date(),
          result: { reveillePar: fait.type, payload: (fait.payload ?? null) as never } as never,
        },
      });
      if (r.count !== 1) continue;

      await journaliser(step.missionId, "EVENT_WAKE",
        `« ${step.title} » : l'événement attendu (${fait.type}) est arrivé.`,
        { stepKey: step.key, event: fait.type });
      reveils.push({ missionId: step.missionId, stepKey: step.key });
    }
    return reveils;
  } catch (err) {
    console.error("[missions] réveil impossible", fait.type, err);
    return [];
  }
}

/**
 * RÈGLE UNE ATTENTE HUMAINE (§79) — quelqu'un a fourni ce qu'on lui demandait.
 *
 * Séparée du réveil par événement à dessein : ici, une PERSONNE agit, et l'audit doit dire
 * laquelle. Un réveil par événement n'a pas d'auteur au même sens.
 */
export async function fournirEntree(
  missionId: string,
  stepKey: string,
  contenu: unknown,
  parQui: string,
): Promise<boolean> {
  const step = await prisma.missionStep.findUnique({
    where: { missionId_key: { missionId, key: stepKey } },
    select: { id: true, status: true, nodeType: true, title: true },
  });
  if (!step || step.nodeType !== "WAIT_INPUT" || step.status !== "WAITING") return false;

  const r = await prisma.missionStep.updateMany({
    where: { id: step.id, status: "WAITING" },
    data: { status: "DONE", completedAt: new Date(), result: { fourniPar: parQui, contenu } as never },
  });
  if (r.count !== 1) return false;

  await journaliser(missionId, "INPUT_PROVIDED",
    `« ${step.title} » : l'élément demandé a été fourni.`, { stepKey }, parQui);
  return true;
}

/**
 * LES ATTENTES DONT L'ÉCHÉANCE EST PASSÉE — matière à RELANCE, pas à échec (§87).
 *
 * On rend l'information ; on ne décide pas. Ce qu'on fait d'une attente en retard — relancer,
 * changer de canal, demander au PDG — relève de la politique, pas du routage.
 */
export async function attentesEchues(maintenant = new Date()) {
  const steps = await prisma.missionStep.findMany({
    where: {
      status: "WAITING",
      nodeType: { in: ["WAIT_EVENT", "WAIT_INPUT"] },
      mission: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    select: {
      id: true, missionId: true, key: true, title: true, waitFor: true, updatedAt: true,
      mission: { select: { ownerId: true, title: true } },
    },
  });

  const out: {
    missionId: string; ownerId: string; missionTitle: string;
    stepKey: string; stepTitle: string; attente: Attente; depuis: Date;
  }[] = [];

  for (const s of steps) {
    const attente = lireAttente(s.waitFor);
    if (!attente || !echue(attente, s.updatedAt, maintenant)) continue;
    out.push({
      missionId: s.missionId,
      ownerId: s.mission.ownerId,
      missionTitle: s.mission.title,
      stepKey: s.key,
      stepTitle: s.title,
      attente,
      depuis: s.updatedAt,
    });
  }
  return out;
}

/**
 * LES MISSIONS QUI PEUVENT AVANCER MAINTENANT — la question que pose l'ordonnanceur.
 *
 * Une mission est candidate si elle n'est ni terminée ni annulée ET qu'il lui reste au moins
 * une étape qui n'attend plus rien. Le filtre est volontairement LARGE : le moteur, lui, sait
 * dire « rien à faire » en un tour et sans effet de bord. Rater une mission prête coûterait
 * plus cher qu'un tour à vide.
 */
export async function missionsAFaireAvancer(limite = 20): Promise<string[]> {
  const rows = await prisma.mission.findMany({
    where: {
      kind: "RUNTIME",
      // `PAUSED` est écarté ICI, à la source, et non dans le balayage. Une mission suspendue qui
      // remonterait comme candidate serait chargée, examinée et reposée à chaque battement — et
      // il suffirait qu'un appelant oublie le filtre pour qu'elle reparte. Le seul endroit qui
      // répond « qui peut avancer ? » doit répondre juste.
      status: { notIn: ["COMPLETED", "CANCELLED", "PAUSED"] },
      steps: { some: { status: { in: ["PENDING", "FAILED"] } } },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: limite,
  });
  return rows.map((r) => r.id);
}
