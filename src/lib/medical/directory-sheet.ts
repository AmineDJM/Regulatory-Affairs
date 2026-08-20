/**
 * L'ANNUAIRE EN FORMAT FEUILLE — export, et surtout IMPORT INTELLIGENT.
 *
 * Les annuaires arrivent de partout : un fichier du délégué, un export d'un ancien outil, une
 * liste envoyée par un partenaire. Aucun n'a nos en-têtes. Exiger « Nom | Grade | Spécialité »
 * dans cet ordre exact revient à demander à quelqu'un de ressaisir 400 lignes — donc à ne
 * jamais importer, et à garder l'annuaire dans un classeur à part.
 *
 * Ce module RECONNAÎT les colonnes. « Médecin », « Nom du praticien », « NOM ET PRENOM »,
 * « Docteur » désignent tous le nom ; « Wilaya », « Ville », « Commune » désignent tous la
 * ville. La reconnaissance est déterministe et testée : elle ne dépend d'aucun service externe
 * et donne toujours le même résultat sur le même fichier. Les en-têtes qu'elle ne reconnaît pas
 * sont RENDUS à l'appelant plutôt qu'ignorés — c'est ce qui permet de les faire trancher
 * (par l'IA, ou par un humain) au lieu de perdre une colonne en silence.
 *
 * Les valeurs aussi sont reconnues : « Pr », « professeur », « PROFESSEUR » donnent le même
 * grade ; « privé », « libéral », « cabinet » le même secteur. Un fichier réel n'écrit jamais
 * nos codes internes.
 *
 * Module PUR — testé. Aucun accès base, aucune lecture de fichier : il reçoit des lignes déjà
 * lues et rend des lignes prêtes à écrire.
 */

import { resolveWilaya } from "./wilaya";

/** Colonne de l'annuaire, telle qu'on l'exporte et telle qu'on la reconnaît à l'import. */
export interface DirectoryColumn {
  key: DirectoryField;
  /** En-tête écrit dans le classeur exporté. */
  header: string;
  /** Autres écritures acceptées à l'import (normalisées : sans accent, sans casse). */
  aliases: string[];
}

export type DirectoryField =
  | "name" | "lastName" | "firstName"
  | "title" | "specialty" | "sector" | "institution"
  | "address" | "city" | "wilaya" | "postalCode" | "region"
  | "phone" | "email" | "influence" | "potential" | "affinity" | "targetProducts"
  | "delegate" | "comments";

export const DIRECTORY_COLUMNS: DirectoryColumn[] = [
  // NOM COMPLET en une seule colonne — la forme la plus répandue dans les fichiers reçus.
  { key: "name", header: "Nom complet", aliases: ["nom et prenom", "nom & prenom", "prenom et nom", "praticien", "medecin", "docteur", "nom du medecin", "nom du praticien", "pharmacien", "nom prenom"] },
  // NOM et PRÉNOM SÉPARÉS — les colonnes de NOTRE écran, et donc de notre propre export. Leur
  // absence de cette liste était le défaut principal : un fichier exporté puis réimporté perdait
  // le nom, le prénom et l'adresse, qui restaient vides à l'écran alors qu'ils étaient bien là.
  { key: "lastName", header: "Nom", aliases: ["nom de famille", "last name"] },
  { key: "firstName", header: "Prénom", aliases: ["prenom", "prenoms", "first name"] },
  { key: "title", header: "Grade", aliases: ["titre", "qualite", "fonction", "grade universitaire", "statut"] },
  { key: "specialty", header: "Spécialité", aliases: ["specialite", "specialite 1", "discipline", "service"] },
  { key: "sector", header: "Secteur", aliases: ["type d exercice", "exercice", "public prive", "prive public", "secteur d activite"] },
  { key: "institution", header: "Établissement", aliases: ["etablissement", "hopital", "clinique", "structure", "officine", "lieu d exercice", "ehs", "chu"] },
  { key: "address", header: "Adresse", aliases: ["adresse", "adresse complete", "rue", "adresse du cabinet", "adresse professionnelle", "lieu"] },
  { key: "city", header: "Ville", aliases: ["commune", "localite", "agglomeration"] },
  // LA WILAYA A SA PROPRE COLONNE. Elle était un simple alias de « Ville » : un fichier portant
  // les deux perdait la wilaya, et le comptage par territoire — la raison d'être de ce champ —
  // ne fonctionnait plus.
  { key: "wilaya", header: "Wilaya", aliases: ["wilaya", "w", "departement", "willaya", "code wilaya"] },
  { key: "postalCode", header: "Code postal", aliases: ["code postal", "cp", "zip", "code post"] },
  { key: "region", header: "Région", aliases: ["region", "zone", "secteur geographique", "territoire"] },
  { key: "phone", header: "Téléphone", aliases: ["telephone", "tel", "mobile", "gsm", "portable", "numero", "n tel", "numero de telephone", "num tel", "contact", "coordonnees"] },
  { key: "email", header: "E-mail", aliases: ["email", "e mail", "mail", "courriel", "adresse mail"] },
  { key: "influence", header: "Influence", aliases: ["niveau d influence", "kol", "leader d opinion"] },
  { key: "potential", header: "Potentiel", aliases: ["potentiel de prescription", "prescription", "potentiel prescripteur"] },
  { key: "affinity", header: "Affinité", aliases: ["affinite", "relation", "proximite"] },
  { key: "targetProducts", header: "Produits ciblés", aliases: ["produits cibles", "produits", "portefeuille", "gamme"] },
  { key: "delegate", header: "Délégué", aliases: ["delegue", "visiteur medical", "vm", "responsable", "charge de secteur"] },
  { key: "comments", header: "Commentaires", aliases: ["commentaire", "remarques", "notes", "observation", "observations"] },
];

/**
 * Normalise un en-tête pour la comparaison : sans accents, sans ponctuation, en minuscules,
 * espaces réduits. « N° Tél. » et « n tel » deviennent la même chose — ce qui est bien le but.
 */
export function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** À quelle colonne de l'annuaire correspond cet en-tête ? `null` si on ne sait pas. */
export function matchColumn(header: unknown): DirectoryField | null {
  const n = normalizeHeader(header);
  if (!n) return null;
  for (const col of DIRECTORY_COLUMNS) {
    if (normalizeHeader(col.header) === n) return col.key;
    if (col.aliases.some((a) => normalizeHeader(a) === n)) return col.key;
  }
  // Repli PRUDENT : on n'accepte une correspondance partielle que si l'en-tête CONTIENT le
  // nom canonique en entier. « nom du service » ne doit pas devenir « Nom » — d'où l'ordre :
  // l'égalité stricte d'abord, ce repli seulement ensuite, et jamais l'inverse.
  for (const col of DIRECTORY_COLUMNS) {
    const canon = normalizeHeader(col.header);
    if (canon.length >= 4 && n.split(" ").includes(canon)) return col.key;
  }
  return null;
}

/**
 * La correspondance colonne par colonne d'un en-tête de fichier.
 *
 * Une même cible ne se prend qu'UNE fois : deux colonnes « Nom » et « Nom complet » ne doivent
 * pas s'écraser l'une l'autre — la première l'emporte, la seconde rejoint les non reconnues.
 */
export function mapHeaderRow(headers: readonly unknown[]): {
  mapping: (DirectoryField | null)[];
  matched: DirectoryField[];
  unknown: { index: number; header: string }[];
} {
  const mapping: (DirectoryField | null)[] = [];
  const taken = new Set<DirectoryField>();
  const unknown: { index: number; header: string }[] = [];
  headers.forEach((h, i) => {
    const field = matchColumn(h);
    if (field && !taken.has(field)) {
      taken.add(field);
      mapping.push(field);
    } else {
      mapping.push(null);
      const label = String(h ?? "").trim();
      if (label) unknown.push({ index: i, header: label });
    }
  });
  return { mapping, matched: [...taken], unknown };
}

const tidy = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

/** Le grade, reconnu depuis ce qu'un humain écrit réellement. */
export function titleFrom(raw: unknown): string {
  const n = normalizeHeader(raw);
  if (!n) return "AUTRE";
  if (/(^|\s)(pr|prof|professeur)(\s|$)/.test(n)) return "PROFESSEUR";
  if (n.includes("maitre de conference") || n.includes("maitre conference") || n === "mca") return "MAITRE_CONFERENCES";
  if (n.includes("maitre assistant") || n === "ma") return "MAITRE_ASSISTANT";
  // « Chef de service » AVANT « spécialiste » : un chef de service EST un spécialiste, et la
  // règle la plus précise doit gagner — sinon la fonction disparaît au profit du grade.
  if (n.includes("chef de service") || n.includes("chef service") || n === "cds") return "CHEF_DE_SERVICE";
  if (n.includes("specialiste") || n.includes("praticien specialiste")) return "PRATICIEN_SPECIALISTE";
  if (n.includes("resident")) return "RESIDENT";
  if (n.includes("assistant")) return "ASSISTANT";
  if (n.includes("generaliste") || n === "mg") return "GENERALISTE";
  if (n.includes("pharmacien") || n.includes("officine")) return "PHARMACIEN";
  // « Dr » seul ne dit pas le grade : c'est une civilité, pas une fonction.
  return "AUTRE";
}

/** Le secteur d'exercice — hôpital, libéral, ou les deux. */
export function sectorFrom(raw: unknown): string {
  const n = normalizeHeader(raw);
  const pub = /(hopital|hospitalier|public|chu|ehs|epsp|eph|clinique publique)/.test(n);
  const priv = /(liberal|prive|cabinet|officine|clinique privee)/.test(n);
  if (pub && priv) return "BOTH";
  if (priv) return "LIBERAL";
  if (pub) return "HOSPITAL";
  if (n.includes("les deux") || n.includes("mixte")) return "BOTH";
  return "LIBERAL";
}

/** Un niveau de segmentation, écrit en toutes lettres, en note sur 5, ou en A/B/C. */
export function levelFrom(raw: unknown): string {
  const n = normalizeHeader(raw);
  if (!n) return "MEDIUM";
  if (n.includes("tres haut") || n.includes("tres eleve") || n === "5" || n === "a+") return "VERY_HIGH";
  if (n.includes("tres bas") || n.includes("tres faible") || n === "1") return "VERY_LOW";
  if (n.includes("haut") || n.includes("eleve") || n.includes("fort") || n === "4" || n === "a") return "HIGH";
  if (n.includes("bas") || n.includes("faible") || n === "2" || n === "c") return "LOW";
  return "MEDIUM";
}

/**
 * SÉPARER UN NOM COMPLET en nom et prénom.
 *
 * L'écran de l'annuaire a DEUX colonnes ; beaucoup de fichiers n'en ont qu'une. Laisser le prénom
 * vide parce que le fichier ne le sépare pas revient à afficher un annuaire à moitié vide alors
 * que l'information est là.
 *
 * La règle suit ce qu'on observe réellement sur les fichiers algériens : le NOM DE FAMILLE est
 * écrit EN MAJUSCULES (« BENALI Karim »). Quand rien n'est en majuscules, on retombe sur la
 * convention d'usage — le premier mot est le nom. C'est une heuristique, et elle est corrigeable
 * à la main dans la grille : mieux vaut un prénom parfois à replacer qu'une colonne vide.
 */
export function splitFullName(full: string): { lastName: string; firstName: string } {
  const parts = tidy(full).split(" ").filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "" };

  const isCaps = (w: string) => w.length > 1 && w === w.toUpperCase() && /[A-ZÀ-Ý]/.test(w);
  const caps = parts.filter(isCaps);
  if (caps.length > 0 && caps.length < parts.length) {
    return { lastName: caps.join(" "), firstName: parts.filter((w) => !isCaps(w)).join(" ") };
  }
  return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
}

/** Une ligne d'annuaire, prête à écrire. */
export interface DirectoryImportRow {
  name: string;
  lastName: string | null;
  firstName: string | null;
  title: string;
  specialty: string | null;
  sector: string;
  institution: string | null;
  address: string | null;
  city: string | null;
  /** Une des 58 wilayas, déduite quand le fichier ne la nomme pas. `null` plutôt que devinée. */
  wilaya: string | null;
  postalCode: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  influence: string;
  potential: string;
  affinity: string;
  targetProducts: string | null;
  delegate: string | null;
  comments: string | null;
}

const orNull = (v: string): string | null => (v ? v : null);

/**
 * Une ligne du fichier, restructurée à NOTRE format.
 *
 * Rend `null` quand la ligne n'a pas de nom : une fiche sans nom n'est pas une fiche, et
 * l'importer fabriquerait des « (vide) » que personne n'osera jamais supprimer.
 */
export function parseDirectoryRow(
  values: readonly unknown[],
  mapping: readonly (DirectoryField | null)[],
): DirectoryImportRow | null {
  const get = (field: DirectoryField): string => {
    const i = mapping.indexOf(field);
    return i >= 0 ? tidy(values[i]) : "";
  };
  // LE NOM, quelle que soit la forme du fichier : une colonne unique, deux colonnes séparées,
  // ou les deux. On remplit TOUJOURS les trois champs — `name` sert d'affichage partout ailleurs
  // dans la plateforme, `lastName`/`firstName` sont les colonnes de la grille.
  const full = get("name");
  const rawLast = get("lastName");
  const rawFirst = get("firstName");
  const split = !rawLast && !rawFirst && full ? splitFullName(full) : { lastName: rawLast, firstName: rawFirst };
  const lastName = split.lastName;
  const firstName = split.firstName;
  const name = full || [lastName, firstName].filter(Boolean).join(" ");
  if (!name) return null;

  const address = get("address");
  const city = get("city");
  const institution = get("institution");
  const postalCode = get("postalCode");

  return {
    name,
    lastName: orNull(lastName),
    firstName: orNull(firstName),
    title: titleFrom(get("title")),
    specialty: orNull(get("specialty")),
    sector: sectorFrom(get("sector") || institution),
    institution: orNull(institution),
    address: orNull(address),
    city: orNull(city),
    // LA WILAYA SE DÉDUIT quand le fichier ne la nomme pas : c'est elle qui permet de filtrer et
    // de compter par territoire, et un annuaire sans wilaya ne sert pas à grand-chose.
    wilaya: resolveWilaya({ wilaya: get("wilaya"), postalCode, city, address, institution }),
    postalCode: orNull(postalCode),
    region: orNull(get("region")),
    phone: orNull(get("phone")),
    email: orNull(get("email")),
    influence: levelFrom(get("influence")),
    potential: levelFrom(get("potential")),
    affinity: levelFrom(get("affinity")),
    targetProducts: orNull(get("targetProducts")),
    delegate: orNull(get("delegate")),
    comments: orNull(get("comments")),
  };
}

/**
 * Toutes les lignes exploitables d'une feuille, et ce qui a été écarté.
 *
 * Un import qui dit « 312 lignes importées » sans dire que 40 ont été laissées de côté fabrique
 * un annuaire incomplet dont personne ne se méfie.
 */
export function parseDirectorySheet(rows: readonly (readonly unknown[])[]): {
  rows: DirectoryImportRow[];
  skipped: number;
  matched: DirectoryField[];
  unknown: { index: number; header: string }[];
} {
  if (rows.length === 0) return { rows: [], skipped: 0, matched: [], unknown: [] };
  const { mapping, matched, unknown } = mapHeaderRow(rows[0]);
  const out: DirectoryImportRow[] = [];
  let skipped = 0;
  for (const raw of rows.slice(1)) {
    if (raw.every((c) => tidy(c) === "")) continue; // ligne vide : ce n'est pas un rejet
    const parsed = parseDirectoryRow(raw, mapping);
    if (parsed) out.push(parsed);
    else skipped += 1;
  }
  return { rows: out, skipped, matched, unknown };
}

/** L'en-tête du classeur exporté — l'ordre des colonnes de l'annuaire. */
export function directoryHeaderRow(): string[] {
  return DIRECTORY_COLUMNS.map((c) => c.header);
}

/**
 * Le fichier exporté doit pouvoir être RÉIMPORTÉ tel quel — c'est ainsi qu'on corrige 200
 * lignes dans un tableur puis qu'on les remet. Les en-têtes exportés sont donc exactement ceux
 * que la reconnaissance sait lire.
 */
export function directoryExportFilename(now = new Date()): string {
  return `annuaire-praticiens-${now.toISOString().slice(0, 10)}.xlsx`;
}
