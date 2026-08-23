/**
 * LE CONTRAT D'UNE MESSAGERIE — ce que l'application demande, sans savoir à qui.
 *
 * Les écrans ne parlent JAMAIS à Microsoft Graph. Ils parlent à ce contrat, et une implémentation
 * le remplit. Ce n'est pas de l'abstraction pour l'abstraction : Exchange Online est la source de
 * vérité d'aujourd'hui, et l'entreprise vient de passer huit ans sur Infomaniak. Un contrat rend le
 * prochain déménagement possible sans réécrire l'interface — et, dès maintenant, rend la
 * messagerie testable sans réseau.
 *
 * Le vocabulaire est celui du MÉTIER (dossier, message, brouillon), pas celui de Graph
 * (`mailFolders`, `singleValueExtendedProperties`). C'est ce qui empêche les particularités d'un
 * fournisseur de remonter jusqu'aux écrans.
 *
 * Module de TYPES — pur, sans dépendance.
 */

/** Les six dossiers que toute messagerie possède, sous un nom stable quel que soit le fournisseur. */
export type WellKnownFolder = "inbox" | "sent" | "drafts" | "archive" | "trash" | "junk";

export interface MailFolder {
  id: string;
  name: string;
  /** Rôle connu, quand c'en est un — sert à l'ordre et aux icônes. */
  wellKnown: WellKnownFolder | null;
  unread: number;
  total: number;
  /** Dossier parent, pour les arborescences personnelles. */
  parentId: string | null;
}

export interface MailAddress {
  name: string | null;
  address: string;
}

/** Ce qui suffit à dessiner une ligne de liste — pas le corps, qui coûte cher et ne sert pas là. */
export interface MailSummary {
  id: string;
  conversationId: string | null;
  subject: string;
  from: MailAddress | null;
  to: MailAddress[];
  preview: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  isDraft: boolean;
  folderId: string;
}

export interface MailAttachmentMeta {
  id: string;
  name: string;
  contentType: string;
  size: number;
  /** Une image intégrée au corps n'a pas à figurer dans la liste des pièces jointes. */
  isInline: boolean;
}

export interface MailMessage extends MailSummary {
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo: MailAddress[];
  /** Corps HTML **déjà assaini** — le contrat l'impose, aucun écran ne doit avoir à y penser. */
  bodyHtml: string;
  bodyText: string;
  attachments: MailAttachmentMeta[];
  webLink: string | null;
}

export interface MailPage<T> {
  items: T[];
  /** Jeton opaque de page suivante ; `null` = fin de liste. */
  nextCursor: string | null;
}

/** Ce qu'on écrit dans un brouillon ou un envoi. */
export interface MailDraftInput {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  bodyHtml: string;
  /** Message auquel on répond / qu'on transfère — le fournisseur pose alors les bons en-têtes. */
  inReplyTo?: { messageId: string; mode: "reply" | "replyAll" | "forward" } | null;
  attachments?: { name: string; contentType: string; content: Buffer }[];
}

/** Résultat d'une synchronisation incrémentale. */
export interface MailDelta {
  changed: MailSummary[];
  removedIds: string[];
  /** À conserver pour la prochaine fois. `null` = le fournisseur demande une resynchronisation. */
  deltaToken: string | null;
}

/**
 * L'ERREUR d'une messagerie, dans un vocabulaire exploitable par l'écran.
 *
 * Sans elle, l'interface ne sait pas distinguer « reconnecte-toi » de « réessaie dans un instant »,
 * et affiche le même message pour les deux — donc le mauvais dans la moitié des cas.
 */
export type MailErrorKind =
  | "unauthorized"   // jeton mort ou consentement retiré → reconnexion nécessaire
  | "forbidden"      // droit manquant côté Microsoft
  | "not-found"
  | "throttled"      // trop de requêtes : réessayer plus tard
  | "delta-expired"  // jeton de delta périmé → resynchroniser depuis le début
  | "network"
  | "unknown";

/**
 * CE QUE MICROSOFT A RÉPONDU — la partie qu'on garde pour le journal, et elle seule.
 *
 * Le message affiché à l'utilisateur reste une phrase en français. Mais une phrase en français ne
 * permet pas de diagnostiquer un envoi qui ne part pas : « Microsoft refuse cette action » couvre
 * aussi bien une boîte sans licence Exchange (`MailboxNotEnabledForRESTAPI`) qu'un consentement
 * retiré (`ErrorAccessDenied`) — deux causes, deux corrections, aucun moyen de les distinguer.
 *
 * Ce qui entre ici est **sans danger par construction** : un statut, un code d'erreur, un
 * identifiant de corrélation, et l'opération tentée. Le corps de la réponse de Graph n'y entre
 * JAMAIS : il peut recopier l'objet du message ou l'adresse d'un destinataire.
 */
export interface MailDiagnostic {
  /** Statut HTTP rendu par Graph. `0` quand la requête n'a pas abouti du tout. */
  status: number;
  /** Le code d'erreur Graph (`ErrorAccessDenied`, `ErrorInvalidRecipients`…), vide s'il n'y en a pas. */
  code: string;
  /**
   * L'identifiant de corrélation Microsoft (`request-id` / `client-request-id`).
   *
   * C'est le SEUL élément qu'un support Microsoft sait retrouver dans ses propres journaux. Sans
   * lui, un ticket « un mail n'est pas parti mardi » n'est pas traitable.
   */
  requestId: string | null;
  /** L'opération tentée, ex. `POST /me/messages/{id}/send`. Sans la requête, qui porte du contenu. */
  operation: string;
}

export class MailError extends Error {
  constructor(
    readonly kind: MailErrorKind,
    message: string,
    /** Délai conseillé avant réessai, en secondes (renseigné sur `throttled`). */
    readonly retryAfterSec?: number,
    /** Le diagnostic Microsoft, quand l'erreur vient de Graph. Absent sinon. */
    readonly diagnostic?: MailDiagnostic,
  ) {
    super(message);
    this.name = "MailError";
  }
}

/**
 * Le diagnostic écrit pour un humain — court, et collable dans un ticket Microsoft.
 *
 * Rend une chaîne vide quand il n'y a rien d'exploitable : coller « (réf. ) » à la fin d'un message
 * d'erreur est pire que de ne rien ajouter.
 */
export function describeDiagnostic(d: MailDiagnostic | undefined): string {
  if (!d) return "";
  const bits = [d.code || `HTTP ${d.status}`];
  if (d.requestId) bits.push(`réf. ${d.requestId}`);
  return `(${bits.join(", ")})`;
}

/**
 * LE FOURNISSEUR. Une implémentation = un service de messagerie.
 *
 * Chaque méthode agit sur LA boîte de la personne connectée : aucune ne prend d'identifiant de
 * boîte en argument. C'est structurel, pas une convention — on ne peut pas demander la boîte de
 * quelqu'un d'autre parce que le contrat ne le permet pas.
 */
export interface MailProvider {
  /** L'adresse de la boîte servie — pour l'afficher, et pour vérifier qu'on est au bon endroit. */
  address(): Promise<string>;
  listFolders(): Promise<MailFolder[]>;
  listMessages(opts: { folderId: string; cursor?: string | null; limit?: number; search?: string | null }): Promise<MailPage<MailSummary>>;
  getMessage(id: string): Promise<MailMessage>;
  /** Les messages d'une conversation, du plus ancien au plus récent. */
  getConversation(conversationId: string): Promise<MailSummary[]>;
  getAttachment(messageId: string, attachmentId: string): Promise<{ name: string; contentType: string; content: Buffer }>;

  createDraft(input: MailDraftInput): Promise<{ id: string }>;
  updateDraft(id: string, input: MailDraftInput): Promise<void>;
  sendDraft(id: string): Promise<void>;
  send(input: MailDraftInput): Promise<void>;

  setRead(id: string, read: boolean): Promise<void>;
  move(id: string, folderId: string): Promise<{ id: string }>;
  delete(id: string): Promise<void>;

  /** Synchronisation incrémentale d'un dossier. Sans jeton : première synchronisation. */
  delta(folderId: string, deltaToken: string | null): Promise<MailDelta>;
}
