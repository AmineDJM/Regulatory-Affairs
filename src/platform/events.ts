import { publish, type EventInput } from "./event-bus";
import type { DomainEvent } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE DES FAITS — ce que la plateforme sait annoncer.
 *
 * C'EST LA MOITIÉ « ERP » DE LA FRONTIÈRE. Les actions métier importent ce fichier, et rien
 * d'autre d'Adam. Un seul import, une seule fonction, un nom d'événement pris dans une liste
 * fermée : le coût d'instrumenter une action est d'une ligne, ce qui est la condition pour que
 * ce soit réellement fait partout plutôt qu'aux trois endroits les plus visibles.
 *
 * ── DES FAITS, PAS DES ORDRES ────────────────────────────────────────────────────────────
 *
 * Chaque nom est un VERBE AU PASSÉ. « regulatory.stage-changed » dit ce qui est arrivé ;
 * « refresh-adam-cache » dirait à Adam quoi faire, et rendrait l'ERP responsable du
 * fonctionnement interne d'Adam. Le premier laisse les deux évoluer séparément, le second les
 * ressoude — sous une couche d'événements, ce qui est pire que le couplage direct parce que
 * c'est invisible.
 *
 * ── LA CHARGE UTILE EST MINIMALE, ET C'EST VOULU ─────────────────────────────────────────
 *
 * De quoi décider s'il faut relire — un identifiant, un statut, un titre. Jamais la ligne
 * complète. Un événement qui transporte l'entité entière devient une seconde source de vérité,
 * qui dérive dès que le modèle change : exactement la « seconde base ERP concurrente » que la
 * mission interdit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES FAITS CONNUS. Liste fermée : ajouter un événement est une décision, et le typage force à
 * décider aussi de son sujet et de sa charge utile.
 */
export const DOMAIN_EVENTS = [
  // ── Personnes ──────────────────────────────────────────────────────────────────────────
  "hr.employee-added",
  "hr.employee-updated",
  "hr.employee-departed",
  "hr.leave-decided",
  // ── Réglementaire ──────────────────────────────────────────────────────────────────────
  "regulatory.dossier-created",
  "regulatory.stage-changed",
  "regulatory.owner-changed",
  // ── Documents ──────────────────────────────────────────────────────────────────────────
  "drive.document-added",
  "drive.document-trashed",
  "legal.document-added",
  // ── Argent ─────────────────────────────────────────────────────────────────────────────
  "finance.payment-validated",
  "finance.expense-recorded",
  // ── Décisions & travail ────────────────────────────────────────────────────────────────
  "workflow.step-decided",
  "task.completed",
  "decision.recorded",
  // ── Messagerie d'Adam ──────────────────────────────────────────────────────────────────
  "mail.received",
  "mail.sent",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[number];

const KNOWN = new Set<string>(DOMAIN_EVENTS);

export interface EmitInput {
  type: DomainEventType;
  subject: { type: string; id: string };
  /** Qui a provoqué le changement — `null` pour le système (import, tâche planifiée, webhook). */
  actorId?: string | null;
  data?: Readonly<Record<string, unknown>>;
}

/**
 * ANNONCE un fait. **Ne lève jamais** : instrumenter une action métier ne doit pas pouvoir la
 * faire échouer. C'est la contrepartie de la règle du bus, posée du côté de l'appelant — parce
 * qu'un `try` oublié dans une action Finance est exactement l'erreur qu'on ne veut pas rendre
 * possible.
 *
 * À appeler APRÈS que l'écriture soit acquise : un fait annoncé avant peut encore être annulé.
 */
export function emit(input: EmitInput): DomainEvent | null {
  try {
    if (!KNOWN.has(input.type)) {
      console.error("[adam-events] type inconnu, ignoré :", input.type);
      return null;
    }
    const payload: EventInput = {
      type: input.type,
      subject: input.subject,
      actorId: input.actorId ?? null,
      data: input.data ?? {},
    };
    return publish(payload);
  } catch (err) {
    console.error("[adam-events] publication impossible", input.type, err);
    return null;
  }
}
