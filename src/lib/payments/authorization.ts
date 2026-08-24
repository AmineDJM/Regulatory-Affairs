/**
 * LE CENTRE DE PAIEMENT — la règle unique qui décide si un décaissement peut partir.
 *
 * Le principe : AUCUN paiement de la société ne quitte les Finances sans être passé par le centre,
 * tenu par le PDG et le Super Admin. Deux exceptions, et deux seulement :
 *   • les petits montants — au-dessous de 50 000 DZD, le circuit de validation habituel suffit et
 *     l'ordre file directement aux Finances. Faire viser une facture de 3 000 DZD par le PDG, c'est
 *     garantir qu'il ne visera plus rien au bout de trois semaines ;
 *   • les MOYENS GÉNÉRAUX — la petite caisse a son propre circuit, elle est explicitement exemptée.
 *
 * Le centre AUTORISE, il ne paie pas : la comptabilité exécute ensuite le virement. Séparer les
 * deux gestes est ce qui rend le contrôle réel — celui qui autorise n'est pas celui qui décaisse.
 *
 * Module PUR — testé, sans base ni session. C'est délibéré : cette règle décide du départ de
 * l'argent de l'entreprise, elle doit pouvoir être lue et vérifiée sans rien exécuter.
 */

/** Le seuil, en dinars. Au-dessous : circuit habituel. À partir de ce montant : centre de paiement. */
export const CENTRAL_AUTH_THRESHOLD_DZD = 50_000;

/**
 * L'état d'un paiement vis-à-vis du centre.
 *
 * `NOT_REQUIRED` n'est pas un contournement : c'est la trace explicite qu'on a REGARDÉ et conclu
 * que ce paiement n'avait pas à passer par le centre. Sans cet état, un paiement non soumis et un
 * paiement approuvé se ressembleraient dans la base.
 */
export type CentralStatus =
  | "NOT_REQUIRED"      // sous le seuil, ou exempté (moyens généraux)
  | "AWAITING"          // en attente d'une décision du centre
  | "CHANGES_REQUESTED" // le centre demande une révision du montant
  | "INFO_REQUESTED"    // le centre demande une argumentation
  | "APPROVED"
  | "REFUSED";

/** Ce que le centre peut décider. Quatre issues, pas deux : un refus sec bloque le travail. */
export type CentralDecision = "APPROVE" | "REFUSE" | "REQUEST_CHANGES" | "REQUEST_INFO";

export const CENTRAL_STATUS_LABEL: Record<CentralStatus, string> = {
  NOT_REQUIRED: "Sans autorisation requise",
  AWAITING: "En attente du centre de paiement",
  CHANGES_REQUESTED: "Révision du montant demandée",
  INFO_REQUESTED: "Argumentation demandée",
  APPROVED: "Autorisé",
  REFUSED: "Refusé",
};

export const CENTRAL_DECISION_LABEL: Record<CentralDecision, string> = {
  APPROVE: "Autoriser le paiement",
  REFUSE: "Refuser",
  REQUEST_CHANGES: "Demander une révision du montant",
  REQUEST_INFO: "Demander une argumentation",
};

/** Les modules dont les paiements NE passent PAS par le centre. */
const EXEMPT_MODULES = new Set(["GENERAL_MEANS"]);

/**
 * Ce paiement doit-il être autorisé par le centre ?
 *
 * `amount` est comparé au seuil de façon INCLUSIVE : « au-dessus de 50 000 a besoin d'une
 * autorisation » se lit, dans une entreprise, comme « à partir de 50 000 » — et un fournisseur qui
 * facture exactement le seuil n'est pas un cas limite qu'on veut voir passer sans contrôle.
 */
export function needsCentralAuthorization(input: { amount: number; module?: string | null }): boolean {
  if (input.module && EXEMPT_MODULES.has(input.module)) return false;
  if (!Number.isFinite(input.amount)) return true; // un montant illisible ne passe pas tout seul
  return input.amount >= CENTRAL_AUTH_THRESHOLD_DZD;
}

/** L'état d'un paiement au moment où il est émis. */
export function initialCentralStatus(input: { amount: number; module?: string | null }): CentralStatus {
  return needsCentralAuthorization(input) ? "AWAITING" : "NOT_REQUIRED";
}

/**
 * LE VERROU. La comptabilité peut-elle exécuter ce décaissement ?
 *
 * C'est la seule fonction que les chemins de règlement doivent appeler. Tout le reste — seuil,
 * exemption, allers-retours — est déjà tranché dans l'état.
 */
export function canDisburse(status: CentralStatus): boolean {
  return status === "NOT_REQUIRED" || status === "APPROVED";
}

/** Le paiement est-il visible des Finances ? Tant qu'il attend le centre, il ne leur arrive pas. */
export function visibleToFinance(status: CentralStatus): boolean {
  // Un REFUSÉ reste visible : les Finances doivent savoir qu'il ne faut pas payer, et pourquoi.
  return status !== "AWAITING" && status !== "CHANGES_REQUESTED" && status !== "INFO_REQUESTED";
}

/** Le paiement attend-il une action DU CENTRE (par opposition à une action du demandeur) ? */
export function awaitsCentre(status: CentralStatus): boolean {
  return status === "AWAITING";
}

/** Le paiement attend-il une action DU DEMANDEUR ? */
export function awaitsRequester(status: CentralStatus): boolean {
  return status === "CHANGES_REQUESTED" || status === "INFO_REQUESTED";
}

/**
 * Qui siège au centre de paiement : le PDG et le Super Admin, personne d'autre.
 *
 * Le Directeur Général n'y est PAS. Ce n'est pas un oubli : le centre existe pour que le sommet de
 * l'entreprise voie passer chaque engagement important, et l'élargir à la direction opérationnelle
 * reviendrait à recréer le circuit qu'il remplace.
 */
export function sitsOnPaymentCentre(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "DIRECTION";
}

/**
 * L'état qui suit une décision — et les allers-retours qu'il autorise.
 *
 * Une demande de révision ou d'argumentation ne ferme rien : le demandeur corrige, resoumet, et le
 * dossier revient au centre. C'est ce va-et-vient qui manquait — un refus sec obligeait à refaire
 * une demande depuis zéro, et l'historique de la discussion était perdu.
 *
 * Rend `null` si la transition n'a pas de sens (décision sur un dossier déjà clos) : l'appelant
 * doit alors refuser plutôt que d'écrire un état incohérent.
 */
export function applyDecision(current: CentralStatus, decision: CentralDecision): CentralStatus | null {
  // On ne décide pas d'un paiement qui n'avait pas à passer par le centre.
  if (current === "NOT_REQUIRED") return null;
  // Un dossier tranché se rouvre par une nouvelle soumission du demandeur, pas par une seconde
  // décision : sans cette règle, deux administrateurs pourraient se contredire sans trace.
  if (current === "APPROVED" || current === "REFUSED") return null;

  switch (decision) {
    case "APPROVE": return "APPROVED";
    case "REFUSE": return "REFUSED";
    case "REQUEST_CHANGES": return "CHANGES_REQUESTED";
    case "REQUEST_INFO": return "INFO_REQUESTED";
  }
}

/**
 * Le demandeur peut-il resoumettre ? Seulement si le centre lui a rendu la main.
 *
 * Resoumettre depuis « en attente » permettrait de relancer indéfiniment un dossier que le centre
 * n'a pas encore regardé.
 */
export function canResubmit(status: CentralStatus): boolean {
  return awaitsRequester(status);
}

/** L'état après une nouvelle soumission du demandeur : la balle repasse au centre. */
export function applyResubmission(current: CentralStatus): CentralStatus | null {
  return canResubmit(current) ? "AWAITING" : null;
}

/**
 * La phrase qui explique à la comptabilité pourquoi elle ne peut pas payer.
 *
 * « Non autorisé » sans motif fait ouvrir un ticket ; en nommant l'état, le comptable sait s'il
 * doit attendre le centre, relancer le demandeur, ou classer le dossier.
 */
export function blockedReason(status: CentralStatus): string | null {
  switch (status) {
    case "AWAITING": return "Ce paiement attend l'autorisation du centre de paiement (montant supérieur au seuil).";
    case "CHANGES_REQUESTED": return "Le centre de paiement a demandé une révision du montant : le demandeur doit corriger et resoumettre.";
    case "INFO_REQUESTED": return "Le centre de paiement a demandé une argumentation : le demandeur doit répondre et resoumettre.";
    case "REFUSED": return "Ce paiement a été refusé par le centre de paiement.";
    default: return null;
  }
}
