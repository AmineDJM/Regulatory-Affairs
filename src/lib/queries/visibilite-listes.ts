import type { Prisma } from "@prisma/client";
import { companyScopedWhere, platformScope } from "@/lib/company";
import {
  scopeAdminRequests, scopeCongressIntl, scopeCongressNational, scopeSales, userCan, type SessionUser,
} from "@/lib/rbac";
import { legalReaderWhere, legalViewScope, PURCHASE_CHAIN_KINDS, type LegalViewScope } from "@/lib/lecteurs/legal";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PÉRIMÈTRE D'UNE LISTE — lu par l'ÉCRAN et par la RECHERCHE GLOBALE, jamais recopié.
 *
 * ── LE DÉFAUT, MESURÉ (§118.177) ─────────────────────────────────────────────────────────
 *
 * La recherche globale (palette ⌘K, page /search) composait ses propres filtres, famille par
 * famille, à côté de ceux des écrans. Recensé sur ses vingt-trois familles : QUINZE ignoraient le
 * cloisonnement par entité que leur liste applique. Un salarié d'Adventum tapait trois lettres et
 * lisait les sponsorings, les écritures comptables, les salariés, les ventes, les commandes
 * logistiques, les praticiens, les appels d'offres, les contrats et les courriers de Pharmagène —
 * et, sur la moitié de ces familles, la fiche s'ouvrait ensuite en entier.
 *
 * La cause n'était pas quinze oublis : c'était DEUX écritures de la même règle. La recherche
 * reprenait la portée par ligne du module (`scopeSales`…) et s'arrêtait là ; l'écran, lui, la
 * composait avec l'entité. Deux clauses pour une seule question finissent toujours par diverger,
 * et c'est la plus large qui fuit (§118.5, §118.71).
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * Chaque fonction ci-dessous rend EXACTEMENT ce que l'écran de liste montre, sans ses filtres
 * d'affichage (dossier ouvert, statut choisi…). L'écran l'appelle pour charger sa liste ; la
 * recherche l'appelle pour chercher dedans. Un écran qui se resserre demain resserre la recherche
 * le même jour, sans que personne y pense. `visibilite-listes.test.ts` vérifie les deux points
 * d'appel (§118.49) et rejoue chaque famille avec un lecteur SANS vue globale (§118.104).
 *
 * ── DEUX FILTRES D'ENTITÉ, ET C'EST L'ÉCRAN QUI CHOISIT ──────────────────────────────────
 *
 * `platformScope` (strict) exclut une ligne sans entité des vues cloisonnées ; `companyScopedWhere`
 * la garde exprès pour qu'on la rattache (§118.154). Les deux coexistent depuis longtemps, chacun
 * avec sa raison : la recherche reprend celui de SON écran, famille par famille, et ne devient ni
 * plus stricte (un refus à tort, §118.27) ni plus large (une fuite) que lui.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** `/sponsoring` — l'entité au sens strict ; le sponsoring n'a pas de portée par ligne. */
export async function clauseSponsoringsVisibles(userId: string): Promise<Prisma.SponsoringRequestWhereInput> {
  return (await platformScope(userId)) as Prisma.SponsoringRequestWhereInput;
}

/** Le livre des Finances (`getFinanceData`, `getComptaData`) — l'entité au sens strict. */
export async function clauseEcrituresVisibles(userId: string): Promise<Prisma.FinanceTransactionWhereInput> {
  return (await platformScope(userId)) as Prisma.FinanceTransactionWhereInput;
}

/** La liste des salariés (`getRhData`, `/rh` et `/rh/equipe`) — l'entité au sens strict. */
export async function clauseSalariesVisibles(userId: string): Promise<Prisma.EmployeeWhereInput> {
  return (await platformScope(userId)) as Prisma.EmployeeWhereInput;
}

/** `/sales` — la portée du module, dans l'entité (les ventes sans entité restent rattachables). */
export async function clauseVentesVisibles(user: SessionUser): Promise<Prisma.SaleWhereInput> {
  return companyScopedWhere(user.id, scopeSales(user));
}

/** `/logistics` — l'entité ; une commande sans entité reste visible pour qu'on la rattache. */
export async function clauseCommandesLogistiqueVisibles(userId: string): Promise<Prisma.LogisticsOrderWhereInput> {
  return companyScopedWhere<Prisma.LogisticsOrderWhereInput>(userId, {});
}

/** Le bureau du secrétariat (`getRequestList`) — la portée du module ET l'entité stricte. */
export async function clauseDemandesSecretariatVisibles(user: SessionUser): Promise<Prisma.AdministrativeRequestWhereInput> {
  return { AND: [scopeAdminRequests(user), (await platformScope(user.id)) as Prisma.AdministrativeRequestWhereInput] };
}

/** Les prises en charge (`getCongressList`) — la portée du module ET l'entité stricte. */
export async function clauseCongresInternationauxVisibles(user: SessionUser): Promise<Prisma.CongressInternationalWhereInput> {
  return { AND: [scopeCongressIntl(user), (await platformScope(user.id)) as Prisma.CongressInternationalWhereInput] };
}

export async function clauseCongresNationauxVisibles(user: SessionUser): Promise<Prisma.CongressNationalWhereInput> {
  return { AND: [scopeCongressNational(user), (await platformScope(user.id)) as Prisma.CongressNationalWhereInput] };
}

/** `/events` (`getEvents`) — l'entité au sens strict. */
export async function clauseEvenementsVisibles(userId: string): Promise<Prisma.EventWhereInput> {
  return (await platformScope(userId)) as Prisma.EventWhereInput;
}

/** `/pch` (`getPchTenders`) — l'entité ; un marché sans entité reste visible pour qu'on le rattache. */
export async function clauseMarchesPchVisibles(userId: string): Promise<Prisma.PchTenderWhereInput> {
  return companyScopedWhere<Prisma.PchTenderWhereInput>(userId, {});
}

/**
 * Les bons de commande PCH n'ont pas d'écran à eux : ils vivent dans la fiche de LEUR marché, et
 * la liste des marchés les charge avec lui. Un bon de commande est donc visible quand son marché
 * l'est — il n'a pas d'entité propre, il hérite de celle du marché.
 */
export async function clauseBonsDeCommandePchVisibles(userId: string): Promise<Prisma.PchOrderWhereInput> {
  return { tender: await clauseMarchesPchVisibles(userId) };
}

/** `/courriers` — l'entité ; un pli sans entité reste visible pour qu'on le rattache. */
export async function clauseCourriersVisibles(userId: string): Promise<Prisma.MailEntryWhereInput> {
  return companyScopedWhere<Prisma.MailEntryWhereInput>(userId, {});
}

/**
 * `/legal` — la PORTÉE de la personne (tout le registre, ou la chaîne d'achat seule pour les
 * Finances), les LECTEURS désignés, puis l'entité.
 *
 * `where` vaut `null` quand la liste ne montre rien : sans droit (`NONE`), ou pour qui n'a que le
 * module « Bons de commande » — la liste le renvoie vers SON écran, elle ne lui ouvre pas le
 * registre. La portée voyage avec la clause parce que l'écran en a besoin pour s'afficher : la
 * calculer deux fois, c'est l'écrire deux fois.
 */
export async function perimetreLegal(user: SessionUser): Promise<{ portee: LegalViewScope; where: Prisma.LegalDocumentWhereInput | null }> {
  const portee = legalViewScope({
    onLegal: userCan(user, "LEGAL", "VIEW"),
    onFinances: userCan(user, "FINANCES", "VIEW"),
    onBonsDeCommande: userCan(user, "PURCHASE_ORDERS", "VIEW"),
  });
  if (portee === "NONE" || portee === "BONS_DE_COMMANDE") return { portee, where: null };
  const lecteurs = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  const nature: Prisma.LegalDocumentWhereInput = portee === "PURCHASE_CHAIN"
    ? { kind: { in: [...PURCHASE_CHAIN_KINDS] as ("INVOICE" | "PURCHASE_ORDER")[] } }
    : {};
  const where = await companyScopedWhere<Prisma.LegalDocumentWhereInput>(user.id, {
    AND: [nature, ...(lecteurs ? [lecteurs as Prisma.LegalDocumentWhereInput] : [])],
  });
  return { portee, where };
}

/**
 * La messagerie : les conversations dont la personne est membre ACTIF. La liste
 * (`getConversationSummaries`) et la fiche (`getConversationDetail`) exigent `leftAt: null` ;
 * la recherche ne le demandait pas, et un ancien membre retrouvait le canal par son titre — et
 * les messages par leur contenu, y compris ceux postés APRÈS son départ.
 */
export function clauseConversationsVisibles(userId: string): Prisma.ConversationWhereInput {
  return { members: { some: { userId, leftAt: null } } };
}

export function clauseMessagesVisibles(userId: string): Prisma.MessageWhereInput {
  return { deletedAt: null, conversation: clauseConversationsVisibles(userId) };
}
