/**
 * QUI PEUT OUVRIR UN DOCUMENT LÉGAL — le déposant désigne ses lecteurs.
 *
 * Avoir le module Legal, ce n'est pas avoir le droit de lire chaque engagement de la société.
 * Un bail, un protocole d'accord, un contrat de cadre concernent trois personnes ; les rendre
 * visibles de tout le module, c'est publier des montants et des clauses à des gens qui n'ont
 * aucune raison de les connaître — et c'est pourquoi, en pratique, ces pièces ne sont jamais
 * déposées et restent dans une boîte mail.
 *
 * QUATRE PORTES, ET QUATRE SEULEMENT :
 *   1. les LECTEURS désignés ;
 *   2. le DÉPOSANT — on ne se ferme pas la porte du document qu'on vient de verser ;
 *   3. le SUPER ADMIN — il arbitre, et un document que personne ne peut plus ouvrir (déposant
 *      parti, lecteurs désactivés) serait perdu ;
 *   4. AUCUN lecteur désigné → le document reste ouvert au module, comme avant.
 *
 * La quatrième n'est pas un trou : c'est le seul défaut sûr pour l'historique. Deviner des
 * listes de lecteurs sur des milliers de documents existants aurait fermé à leurs utilisateurs
 * des pièces dont personne n'aurait su reconstituer la liste.
 *
 * ⚠️ La restriction s'ajoute au CLOISONNEMENT PAR ENTITÉ, elle ne le remplace pas : être lecteur
 * d'un document de Pharmagène ne donne pas accès au reste de Pharmagène.
 *
 * Module PUR — testé, sans base de données.
 */

export interface LegalReaderContext {
  /** Le spectateur. */
  viewerId: string;
  /** Vue groupe / arbitrage — le Super Admin. */
  isSuperAdmin: boolean;
}

export interface LegalDocumentAccess {
  /** Qui a déposé le document (`null` si le compte a été supprimé). */
  createdById: string | null;
  /** Lecteurs désignés. Vide = document ouvert au module. */
  readerIds: string[];
}

/** Le document est-il RESTREINT, c'est-à-dire réservé à une liste nommée ? */
export function isRestricted(doc: LegalDocumentAccess): boolean {
  return doc.readerIds.length > 0;
}

/** Ce spectateur peut-il ouvrir ce document ? (le droit de module est vérifié à part) */
export function canReadLegalDocument(ctx: LegalReaderContext, doc: LegalDocumentAccess): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!isRestricted(doc)) return true;
  if (doc.createdById && doc.createdById === ctx.viewerId) return true;
  return doc.readerIds.includes(ctx.viewerId);
}

/**
 * Le filtre Prisma des documents lisibles — la MÊME règle, côté requête.
 *
 * `null` signifie « aucune restriction à poser » (Super Admin). Sinon, un `OR` : les documents
 * sans lecteur désigné, ceux que j'ai déposés, et ceux où l'on m'a nommé.
 *
 * Ce filtre doit être composé AVEC le cloisonnement d'entité, jamais à sa place.
 */
export function legalReaderWhere(ctx: LegalReaderContext): {
  OR: ({ readers: { none: Record<string, never> } } | { createdById: string } | { readers: { some: { userId: string } } })[];
} | null {
  if (ctx.isSuperAdmin) return null;
  return {
    OR: [
      { readers: { none: {} } },
      { createdById: ctx.viewerId },
      { readers: { some: { userId: ctx.viewerId } } },
    ],
  };
}

/**
 * La liste de lecteurs à ENREGISTRER, à partir de ce que le formulaire a envoyé.
 *
 * Le déposant est retiré s'il s'y est mis : il a déjà accès par la porte 2, et l'inscrire
 * ferait croire qu'en se retirant il se fermerait le document. Doublons écartés.
 */
export function normalizeReaderIds(raw: string[], createdById: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const v = id.trim();
    if (!v || v === createdById || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * QUI GÈRE LES ACCÈS D'UN DOCUMENT — le déposant, et le Super Admin.
 *
 * Pas celui qui a le droit d'ÉCRITURE sur le module : pouvoir corriger une date d'échéance n'est
 * pas pouvoir s'ouvrir un document qu'on ne devrait pas lire. Ce serait la porte dérobée exacte
 * que la restriction ferme — il suffirait de s'ajouter soi-même à la liste.
 *
 * Cette règle vivait DANS l'action. Elle en sort pour que l'écran pose exactement la même
 * question : un bouton qu'on voit et qui refuse ensuite est pire qu'un bouton absent, parce
 * qu'on cherche la panne au lieu de demander à la bonne personne.
 */
export function canManageLegalReaders(
  ctx: LegalReaderContext,
  doc: { createdById: string | null },
): boolean {
  return ctx.isSuperAdmin || (doc.createdById !== null && doc.createdById === ctx.viewerId);
}

/** À qui s'adresser quand on ne gère pas soi-même les accès. Nommer évite l'aller-retour. */
export function readersManagerHint(depositorName: string | null): string {
  return depositorName
    ? `Seul ${depositorName}, qui a déposé ce document, ou un Super Admin peut en changer les accès.`
    : "Seul le déposant du document, ou un Super Admin, peut en changer les accès.";
}

/** Phrase d'état, telle qu'elle s'affiche sur la fiche et dans la liste. */
export function readersCaption(doc: LegalDocumentAccess): string {
  const n = doc.readerIds.length;
  if (n === 0) return "Visible de tout le module Legal";
  return `Restreint — ${n} lecteur${n > 1 ? "s" : ""} désigné${n > 1 ? "s" : ""} (plus le déposant)`;
}
