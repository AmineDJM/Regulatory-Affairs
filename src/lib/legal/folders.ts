/**
 * LES DOSSIERS DE CLASSEMENT DE LEGAL — l'armoire, pas le classeur.
 *
 * Trois cents contrats dans une seule liste se cherchent au filtre, jamais au regard. On sait
 * qu'un bail existe, on ne sait pas comment il s'intitule exactement — et c'est précisément le
 * cas où un filtre par titre ne sert à rien. Les dossiers rendent au module la structure qu'ont
 * les armoires réelles : « Baux », « Assurances », « Prestataires 2026 ».
 *
 * ⚠️ UN DOSSIER NE PORTE AUCUN DROIT. La restriction d'un engagement reste sur lui — ses
 * lecteurs désignés — et sur son entité. Un dossier qui donnerait accès à son contenu ferait
 * qu'y ranger une pièce l'ouvrirait à d'autres : exactement le contraire de ce que le classement
 * doit faire. Le dossier range, il n'autorise pas.
 *
 * Module PUR — testé, sans base de données.
 */

export interface FolderLite {
  id: string;
  name: string;
  parentId: string | null;
  companyId?: string | null;
}

export interface FolderNode extends FolderLite {
  children: FolderNode[];
  /** Profondeur, pour l'indentation d'une liste à plat. */
  depth: number;
}

/**
 * L'arbre des dossiers, dans l'ordre alphabétique à chaque niveau.
 *
 * Un dossier dont le parent a disparu de la liste (filtré par entité, par exemple) est remonté
 * à la racine plutôt qu'escamoté : le faire disparaître avec son parent cacherait son contenu
 * sans que rien ne le signale, et l'on chercherait un contrat qui n'apparaît nulle part.
 */
export function buildFolderTree(folders: FolderLite[]): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, { ...f, children: [] as FolderNode[], depth: 0 }]));
  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: FolderNode[], depth: number): FolderNode[] => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    for (const n of nodes) {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    }
    return nodes;
  };
  return sortRec(roots, 0);
}

/** L'arbre aplati, parents avant enfants — ce qu'un menu déroulant sait afficher. */
export function flattenFolders(nodes: FolderNode[], out: FolderNode[] = []): FolderNode[] {
  for (const n of nodes) {
    out.push(n);
    flattenFolders(n.children, out);
  }
  return out;
}

/**
 * Le chemin d'un dossier, de la racine jusqu'à lui — le fil d'Ariane.
 *
 * Protégé contre les cycles : une donnée abîmée (un dossier devenu son propre ancêtre) doit
 * rendre un chemin tronqué, pas figer la page.
 */
export function folderPath(folders: FolderLite[], id: string | null): FolderLite[] {
  if (!id) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: FolderLite[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Les identifiants d'un dossier ET de toute sa descendance. */
export function subtreeIds(folders: FolderLite[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    childrenOf.set(f.parentId, [...(childrenOf.get(f.parentId) ?? []), f.id]);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return out;
}

/**
 * Un dossier peut-il devenir l'enfant d'un autre ?
 *
 * Non s'il s'agit de lui-même ou de l'un de ses propres descendants : on créerait une boucle,
 * et le dossier — avec tout ce qu'il contient — disparaîtrait de l'arborescence.
 */
export function canReparent(folders: FolderLite[], id: string, newParentId: string | null): boolean {
  if (!newParentId) return true;
  if (newParentId === id) return false;
  return !subtreeIds(folders, id).includes(newParentId);
}

/**
 * Ce que la suppression d'un dossier emporte, dit avant de cliquer.
 *
 * Les SOUS-DOSSIERS partent avec lui — ils n'ont pas de sens sans leur parent. Les DOCUMENTS,
 * eux, sont déclassés et jamais supprimés : ranger un engagement dans un dossier ne doit pas
 * offrir un moyen de le faire disparaître.
 */
export function deletionSummary(counts: { subfolders: number; documents: number }): string {
  const parts: string[] = [];
  if (counts.subfolders > 0) parts.push(`${counts.subfolders} sous-dossier(s) seront supprimés`);
  parts.push(
    counts.documents > 0
      ? `${counts.documents} document(s) repasseront « non classés » — aucun n'est supprimé`
      : "aucun document n'y est rangé",
  );
  return parts.join(" · ");
}

/** Le libellé d'un dossier dans un menu, indenté selon sa profondeur. */
export function indentedLabel(node: FolderNode): string {
  return `${"  ".repeat(node.depth)}${node.depth > 0 ? "└ " : ""}${node.name}`;
}
