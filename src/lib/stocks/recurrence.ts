import {
  RECURRENCE_LABEL, describeSchedule, nextRunAt,
  type Recurrence, type Schedule,
} from "@/lib/scheduler/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉCURRENCE D'UNE DEMANDE D'ÉTAT DE STOCK — ce que le code décide, et rien d'autre.
 *
 * ── CE QUE CE MODULE N'ÉCRIT PAS ─────────────────────────────────────────────────────────
 *
 * Ni le calcul d'échéance, ni les libellés de récurrence. `lib/scheduler/contract.ts` les porte
 * déjà — module PUR, zéro import, éprouvé — et deux grammaires de récurrence dans un même
 * produit finiraient par ne pas dire la même chose de « tous les dimanches à 7 h » (§118.5).
 * On les RÉUTILISE ; ce fichier ne porte que ce qui est PROPRE à une demande de stock.
 *
 * ── POURQUOI « TOUTES LES HEURES » EST REFUSÉ ────────────────────────────────────────────
 *
 * La grammaire partagée connaît `HOURLY`, et c'est juste pour un RAPPORT — une lecture ne coûte
 * rien à personne. Une demande d'état de stock est une RÉQUISITION : elle crée une tâche
 * assignée et une notification, et elle demande à quelqu'un d'aller COMPTER. Vingt-quatre par
 * jour produiraient vingt-quatre tâches que personne ne fait, et un compteur de tâches ignorées
 * n'est pas un pilotage. Le refus est donc un fait du code, et il NOMME la maille la plus fine
 * admise plutôt que de dire « valeur invalide » (§118.30).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les mailles admises pour une réquisition. Sous-ensemble EXPLICITE de la grammaire partagée. */
export const RECURRENCES_STOCK: readonly Recurrence[] = ["DAILY", "WEEKLY", "MONTHLY"] as const;

export const RECURRENCE_STOCK_DEFAUT: Recurrence = "MONTHLY";

/** L'heure par défaut : 8 h. Un relevé se fait dans la journée de travail, pas à 3 h du matin. */
export const HEURE_DEFAUT = 8;

export type StatutRecurrence = "ACTIVE" | "PAUSED";

export const STATUT_RECURRENCE_LABELS: Record<StatutRecurrence, string> = {
  ACTIVE: "Active",
  PAUSED: "En pause",
};

export const estRecurrenceStock = (v: string): v is Recurrence =>
  (RECURRENCES_STOCK as readonly string[]).includes(v);

export const estStatutRecurrence = (v: string): v is StatutRecurrence =>
  v === "ACTIVE" || v === "PAUSED";

export interface SaisieRecurrence {
  nom: string;
  assigneeId: string;
  recurrence: string;
  hourLocal: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  /** Combien d'hôpitaux sont cochés. Zéro est LÉGITIME — voir ci-dessous. */
  nbHopitaux: number;
}

/**
 * TOUT CE QUI MANQUE, EN UNE FOIS. Un refus par champ ferait ressaisir un formulaire de six
 * champs autant de fois qu'il a de trous (§118.18).
 *
 * ZÉRO HÔPITAL N'EST PAS UN BLOQUANT : le geste de l'écran admet « en général, sans cibler »
 * depuis toujours, et le refuser ici rendrait la récurrence plus exigeante que la demande
 * qu'elle répète — deux règles pour un même geste, dont la plus stricte n'a aucune raison
 * (§118.5). L'écran DIT ce que ça veut dire, il ne l'interdit pas.
 */
export function bloquantsDeRecurrence(s: SaisieRecurrence): string[] {
  const out: string[] = [];
  if (!s.nom.trim()) out.push("Donnez un nom à la récurrence — c'est ce que vous relirez dans la liste dans trois mois.");
  if (!s.assigneeId) out.push("Choisissez le KAM à qui la demande sera adressée.");
  if (!estRecurrenceStock(s.recurrence)) {
    out.push(
      `Maille inconnue « ${s.recurrence || "(vide)"} ». La plus fine admise est QUOTIDIENNE : `
      + "un relevé de stock est un comptage physique, et le demander toutes les heures produirait "
      + "vingt-quatre tâches par jour que personne ne ferait.",
    );
  }
  if (!Number.isInteger(s.hourLocal) || s.hourLocal < 0 || s.hourLocal > 23) {
    out.push("L'heure doit être un entier entre 0 et 23 (heure d'Alger).");
  }
  if (s.recurrence === "WEEKLY" && (s.dayOfWeek === null || s.dayOfWeek < 0 || s.dayOfWeek > 6)) {
    out.push("Pour une récurrence hebdomadaire, choisissez le jour de la semaine.");
  }
  if (s.recurrence === "MONTHLY" && (s.dayOfMonth === null || s.dayOfMonth < 1 || s.dayOfMonth > 31)) {
    out.push("Pour une récurrence mensuelle, choisissez le jour du mois (1 à 31).");
  }
  return out;
}

/** La planification en une phrase — la MÊME que celle des planifications (§118.5). */
export function decrireRecurrence(s: Schedule): string {
  return describeSchedule(s);
}

/** La prochaine échéance, strictement après `apres`. Même calcul que les planifications. */
export function prochaineEcheanceStock(s: Schedule, apres: Date): Date {
  return nextRunAt(s, apres);
}

/** Le libellé d'une maille, emprunté au vocabulaire partagé. */
export const libelleRecurrence = (r: Recurrence): string => RECURRENCE_LABEL[r];

/**
 * CE QUI SE PASSE QUAND UNE ÉCHÉANCE A ÉTÉ MANQUÉE — après une panne, un redéploiement, ou une
 * pause longue.
 *
 * On ne rattrape PAS les occurrences perdues. Une récurrence mensuelle en pause six mois ne doit
 * pas produire six demandes d'un coup le jour de sa reprise : le KAM recevrait six réquisitions
 * identiques dont cinq portent sur des mois révolus, et le comptage physique de mars n'existe
 * plus. On déclenche UNE fois et l'on repart de maintenant.
 *
 * C'est la même décision que « une étape terminée avec son reçu EST le point de reprise »
 * (§118.4) prise dans l'autre sens : ce qui n'a pas eu lieu à sa date n'a plus d'objet.
 */
export function echeanceApresDeclenchement(s: Schedule, maintenant: Date): Date {
  return nextRunAt(s, maintenant);
}

/**
 * LA PHRASE QUI DIT CE QUE LA RÉCURRENCE VA FAIRE — celle qu'on relit avant d'enregistrer.
 *
 * Elle NOMME les hôpitaux et la personne, jamais « 3 hôpitaux » : ce qu'on confirme doit être ce
 * qui sera fait (§118.85), et un compte ne permet pas de vérifier qu'on a coché les bons.
 */
export function apercuRecurrence(input: {
  schedule: Schedule;
  assigneeNom: string;
  hopitaux: readonly string[];
}): string {
  const quand = describeSchedule(input.schedule);
  const ou = input.hopitaux.length > 0
    ? `pour ${input.hopitaux.join(", ")}`
    : "sans cibler d'hôpital — la demande portera sur l'état de stock en général";
  return `${quand}, ${input.assigneeNom} recevra une demande d'état de stock ${ou}.`;
}
