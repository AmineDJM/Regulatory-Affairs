import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/missions/runtime/store";
import { designe, emetteurs, norm, references, type FaitObserve } from "@/lib/missions/events/match";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ENGAGEMENTS SE SATISFONT TOUT SEULS (§86, §103).
 *
 * ── LE COMPORTEMENT QU'ON REMPLACE ───────────────────────────────────────────────────────
 *
 * Adam demande son contrat à Redouane. Redouane le dépose. Trois jours plus tard, Adam relance
 * Redouane — parce que personne ne lui a dit « il l'a fait ». C'est le défaut qui ruine la
 * confiance le plus vite : un assistant qui harcèle quelqu'un pour une chose déjà faite est
 * pire qu'un assistant qui ne relance pas.
 *
 * ── LE PRINCIPE ──────────────────────────────────────────────────────────────────────────
 *
 * Un engagement est une ATTENTE, comme celle d'une étape de mission. Le fait qui la satisfait
 * arrive par le même registre, et se reconnaît par les mêmes moyens — d'où la réutilisation
 * littérale des fonctions de `events/match.ts`. Deux logiques de reconnaissance divergeraient,
 * et celle qui diverge est toujours celle qui laisse relancer à tort.
 *
 * ── CE QUI DISTINGUE UN ENGAGEMENT D'UNE ATTENTE DE MISSION ──────────────────────────────
 *
 * Une attente de mission nomme UN type d'événement. Un engagement, non : « Redouane m'envoie
 * son contrat » est satisfait par un dépôt de document, par un mail avec pièce jointe, ou par
 * une tâche marquée faite. On accepte donc une FAMILLE de faits — mais toujours de la bonne
 * personne, et toujours sur la bonne entité quand elle est connue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES FAITS QUI PEUVENT TENIR UNE PROMESSE.
 *
 * Fermée à dessein. Un `TASK_COMPLETED` ou un `DOCUMENT_UPLOADED` prouvent quelque chose ; un
 * `RECORD_VIEWED` ne prouve rien, et l'accepter satisferait une promesse parce que la personne
 * a ouvert un écran.
 */
export const FAITS_SATISFAISANTS = [
  "DOCUMENT_UPLOADED", "EMAIL_RECEIVED", "TASK_COMPLETED",
  "PAYMENT_RECORDED", "VALIDATION_DONE", "CONTRACT_SIGNED",
] as const;

const SATISFAISANTS = new Set<string>(FAITS_SATISFAISANTS.map((f) => norm(f)));

export interface Engagement {
  id: string;
  who: string;
  personId: string | null;
  what: string;
  relatedRef: string | null;
  missionId: string | null;
  stepKey: string | null;
}

/**
 * CE FAIT TIENT-IL CETTE PROMESSE ?
 *
 * Pure, pour la même raison que la correspondance d'événement : c'est une décision qui, prise
 * de travers, fait taire une relance légitime — ou en déclenche une injustifiée.
 */
export function tientLaPromesse(e: Engagement, fait: FaitObserve): boolean {
  if (!SATISFAISANTS.has(norm(fait.type))) return false;

  // 1. LA PERSONNE. L'identité canonique prime ; le libellé libre sert de repli, parce que
  //    beaucoup d'engageants (fournisseurs, partenaires) n'ont pas de compte ERP.
  const candidats = emetteurs(fait);
  const bonneP = e.personId ? designe(e.personId, candidats) : designe(e.who, candidats);
  if (!bonneP) return false;

  // 2. L'ENTITÉ, quand l'engagement en nomme une. Sans ce filtre, un dépôt de document par
  //    Redouane satisferait TOUTES ses promesses en cours d'un coup.
  if (e.relatedRef && !references(fait).includes(norm(e.relatedRef))) return false;

  return true;
}

/**
 * RÈGLE LES ENGAGEMENTS QUE CE FAIT SATISFAIT.
 *
 * Comme le routeur d'événements : on avale les erreurs. Le dépôt d'un contrat doit réussir même
 * si aucun engagement ne peut être réglé.
 */
export async function satisfaireEngagements(fait: FaitObserve): Promise<string[]> {
  try {
    if (!SATISFAISANTS.has(norm(fait.type))) return [];

    const ouverts = await prisma.executiveCommitment.findMany({
      where: { status: "OPEN" },
      select: {
        id: true, who: true, personId: true, what: true,
        relatedRef: true, missionId: true, stepKey: true,
      },
    });

    const regles: string[] = [];
    for (const e of ouverts) {
      if (!tientLaPromesse(e, fait)) continue;
      const r = await prisma.executiveCommitment.updateMany({
        where: { id: e.id, status: "OPEN" },
        data: {
          status: "DONE",
          evidence: `${fait.type}${fait.entityId ? ` sur ${fait.entityType}:${fait.entityId}` : ""}`,
        },
      });
      if (r.count !== 1) continue;
      regles.push(e.id);
      if (e.missionId) {
        await journaliser(e.missionId, "COMMITMENT_SATISFIED",
          `« ${e.what} » : ${e.who} l'a fait.`,
          { commitmentId: e.id, event: fait.type, stepKey: e.stepKey });
      }
    }
    return regles;
  } catch (err) {
    console.error("[missions] satisfaction d'engagement impossible", fait.type, err);
    return [];
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RELANCE INTELLIGENTE (§103).
 *
 * ── LES QUATRE RAISONS DE NE PAS RELANCER ────────────────────────────────────────────────
 *
 *   1. l'engagement est déjà tenu — évident, et pourtant c'est l'erreur la plus fréquente ;
 *   2. l'échéance n'est pas passée — relancer avant terme est de l'impatience, pas du suivi ;
 *   3. on a déjà relancé récemment — deux relances le même jour sont du harcèlement ;
 *   4. on n'a jamais rien demandé — relancer une promesse qu'on n'a pas sollicitée est absurde.
 *
 * Le point 3 mérite qu'on s'y arrête : le délai entre deux relances CROÎT. Une personne qui
 * n'a pas répondu à trois relances ne répondra pas à la quatrième le lendemain ; insister au
 * même rythme transforme un rappel utile en bruit qu'on finit par filtrer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface EtatRelance {
  status: string;
  dueAt: Date | null;
  promisedAt: Date | null;
  lastNudgeAt: Date | null;
  /** Combien de fois on a déjà relancé. Sert à espacer, pas à abandonner. */
  relances: number;
}

/** Le délai minimal avant la relance suivante, en jours. Croissant, et borné. */
export function delaiRelance(relances: number): number {
  return Math.min(1 + relances * 2, 14);
}

export interface DecisionRelance {
  relancer: boolean;
  raison: string;
}

export function doitRelancer(e: EtatRelance, maintenant: Date): DecisionRelance {
  if (e.status !== "OPEN") return { relancer: false, raison: "l'engagement n'est plus ouvert" };

  const reference = e.dueAt ?? e.promisedAt;
  if (!reference) {
    return { relancer: false, raison: "aucune échéance : il n'y a rien à relancer" };
  }
  if (maintenant.getTime() <= reference.getTime()) {
    return { relancer: false, raison: "l'échéance n'est pas passée" };
  }

  if (e.lastNudgeAt) {
    const jours = (maintenant.getTime() - e.lastNudgeAt.getTime()) / (24 * 3600 * 1000);
    const requis = delaiRelance(e.relances);
    if (jours < requis) {
      return {
        relancer: false,
        raison: `relancé il y a ${Math.floor(jours)} jour(s) ; on attend ${requis} jour(s) entre deux rappels`,
      };
    }
  }

  return { relancer: true, raison: "échéance dépassée et aucun rappel récent" };
}

/**
 * LES PERSONNES QUI ONT QUELQUE CHOSE À RELANCER — la file du battement.
 *
 * On ne balaie pas tous les comptes : la quasi-totalité n'a aucun engagement en retard, et les
 * interroger un par un ferait N requêtes pour rien. On demande à la base QUI a au moins un
 * engagement ouvert dont l'échéance est passée, et `aRelancer` fait ensuite le tri exact —
 * échéance, dernier rappel, espacement croissant.
 */
export async function proprietairesARelancer(maintenant = new Date(), limite = 25): Promise<string[]> {
  const rows = await prisma.executiveCommitment.findMany({
    where: {
      status: "OPEN",
      OR: [{ dueAt: { lt: maintenant } }, { dueAt: null, promisedAt: { lt: maintenant } }],
    },
    select: { ownerId: true },
    orderBy: { dueAt: "asc" },
    take: 500,
  });
  return [...new Set(rows.map((r) => r.ownerId))].slice(0, limite);
}

/** Les engagements qu'il est légitime de relancer maintenant. Le « qui » et le « quoi » suivent. */
export async function aRelancer(ownerId: string, maintenant = new Date()) {
  const ouverts = await prisma.executiveCommitment.findMany({
    where: { ownerId, status: "OPEN" },
    select: {
      id: true, who: true, what: true, dueAt: true, promisedAt: true,
      lastNudgeAt: true, missionId: true, personId: true, relatedRef: true,
    },
  });

  return ouverts
    .map((e) => ({
      engagement: e,
      // Le nombre de relances n'est pas stocké : on le DÉDUIT de l'écart entre la première
      // échéance et le dernier rappel. Ajouter un compteur serait une donnée de plus à tenir
      // à jour, et une de plus à voir diverger.
      decision: doitRelancer({
        status: "OPEN", dueAt: e.dueAt, promisedAt: e.promisedAt,
        lastNudgeAt: e.lastNudgeAt, relances: relancesDeduites(e.dueAt ?? e.promisedAt, e.lastNudgeAt),
      }, maintenant),
    }))
    .filter((x) => x.decision.relancer);
}

/**
 * COMBIEN DE FOIS A-T-ON DÉJÀ RELANCÉ ? — déduit, pas compté.
 *
 * ── L'INVERSION EST CUMULATIVE, ET C'EST TOUTE LA DIFFÉRENCE ────────────────────────────
 *
 * L'écart mesuré va de l'ÉCHÉANCE au DERNIER rappel : c'est un cumul, pas un intervalle. Si les
 * rappels ont suivi la cadence de `delaiRelance` (1, 3, 5, 7… jours), le cumul après k rappels
 * vaut 1+3+5+…+(2k−1) = k². Le nombre de rappels est donc la RACINE de l'écart, pas sa moitié.
 *
 * La première écriture inversait un seul intervalle : 19 jours d'écart y valaient dix rappels
 * au lieu de quatre. La conséquence se voyait en exploitation — un engagement en retard de trois
 * semaines recevait son PREMIER rappel, puis se retrouvait aussitôt à l'espacement maximal de
 * quatorze jours, comme s'il en avait déjà reçu dix. Le commentaire d'origine disait d'ailleurs
 * « 7 ⇒ 3 » quand le code rendait 4 : le texte avait raison, pas le calcul.
 *
 * Au-delà de 49 jours (k = 7), `delaiRelance` plafonne à quatorze jours et le cumul redevient
 * linéaire — la formule suit.
 */
export function relancesDeduites(echeance: Date | null, dernierRappel: Date | null): number {
  if (!echeance || !dernierRappel) return 0;
  const jours = (dernierRappel.getTime() - echeance.getTime()) / (24 * 3600 * 1000);
  if (jours <= 0) return 0;
  // 1 jour ⇒ 1 relance, 3 ⇒ 2, 7 ⇒ 3, 13 ⇒ 4, 21 ⇒ 5… l'inverse CUMULÉ de `delaiRelance`.
  if (jours <= 49) return Math.max(1, Math.round(Math.sqrt(jours)));
  return 7 + Math.floor((jours - 49) / 14);
}

/** Marque la relance comme faite. Sans cela, la suivante repartirait le lendemain. */
export async function noterRelance(commitmentId: string, maintenant = new Date()): Promise<void> {
  await prisma.executiveCommitment.updateMany({
    where: { id: commitmentId, status: "OPEN" },
    data: { lastNudgeAt: maintenant },
  });
}
