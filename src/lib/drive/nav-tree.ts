/**
 * L'ARBRE DU VOLET DE NAVIGATION, construit à partir d'une liste plate de dossiers.
 *
 * La base rend des dossiers avec leur parent ; l'écran a besoin d'un arbre. Entre les deux il y a
 * deux pièges, et ils se produisent pour de vrai :
 *   • un dossier dont le PARENT n'est pas dans la liste (le parent est hors de notre portée, ou la
 *     liste a été tronquée) — il ne doit pas disparaître, sinon des dossiers accessibles
 *     deviennent introuvables. On le raccroche à la racine de son emplacement ;
 *   • un CYCLE (A dans B, B dans A) : rare, mais une boucle infinie fige l'onglet. On coupe.
 *
 * Module PUR — testé.
 */

export interface FlatFolder {
  id: string;
  name: string;
  parentId: string | null;
  /** Catégorie d'appartenance ; `null` = espace personnel. */
  spaceId: string | null;
}

export interface TreeFolder extends FlatFolder {
  children: TreeFolder[];
  /** Profondeur d'affichage (0 = à la racine de son emplacement). */
  depth: number;
}

/** Au-delà, on cesse de descendre : un volet de navigation n'a jamais eu besoin de dix niveaux. */
export const MAX_TREE_DEPTH = 6;

/**
 * L'arbre des dossiers d'UN emplacement (`spaceId = null` pour l'espace personnel).
 *
 * Les enfants suivent l'ordre de la liste reçue — c'est-à-dire l'ordre alphabétique décidé par la
 * requête, le même que dans la liste principale.
 */
export function buildNavTree(folders: readonly FlatFolder[], spaceId: string | null): TreeFolder[] {
  const here = folders.filter((f) => (f.spaceId ?? null) === spaceId);
  const byId = new Map(here.map((f) => [f.id, f]));

  const childrenOf = new Map<string | null, FlatFolder[]>();
  for (const f of here) {
    // Parent hors de la liste → on le traite comme une racine : mieux vaut un dossier remonté
    // d'un cran qu'un dossier invisible.
    const key = f.parentId && byId.has(f.parentId) ? f.parentId : null;
    const list = childrenOf.get(key);
    if (list) list.push(f);
    else childrenOf.set(key, [f]);
  }

  const seen = new Set<string>();
  const build = (parentId: string | null, depth: number): TreeFolder[] => {
    if (depth >= MAX_TREE_DEPTH) return [];
    return (childrenOf.get(parentId) ?? [])
      .filter((f) => !seen.has(f.id)) // coupe les cycles : un dossier n'est rendu qu'une fois
      .map((f) => {
        seen.add(f.id);
        return { ...f, depth, children: build(f.id, depth + 1) };
      });
  };
  return build(null, 0);
}

/** Les identifiants des ancêtres d'un dossier, du plus proche au plus lointain. */
export function ancestorsOf(folders: readonly FlatFolder[], id: string): string[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: string[] = [];
  let cur = byId.get(id)?.parentId ?? null;
  while (cur && byId.has(cur) && !out.includes(cur) && out.length < MAX_TREE_DEPTH) {
    out.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}
