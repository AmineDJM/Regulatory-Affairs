/**
 * LES TROIS CHAMPS QUI NE SE MODIFIENT PAS À LA LÉGÈRE.
 *
 * Un dossier réglementaire a des dizaines de champs, et presque tous se corrigent au fil de
 * l'eau : un dosage, un conditionnement, un commentaire. Trois font exception, parce qu'ils ne
 * décrivent pas le produit — ils décident de ce qu'il ENGAGE :
 *
 *   • **le statut de fabrication** (Importation → packaging secondaire → primaire → full process)
 *     dit ce que la société s'engage à faire industriellement. Il commande les investissements,
 *     les délais, l'argumentaire devant l'agence. Le corriger « pour voir » n'existe pas ;
 *   • **le chargé du dossier** : c'est un engagement pris au nom de quelqu'un ;
 *   • **l'entité** : elle détermine QUI a le droit de voir le dossier. La changer, c'est le
 *     déplacer d'une société à une autre, donc le montrer à des gens et le cacher à d'autres.
 *
 * Ces trois-là appartiennent au **SUPER ADMIN**, et à personne d'autre — ni la Direction, ni le
 * responsable Regulatory, ni le porteur du dossier. Le reste de la fiche demeure ouvert à qui a
 * le droit de la modifier : on ne fige pas un dossier, on protège trois décisions.
 *
 * Et parce qu'une décision prise ailleurs sans être dite est une décision perdue : quand le Super
 * Admin en change une, **le chargé du dossier est prévenu**. C'est lui qui répondra à l'agence.
 *
 * Module PUR — testé, sans base de données.
 */

export const STRUCTURAL_FIELDS = ["manufacturingStatus", "responsibleId", "companyId"] as const;
export type StructuralField = (typeof STRUCTURAL_FIELDS)[number];

export const STRUCTURAL_LABELS: Record<StructuralField, string> = {
  manufacturingStatus: "Statut de fabrication",
  responsibleId: "Chargé du dossier",
  companyId: "Entité",
};

/**
 * Qui peut les poser. Le RÔLE PRINCIPAL seul, comme pour le cadenas des dossiers : une règle
 * restrictive qui s'ouvrirait par un rôle secondaire cumulé ne serait plus une règle.
 */
export function canSetStructural(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN";
}

export interface StructuralValues {
  manufacturingStatus: string | null;
  responsibleId: string | null;
  companyId: string | null;
}

export interface StructuralChange {
  field: StructuralField;
  label: string;
  /** Valeurs LISIBLES (« Importation », « Pharmagène », un nom de personne) — pas des identifiants. */
  from: string;
  to: string;
}

/**
 * Ce qui change réellement, une fois les valeurs comparées.
 *
 * Un champ ABSENT du formulaire n'est pas une remise à zéro : les écrans envoient des sous-
 * ensembles de la fiche, et traiter « non transmis » comme « effacé » viderait la moitié du
 * dossier à chaque enregistrement partiel. Seul un champ PRÉSENT et DIFFÉRENT compte.
 */
export function structuralChanges(
  before: StructuralValues,
  after: Partial<StructuralValues>,
  display: (field: StructuralField, value: string | null) => string,
): StructuralChange[] {
  const out: StructuralChange[] = [];
  for (const field of STRUCTURAL_FIELDS) {
    if (!(field in after)) continue;
    const next = after[field] ?? null;
    const prev = before[field] ?? null;
    if (next === prev) continue;
    out.push({ field, label: STRUCTURAL_LABELS[field], from: display(field, prev), to: display(field, next) });
  }
  return out;
}

/**
 * Le refus, qui NOMME ce qu'il refuse.
 *
 * « Modification non autorisée » sur un formulaire de trente champs envoie chercher lequel a
 * fâché le serveur. On dit lesquels, et qui peut les changer — sinon la personne réessaie.
 */
export function structuralRefusal(changes: readonly StructuralChange[]): string {
  const names = changes.map((c) => c.label);
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  return `${list} : seul le Super Admin peut les modifier. Le reste de la fiche a été laissé tel quel.`;
}

/** La notification envoyée au chargé du dossier. Elle dit l'AVANT et l'APRÈS, pas « mis à jour ». */
export function structuralNotice(
  reference: string,
  dci: string,
  changes: readonly StructuralChange[],
): { title: string; body: string } | null {
  if (changes.length === 0) return null;
  const detail = changes.map((c) => `${c.label} : ${c.from} → ${c.to}`).join(" · ");
  return {
    title: changes.length === 1 && changes[0].field === "manufacturingStatus"
      ? "Statut de fabrication mis à jour"
      : "Votre dossier a été mis à jour",
    body: `${reference} — ${dci} · ${detail}`,
  };
}
