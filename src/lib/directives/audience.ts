/**
 * À QUI UNE DIRECTIVE S'ADRESSE — et à quelle condition elle part.
 *
 * Une note de service n'a pas toujours un destinataire : elle en a souvent des dizaines. Le
 * module ne savait dire que deux choses — « cette personne » ou « ce rôle » —, ce qui obligeait
 * la direction à émettre quatorze fois la même note pour toucher une entité, puis à répondre
 * quatorze fois dans quatorze fils. Quatre portées y répondent, et **une seule fait foi** :
 *
 *   • `USERS`   — une ou plusieurs personnes nommées ;
 *   • `ROLE`    — tous les porteurs d'un rôle ;
 *   • `COMPANY` — tous les salariés d'une entité du groupe ;
 *   • `ALL`     — tous les salariés.
 *
 * ── POURQUOI LA PUBLICATION EST UN AXE À PART ───────────────────────────────────────────────
 *
 * `status` dit ce que le DESTINATAIRE en a fait (lu, en cours, traité). `publication` dit si la
 * direction générale a ACCORDÉ la diffusion. Les confondre — un seul champ pour les deux — ferait
 * partir une note « ouverte » avant tout accord : le jour où quelqu'un enverrait à 200 salariés
 * une note non relue, personne ne pourrait la rattraper. Ce qui a été lu a été lu.
 *
 * Module PUR : aucune base, aucun import lourd — importable côté client comme serveur, et testé.
 */

export type DirectiveAudience = "USERS" | "ROLE" | "COMPANY" | "ALL";
export type DirectivePublication = "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED";

export const AUDIENCE_LABELS: Record<DirectiveAudience, string> = {
  USERS: "Une ou plusieurs personnes",
  ROLE: "Tous les porteurs d'un rôle",
  COMPANY: "Tous les salariés d'une entité",
  ALL: "Tous les salariés",
};

export const PUBLICATION_LABELS: Record<DirectivePublication, string> = {
  DRAFT: "Brouillon",
  PENDING_APPROVAL: "En attente de validation",
  PUBLISHED: "Publiée",
  REJECTED: "Refusée",
};

/** La forme minimale d'une directive pour raisonner sur sa portée. */
export interface DirectiveScope {
  audience: DirectiveAudience;
  targetUserIds: string[];
  targetRole: string | null;
  companyId: string | null;
}

/** La personne qui regarde — son compte, son rôle (principal et cumulé), son entité. */
export interface DirectivePerson {
  id: string;
  role: string;
  secondaryRole?: string | null;
  /** Entités auxquelles la personne est rattachée (fiche employé + accès accordés). */
  companyIds?: string[];
}

/** Les rôles qui PUBLIENT : la note engage l'entreprise, ils en répondent. */
export const PUBLISHER_ROLES = ["SUPER_ADMIN", "GENERAL_MANAGER"] as const;

function holdsRole(user: DirectivePerson, roles: readonly string[]): boolean {
  return roles.some((r) => r === user.role || (user.secondaryRole ? r === user.secondaryRole : false));
}

/**
 * PUBLIER — accorder la diffusion d'une note à toute l'entreprise.
 *
 * Le directeur général et le Super Admin, personne d'autre. Ce n'est pas un droit de module :
 * c'est une signature. L'ouvrir par la matrice d'accès reviendrait à ce qu'un module coché par
 * mégarde donne le pouvoir d'écrire au nom de la direction.
 */
export function canPublishDirectives(user: DirectivePerson): boolean {
  return holdsRole(user, PUBLISHER_ROLES);
}

/**
 * Une directive écrite PAR un publieur est-elle publiée d'emblée ?
 *
 * Oui — et ce n'est pas une exception au principe, c'en est l'application : la règle exige
 * l'accord du directeur général, et il vient de l'écrire. Lui demander de se valider lui-même
 * produirait un clic vide dont chacun apprendrait à se moquer.
 */
export function publishesImmediately(author: DirectivePerson): boolean {
  return canPublishDirectives(author);
}

/**
 * Cette personne est-elle DESTINATAIRE de cette directive ?
 *
 * Ne répond QUE de la portée. La publication, l'émetteur et les droits d'administration se
 * jugent ailleurs : mélanger les deux ferait qu'un brouillon toucherait ses destinataires.
 */
export function isRecipient(user: DirectivePerson, d: DirectiveScope): boolean {
  switch (d.audience) {
    case "ALL":
      return true;
    case "ROLE":
      return d.targetRole ? holdsRole(user, [d.targetRole]) : false;
    case "COMPANY":
      return d.companyId ? (user.companyIds ?? []).includes(d.companyId) : false;
    case "USERS":
      return d.targetUserIds.includes(user.id);
    default:
      return false;
  }
}

/**
 * Ce que la personne VOIT : une directive publiée qui la concerne, ou la sienne (à tout état).
 * Un émetteur suit sa note pendant qu'elle attend la signature — sinon il la croirait perdue.
 */
export function canReadDirective(
  user: DirectivePerson,
  d: DirectiveScope & { publication: DirectivePublication; fromId: string | null },
  opts: { isManager?: boolean } = {},
): boolean {
  if (d.fromId === user.id) return true;
  if (opts.isManager || canPublishDirectives(user)) return true;
  if (d.publication !== "PUBLISHED") return false;
  return isRecipient(user, d);
}

/**
 * Ce qui manque pour qu'une directive soit envoyable. Renvoie le motif EXACT plutôt qu'un
 * « formulaire incomplet » : la personne doit savoir quelle case remplir.
 */
export function validateAudience(d: DirectiveScope): string | null {
  switch (d.audience) {
    case "USERS":
      return d.targetUserIds.length > 0 ? null : "Choisissez au moins une personne destinataire.";
    case "ROLE":
      return d.targetRole ? null : "Choisissez le rôle destinataire.";
    case "COMPANY":
      return d.companyId ? null : "Choisissez l'entité destinataire.";
    case "ALL":
      return null;
    default:
      return "Portée de diffusion inconnue.";
  }
}

/**
 * La portée en une ligne lisible, telle qu'elle s'affiche en tête de directive et dans le
 * récapitulatif d'envoi. Le NOMBRE y figure quand il est connu : « 34 personnes » se relit,
 * « toute l'entité » ne se relit pas.
 */
export function describeAudience(
  d: DirectiveScope,
  names: { users?: string[]; role?: string | null; company?: string | null; count?: number } = {},
): string {
  const count = typeof names.count === "number" ? ` — ${names.count} personne${names.count > 1 ? "s" : ""}` : "";
  switch (d.audience) {
    case "ALL":
      return `Tous les salariés${count}`;
    case "COMPANY":
      return `${names.company ?? "Entité"}${count}`;
    case "ROLE":
      return `${names.role ?? d.targetRole ?? "Rôle"}${count}`;
    case "USERS": {
      const list = names.users ?? [];
      if (list.length === 0) return `${d.targetUserIds.length} personne${d.targetUserIds.length > 1 ? "s" : ""}`;
      if (list.length <= 3) return list.join(", ");
      return `${list.slice(0, 3).join(", ")} +${list.length - 3}`;
    }
    default:
      return "—";
  }
}

/**
 * Ce que dit le bouton de RELANCE. Une note se renvoie quand elle n'a pas été lue ; le libellé
 * porte le compte, sans quoi on renvoie trois fois en croyant renvoyer une première fois.
 */
export function describeSends(sendCount: number, lastSentAt: Date | string | null): string {
  if (sendCount <= 0) return "Jamais envoyée.";
  const when = lastSentAt ? new Date(lastSentAt).toLocaleDateString("fr-FR") : null;
  const times = sendCount === 1 ? "Envoyée une fois" : `Envoyée ${sendCount} fois`;
  return when ? `${times} — dernier envoi le ${when}.` : `${times}.`;
}
