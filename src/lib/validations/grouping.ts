/**
 * UNE DEMANDE = UNE DEMANDE.
 *
 * Une demande du Bureau du secrétariat porte plusieurs pièces, et chaque pièce peut être
 * soumise séparément à validation. Techniquement, cela crée une demande de validation PAR
 * PIÈCE — c'est ce qu'il faut pour que deux validateurs différents se prononcent sur la facture
 * et sur le bon de commande. Mais du côté de celui qui a demandé, l'écran affichait alors
 * quatre « demandes de validation » là où il n'en avait déposé qu'une, chacune avec son propre
 * statut. Résultat : une facture acceptée se lisait « Validation acceptée », et on croyait la
 * demande entière tranchée alors que trois pièces attendaient encore.
 *
 * Ce module regroupe. La demande d'origine redevient l'unité de lecture ; les validations de
 * pièces deviennent ce qu'elles sont — le détail à l'intérieur. Et le statut affiché est celui
 * du TOUT, jamais celui de la pièce la plus avancée.
 *
 * Module PUR — testé.
 */

export type ValidationStatusLike = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface GroupableValidation {
  id: string;
  reference: string;
  title: string;
  status: string;
  createdAt: string;
  /** Porte-t-elle sur l'objet entier, ou sur UNE pièce jointe ? */
  scope: "OBJECT" | "DOCUMENT";
  /** Objet parent (« ADMIN_REQUEST:xxx ») — ce qui permet de regrouper. */
  parentKey: string | null;
  /** Nom de la pièce visée, quand il s'agit d'une validation de pièce. */
  documentName?: string | null;
}

export interface ValidationGroup<T extends GroupableValidation = GroupableValidation> {
  key: string;
  /** Le titre de la DEMANDE, pas celui d'une pièce. */
  title: string;
  /** La demande portant sur l'objet entier, quand elle existe. */
  main: T | null;
  /** Les validations de pièces rattachées, les plus récentes d'abord. */
  pieces: T[];
  /** Statut du TOUT — voir `groupStatus`. */
  status: ValidationStatusLike;
  /** Date de la plus ancienne demande du groupe (l'ancienneté réelle). */
  createdAt: string;
  /** Phrase qui lève l'ambiguïté : « 3 pièces — 2 acceptées, 1 en attente ». */
  summary: string;
}

const norm = (s: string): ValidationStatusLike =>
  s === "APPROVED" || s === "REJECTED" || s === "CHANGES_REQUESTED" ? s : "PENDING";

/**
 * Le statut d'un ENSEMBLE de validations.
 *
 * L'ordre des questions n'est pas neutre : tant qu'une seule attend, rien n'est tranché — dire
 * « accepté » parce que deux pièces sur trois le sont ferait exactement l'erreur qu'on corrige.
 * Vient ensuite le refus (une pièce refusée bloque la demande telle qu'elle a été déposée), puis
 * la demande de modification, et seulement en dernier l'acceptation.
 */
export function groupStatus(statuses: readonly string[]): ValidationStatusLike {
  if (statuses.length === 0) return "PENDING";
  const s = statuses.map(norm);
  if (s.includes("PENDING")) return "PENDING";
  if (s.includes("REJECTED")) return "REJECTED";
  if (s.includes("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  return "APPROVED";
}

/** Le décompte, dit en français, pièce par pièce. Vide s'il n'y a aucune pièce à compter. */
export function pieceSummary(pieces: readonly { status: string }[]): string {
  if (pieces.length === 0) return "";
  const count = (st: ValidationStatusLike) => pieces.filter((p) => norm(p.status) === st).length;
  const parts: string[] = [];
  const approved = count("APPROVED");
  const pending = count("PENDING");
  const rejected = count("REJECTED");
  const changes = count("CHANGES_REQUESTED");
  if (approved) parts.push(`${approved} acceptée${approved > 1 ? "s" : ""}`);
  if (pending) parts.push(`${pending} en attente`);
  if (rejected) parts.push(`${rejected} refusée${rejected > 1 ? "s" : ""}`);
  if (changes) parts.push(`${changes} à revoir`);
  return `${pieces.length} pièce${pieces.length > 1 ? "s" : ""} — ${parts.join(", ")}`;
}

/**
 * Regroupe les validations par DEMANDE D'ORIGINE.
 *
 * Une validation sans objet parent reste seule dans son groupe : c'est bien une demande à part
 * entière, et la fondre avec une autre serait aussi trompeur que l'inverse.
 *
 * L'ordre est celui de la plus récente activité, comme avant — on ne réorganise pas la liste
 * sous prétexte de la regrouper.
 */
export function groupValidations<T extends GroupableValidation>(items: readonly T[]): ValidationGroup<T>[] {
  const groups = new Map<string, ValidationGroup<T>>();
  const order: string[] = [];

  for (const item of items) {
    // Sans parent, la demande EST le groupe : sa propre clé, qui ne peut en attirer aucune autre.
    const key = item.parentKey ?? `self:${item.id}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, title: item.title, main: null, pieces: [], status: "PENDING", createdAt: item.createdAt, summary: "" };
      groups.set(key, g);
      order.push(key);
    }
    if (item.scope === "DOCUMENT") g.pieces.push(item);
    else g.main = g.main ?? item;
    if (item.createdAt < g.createdAt) g.createdAt = item.createdAt;
  }

  for (const g of groups.values()) {
    // Le titre du groupe vient de la demande entière quand elle existe. Sinon, du titre de la
    // première pièce — qui porte déjà la référence de la demande (« Pièce « X » — DEM-2026-007 »).
    g.title = g.main?.title ?? g.pieces[0]?.title ?? g.title;
    g.status = groupStatus([...(g.main ? [g.main.status] : []), ...g.pieces.map((p) => p.status)]);
    g.summary = pieceSummary(g.pieces);
  }

  return order.map((k) => groups.get(k)!);
}
