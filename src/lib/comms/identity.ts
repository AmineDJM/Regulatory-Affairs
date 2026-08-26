import { prisma } from "@/lib/prisma";

/**
 * L'IDENTITÉ D'ENVOI — QUI signe, et d'où part réellement le message.
 *
 * LE BOGUE QUE CE MODULE EXISTE POUR FERMER. Une carte de confirmation a montré au PDG :
 *
 *     De : amine.djouamai@pharmagenedz.com
 *     À  : amine.djouamai@pharmagenedz.com
 *
 * Il s'écrivait à lui-même, depuis sa propre boîte, alors qu'Adam dispose d'une adresse à lui.
 * L'expéditeur n'avait pas été « déduit du destinataire » : il venait d'une AUTRE PILE — la
 * messagerie IMAP historique du module Courrier (`MailAccount`), que l'assistant savait encore
 * utiliser. Deux piles d'envoi coexistaient sous le même cerveau, et la mauvaise gagnait.
 *
 * LA RÈGLE, désormais portée par du code et non par une consigne : l'expéditeur d'un message
 * sortant est TOUJOURS la connexion Google canonique de la personne — jamais le destinataire,
 * jamais l'adresse ERP de l'utilisateur, jamais l'entité d'une conversation, jamais un argument
 * d'outil. `recipient ≠ identité d'envoi` : ce sont deux notions sans rapport, et rien dans le
 * chemin d'envoi ne doit pouvoir les confondre.
 *
 * DEUX FONCTIONS, DEUX MOMENTS, ET C'EST VOULU :
 *
 *   • `resolveOutboundIdentity` sert à PRÉPARER et à AFFICHER — elle rafraîchit le jeton si
 *     nécessaire, donc elle parle au réseau.
 *   • `authorizeIdentity` sert à VALIDER — elle ne lit que la base, et se rappelle à l'instant de
 *     la création de l'intention PUIS à l'instant de l'envoi. Une connexion suspendue entre les
 *     deux doit arrêter le message : c'est le même raisonnement que la relecture de la politique.
 *
 * Et la règle qui prime sur le confort : **s'il n'existe aucune identité sortante autorisée, on
 * n'envoie pas.** Pas de repli silencieux sur une autre boîte.
 */

export interface OutboundIdentity {
  /** La connexion canonique — c'est elle qui entre dans l'empreinte du contenu approuvé. */
  connectionId: string;
  /** L'adresse RÉELLE d'expédition, telle qu'elle apparaîtra chez le destinataire. */
  address: string;
  displayName: string | null;
}

/** Pourquoi une identité manque — chaque motif appelle un geste différent du PDG. */
export type IdentityRefusal =
  | { error: "not-connected"; message: string }
  | { error: "paused"; message: string }
  | { error: "needs-reconnect"; message: string }
  | { error: "not-yours"; message: string };

export const NO_IDENTITY_MESSAGE =
  "Aucune adresse d'envoi n'est connectée pour Adam : je ne peux donc envoyer aucun message. "
  + "Ouvrez « Chief of Staff → Réglages » et connectez le compte Google d'Adam — je préparerai ensuite le message normalement.";

const REFUSALS: Record<IdentityRefusal["error"], string> = {
  "not-connected": NO_IDENTITY_MESSAGE,
  paused: "La connexion Google d'Adam est SUSPENDUE (coupe-circuit). Rien ne peut partir tant qu'elle ne sera pas relevée dans « Chief of Staff → Réglages ».",
  "needs-reconnect": "Le compte Google d'Adam doit être RECONNECTÉ (jeton expiré ou consentement révoqué). « Chief of Staff → Réglages » → Reconnecter.",
  "not-yours": "Cette identité d'envoi n'est pas celle de ce compte : un message ne peut pas partir d'une boîte qui n'est pas la vôtre.",
};

const refuse = (error: IdentityRefusal["error"]): IdentityRefusal =>
  ({ error, message: REFUSALS[error] }) as IdentityRefusal;

/** Est-ce une identité, ou un refus ? Prédicat PUR — il n'y a rien à interroger pour le savoir. */
export function isIdentity(v: OutboundIdentity | IdentityRefusal): v is OutboundIdentity {
  return "connectionId" in v;
}

/**
 * AUTORISE (ou refuse) une identité d'envoi — LECTURE SEULE, sans réseau.
 *
 * Le contrôle porte sur trois choses, et les trois comptent : la connexion existe, elle
 * appartient à CE compte, et elle est réellement en état d'envoyer. Un payload trafiqué qui
 * porterait le `connectionId` de quelqu'un d'autre échoue ici — avant toute écriture.
 */
export async function authorizeIdentity(
  connectionId: string,
  userId: string,
): Promise<OutboundIdentity | IdentityRefusal> {
  const c = await prisma.googleConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, userId: true, address: true, displayName: true, paused: true, status: true },
  });
  if (!c) return refuse("not-connected");
  if (c.userId !== userId) return refuse("not-yours");
  if (c.paused) return refuse("paused");
  if (c.status !== "connected") return refuse("needs-reconnect");
  return { connectionId: c.id, address: c.address, displayName: c.displayName };
}

/**
 * L'IDENTITÉ SORTANTE de cette personne — celle qui doit figurer dans « De : ».
 *
 * Aujourd'hui il y en a UNE par compte (`GoogleConnection.userId` est unique). Le jour où il y en
 * aura plusieurs, c'est CETTE fonction qui deviendra le routeur d'identités : le reste du système
 * ne connaît qu'elle, et n'aura donc pas à changer.
 */
export async function resolveOutboundIdentity(userId: string): Promise<OutboundIdentity | IdentityRefusal> {
  const c = await prisma.googleConnection.findUnique({
    where: { userId },
    select: { id: true, address: true, displayName: true, paused: true, status: true },
  });
  if (!c) return refuse("not-connected");
  if (c.paused) return refuse("paused");
  if (c.status !== "connected") return refuse("needs-reconnect");
  return { connectionId: c.id, address: c.address, displayName: c.displayName };
}

/** « Adam <adam.executive.ai@gmail.com> » — ce que l'écran et le prompt doivent montrer. */
export function formatIdentity(id: OutboundIdentity): string {
  return id.displayName ? `${id.displayName} <${id.address}>` : id.address;
}
