/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ARTIFACT COMMAND IR (§8) — la seule chose qu'un modèle a le droit de produire.
 *
 * ── LA LIGNE QUI NE SE FRANCHIT PAS (§9) ────────────────────────────────────────────────
 *
 * « Les modèles décident QUOI. Le code décide COMMENT. » Un modèle ne voit JAMAIS d'XML, ne
 * produit JAMAIS d'OOXML, ne touche JAMAIS un octet de PDF. Il produit une COMMANDE — un objet
 * plat, typé, borné — et un adaptateur déterministe la traduit en manipulation de fichier.
 *
 * La raison n'est pas esthétique. Un modèle qui écrirait du `w:jc w:val="center"` se tromperait
 * un jour sur l'ordre des enfants de `w:pPr`, et le fichier s'ouvrirait « corrompu » chez un
 * client, une fois sur cinquante, sans que rien ne l'ait signalé. Avec une commande, l'erreur
 * possible est « mauvaise cible » — visible, réversible, et rattrapée par le compilateur.
 *
 * ── POURQUOI UN OBJET PLAT PLUTÔT QU'UNE UNION IMBRIQUÉE ────────────────────────────────
 *
 * Les sorties structurées STRICTES exigent `additionalProperties:false` et un `required` qui
 * liste TOUTES les propriétés — une union discriminée à quarante formes différentes y devient
 * un schéma illisible que les modèles remplissent mal. Un objet plat où tout est nullable
 * s'exprime en un schéma simple ; c'est ensuite `compile.ts` qui REFUSE une commande dont les
 * champs obligatoires pour son `op` manquent. Le contrôle n'est pas perdu : il est déplacé du
 * schéma vers un compilateur qui a le droit d'expliquer POURQUOI il refuse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { ArtifactFormat } from "@/lib/artifact/object-model/model";

/**
 * COMMENT ON DÉSIGNE UNE CHOSE (§11).
 *
 * Quatre voies, essayées DANS CET ORDRE par le résolveur :
 *   `id`        — l'identifiant stable rendu par `inspect`. Sans ambiguïté ; c'est ce que
 *                 renvoie un clic dans le workspace, et ce que réutilise « encore un peu ».
 *   `index`     — le rang HUMAIN, 1-indexé : « le troisième paragraphe ».
 *   `contient`  — un fragment de texte : « le paragraphe qui parle de la rémunération ».
 *   `role`      — `titre` | `premier` | `dernier`.
 */
export interface Cible {
  id: string | null;
  index: number | null;
  contient: string | null;
  role: string | null;
  /**
   * La PAGE où chercher (1 = la première) — « le troisième paragraphe de la page 12 ». Quand
   * elle est donnée, `index` se compte À L'INTÉRIEUR de la page, et `contient` n'y cherche que
   * là. C'est ce qui rend un document de 300 pages adressable sans en réciter les 6 000
   * paragraphes. Pour un Word, la page vient de la dernière pagination enregistrée ou d'une
   * estimation (`DocxModel.paginationSource`).
   */
  page?: number | null;
}

export const CIBLE_VIDE: Cible = { id: null, index: null, contient: null, role: null, page: null };
export const ciblePage = (page: number, reste: Partial<Cible> = {}): Cible => ({ ...CIBLE_VIDE, ...reste, page });

export const cibleId = (id: string): Cible => ({ ...CIBLE_VIDE, id });
export const cibleIndex = (index: number): Cible => ({ ...CIBLE_VIDE, index });
export const cibleTexte = (contient: string): Cible => ({ ...CIBLE_VIDE, contient });
export const cibleRole = (role: "titre" | "premier" | "dernier"): Cible => ({ ...CIBLE_VIDE, role });

export const cibleVide = (c: Cible | null | undefined): boolean =>
  !c || (c.id === null && c.index === null && c.contient === null && c.role === null && (c.page === null || c.page === undefined));

/** Les opérations reconnues, par format. Une opération absente d'ici n'existe pas. */
export const OPS_DOCX = [
  "docx.align",
  "docx.format_texte",
  "docx.espacement",
  "docx.retrait",
  "docx.texte",
  "docx.inserer_paragraphe",
  "docx.supprimer_paragraphe",
  "docx.deplacer",
  "docx.remplacer_texte",
  "docx.cellule",
  "docx.inserer_ligne",
  "docx.supprimer_ligne",
  "docx.image_taille",
  "docx.supprimer_image",
] as const;

export const OPS_XLSX = [
  "xlsx.valeur",
  "xlsx.formule",
  "xlsx.format",
  "xlsx.largeur_colonne",
  "xlsx.inserer_ligne",
  "xlsx.supprimer_ligne",
  "xlsx.inserer_colonne",
  "xlsx.supprimer_colonne",
  "xlsx.figer",
  "xlsx.fusionner",
  "xlsx.trier",
  "xlsx.ajouter_feuille",
  "xlsx.renommer_feuille",
  "xlsx.supprimer_feuille",
] as const;

export const OPS_PPTX = [
  "pptx.texte",
  "pptx.format_texte",
  "pptx.deplacer",
  "pptx.position",
  "pptx.taille",
  "pptx.supprimer_forme",
  "pptx.supprimer_diapo",
  "pptx.deplacer_diapo",
  "pptx.dupliquer_diapo",
  "pptx.ajouter_diapo",
] as const;

export const OPS_PDF = [
  "pdf.supprimer_pages",
  "pdf.reordonner",
  "pdf.pivoter",
  "pdf.filigrane",
  "pdf.recadrer",
] as const;

export const OPS = [...OPS_DOCX, ...OPS_XLSX, ...OPS_PPTX, ...OPS_PDF] as const;
export type OpArtefact = (typeof OPS)[number];

export const OPS_PAR_FORMAT: Record<ArtifactFormat, readonly string[]> = {
  DOCX: OPS_DOCX,
  XLSX: OPS_XLSX,
  PPTX: OPS_PPTX,
  PDF: OPS_PDF,
};

/**
 * UNE COMMANDE. Tout est nullable sauf `op` ; `compile.ts` exige ensuite ce qu'il faut.
 *
 * Les unités sont celles dans lesquelles un humain PARLE : des points pour une police, des
 * centimètres pour une position, des degrés pour une rotation. Les EMU, twips et demi-points
 * de l'OOXML ne remontent jamais jusqu'ici.
 */
export interface CommandeArtefact {
  op: string;

  /** L'objet visé (paragraphe, tableau, forme, image). */
  cible: Cible | null;
  /** Second objet, pour les opérations qui en prennent deux (cellule d'un tableau visé). */
  cible2: Cible | null;

  // Mise en forme du texte — `null` = « ne touche pas à ça ».
  alignement: string | null;
  gras: boolean | null;
  italique: boolean | null;
  souligne: boolean | null;
  taillePt: number | null;
  police: string | null;
  couleur: string | null;

  // Géométrie, en centimètres.
  xCm: number | null;
  yCm: number | null;
  dxCm: number | null;
  dyCm: number | null;
  largeurCm: number | null;
  hauteurCm: number | null;
  avantPt: number | null;
  apresPt: number | null;
  gaucheCm: number | null;
  droiteCm: number | null;

  // Contenus.
  texte: string | null;
  chercher: string | null;
  remplacer: string | null;
  formule: string | null;
  formatNombre: string | null;
  remplissage: string | null;

  // Adressage tabulaire et paginé — TOUJOURS 1-indexé (§17).
  feuille: string | null;
  plage: string | null;
  ligne: number | null;
  colonne: number | null;
  pages: number[] | null;
  ordre: number[] | null;
  diapo: number | null;
  versIndex: number | null;

  // Divers.
  position: string | null;
  direction: string | null;
  pas: number | null;
  degres: number | null;
  opacite: number | null;
  tout: boolean | null;
  nom: string | null;
}

/** Gabarit d'une commande — sert à en construire une sans énumérer trente `null`. */
export const COMMANDE_VIDE: Omit<CommandeArtefact, "op"> = {
  cible: null, cible2: null,
  alignement: null, gras: null, italique: null, souligne: null, taillePt: null, police: null, couleur: null,
  xCm: null, yCm: null, dxCm: null, dyCm: null, largeurCm: null, hauteurCm: null,
  avantPt: null, apresPt: null, gaucheCm: null, droiteCm: null,
  texte: null, chercher: null, remplacer: null, formule: null, formatNombre: null, remplissage: null,
  feuille: null, plage: null, ligne: null, colonne: null, pages: null, ordre: null, diapo: null, versIndex: null,
  position: null, direction: null, pas: null, degres: null, opacite: null, tout: null, nom: null,
};

export function commande(op: string, champs: Partial<CommandeArtefact> = {}): CommandeArtefact {
  return { ...COMMANDE_VIDE, op, ...champs };
}

/** Le format auquel appartient une opération, ou `null` si l'opération est inconnue. */
export function formatDeLOp(op: string): ArtifactFormat | null {
  for (const f of Object.keys(OPS_PAR_FORMAT) as ArtifactFormat[]) {
    if (OPS_PAR_FORMAT[f].includes(op)) return f;
  }
  return null;
}
