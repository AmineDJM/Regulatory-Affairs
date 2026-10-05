/**
 * LA DEMANDE D'ACHAT — ouverte à tout le monde, validée par son directeur.
 *
 * Jusqu'ici, acheter quoi que ce soit passait par l'assistante de direction : on lui écrivait,
 * elle saisissait, et la demande n'existait nulle part avant qu'elle ne l'ait tapée. Le
 * catalogue était pourtant déjà là — c'est le même que celui du secrétariat.
 *
 * Deux règles, et rien de plus :
 *
 *   • **Tout le monde demande.** Un délégué qui a besoin de cartouches n'a pas à connaître le
 *     circuit ; il coche dans le catalogue, ou décrit son besoin en clair (« autre »).
 *   • **Le directeur du département valide.** Pas un service transverse, pas l'assistante : le
 *     responsable de la personne, celui qui sait si ça se justifie et dont le budget paiera.
 *
 * Et une règle de VUE, qui compte autant : le demandeur ne voit PAS le budget. Ce n'est pas de
 * la cachotterie, c'est de la justesse — connaître le reste de l'enveloppe transforme une
 * demande en négociation (« il reste de quoi, donc je demande »), et le rôle du demandeur est
 * de dire ce dont il a besoin, pas d'arbitrer une caisse qu'il ne tient pas.
 *
 * Module PUR — testé, sans base de données.
 */

import { libelleMotif } from "@/lib/secretariat/decision-approbation";

/** Une ligne de la demande : un article du catalogue, ou un besoin décrit en clair. */
export interface PurchaseLine {
  /** Article du catalogue, `null` pour une ligne « autre ». */
  articleId: string | null;
  label: string;
  quantity: number;
  /** Prix indicatif unitaire, quand le catalogue en porte un. Jamais un engagement. */
  unitPrice: number | null;
}

/**
 * LES LIGNES D'UNE DEMANDE, RELUES DEPUIS SES CHAMPS — une lecture, pour la fiche, la carte de
 * validation et « Mes demandes » (§118.185 — audit 360°, I14).
 *
 * Les lignes voyagent dans `fields.purchaseLines` (du JSON) : la fiche n'affichait que les champs
 * DÉCLARÉS du type, et la carte de validation un titre coupé « (+2) ». Le N+1 validait à l'aveugle
 * et l'assistante ne savait pas quoi acheter. Ce qui ne se lit pas à coup sûr (un champ qui n'est
 * pas une liste, une ligne sans libellé) est écarté, jamais deviné.
 */
export function lireLignesDAchat(fields: unknown): PurchaseLine[] {
  const brut = fields && typeof fields === "object" ? (fields as Record<string, unknown>).purchaseLines : null;
  if (!Array.isArray(brut)) return [];
  return cleanLines(brut
    .filter((l): l is Record<string, unknown> => Boolean(l) && typeof l === "object")
    .map((l) => ({
      articleId: typeof l.articleId === "string" ? l.articleId : null,
      label: typeof l.label === "string" ? l.label : "",
      quantity: typeof l.quantity === "number" ? l.quantity : Number(l.quantity),
      unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null,
    })));
}

/** Nettoie la saisie : on jette les lignes vides plutôt que d'enregistrer du bruit. */
export function cleanLines(lines: PurchaseLine[]): PurchaseLine[] {
  return lines
    .map((l) => ({
      articleId: l.articleId || null,
      label: (l.label ?? "").trim(),
      quantity: Number.isFinite(l.quantity) && l.quantity > 0 ? Math.floor(l.quantity) : 1,
      unitPrice: l.unitPrice != null && Number.isFinite(l.unitPrice) && l.unitPrice > 0 ? l.unitPrice : null,
    }))
    .filter((l) => l.label.length > 0);
}

/**
 * Le montant INDICATIF de la demande.
 *
 * Indicatif, et le mot est important : il vient des prix du catalogue, qui datent du jour où
 * quelqu'un les a saisis. On l'affiche pour donner un ordre de grandeur au validateur, jamais
 * comme un engagement — la facture réelle arrivera plus tard, et c'est elle qui fera foi.
 *
 * `null` quand aucune ligne ne porte de prix : afficher « 0 DZD » ferait croire à une demande
 * gratuite.
 */
export function estimatedTotal(lines: PurchaseLine[]): number | null {
  const priced = lines.filter((l) => l.unitPrice != null);
  if (priced.length === 0) return null;
  return priced.reduce((sum, l) => sum + (l.unitPrice as number) * l.quantity, 0);
}

/** Le résumé d'une demande, tel qu'il tient sur une ligne de liste. */
export function summarize(lines: PurchaseLine[]): string {
  if (lines.length === 0) return "Demande d'achat";
  const head = lines
    .slice(0, 3)
    .map((l) => (l.quantity > 1 ? `${l.quantity}× ${l.label}` : l.label))
    .join(", ");
  return lines.length > 3 ? `${head} (+${lines.length - 3})` : head;
}

/**
 * QUI VOIT LE BUDGET.
 *
 * Le module a désormais DEUX visages sur le même écran : celui qui tient la caisse voit
 * l'enveloppe, la consommation et les dépenses ; celui qui demande voit son catalogue et ses
 * demandes. Le second n'est pas une version dégradée du premier — c'est un autre métier.
 */
export function seesBudget(canViewModule: boolean): boolean {
  return canViewModule;
}

export type PurchaseStage = "PENDING" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "DONE" | "CANCELLED";

/**
 * Où en est une demande d'achat, dit comme on le dirait à l'oral.
 *
 * On lit d'abord la DÉCISION du validateur, puis le statut de la demande : une demande refusée
 * dont le statut est resté « bloqué » doit se lire « refusée par votre directeur », pas
 * « bloquée » — le second n'explique rien à celui qui attend.
 *
 * UNE MODIFICATION DEMANDÉE N'EST PAS UNE ATTENTE (lot E5 — audit des managers, M15) : elle se lisait
 * « En attente de votre directeur » — le demandeur attendait une décision que le directeur avait déjà prise,
 * et la balle était à lui.
 */
export function purchaseStage(status: string, approval: { status: string } | null): PurchaseStage {
  if (status === "CANCELLED") return "CANCELLED";
  if (approval?.status === "REJECTED") return "REJECTED";
  if (status === "DONE" || status === "COMPLETED") return "DONE";
  if (approval?.status === "APPROVED") return "APPROVED";
  if (approval?.status === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
  return "PENDING";
}

export const STAGE_LABEL: Record<PurchaseStage, string> = {
  PENDING: "En attente de votre directeur",
  // Pas « par votre directeur » : c'est peut-être son intérimaire ou la Direction qui l'a renvoyée — la ligne le nomme.
  CHANGES_REQUESTED: "À modifier",
  APPROVED: "Validée — en cours d'achat",
  REJECTED: "Refusée",
  DONE: "Achat effectué",
  CANCELLED: "Annulée",
};

export const STAGE_TONE: Record<PurchaseStage, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  CHANGES_REQUESTED: "warning",
  APPROVED: "info",
  REJECTED: "danger",
  DONE: "success",
  CANCELLED: "neutral",
};

/**
 * La demande est-elle encore retirable par son auteur ?
 *
 * Tant que personne n'a tranché DÉFINITIVEMENT. Après, elle appartient au circuit : la retirer
 * effacerait une décision, et l'on ne saurait plus pourquoi un achat a été lancé. Une demande
 * « à modifier » se retire aussi : c'est, aujourd'hui, le geste qui la fait repartir corrigée (la redéposer).
 */
export function canWithdraw(stage: PurchaseStage): boolean {
  // DÉCISION DE LA DIRECTION (04/10) : on annule sa demande tant que l'autre ne l'a pas exécutée. Une
  // demande VALIDÉE n'est pas encore un achat fait : elle se retire jusqu'à « Achat effectué », et ce qui
  // en dépend (approbations, paiement non réglé) part avec elle par l'annulation commune.
  return stage === "PENDING" || stage === "CHANGES_REQUESTED" || stage === "APPROVED";
}

/**
 * CE QUE LE DEMANDEUR LIT SOUS SA DEMANDE, une fois tranchée (lot E5 — M14, M15) : la parole de celui qui a
 * tranché (`decisionNote`), préfixée de ce qu'elle est ; le geste qui reste quand la balle revient au demandeur ;
 * et le NOM de celui qui a tranché quand ce n'est pas le validateur nommé. Jamais `comment` : il porte
 * l'estimation du catalogue, qui se lisait comme l'avis du directeur — la fonction ne le reçoit même pas.
 */
export function phraseDeDecision(
  stage: PurchaseStage,
  a: { status: string; note: string | null; decideurAutre: string | null } | null,
): string | null {
  if (!a || a.status === "PENDING") return null;
  const morceaux: string[] = [];
  if (a.note) morceaux.push(`${libelleMotif(a.status)} : ${a.note}`);
  if (stage === "CHANGES_REQUESTED") morceaux.push("retirez la demande, puis redéposez-la corrigée");
  if (a.decideurAutre) morceaux.push(`décision prise par ${a.decideurAutre}`);
  if (morceaux.length === 0) return null;
  const phrase = morceaux.join(" — ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
