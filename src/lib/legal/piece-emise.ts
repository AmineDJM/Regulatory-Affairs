/**
 * ═════════════════════════════════════════════════════════════════
 * UNE PIÈCE ÉMISE PAR LA PLATEFORME — ce que son FICHIER porte, et que le formulaire Legal ne
 * réécrit donc pas (§118.194 — audit 360°, R15).
 *
 * La fabrique (`platform/in-process/artifact/factory.ts`) émet devis, bons de commande et factures :
 * un numéro, un Word et un PDF dans le Drive, et la pièce au registre Legal. Le formulaire générique
 * de la fiche Legal changeait pourtant le montant, la partie, le numéro ou les dates SANS régénérer le
 * fichier : la fiche disait un montant, la pièce partie chez le fournisseur en disait un autre — et
 * c'est la fiche qui part au règlement. Ces champs sont désormais ceux du fichier : une vraie
 * correction passe par la RÉVISION (même numéro, nouvelle version, historique), qui réécrit les deux
 * ensemble.
 *
 * Module PUR, zéro import : la fiche (serveur), son formulaire et l'action le lisent — deux copies de
 * « quels champs le fichier porte » finiraient par en oublier un (§118.5).
 * ═════════════════════════════════════════════════════════════════
 */

export type TypePieceEmise = "DEVIS" | "BON_DE_COMMANDE" | "FACTURE" | "AVOIR";

/** Ce que l'on sait d'une pièce émise, lu dans `custom.fabrique` — `null` pour une pièce déposée. */
export interface FaitsPieceEmise {
  type: TypePieceEmise;
  numero: string;
  version: number;
}

const TYPES: readonly string[] = ["DEVIS", "BON_DE_COMMANDE", "FACTURE", "AVOIR"];

/** La pièce a-t-elle été émise par la fabrique ? On ne devine rien : sans type ni numéro lisibles, `null`. */
export function pieceEmise(custom: unknown): FaitsPieceEmise | null {
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const f = (custom as { fabrique?: unknown }).fabrique;
  if (!f || typeof f !== "object" || Array.isArray(f)) return null;
  const { type, numero, version } = f as { type?: unknown; numero?: unknown; version?: unknown };
  if (typeof type !== "string" || !TYPES.includes(type) || typeof numero !== "string" || !numero.trim()) return null;
  return { type: type as TypePieceEmise, numero, version: typeof version === "number" && Number.isInteger(version) && version > 0 ? version : 1 };
}

/** Les champs du registre que le FICHIER porte — et leur nom dans une phrase. */
export interface ValeursDuFichier {
  amount: number | null;
  reference: string | null;
  kind: string;
  startDate: Date | null;
  endDate: Date | null;
  direction: string | null;
  counterpartyIds: string[];
}
export type ChampDuFichier = keyof ValeursDuFichier;

export const LIBELLE_CHAMP_DU_FICHIER: Record<ChampDuFichier, string> = {
  amount: "le montant",
  reference: "le numéro",
  kind: "la nature",
  startDate: "la date",
  endDate: "l'échéance",
  direction: "le sens de l'argent",
  counterpartyIds: "la partie",
};

/** Le jour d'une date, dans le fuseau du serveur — celui où le formulaire l'a écrite et la relit. */
function jour(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const memeTexte = (a: string | null, b: string | null): boolean => (a ?? "").trim() === (b ?? "").trim();
const memeMontant = (a: number | null, b: number | null): boolean =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.005;
const memesIds = (a: string[], b: string[]): boolean => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Les champs du fichier que la demande CHANGE. Ce que le formulaire ne porte pas (`porte(champ)`
 * faux) ne change rien — il garde sa valeur (§118.152). Ce qu'il porte à l'identique non plus :
 * le formulaire pré-rempli renvoie le montant tel qu'il l'a lu, et ce n'est pas une modification.
 */
export function champsDuFichierChanges(
  avant: ValeursDuFichier,
  demande: ValeursDuFichier,
  porte: (champ: ChampDuFichier) => boolean,
): ChampDuFichier[] {
  const changes: ChampDuFichier[] = [];
  if (porte("amount") && !memeMontant(avant.amount, demande.amount)) changes.push("amount");
  if (porte("reference") && !memeTexte(avant.reference, demande.reference)) changes.push("reference");
  if (porte("kind") && avant.kind !== demande.kind) changes.push("kind");
  if (porte("startDate") && jour(avant.startDate) !== jour(demande.startDate)) changes.push("startDate");
  if (porte("endDate") && jour(avant.endDate) !== jour(demande.endDate)) changes.push("endDate");
  if (porte("direction") && (avant.direction ?? null) !== (demande.direction ?? null)) changes.push("direction");
  if (porte("counterpartyIds") && !memesIds(avant.counterpartyIds, demande.counterpartyIds)) changes.push("counterpartyIds");
  return changes;
}

const liste = (mots: string[]): string =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/**
 * LE GESTE QUI CORRIGE une pièce émise, dit là où on le cherche. Un devis et un bon de commande se
 * RÉVISENT (même numéro, nouvelle version). Une facture émise ne se réécrit pas : un AVOIR la corrige,
 * en totalité ou en partie, sous son propre numéro (§118.195). Un avoir non plus : il s'annule, motif à
 * l'appui, et un autre s'émet depuis la facture.
 */
export function remedePieceEmise(p: FaitsPieceEmise): string {
  if (p.type === "FACTURE") return `une facture émise ne se réécrit pas : « Émettre un avoir », sur sa fiche, la corrige en totalité ou en partie, sous son propre numéro.`;
  if (p.type === "AVOIR") return `un avoir émis ne se réécrit pas : annulez-le (motif à l'appui), puis émettez-en un autre depuis la fiche de la facture.`;
  return `« Réviser la pièce » en produit une nouvelle version, sous le même numéro — le fichier et la fiche restent d'accord.`;
}

/** Une pièce émise qui ne se RÉVISE pas : la facture et l'avoir, pièces fiscales — on les corrige par une autre pièce. */
export function pieceDefinitive(type: TypePieceEmise): type is "FACTURE" | "AVOIR" {
  return type === "FACTURE" || type === "AVOIR";
}

/** Le refus du formulaire générique sur un champ que le fichier porte — nommé, avec son remède (§118.30). */
export function refusChampsDuFichier(p: FaitsPieceEmise, champs: ChampDuFichier[]): string {
  const noms = liste(champs.map((c) => LIBELLE_CHAMP_DU_FICHIER[c]));
  const article = p.type === "FACTURE" ? "Cette facture a été émise" : p.type === "AVOIR" ? "Cet avoir a été émis" : "Cette pièce a été émise";
  return `${article} par la plateforme (${p.numero}) : ${noms} ${champs.length > 1 ? "viennent" : "vient"} de son fichier, et ce formulaire ne ${champs.length > 1 ? "les" : "le"} réécrit pas — ${remedePieceEmise(p)}`;
}

/**
 * CE QUI, EN AVAL, FIGE UNE PIÈCE ÉMISE (§118.194) — les natures du registre Legal qui DÉCOULENT d'elle
 * commercialement. Réviser un bon de commande déjà facturé changerait la commande sous la facture qui en
 * découle ; réviser un devis déjà commandé (ou facturé), le devis sous la pièce qui en découle. Un courrier ou
 * un contrat « faisant suite » à un bon de commande ne facture rien : il ne fige rien.
 */
export const AVAL_QUI_FIGE: Record<TypePieceEmise, readonly string[]> = {
  DEVIS: ["PURCHASE_ORDER", "INVOICE"],
  BON_DE_COMMANDE: ["INVOICE"],
  // Une facture et un avoir ne se révisent pas du tout (`pieceDefinitive`) : rien en aval n'a à les figer.
  FACTURE: [],
  AVOIR: [],
};

const NATURE_AVAL: Record<string, { article: string; nom: string }> = {
  INVOICE: { article: "Une facture", nom: "la facture" },
  PURCHASE_ORDER: { article: "Un bon de commande", nom: "le bon de commande" },
};

/**
 * Le refus d'une révision retenue par ce qui en découle — la nature de la pièce aval est NOMMÉE, jamais
 * supposée, et le geste qui lève le refus aussi : c'est la pièce aval qui se corrige, ou s'annule, et alors
 * l'amont redevient révisable.
 */
export function refusRevisionAval(type: TypePieceEmise, aval: { kind: string; reference: string | null }): string {
  const ref = aval.reference?.trim() ? ` (${aval.reference.trim()})` : "";
  const n = NATURE_AVAL[aval.kind] ?? { article: "Une pièce", nom: "la pièce" };
  const amont = type === "BON_DE_COMMANDE" ? "ce bon de commande" : "ce devis";
  const lui = type === "BON_DE_COMMANDE" ? "le bon de commande" : "le devis";
  return `${n.article} découle déjà de ${amont}${ref} : il ne se révise plus. Annulez d'abord ${n.nom} qui en découle — ${lui} redeviendra révisable.`;
}

/** Ce que l'écran de révision pré-remplit, lu dans la spécification de la version courante. */
export interface SpecRevisable {
  lignes: {
    designation: string; details: string[]; quantite: number; prixUnitaire: number;
    remise: number | null; tva: number | null; section: boolean;
  }[];
  objet: string | null;
  notes: string | null;
  validiteJours: number | null;
  livraison: { adresse: string | null; delai: string | null } | null;
  contact: { nom: string | null; telephone: string | null } | null;
}

const chaine = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const nombreOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * La spécification d'une pièce émise, telle que la révision la REPREND — `null` quand elle ne se lit pas.
 * Une ligne dont la désignation n'est pas un texte n'est pas inventée : elle est écartée, et la révision
 * ne la réécrira pas sans qu'on la voie.
 */
export function specRevisable(custom: unknown): SpecRevisable | null {
  if (!pieceEmise(custom)) return null;
  const spec = ((custom as { fabrique: { spec?: unknown } }).fabrique.spec ?? null) as Record<string, unknown> | null;
  if (!spec || typeof spec !== "object") return null;
  const brutes = Array.isArray(spec.lignes) ? spec.lignes : [];
  const lignes = brutes.flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const x = l as Record<string, unknown>;
    if (typeof x.designation !== "string") return [];
    return [{
      designation: x.designation,
      details: Array.isArray(x.details) ? x.details.filter((d): d is string => typeof d === "string") : [],
      quantite: nombreOuNull(x.quantite) ?? 0,
      prixUnitaire: nombreOuNull(x.prixUnitaire) ?? 0,
      remise: nombreOuNull(x.remise),
      tva: nombreOuNull(x.tva),
      section: x.section === true,
    }];
  });
  const liv = spec.livraison && typeof spec.livraison === "object" ? (spec.livraison as Record<string, unknown>) : null;
  const ctc = spec.contact && typeof spec.contact === "object" ? (spec.contact as Record<string, unknown>) : null;
  return {
    lignes,
    objet: chaine(spec.objet),
    notes: chaine(spec.notes),
    validiteJours: nombreOuNull(spec.validiteJours),
    livraison: liv ? { adresse: chaine(liv.adresse), delai: chaine(liv.delai) } : null,
    contact: ctc ? { nom: chaine(ctc.nom), telephone: chaine(ctc.telephone) } : null,
  };
}
