/**
 * LE PAPIER EN-TÊTE — qui le tient, ce qu'il accepte, et ce qu'on en fait.
 *
 * Un en-tête n'est pas une image qu'on colle en haut d'une page : c'est un DOCUMENT déjà mis en
 * page — marges, pied de page, police, mentions légales, logo à la bonne taille. Le stocker
 * comme un vrai fichier Office et en recopier les octets donne un résultat identique au modèle,
 * sans conversion ni approximation. Toute autre approche (injecter une image, fusionner deux
 * documents) produit des décalages qu'on ne découvre qu'à l'impression, chez le destinataire.
 *
 * Module PUR — testé, sans base de données.
 */

import type { OfficeKind } from "@/lib/office-templates";

/**
 * QUI TIENT LA PAPETERIE DE LA SOCIÉTÉ.
 *
 * L'assistante de direction, et l'encadrement au-dessus d'elle. Ce n'est pas un droit de module
 * (« qui peut créer un document Word ») mais une responsabilité : un en-tête erroné part sur
 * tous les courriers de la société avant que quiconque le remarque.
 *
 * Liste EXPLICITE plutôt qu'un droit dérivé : on doit pouvoir lire, en une ligne, qui peut
 * changer le papier à en-tête d'Adventum.
 */
const LETTERHEAD_MANAGER_ROLES: readonly string[] = [
  "SUPER_ADMIN",
  "DIRECTION",
  "GENERAL_MANAGER",
  "DIRECTION_ASSISTANT",
];

export function canManageLetterheads(user: { role: string; secondaryRole?: string | null }): boolean {
  return [user.role, user.secondaryRole]
    .filter(Boolean)
    .some((r) => LETTERHEAD_MANAGER_ROLES.includes(r as string));
}

/** Extension attendue par type de document. */
export const KIND_EXTENSION: Record<OfficeKind, string> = {
  word: "docx",
  cell: "xlsx",
  slide: "pptx",
};

export const KIND_LABEL: Record<OfficeKind, string> = {
  word: "Word",
  cell: "Excel",
  slide: "PowerPoint",
};

/**
 * Le fichier téléversé correspond-il au type annoncé ?
 *
 * Un en-tête Word rangé sous « Excel » ne s'ouvrirait pas — et l'erreur ne se verrait qu'au
 * moment où quelqu'un crée un document en urgence. On refuse à la porte, avec le motif.
 */
export function validateLetterheadFile(kind: OfficeKind, filename: string): string | null {
  const expected = KIND_EXTENSION[kind];
  const lower = filename.toLowerCase();
  if (!lower.endsWith(`.${expected}`)) {
    return `Un en-tête ${KIND_LABEL[kind]} doit être un fichier .${expected} — « ${filename} » n'en est pas un.`;
  }
  return null;
}

/**
 * Les en-têtes proposés pour un type de document et une entité.
 *
 * Ceux de l'entité d'abord, puis les communs (sans entité) : on écrit presque toujours sur le
 * papier de SA société, et faire descendre le bon choix en troisième position, c'est le faire
 * manquer un jour de presse.
 */
export function letterheadsFor<T extends { kind: string; companyId: string | null; isActive: boolean }>(
  all: T[],
  kind: OfficeKind,
  companyId: string | null,
): T[] {
  const usable = all.filter((l) => l.isActive && l.kind === kind);
  const own = usable.filter((l) => l.companyId && l.companyId === companyId);
  const shared = usable.filter((l) => !l.companyId);
  const others = usable.filter((l) => l.companyId && l.companyId !== companyId);
  return [...own, ...shared, ...others];
}

/** Le nom du fichier créé — on garde celui que la personne a saisi, jamais celui du modèle. */
export function documentName(base: string, kind: OfficeKind): string {
  const ext = KIND_EXTENSION[kind];
  const clean = base.replace(/\.(docx|xlsx|pptx)$/i, "").trim() || "Document";
  return `${clean}.${ext}`;
}
