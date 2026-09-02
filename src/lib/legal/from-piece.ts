/**
 * UNE PIÈCE RÉCLAMÉE QUI EST UNE FACTURE OU UN BON DE COMMANDE REJOINT LEGAL.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * On réclame une facture depuis un dossier de paiement ; la personne la dépose ; on l'accepte ;
 * et elle reste là, dans le fil de la demande de pièce. Le registre des engagements de la
 * société — Legal, où vivent les contrats, les devis, les bons de commande et les factures —
 * ne la connaît pas. Six mois plus tard, la question « quelles factures avons-nous reçues de ce
 * fournisseur ? » n'a pas de réponse : la moitié d'entre elles sont dans des fils de discussion.
 *
 * Personne ne les y recopiait, et c'est normal : recopier à la main une pièce qu'on vient de
 * recevoir est un travail de secrétariat, et un travail de secrétariat finit par être oublié.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * La demande de pièce DIT SA NATURE. Quand cette nature est un engagement — facture, bon de
 * commande, devis, contrat —, l'acceptation de la pièce l'enregistre dans Legal, sous cette
 * nature. Le reste — bon de livraison, justificatif, autre — n'y va pas : Legal est le registre
 * de ce qui ENGAGE, pas un second Drive.
 *
 * ── POURQUOI À L'ACCEPTATION, ET NON AU DÉPÔT ───────────────────────────────────────────────
 *
 * Parce que le registre des engagements ne doit contenir que des pièces que quelqu'un a
 * regardées. Une facture déposée puis refusée — mauvais montant, mauvaise société — y resterait
 * comme un engagement de la société. L'acceptation est le moment où le demandeur dit « c'est bien
 * celle-là » : c'est cette phrase-là qui a sa place dans un registre.
 *
 * ── ET LES DROITS, QUI SONT LE VRAI PIÈGE ───────────────────────────────────────────────────
 *
 * Un document Legal SANS lecteur désigné est visible de tout le module. Classer une facture
 * réclamée sans y penser l'exposerait donc, en silence, à des gens qui n'avaient rien à en
 * connaître. La pièce naît RESTREINTE — à celui qui a demandé, à celui qui a déposé — et Legal
 * offre déjà le geste inverse, explicite, pour l'ouvrir à tout le module.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/**
 * LES NATURES QU'UNE PIÈCE RÉCLAMÉE PEUT AVOIR.
 *
 * Ce sont exactement celles d'une pièce de dossier de paiement (`PaymentPieceKind`) : réclamer
 * une facture et joindre une facture désignent la même chose, et deux vocabulaires pour un même
 * objet finissent par ne plus se correspondre.
 */
export const PIECE_KINDS = ["INVOICE", "PURCHASE_ORDER", "QUOTE", "DELIVERY_NOTE", "CONTRACT", "PROOF", "OTHER"] as const;

export type PieceKind = (typeof PIECE_KINDS)[number];

export function pieceKindOf(raw: string | null | undefined): PieceKind {
  return (PIECE_KINDS as readonly string[]).includes(raw ?? "") ? (raw as PieceKind) : "OTHER";
}

/**
 * OÙ CETTE NATURE ATTERRIT DANS LEGAL — ou `null` quand elle n'y va pas.
 *
 * Une table, et non une cascade de `if` : c'est la liste de ce qui ENGAGE la société. Un bon de
 * livraison prouve qu'on a reçu, il n'engage rien ; un justificatif appartient au dossier qui
 * l'a demandé. Les y verser ferait de Legal un second Drive, et le registre des engagements
 * perdrait ce qui fait sa valeur : on peut le lire en entier.
 */
const LEGAL_KIND_OF_PIECE: Record<PieceKind, string | null> = {
  INVOICE: "INVOICE",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  QUOTE: "QUOTE",
  CONTRACT: "CONTRACT",
  DELIVERY_NOTE: null,
  PROOF: null,
  OTHER: null,
};

export function legalKindOfPiece(kind: string | null | undefined): string | null {
  return LEGAL_KIND_OF_PIECE[pieceKindOf(kind)];
}

/** Cette pièce rejoindra-t-elle le registre des engagements ? */
export function filesInLegal(kind: string | null | undefined): boolean {
  return legalKindOfPiece(kind) !== null;
}

/** Le libellé de chaque nature — celui que lit la personne qui réclame. */
export const PIECE_KIND_LABEL: Record<PieceKind, string> = {
  INVOICE: "Facture",
  PURCHASE_ORDER: "Bon de commande",
  QUOTE: "Devis",
  DELIVERY_NOTE: "Bon de livraison",
  CONTRACT: "Contrat",
  PROOF: "Justificatif",
  OTHER: "Autre",
};

export function pieceKindOptions(): { value: PieceKind; label: string }[] {
  return PIECE_KINDS.map((k) => ({ value: k, label: PIECE_KIND_LABEL[k] }));
}

/**
 * CE QU'ON DIT À CELUI QUI RÉCLAME — avant qu'il envoie, pas après.
 *
 * Un classement qui se produit sans être annoncé se découvre par accident, et l'on se demande
 * qui a mis cette facture dans Legal.
 */
export function filingNotice(kind: string | null | undefined): string | null {
  const legal = legalKindOfPiece(kind);
  if (!legal) return null;
  return `Une fois déposée et acceptée, cette pièce sera enregistrée dans Legal (${PIECE_KIND_LABEL[pieceKindOf(kind)].toLowerCase()}), visible de vous et de la personne qui l'aura déposée.`;
}

/**
 * LE TITRE DE LA PIÈCE DANS LEGAL — celui qu'on a écrit en la réclamant.
 *
 * « La facture définitive de l'agence » dit ce que c'est ; la référence de la demande (PIE-…)
 * permet de remonter au fil qui l'a obtenue. Un titre technique — « Document de PIE-2026-014 » —
 * n'apprendrait rien à celui qui parcourt le registre.
 */
export function legalTitleFromPiece(label: string, reference: string): string {
  const t = label.trim();
  return t ? `${t} (${reference})` : reference;
}
