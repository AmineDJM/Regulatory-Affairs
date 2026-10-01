import type { EntityType } from "@prisma/client";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES BRANCHES D'UNE DEMANDE — qui pointe vers elle, et ce qu'on en fait quand elle part
 * (§118.162).
 *
 * Décision de la Direction (30/09/2026) : « toute demande doit être liée du début à la fin à
 * toutes ses branches — quand une demande Ad & Pro se retrouve dans Information médicale et
 * qu'ensuite cette demande est supprimée, celle d'Information médicale doit être supprimée
 * également. »
 *
 * ── LE DÉFAUT, ET POURQUOI AUCUNE CLÉ ÉTRANGÈRE NE LE VOYAIT ─────────────────────────────
 *
 * Une déclaration d'information médicale désigne sa demande par un COUPLE (type, identifiant)
 * — `sourceType` / `sourceId` — et non par une clé étrangère : la même table reçoit des
 * sponsorings, des congrès, des événements, du matériel promotionnel. Postgres ne peut donc rien
 * propager : supprimer le sponsoring laissait sa déclaration vivante dans la file du pharmacien,
 * pour une demande qui n'existait plus. Seize tables désignent ainsi un objet, et chacune
 * répondait à la question « et si la demande disparaît ? » par un silence.
 *
 * ── CE QUE CE MODULE DIT, POUR CHAQUE COUPLE DU SCHÉMA ───────────────────────────────────
 *
 *   • EMPORTEE — la ligne n'existe que pour la demande (sa déclaration, sa demande au
 *     secrétariat, son circuit de validation, son visa, sa demande de paiement, ses pièces au
 *     registre Legal, ses rappels…). Elle part AVEC elle, dans la MÊME entrée de corbeille, et
 *     revient avec elle.
 *   • COEUR — pièces jointes et commentaires : le cœur de la suppression les instantane déjà
 *     pour chaque ligne qui a un type d'entité.
 *   • HISTOIRE — le journal ne s'efface pas : audit, registre des faits, correspondance, index
 *     de recherche. Une trace d'un objet disparu reste une trace ; l'effacer réécrirait le passé.
 *
 * Et un fait qui a QUITTÉ l'ERP ne s'efface pas avec la demande : un règlement parti, une pièce
 * signée, une déclaration déposée aux autorités, un courrier inscrit au registre. La demande est
 * alors la JUSTIFICATION de ce fait — la supprimer le laisserait sans cause. Elle se garde, et le
 * refus nomme ce qui l'y oblige (`faitIrreversible`).
 *
 * Le cliquet (`branches.test.ts`) lit le schéma : tout couple (…Type, …Id) d'un modèle doit être
 * classé ICI, avec sa raison. Un couple ajouté demain sans décision fait tomber la suite — il ne
 * pourra pas redevenir un silence (§118.73).
 *
 * Module PUR : des données et deux fonctions, aucun accès à la base.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Conduite = "EMPORTEE" | "COEUR" | "HISTOIRE";

export interface Referent {
  /** Le modèle Prisma qui porte le couple. */
  modele: string;
  /** Le champ qui porte le TYPE de l'objet visé. */
  champType: string;
  /** Le champ qui porte l'IDENTIFIANT de l'objet visé. */
  champId: string;
  conduite: Conduite;
  raison: string;
}

export const REFERENTS: readonly Referent[] = [
  // ── EMPORTÉES : elles n'existent que pour la demande ─────────────────────────────────────
  { modele: "MedicalInfoDeclaration", champType: "sourceType", champId: "sourceId", conduite: "EMPORTEE",
    raison: "LA décision de la Direction : la déclaration d'une demande supprimée resterait dans la file du pharmacien, pour rien." },
  { modele: "AdministrativeRequest", champType: "linkedEntityType", champId: "linkedEntityId", conduite: "EMPORTEE",
    raison: "une demande au secrétariat (devis, BC) faite POUR la demande — l'assistante la traiterait pour un objet disparu." },
  { modele: "WorkflowInstance", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "le circuit de validation de la demande — resté vivant, il apparaîtrait dans les files de ceux qui valident." },
  { modele: "AdProGateVisa", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "le visa du DG ou du centre sur la demande — une porte ouverte sur un objet disparu." },
  { modele: "ValidationRequest", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "une validation demandée pour la demande ou l'une de ses pièces (bon de versement, BC)." },
  { modele: "PaymentRequest", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "une demande de paiement faite pour la demande — tant que rien n'est réglé, elle n'a plus d'objet." },
  { modele: "ExpenseOrder", champType: "sourceType", champId: "sourceId", conduite: "EMPORTEE",
    raison: "un ordre de dépense pour la demande — non réglé, il resterait à payer au centre de paiement pour un objet disparu." },
  { modele: "LegalDocument", champType: "sourceType", champId: "sourceId", conduite: "EMPORTEE",
    raison: "une pièce liée (devis, BC, facture, convention) — non signée et non réglée, elle n'a plus de cause." },
  { modele: "MailEntry", champType: "sourceType", champId: "sourceId", conduite: "EMPORTEE",
    raison: "un courrier rattaché — le fait qu'il soit INSCRIT au registre bloque la suppression (voir faitIrreversible)." },
  { modele: "DocumentRequest", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "une demande de pièce adressée à quelqu'un pour la demande — il la recevrait encore." },
  { modele: "Dossier", champType: "sourceType", champId: "sourceId", conduite: "EMPORTEE",
    raison: "le dossier ouvert pour impliquer un tiers sur la demande — sa conversation n'a de sens qu'avec elle." },
  { modele: "MissionAssignment", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "l'affectation d'une personne à l'événement ou au congrès — une mission vers un objet disparu." },
  { modele: "Task", champType: "relatedEntityType", champId: "relatedEntityId", conduite: "EMPORTEE",
    raison: "une tâche POUR la demande — elle resterait dans la liste de quelqu'un, avec un lien vers rien." },
  { modele: "Reminder", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "un rappel sur la demande — il sonnerait pour un objet disparu." },
  { modele: "RowGrant", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "un droit accordé sur CETTE ligne — il revient avec elle, sinon la restauration rouvrirait mal." },
  { modele: "EntityLink", champType: "fromType", champId: "fromId", conduite: "EMPORTEE",
    raison: "un lien « relié à… » partant de la demande." },
  { modele: "EntityLink", champType: "toType", champId: "toId", conduite: "EMPORTEE",
    raison: "un lien « relié à… » arrivant sur la demande." },
  { modele: "MailLink", champType: "entityType", champId: "entityId", conduite: "EMPORTEE",
    raison: "un e-mail classé sur la demande — le lien part avec elle, l'e-mail reste dans la boîte." },

  // ── COEUR : instantanés par le cœur de la suppression, ligne par ligne ───────────────────
  { modele: "Document", champType: "entityType", champId: "entityId", conduite: "COEUR",
    raison: "pièces jointes : le cœur les instantane pour chaque ligne qui a un type d'entité." },
  { modele: "Comment", champType: "entityType", champId: "entityId", conduite: "COEUR",
    raison: "commentaires : même traitement que les pièces jointes." },

  // ── HISTOIRE : la trace reste ─────────────────────────────────────────────────────────────
  { modele: "AuditLog", champType: "entityType", champId: "entityId", conduite: "HISTOIRE",
    raison: "le journal d'audit ne s'efface pas — c'est lui qui dira qui a supprimé quoi." },
  { modele: "BusinessEvent", champType: "entityType", champId: "entityId", conduite: "HISTOIRE",
    raison: "le registre canonique des faits (§17) : ce qui a eu lieu a eu lieu." },
  { modele: "Task", champType: "evidenceEntityType", champId: "evidenceEntityId", conduite: "HISTOIRE",
    raison: "la PREUVE d'une tâche qui vit ailleurs : la tâche reste, sa preuve désignait cet objet." },
  { modele: "Conversation", champType: "refType", champId: "refId", conduite: "HISTOIRE",
    raison: "une conversation qui CITE la demande : la correspondance des personnes ne s'efface pas avec l'objet cité." },
  { modele: "Message", champType: "refType", champId: "refId", conduite: "HISTOIRE",
    raison: "un message qui cite la demande : même raison." },
  { modele: "EntityMention", champType: "entityType", champId: "entityId", conduite: "HISTOIRE",
    raison: "l'index des mentions : il sait déjà ignorer un objet disparu." },
  { modele: "KnowledgeItem", champType: "sourceType", champId: "sourceId", conduite: "HISTOIRE",
    raison: "l'index de connaissance : une entrée périmée s'y retrouve sans rien casser." },
  { modele: "KnowledgeEntity", champType: "refType", champId: "refId", conduite: "HISTOIRE",
    raison: "idem : un index, pas une branche." },
  { modele: "AdamWatch", champType: "targetType", champId: "targetId", conduite: "HISTOIRE",
    raison: "une surveillance d'Adam : son balayage constate lui-même la disparition de sa cible." },
  { modele: "ApiCall", champType: "entityType", champId: "entityId", conduite: "HISTOIRE",
    raison: "le journal des appels d'API." },
  { modele: "KnowledgeLink", champType: "toType", champId: "toId", conduite: "HISTOIRE",
    raison: "un lien de l'index de connaissance : un index, pas une branche." },
  { modele: "AssistantReminder", champType: "watchType", champId: "watchId", conduite: "HISTOIRE",
    raison: "un rappel interne d'Adam : comme ses surveillances, il constate lui-même que sa cible a disparu." },
];

/**
 * LE TYPE D'ENTITÉ D'UNE LIGNE, par son modèle — ce qui permet de DESCENDRE : une déclaration
 * d'information médicale a elle-même sa demande de bon de versement, un poste ses demandes au
 * secrétariat. Sans type d'entité, une ligne n'a ni pièces jointes, ni branches à elle.
 */
export const ENTITE_DU_MODELE: Readonly<Record<string, EntityType>> = {
  SponsoringRequest: "SPONSORING",
  Event: "EVENT",
  CongressInternational: "CONGRESS_INTERNATIONAL",
  CongressNational: "CONGRESS_NATIONAL",
  PromoMaterial: "PROMO_MATERIAL",
  ConsultingContract: "CONSULTING_CONTRACT",
  AdProOtherRequest: "AD_PRO_OTHER",
  AdProItem: "AD_PRO_ITEM",
  MedicalInfoDeclaration: "MEDICAL_INFO_DECLARATION",
  AdministrativeRequest: "ADMIN_REQUEST",
  ValidationRequest: "VALIDATION_REQUEST",
  PaymentRequest: "PAYMENT_REQUEST",
  ExpenseOrder: "EXPENSE_ORDER",
  LegalDocument: "LEGAL_DOCUMENT",
  MailEntry: "MAIL_ENTRY",
  DocumentRequest: "DOCUMENT_REQUEST",
  Dossier: "DOSSIER",
  MissionAssignment: "MISSION_ASSIGNMENT",
  Task: "TASK",
  BdProject: "BD_PROJECT",
};

/**
 * LES LIENS DIRECTS qui désignent une branche créée PAR une autre branche, sans passer par un
 * couple (type, identifiant) : le bon de versement d'une déclaration, l'ordre de dépense d'une
 * facture. Ce sont des objets EN AVAL — ils partent avec leur branche.
 */
export const LIENS_DIRECTS: readonly { modele: string; champ: string; cible: string }[] = [
  { modele: "MedicalInfoDeclaration", champ: "expenseOrderId", cible: "ExpenseOrder" },
  { modele: "MedicalInfoDeclaration", champ: "bvValidationId", cible: "ValidationRequest" },
  { modele: "MedicalInfoDeclaration", champ: "bvRequestId", cible: "PaymentRequest" },
  { modele: "PaymentRequest", champ: "expenseOrderId", cible: "ExpenseOrder" },
  { modele: "LegalDocument", champ: "expenseOrderId", cible: "ExpenseOrder" },
];

const ref = (d: Record<string, unknown>) => {
  const r = d.reference ?? d.number ?? d.title ?? d.label ?? d.id;
  return typeof r === "string" && r.trim() ? r.trim() : String(d.id ?? "");
};

/**
 * UN FAIT QUI A QUITTÉ L'ERP — et qui interdit donc de supprimer la demande qui le justifie.
 *
 * Rend la phrase qui le NOMME, ou `null`. La liste est FERMÉE : chaque entrée est un fait qu'on
 * ne défait pas en effaçant une ligne — l'argent est parti, une personne a signé, l'autorité a
 * reçu un dépôt, un courrier est inscrit au registre chronologique.
 */
export function faitIrreversible(modele: string, d: Record<string, unknown>): string | null {
  switch (modele) {
    case "ExpenseOrder":
      if (d.status === "PAID" || d.paidDate || d.transactionId) return `l'ordre de dépense ${ref(d)} a été réglé`;
      return null;
    case "LegalDocument":
      if (d.paidDate || d.settlementTxId) return `la facture ${ref(d)} a été réglée`;
      if (d.signedById) return `la pièce ${ref(d)} a été signée par les Finances`;
      if (d.signedAt) return `la pièce ${ref(d)} est signée`;
      return null;
    case "MedicalInfoDeclaration":
      if (d.authorityRef) return `la déclaration ${ref(d)} a été déposée auprès des autorités (récépissé ${String(d.authorityRef)})`;
      return null;
    case "MailEntry":
      return `le courrier ${ref(d)} est inscrit au registre des courriers`;
    default:
      return null;
  }
}

/** Le délégué Prisma d'un modèle — la convention du client généré (première lettre minuscule). */
export function delegueDe(modele: string): string {
  return modele.charAt(0).toLowerCase() + modele.slice(1);
}

/** Libellés lisibles, pour dire à la personne ce qui part avec la demande. */
export const LIBELLE_DU_MODELE: Readonly<Record<string, [string, string]>> = {
  AdProItem: ["poste", "postes"],
  AdProItemDecision: ["décision de poste", "décisions de poste"],
  AdProProductAllocation: ["répartition par produit", "répartitions par produit"],
  EventRegistration: ["inscription", "inscriptions"],
  CareBeneficiary: ["personne prise en charge", "personnes prises en charge"],
  CareCell: ["case de prise en charge", "cases de prise en charge"],
  CareQuote: ["devis de prise en charge", "devis de prise en charge"],
  CareQuoteCell: ["ligne de devis", "lignes de devis"],
  PromoQuote: ["devis retranscrit", "devis retranscrits"],
  PromoQuoteLine: ["ligne de devis", "lignes de devis"],
  ConsultingTask: ["tâche du contrat", "tâches du contrat"],
  MedicalInfoDeclaration: ["déclaration d'information médicale", "déclarations d'information médicale"],
  MedicalInfoSlip: ["bon de versement", "bons de versement"],
  MedicalInfoDocRequest: ["demande de pièce du pharmacien", "demandes de pièces du pharmacien"],
  AdministrativeRequest: ["demande au secrétariat", "demandes au secrétariat"],
  AdminApproval: ["validation au secrétariat", "validations au secrétariat"],
  WorkflowInstance: ["circuit de validation", "circuits de validation"],
  WorkflowStepEvent: ["étape franchie", "étapes franchies"],
  AdProGateVisa: ["visa", "visas"],
  ValidationRequest: ["demande de validation", "demandes de validation"],
  ValidationStep: ["étape de validation", "étapes de validation"],
  ValidationItemDecision: ["décision de ligne validée", "décisions de lignes validées"],
  PaymentRequest: ["demande de paiement", "demandes de paiement"],
  PaymentPiece: ["pièce de paiement", "pièces de paiement"],
  PaymentRequestEvent: ["événement de paiement", "événements de paiement"],
  ExpenseOrder: ["ordre de dépense", "ordres de dépense"],
  PaymentCentreMessage: ["message du centre de paiement", "messages du centre de paiement"],
  LegalDocument: ["pièce au registre Legal", "pièces au registre Legal"],
  LegalDocumentReader: ["lecteur désigné", "lecteurs désignés"],
  MailEntry: ["courrier", "courriers"],
  MailEntryPiece: ["pièce de courrier", "pièces de courrier"],
  DocumentRequest: ["demande de pièce", "demandes de pièces"],
  Dossier: ["sujet", "sujets"],
  DossierMessage: ["message de sujet", "messages de sujet"],
  DossierMessageAttachment: ["pièce de message", "pièces de message"],
  MissionAssignment: ["affectation", "affectations"],
  Task: ["tâche", "tâches"],
  TaskComment: ["commentaire de tâche", "commentaires de tâche"],
  Reminder: ["rappel", "rappels"],
  RowGrant: ["droit sur la ligne", "droits sur la ligne"],
  EntityLink: ["lien « relié à »", "liens « relié à »"],
  MailLink: ["e-mail classé", "e-mails classés"],
  PchContractLine: ["ligne de marché", "lignes de marché"],
  // Le registre des projets (§118.163) : ce qu'un projet emporte, et ce qui perd son lien avec lui.
  BdRange: ["gamme", "gammes"],
  BdProduct: ["produit à l'étude", "produits à l'étude"],
  RegulatoryProduct: ["dossier réglementaire", "dossiers réglementaires"],
};

export function libelleDe(modele: string, n: number): string {
  const l = LIBELLE_DU_MODELE[modele];
  if (!l) return `${n} ${modele}`;
  return `${n} ${n > 1 ? l[1] : l[0]}`;
}

/**
 * CE QUI RESTE mais PERD SON LIEN avec l'élément supprimé — « 3 dossiers réglementaires »
 * perdent leur projet, une pièce d'un autre dossier perd sa pièce parente (§118.163).
 *
 * Compté par LIGNE, jamais par lien : un dossier qui désignerait l'élément par deux champs reste
 * UN dossier, et le compter deux fois gonflerait ce qu'on annonce à la personne.
 */
export function resumeDesLiens(liens: readonly { modele: string; cle: Record<string, unknown> }[]): string[] {
  const parModele = new Map<string, Set<string>>();
  for (const l of liens) {
    const lignes = parModele.get(l.modele) ?? new Set<string>();
    lignes.add(JSON.stringify(l.cle));
    parModele.set(l.modele, lignes);
  }
  return [...parModele]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([modele, lignes]) => libelleDe(modele, lignes.size));
}

/** Le nom d'UN élément de ce modèle, sans compte — pour une phrase qui désigne une ligne précise. */
export function nomDe(modele: string): string {
  return LIBELLE_DU_MODELE[modele]?.[0] ?? modele;
}
