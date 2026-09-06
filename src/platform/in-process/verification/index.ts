import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { evaluer, type Affirmation, type Evaluation } from "@/lib/verification/risque";
import { conclure, selectionner, type Methode, type Programme, type Resultat, type Verdict } from "@/lib/verification/methodes";
import { apprendre, feuille, redigerEval, type Echec, type Lecon } from "@/lib/apprentissage/lecon";
import type { NatureManque } from "@/lib/registre/manques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PONT DE LA VÉRIFICATION ET DE L'APPRENTISSAGE (mandat 6 §49).
 *
 * ── LES ÉCHECS NE SONT PAS COLLECTÉS : ILS SONT DÉJÀ ÉCRITS ─────────────────────────────
 *
 * §17 : pas de second registre. `MissionEvent` porte déjà, depuis §44, un `STEP_FAILED` dont
 * le `detail.manque` contient la nature du manque classée par `registre/manques.ts`. Le
 * « Failure Learning System » n'est donc pas un collecteur : c'est une LECTURE de ce journal,
 * regroupée par cause. Écrire une table d'échecs redirait la même chose une seconde fois et
 * divergerait au premier correctif.
 *
 * ── ET LES LEÇONS NE S'APPLIQUENT PAS ───────────────────────────────────────────────────
 *
 * Ce module rend des propositions. Il n'écrit RIEN — ni règle, ni routage, ni description, ni
 * eval. C'est §118.12 tenu par l'absence de fonction : il n'y a pas d'`appliquerLecon` à
 * appeler par mégarde, et il n'y en aura pas. Ce qu'un humain décide, il le décide dans le
 * code, en relisant la proposition.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Refus = { erreur: string; suite?: string };

/** Le plafond de lignes lues. Une lecture bornée qui dit sa borne. */
export const EVENEMENTS_MAX = 3_000;

/**
 * LES ÉCHECS, LUS DANS LE JOURNAL DES MISSIONS — et cloisonnés à ce que la personne peut voir.
 *
 * Le cloisonnement est PAR REQUÊTE (`mission.ownerId`), comme partout ailleurs : lire les
 * échecs des missions d'autrui donnerait, par les libellés de demande, un aperçu de ce que les
 * autres font faire à Adam.
 */
export async function echecsObserves(user: CurrentUser, depuis: Date): Promise<Echec[]> {
  const lignes = await prisma.missionEvent.findMany({
    where: {
      kind: "STEP_FAILED",
      at: { gte: depuis },
      mission: { ownerId: user.id },
    },
    select: {
      at: true, summary: true, detail: true,
      mission: { select: { objective: true, title: true } },
    },
    orderBy: { at: "asc" },
    take: EVENEMENTS_MAX,
  });

  const out: Echec[] = [];
  for (const l of lignes) {
    const d = (l.detail ?? {}) as {
      manque?: { nature?: string; quoi?: string };
      capability?: string; capacite?: string; model?: string; modele?: string; cause?: string;
    };
    const nature = (d.manque?.nature ?? null) as NatureManque | null;
    if (!nature || nature === "INDETERMINE") continue;
    out.push({
      quand: l.at,
      demande: l.mission?.objective ?? l.mission?.title ?? l.summary ?? "",
      // LA CAUSE VIENT DE LA NATURE, par la même table que le banc (§43) — pas d'un second
      // vocabulaire qui divergerait du premier.
      cause: CAUSE_DE_NATURE[nature],
      nature,
      capacite: d.capability ?? d.capacite ?? null,
      modele: d.model ?? d.modele ?? null,
    });
  }
  return out;
}

/** La même table que `juges.ts` — recopiée ici serait un second classement, alors on la partage. */
const CAUSE_DE_NATURE: Readonly<Record<NatureManque, string>> = {
  SOURCE_INACCESSIBLE: "EXECUTION",
  PERMISSION: "PERMISSION",
  CAPACITE_ABSENTE: "PRIMITIVE_ABSENTE",
  MOTEUR_DE_CALCUL: "EXECUTION",
  FORMAT_DE_FICHIER: "EXECUTION",
  RENDU: "RENDU",
  API_EXTERNE: "EXECUTION",
  DONNEE_MANQUANTE: "DONNEE",
  ENTREE_HUMAINE: "PERMISSION",
  MODELE: "MODELE",
  INDETERMINE: "MODELE",
};

export interface FeuilleApprentissage {
  aDecider: Lecon[];
  sousSurveillance: Lecon[];
  resume: string;
  /** Les evals que les leçons proposent d'écrire — du TEXTE, pas du code généré. */
  evals: NonNullable<ReturnType<typeof redigerEval>>[];
  /** Sur quelle période, et combien d'échecs ont été lus. Une mesure dit son assiette. */
  periode: { depuis: Date; echecs: number };
}

export async function apprendreDesEchecs(user: CurrentUser, jours = 30): Promise<FeuilleApprentissage> {
  const depuis = new Date(Date.now() - Math.max(1, Math.min(365, jours)) * 86_400_000);
  const echecs = await echecsObserves(user, depuis);
  const lecons = apprendre(echecs);
  const f = feuille(lecons);
  return {
    ...f,
    evals: f.aDecider.map(redigerEval).filter((x): x is NonNullable<typeof x> => x !== null),
    periode: { depuis, echecs: echecs.length },
  };
}

export interface Plan {
  evaluation: Evaluation;
  programme: Programme;
}

/** Compose le programme de vérification d'une affirmation. Pur en pratique — aucune écriture. */
export function planifierVerification(a: Affirmation, indisponibles: readonly Methode[] = []): Plan {
  const evaluation = evaluer(a);
  return { evaluation, programme: selectionner(a, evaluation.niveau, indisponibles) };
}

export function conclureVerification(p: Plan, resultats: readonly Resultat[]): Verdict {
  return conclure(p.programme, resultats);
}

export type { Affirmation, Evaluation } from "@/lib/verification/risque";
export type { Methode, Programme, Resultat, Verdict } from "@/lib/verification/methodes";
export { FICHES, METHODES, echantillon } from "@/lib/verification/methodes";
export { NIVEAUX, OBTENTIONS, EXPOSITIONS } from "@/lib/verification/risque";
export type { Echec, Lecon } from "@/lib/apprentissage/lecon";
export { ACTIONS, SENS_ACTION, SEUIL_RECURRENCE } from "@/lib/apprentissage/lecon";
