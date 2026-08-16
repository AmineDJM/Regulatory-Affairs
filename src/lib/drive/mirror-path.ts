/**
 * OÙ ATTERRIT UN FICHIER IMPORTÉ, DANS LE DRIVE.
 *
 * On importe une pièce depuis un sponsoring, un appel d'offres, une demande RH — et elle
 * disparaît dans l'objet métier. Six semaines plus tard, on la cherche « dans le Drive », parce
 * que c'est là qu'on cherche les fichiers. Elle n'y est pas : elle est restée accrochée à sa
 * demande. Le Drive doit donc recevoir une copie de TOUT ce qui entre dans l'ERP, rangée là où
 * on la cherchera : par module, puis par objet.
 *
 * Ce module ne fait que dire OÙ. Il ne touche ni à la base, ni au stockage — d'où les tests.
 */

import { ENTITY_TYPE_LABELS } from "@/lib/labels";

/** La boîte, à la racine du Drive de celui qui importe. Une seule, pas une par module. */
export const IMPORT_DRIVE_ROOT = "Mes documents importés";

/**
 * Les types d'objet qui ont DÉJÀ leur miroir, plus riche que celui-ci — on ne double pas.
 *
 * Regulatory range par produit et partage avec les parties prenantes du dossier ; le refaire ici
 * créerait deux copies du même fichier à deux endroits, et c'est exactement ce qui fait perdre
 * confiance dans un drive.
 */
const ALREADY_MIRRORED = new Set(["REGULATORY_PRODUCT", "DRIVE_NODE"]);

/** Ce téléversement doit-il aussi atterrir dans le Drive de celui qui importe ? */
export function shouldMirrorToDrive(entityType: string): boolean {
  return Boolean(entityType) && !ALREADY_MIRRORED.has(entityType);
}

/**
 * Un nom de dossier acceptable : pas de séparateur (qui fabriquerait une arborescence fantôme),
 * pas de caractère de contrôle, pas de nom vide, et une longueur qui reste lisible dans une liste.
 */
export function safeFolderName(raw: string, fallback = "Sans nom"): string {
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  // Un nom qui ne contient ni lettre ni chiffre (« --- », « … ») n'est pas un nom : il occupe une
  // ligne dans la liste sans rien apprendre. On préfère le repli, qui dit au moins de quoi il s'agit.
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return fallback;
  return cleaned.slice(0, 120).trim() || fallback;
}

/**
 * Le chemin du dossier d'accueil : « Mes documents importés / <module> / <objet> ».
 *
 * L'objet porte sa référence quand il en a une (« SPO-2026-014 ») — c'est ce que la personne a
 * sous les yeux dans l'écran d'où elle importe. Sans référence, on retombe sur un identifiant
 * abrégé : moins parlant, mais au moins deux demandes différentes ne se mélangent pas.
 */
export function importFolderPath(entityType: string, reference: string | null | undefined, entityId: string): string[] {
  const moduleName = safeFolderName(ENTITY_TYPE_LABELS[entityType] ?? entityType, "Autres");
  const ref = (reference ?? "").trim();
  const objectName = safeFolderName(ref || `Dossier ${entityId.slice(0, 8)}`, `Dossier ${entityId.slice(0, 8)}`);
  return [IMPORT_DRIVE_ROOT, moduleName, objectName];
}
