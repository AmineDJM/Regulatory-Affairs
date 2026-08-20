/**
 * LA RECHERCHE DU DRIVE — retrouver un fichier dont on a oublié le dossier.
 *
 * C'est le cas normal, pas l'exception : on se souvient d'un mot du nom, jamais du chemin. Sans
 * recherche, la seule issue est de rouvrir les dossiers un par un — et l'on finit par redemander
 * le fichier à la personne qui l'a déposé, ou par le re-téléverser en double.
 *
 * Trois décisions gouvernent ce module :
 *
 *   • on cherche SUR TOUT le Drive visible, pas dans le dossier courant. Chercher là où l'on est
 *     déjà ne sert à rien : si l'on savait où regarder, on n'aurait pas besoin de chercher ;
 *   • le RÉSULTAT PORTE SON CHEMIN. Une liste de noms sans emplacement oblige à ouvrir chaque
 *     ligne pour comprendre laquelle est la bonne — surtout quand trois dossiers contiennent un
 *     « Contrat.docx » ;
 *   • le classement est par PERTINENCE, pas par date. Le nom exact d'abord, puis ce qui commence
 *     par le terme, puis ce qui le contient. Trier par date remonterait le fichier touché ce
 *     matin devant celui qu'on nomme précisément.
 *
 * Module PUR — testé, sans base de données.
 */

/** En deçà, on ne cherche pas : deux lettres ramèneraient la moitié du Drive. */
export const MIN_QUERY = 2;

/**
 * Sans accent, sans casse — personne ne tape les accents dans une recherche.
 *
 * `NFD` sépare la lettre de son accent (« é » → « e » + ´), et l'on jette la seconde moitié. La
 * plage U+0300–U+036F est celle des signes diacritiques combinants ; elle est écrite en échappé
 * plutôt qu'avec les caractères eux-mêmes, qui sont invisibles dans un éditeur et se perdent au
 * premier copier-coller.
 */
export function fold(raw: string): string {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** La saisie, nettoyée. Rend `null` quand elle est trop courte pour chercher. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim();
  return q.length >= MIN_QUERY ? q : null;
}

export function matchesQuery(name: string, query: string): boolean {
  return fold(name).includes(fold(query));
}

/**
 * La PERTINENCE d'un résultat — plus le chiffre est petit, plus il remonte.
 *
 * 0 le nom exact · 1 ce qui commence par le terme · 2 un MOT qui commence par le terme
 * (« rapport » trouve « Bilan rapport 2026 ») · 3 le reste. Sans le rang 2, un fichier dont le
 * terme est le deuxième mot se retrouve derrière tous les « xxx-rapport-xxx » automatiques.
 */
export function rankHit(name: string, query: string): number {
  const n = fold(name);
  const q = fold(query);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  // Un mot commence par le terme : on découpe sur ce qui sépare des mots dans un nom de fichier.
  if (n.split(/[\s._\-/(),[\]]+/).some((w) => w.startsWith(q))) return 2;
  return 3;
}

export interface SearchHit {
  id: string;
  name: string;
  isFile: boolean;
  updatedAt: string;
  /** Le chemin lisible — « Drive › Contrats › 2026 ». Ce que la personne a oublié. */
  path: string;
}

/**
 * Le classement final : pertinence, puis les DOSSIERS avant les fichiers à pertinence égale
 * (ouvrir le dossier montre tout ce qu'il contient — c'est souvent la réponse), puis le plus
 * récemment touché.
 */
export function sortHits<T extends SearchHit>(hits: readonly T[], query: string): T[] {
  return [...hits].sort((a, b) => {
    const r = rankHit(a.name, query) - rankHit(b.name, query);
    if (r !== 0) return r;
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * Le chemin d'un nœud, écrit comme on le lit.
 *
 * La racine est nommée : sans elle, un fichier posé à la racine n'aurait AUCUN chemin, et l'on
 * croirait à un affichage manquant plutôt qu'à un fichier bien rangé au premier niveau.
 */
export function describePath(rootLabel: string, segments: readonly string[]): string {
  return [rootLabel, ...segments].join(" › ");
}

/** « 3 résultats pour « contrat » » — ou l'absence, dite clairement. */
export function searchSummary(count: number, query: string): string {
  if (count === 0) return `Aucun résultat pour « ${query} ».`;
  return `${count} résultat${count > 1 ? "s" : ""} pour « ${query} ».`;
}
