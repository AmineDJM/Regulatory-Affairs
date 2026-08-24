import { REGULATORY_STEP_TYPE } from "@/lib/labels";
import { FINISHED_REG_STATUSES } from "@/lib/regulatory/stage";

/**
 * ÉTAT EXÉCUTIF PRÉCALCULÉ — « precompute intelligence, not only data ».
 *
 * « Où en est Pembro ? » ne doit pas répondre « étape 6 » : le PDG veut, dans la même seconde,
 * le statut réel, le BLOQUEUR, depuis combien de temps, la prochaine étape et les signaux qui
 * méritent son attention. Ces fonctions les DÉRIVENT de données que les outils lisent déjà —
 * fonctions PURES, zéro requête supplémentaire, zéro latence ajoutée : le calcul déterministe
 * fait ce qu'il sait faire parfaitement, le modèle garde son budget de raisonnement pour ce qui
 * demande vraiment de l'intelligence.
 *
 * Honnêteté : chaque champ est dérivé d'une donnée tracée — quand rien n'est traçable (aucune
 * étape datée, aucun mouvement), on le DIT (« non mesurable ») au lieu d'estimer en silence.
 */

const DAY = 86_400_000;

/** Jours ENTIERS écoulés depuis `d` (0 si aujourd'hui) — null si la date manque. */
export function daysSince(d: Date | string | null | undefined, now = new Date()): number | null {
  if (!d) return null;
  const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

// ───────────────────────── Dossier Regulatory ─────────────────────────

export interface RegStepInput {
  type: string;
  status: string; // NOT_STARTED | IN_PROGRESS | DONE | BLOCKED | LATE
  plannedDate: Date | null;
  actualDate: Date | null;
  missingDocs?: string | null;
  responsible?: string | null;
}

export interface RegulatoryStateInput {
  status: string;
  priority: string;
  targetSubmissionDate: Date | null;
  targetDate: Date | null;
  responsible: string | null;
  steps: RegStepInput[];
  /** Dernier mouvement tracé du dossier (journal d'audit), s'il existe. */
  lastActivity: { at: Date; summary: string | null } | null;
}

const stepLabel = (type: string): string => REGULATORY_STEP_TYPE[type] ?? type;

/**
 * La synthèse exécutive d'un dossier Regulatory : étape courante, bloqueur DÉRIVÉ (étape
 * bloquée / pièces manquantes / retard sur la date prévue), jours dans l'étape, prochaine
 * échéance, prochaine étape attendue, dernier mouvement, et SIGNAUX d'attention.
 */
export function regulatoryExecutiveState(p: RegulatoryStateInput, now = new Date()): Record<string, unknown> {
  const done = p.steps.filter((s) => s.status === "DONE");
  const currentIdx = p.steps.findIndex((s) => s.status !== "DONE");
  const current = currentIdx >= 0 ? p.steps[currentIdx] : null;
  const next = currentIdx >= 0 ? p.steps[currentIdx + 1] ?? null : null;

  // Depuis quand est-on DANS l'étape courante : depuis la fin réelle de la dernière étape faite.
  const lastDoneAt = done.reduce<Date | null>((acc, s) => (s.actualDate && (!acc || s.actualDate > acc) ? s.actualDate : acc), null);
  const joursDansEtape = current ? daysSince(lastDoneAt, now) : null;

  // Le BLOQUEUR — dérivé, jamais inventé : ce que les données tracées permettent d'affirmer.
  let bloqueur: string | null = null;
  if (current) {
    const lateDays = current.plannedDate && current.plannedDate < now ? daysSince(current.plannedDate, now) : null;
    if (current.status === "BLOCKED") {
      bloqueur = `étape marquée BLOQUÉE${current.missingDocs ? ` — pièces manquantes : ${current.missingDocs}` : ""}`;
    } else if (current.missingDocs) {
      bloqueur = `pièces manquantes : ${current.missingDocs}`;
    } else if (lateDays != null && lateDays > 0) {
      bloqueur = `étape en retard de ${lateDays} j sur la date prévue`;
    }
  }

  const sinceActivity = daysSince(p.lastActivity?.at ?? null, now);

  // Les SIGNAUX : peu, dérivés, chacun vérifiable. Une liste vide est une information.
  const signaux: string[] = [];
  const lateSteps = p.steps.filter((s) => s.status !== "DONE" && s.plannedDate && s.plannedDate < now);
  if (lateSteps.length > 0) signaux.push(`${lateSteps.length} étape(s) en retard sur leur date prévue`);
  if (sinceActivity != null && sinceActivity > 30) signaux.push(`aucun mouvement tracé depuis ${sinceActivity} j`);
  if ((p.priority === "HIGH" || p.priority === "CRITICAL") && (lateSteps.length > 0 || (sinceActivity ?? 0) > 30)) {
    signaux.push(`dossier priorité ${p.priority} qui n'avance pas — mérite l'attention`);
  }
  if (p.targetSubmissionDate && p.targetSubmissionDate < now && !done.some((s) => s.type === "DOSSIER_SUBMISSION")) {
    signaux.push(`cible de dépôt dépassée (${p.targetSubmissionDate.toISOString().slice(0, 10)}) sans dépôt tracé`);
  }
  if (p.targetDate && p.targetDate < now && !(FINISHED_REG_STATUSES as readonly string[]).includes(p.status)) {
    signaux.push(`cible d'enregistrement dépassée (${p.targetDate.toISOString().slice(0, 10)})`);
  }

  return {
    etapeCourante: current
      ? { etape: stepLabel(current.type), statut: current.status, responsable: current.responsible ?? p.responsible ?? "non assigné" }
      : "toutes les étapes sont faites",
    bloqueur: bloqueur ?? (current ? "aucun bloqueur tracé (ni blocage déclaré, ni pièce manquante, ni retard)" : null),
    joursDansEtapeCourante: current ? (joursDansEtape ?? "non mesurable (aucune étape précédente datée)") : null,
    prochaineEcheance: current?.plannedDate
      ? current.plannedDate.toISOString().slice(0, 10)
      : next?.plannedDate?.toISOString().slice(0, 10) ?? null,
    prochaineEtapeAttendue: next ? stepLabel(next.type) : current ? "dernière étape du circuit" : null,
    dernierMouvement: p.lastActivity
      ? { le: p.lastActivity.at.toISOString().slice(0, 10), quoi: p.lastActivity.summary ?? "mouvement tracé", ilYAJours: sinceActivity }
      : "aucun mouvement tracé au journal",
    signaux,
  };
}

// ───────────────────────── Demande de paiement / règlement ─────────────────────────

export interface ValidationStepInput {
  status: string; // PENDING | APPROVED | REJECTED …
  decidedAt: Date | null;
  validatorName: string;
  order: number;
}

export interface PaymentStateInput {
  status: string; // PaymentRequestStatus
  dueDate: Date | null;
  createdAt: Date;
  /** Les demandes de validation qui visent ce paiement (avec la chronologie des marches). */
  validations: { createdAt: Date; steps: ValidationStepInput[] }[];
  /** Le règlement (ordre de dépense) s'il existe. */
  order: { status: string; centralStatus: string | null; paidDate: Date | null; createdAt: Date } | null;
}

/**
 * La synthèse exécutive d'une demande de paiement : QUI la bloque (le validateur dont la marche
 * est en attente, depuis combien de jours), la prochaine étape du circuit, et les signaux
 * (échéance dépassée, attente anormalement longue). Tout est dérivé de la chronologie tracée.
 */
export function paymentExecutiveState(p: PaymentStateInput, now = new Date()): Record<string, unknown> {
  // La marche EN ATTENTE la plus ancienne, toutes demandes de validation confondues.
  let waiting: { validator: string; sinceDays: number | null } | null = null;
  for (const v of p.validations) {
    const sorted = [...v.steps].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.status === "PENDING");
    if (idx < 0) continue;
    const prevDecided = idx > 0 ? sorted[idx - 1].decidedAt : null;
    const since = daysSince(prevDecided ?? v.createdAt, now);
    if (!waiting || (since ?? 0) > (waiting.sinceDays ?? 0)) {
      waiting = { validator: sorted[idx].validatorName, sinceDays: since };
    }
  }

  const paid = Boolean(p.order?.paidDate);
  const atCenter = p.order?.centralStatus === "AWAITING";

  // La PROCHAINE ÉTAPE du circuit — déduite de l'état, dite en clair.
  let prochaineEtape: string;
  let bloqueur: string | null = null;
  if (paid) {
    prochaineEtape = "rien — le règlement est payé";
  } else if (atCenter && p.order) {
    const centerDays = daysSince(p.order.createdAt, now);
    prochaineEtape = "bon à payer du centre de paiement";
    bloqueur = `au centre de paiement depuis ${centerDays ?? "?"} j — en attente du bon à payer`;
  } else if (p.order) {
    prochaineEtape = `exécution du règlement (statut actuel : ${p.order.status})`;
  } else if (waiting) {
    prochaineEtape = `validation de ${waiting.validator}`;
    bloqueur = `en attente de ${waiting.validator}${waiting.sinceDays != null ? ` depuis ${waiting.sinceDays} j` : ""}`;
  } else if (p.status === "DRAFT") {
    prochaineEtape = "soumission (la demande est encore au brouillon)";
  } else if (p.status === "APPROVED") {
    prochaineEtape = "création du règlement (bon à payer donné, pas encore d'ordre de dépense)";
  } else if (["REJECTED", "CANCELLED"].includes(p.status)) {
    prochaineEtape = "rien — la demande est close";
  } else {
    prochaineEtape = "décision sur la demande";
  }

  const signaux: string[] = [];
  const overdue = !paid && p.dueDate && p.dueDate < now ? daysSince(p.dueDate, now) : null;
  if (overdue != null && overdue > 0) signaux.push(`échéance convenue dépassée de ${overdue} j`);
  if (waiting?.sinceDays != null && waiting.sinceDays > 7) signaux.push(`la validation attend depuis ${waiting.sinceDays} j chez la même personne`);
  const age = daysSince(p.createdAt, now);
  if (!paid && !["REJECTED", "CANCELLED"].includes(p.status) && age != null && age > 45) {
    signaux.push(`demande ouverte depuis ${age} j sans paiement`);
  }

  return {
    bloqueur: bloqueur ?? (paid ? null : "aucun bloqueur tracé"),
    prochaineEtape,
    joursDepuisCreation: age,
    echeance: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
    signaux,
  };
}
