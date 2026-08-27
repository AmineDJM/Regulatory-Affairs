/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DE L'AUDIT AU FAIT MÉTIER — un seul point d'émission au lieu de cinq cents.
 *
 * ── LE PROBLÈME ──────────────────────────────────────────────────────────────────────────
 *
 * Le registre d'événements n'était alimenté que par UN endroit (le dépôt d'un contrat de
 * consulting). Tout le reste de l'ERP — un statut réglementaire qui change, une vente réglée,
 * une livraison faite — n'y laissait aucune trace. Une tâche « facture Untel » restait donc
 * TODO alors que la facture était payée, et personne ne pouvait dire pourquoi.
 *
 * Aller poser un appel dans les ~500 endroits qui écrivent dans l'ERP serait long, incomplet le
 * jour même, et faux au premier oubli. Or ces 500 endroits passent DÉJÀ tous par un point
 * unique : `recordAudit`. C'est là que le fait est capté.
 *
 * ── CE QUI REND CE FICHIER NÉCESSAIRE : TOUT N'EST PAS UN FAIT ───────────────────────────
 *
 * Émettre un événement par ligne d'audit ferait du registre un MIROIR de l'audit : des milliers
 * de modifications de champ, dont « commentaire », « tri », « couleur ». Le registre perdrait
 * son sens (on n'y chercherait plus rien) et la réconciliation des tâches tournerait à chaque
 * frappe.
 *
 * Ce classeur est donc une LISTE BLANCHE STRICTE. Il ne reconnaît qu'un fait qu'il peut nommer
 * SANS AMBIGUÏTÉ à partir de ce que l'audit porte déjà. Tout le reste rend `null`, et c'est le
 * comportement voulu : un registre qui accepte tout ne prouve rien.
 *
 * ── POURQUOI IL EST PUR ──────────────────────────────────────────────────────────────────
 *
 * Zéro import. La règle « ceci est-il un fait métier ? » se vérifie donc au cas près, sans base
 * et sans faux-semblant — et `recordAudit` reste un appel de plus, pas une dépendance de plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que l'audit porte, réduit à ce dont la classification a besoin. */
export interface AuditFait {
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  summary?: string | null;
}

export interface FaitMetier {
  /** Le nom du fait, en vocabulaire métier. */
  type: string;
  /** Ce qu'il faut pour comprendre — JAMAIS un contenu de document ni un secret. */
  payload: Record<string, string>;
}

/** Les statuts de tâche qui valent ACHÈVEMENT. `CANCELLED` et `DECLINED` n'en sont pas. */
const TACHE_FAITE = new Set(["DONE"]);

/**
 * LES CHANGEMENTS DE STATUT QUI SONT DES FAITS, par entité et par champ.
 *
 * La valeur d'arrivée compte : passer une vente en `PARTIAL` n'est pas « payée ». Une entrée
 * `null` signifie « tout changement de ce champ est un fait » — utile pour un statut
 * réglementaire, où CHAQUE passage compte et où l'important est la transition elle-même.
 */
const STATUTS: Record<string, { champ: string; versUniquement: string[] | null; type: string }[]> = {
  REGULATORY_PRODUCT: [
    { champ: "status", versUniquement: null, type: "REGULATORY_STATUS_CHANGED" },
  ],
  SALE: [
    { champ: "paymentStatus", versUniquement: ["PAID"], type: "PAYMENT_RECEIVED" },
    { champ: "deliveryStatus", versUniquement: ["DELIVERED"], type: "DELIVERY_COMPLETED" },
  ],
  PCH_TENDER: [
    // Le statut d'un MARCHÉ (NOT_STARTED → IN_PROGRESS → COMPLETED). Ce n'est PAS
    // « soumissionné » : `PchTenderStatus` ne porte pas cette valeur, et la nommer ainsi
    // annoncerait une soumission que rien ne prouve.
    { champ: "status", versUniquement: null, type: "TENDER_STATUS_CHANGED" },
  ],
  TASK: [
    { champ: "status", versUniquement: [...TACHE_FAITE], type: "TASK_COMPLETED" },
  ],
  EXPENSE_ORDER: [
    // L'argent qui SORT. Distinct de `PAYMENT_RECEIVED` : les confondre mettrait une dépense
    // dans un chiffre d'affaires.
    { champ: "status", versUniquement: ["PAID"], type: "PAYMENT_ISSUED" },
  ],
  PAYMENT_REQUEST: [
    { champ: "status", versUniquement: ["PAID"], type: "PAYMENT_ISSUED" },
  ],
};

/** Les actions qui sont un fait par elles-mêmes, quelle que soit l'entité touchée. */
const ACTIONS: Record<string, string> = {
  UPLOAD: "DOCUMENT_UPLOADED",
  VALIDATE: "VALIDATION_APPROVED",
  REFUSE: "VALIDATION_REFUSED",
};

/** Les créations qui valent un fait — et elles seules. Créer une ligne de tri n'en est pas un. */
const CREATIONS: Record<string, string> = {
  CONSULTING_CONTRACT: "CONTRACT_RECORDED",
  LEGAL_DOCUMENT: "LEGAL_DOCUMENT_REGISTERED",
  PCH_TENDER: "TENDER_OPENED",
  SALE: "SALE_RECORDED",
  RECRUITMENT_REQUEST: "RECRUITMENT_REQUESTED",
  MAIL_ENTRY: "MAIL_REGISTERED",
};

/**
 * CLASSE UNE LIGNE D'AUDIT. Rend le fait métier, ou `null` si ce n'en est pas un.
 *
 * L'ordre des règles n'est pas décoratif : l'ACTION prime sur l'entité. Un téléversement sur un
 * dossier réglementaire est d'abord un document déposé — c'est ce que la tâche « envoie le
 * contrat » attend, et c'est ce qui la clôt.
 */
export function faitDepuisAudit(a: AuditFait): FaitMetier | null {
  const payloadBase: Record<string, string> = { module: a.module };
  if (a.summary) payloadBase.resume = a.summary;

  const parAction = ACTIONS[a.action];
  if (parAction) {
    return { type: parAction, payload: { ...payloadBase, ...(a.entityType ? { cible: a.entityType } : {}) } };
  }

  if (a.action === "CREATE" && a.entityType) {
    const creation = CREATIONS[a.entityType];
    if (creation) return { type: creation, payload: payloadBase };
    return null;
  }

  if (a.action === "UPDATE" && a.entityType && a.field) {
    const regles = STATUTS[a.entityType];
    if (!regles) return null;
    for (const r of regles) {
      if (r.champ !== a.field) continue;
      // UN CHANGEMENT QUI NE CHANGE RIEN N'EST PAS UN FAIT. `recordFieldChanges` ne remonte
      // déjà que les vraies différences, mais un appel direct peut poser la même valeur.
      if (a.oldValue === a.newValue) return null;
      if (r.versUniquement && !r.versUniquement.includes(a.newValue ?? "")) return null;
      return {
        type: r.type,
        payload: {
          ...payloadBase,
          ...(a.oldValue ? { de: a.oldValue } : {}),
          ...(a.newValue ? { vers: a.newValue } : {}),
        },
      };
    }
  }

  return null;
}

/** Les faits que ce classeur sait produire — pour la documentation et les tests de couverture. */
export const FAITS_CONNUS: readonly string[] = [
  ...new Set([...Object.values(ACTIONS), ...Object.values(CREATIONS), ...Object.values(STATUTS).flat().map((r) => r.type)]),
].sort();
