/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES DOUBLONS, ET CE QU'ON N'EN FAIT PAS (mandat 5 §41) — pur.
 *
 * Trois natures de doublon, et elles n'appellent PAS la même chose :
 *
 *   · IDENTIQUE — même contenu, octet pour octet (même empreinte). Le stockage les partage déjà :
 *     supprimer une copie ne libère RIEN. Ce qui gêne, c'est de ne pas savoir laquelle fait foi.
 *   · VERSION — le même document à deux moments (« Contrat v2 », « Contrat FINAL », « (1) »).
 *     Ce n'est pas un doublon : c'est un historique mal rangé.
 *   · RESSEMBLANT — noms proches et taille voisine, contenus différents. C'est un SOUPÇON, et
 *     un soupçon ne se supprime pas.
 *
 * LA RÈGLE : ce module PROPOSE, il ne supprime jamais. Un fichier effacé par erreur au nom d'un
 * ménage automatique coûte infiniment plus que les octets qu'il occupait — et l'un des deux
 * exemplaires est presque toujours celui que quelqu'un a mis en lien quelque part.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface Fichier {
  id: string;
  nom: string;
  /** Le chemin lisible (« Contrats / 2026 / Sofradis »), pour que la proposition se lise. */
  chemin?: string;
  taille: number;
  /** L'empreinte du CONTENU. Deux fichiers de même empreinte sont identiques, sans discussion. */
  empreinte?: string | null;
  modifieLe?: Date | string | null;
  creeLe?: Date | string | null;
  mimeType?: string | null;
  /** Le fichier est-il référencé ailleurs (pièce de courrier, document légal, message) ? */
  references?: number;
  proprietaire?: string | null;
}

export type NatureDoublon = "IDENTIQUE" | "VERSION" | "RESSEMBLANT";

export interface GroupeDoublons {
  nature: NatureDoublon;
  /** Celui qui fait foi — le plus récent, ou le plus référencé. */
  garder: Fichier;
  autres: Fichier[];
  /** Pourquoi ces fichiers sont groupés. */
  raison: string;
  /** Ce que la suppression des autres libérerait RÉELLEMENT. */
  octetsLiberables: number;
  /** Ce qu'il faut vérifier avant de toucher à quoi que ce soit. */
  precautions: string[];
  confiance: number;
}

export const FICHIERS_MAX = 50_000;

const instant = (v: Date | string | null | undefined): number => {
  if (!v) return 0;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

/** Le nom sans son extension, sans accents, sans ponctuation — la base d'une comparaison de noms. */
export function radical(nom: string): string {
  return nom
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Les marques d'une VERSION : « v2 », « (1) », « copie », « final », « ancien », une date. */
const MARQUES_VERSION = /\b(v ?\d+|version ?\d+|rev ?\d+|copie|copy|final|finale|def|definitif|definitive|ancien|ancienne|old|new|nouveau|nouvelle|bis|ter|\d{4}[-_]?\d{2}[-_]?\d{2}|\d{1,2}[-_]\d{1,2}[-_]\d{2,4})\b|\(\d+\)$/i;

/** Le radical DÉBARRASSÉ de ses marques de version — « Contrat v2 » et « Contrat FINAL » se rejoignent. */
export function radicalSansVersion(nom: string): string {
  return radical(nom).replace(MARQUES_VERSION, "").replace(/\s+/g, " ").trim();
}

/** La distance de Levenshtein bornée — au-delà du plafond, on arrête : le détail n'intéresse plus. */
export function distanceNoms(a: string, b: string, plafond = 8): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > plafond) return plafond + 1;
  const m = a.length, n = b.length;
  let precedente = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const courante = [i, ...new Array<number>(n).fill(0)];
    let minLigne = i;
    for (let j = 1; j <= n; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(courante[j - 1]! + 1, precedente[j]! + 1, precedente[j - 1]! + cout);
      minLigne = Math.min(minLigne, courante[j]!);
    }
    if (minLigne > plafond) return plafond + 1;
    precedente = courante;
  }
  return precedente[n]!;
}

/** Celui qui fait foi : le plus RÉFÉRENCÉ d'abord (quelqu'un s'appuie dessus), puis le plus récent. */
function choisirLeMaitre(groupe: readonly Fichier[]): Fichier {
  return [...groupe].sort((a, b) =>
    (b.references ?? 0) - (a.references ?? 0)
    || instant(b.modifieLe) - instant(a.modifieLe)
    || instant(b.creeLe) - instant(a.creeLe)
    || a.nom.length - b.nom.length,
  )[0]!;
}

export interface RapportDoublons {
  fichiers: number;
  groupes: GroupeDoublons[];
  identiques: number;
  versions: number;
  ressemblants: number;
  octetsLiberables: number;
  /** L'octet économisé par la déduplication du STOCKAGE, qui existe déjà. */
  octetsDejaPartages: number;
  limites: string[];
}

/**
 * TROUVE LES DOUBLONS — sans en supprimer un seul.
 * `empreintes: false` quand les empreintes ne sont pas disponibles : la recherche se rabat sur
 * les noms et les tailles, et sa confiance baisse en conséquence, ce qui est DIT.
 */
export function trouverDoublons(
  fichiers: readonly Fichier[],
  options: { seuilRessemblance?: number; ignorerReferences?: boolean } = {},
): RapportDoublons | { erreur: string } {
  if (!fichiers.length) return { erreur: "Aucun fichier à examiner." };
  if (fichiers.length > FICHIERS_MAX) return { erreur: `${fichiers.length} fichiers : ${FICHIERS_MAX} au plus pour une recherche de doublons (limite opérationnelle).` };
  const seuil = options.seuilRessemblance ?? 3;
  const groupes: GroupeDoublons[] = [];
  const casesUtilisees = new Set<string>();
  let octetsDejaPartages = 0;

  // ── 1. IDENTIQUES : même empreinte. Aucune discussion possible.
  const parEmpreinte = new Map<string, Fichier[]>();
  for (const f of fichiers) {
    if (!f.empreinte) continue;
    if (!parEmpreinte.has(f.empreinte)) parEmpreinte.set(f.empreinte, []);
    parEmpreinte.get(f.empreinte)!.push(f);
  }
  for (const [, groupe] of parEmpreinte) {
    if (groupe.length < 2) continue;
    const garder = choisirLeMaitre(groupe);
    const autres = groupe.filter((f) => f !== garder);
    for (const f of groupe) casesUtilisees.add(f.id);
    // Le stockage partage déjà le contenu : la place n'est PAS libérée par la suppression.
    octetsDejaPartages += autres.reduce((s, f) => s + f.taille, 0);
    const references = autres.filter((f) => (f.references ?? 0) > 0);
    groupes.push({
      nature: "IDENTIQUE", garder, autres,
      raison: `${groupe.length} fichiers au contenu STRICTEMENT identique (même empreinte)`,
      octetsLiberables: 0,
      precautions: [
        "Le stockage partage déjà ce contenu : supprimer une copie ne libère AUCUN octet. Ce qui se gagne, c'est de savoir laquelle fait foi.",
        ...(references.length ? [`${references.length} copie(s) sont RÉFÉRENCÉES ailleurs (pièce de courrier, document légal, message) : les supprimer casserait ces liens.`] : []),
        `À garder : « ${garder.nom} »${garder.chemin ? ` (${garder.chemin})` : ""} — ${(garder.references ?? 0) > 0 ? `${garder.references} référence(s)` : "le plus récent"}.`,
      ],
      confiance: 1,
    });
  }

  // ── 2. VERSIONS : même radical une fois les marques de version retirées.
  const parRadical = new Map<string, Fichier[]>();
  for (const f of fichiers) {
    if (casesUtilisees.has(f.id)) continue;
    const r = radicalSansVersion(f.nom);
    if (r.length < 4) continue;
    if (!parRadical.has(r)) parRadical.set(r, []);
    parRadical.get(r)!.push(f);
  }
  for (const [r, groupe] of parRadical) {
    if (groupe.length < 2) continue;
    // Il faut qu'au moins un nom porte une marque de version — sinon ce sont deux fichiers distincts.
    if (!groupe.some((f) => MARQUES_VERSION.test(radical(f.nom)))) continue;
    const garder = choisirLeMaitre(groupe);
    const autres = groupe.filter((f) => f !== garder);
    for (const f of groupe) casesUtilisees.add(f.id);
    groupes.push({
      nature: "VERSION", garder, autres,
      raison: `${groupe.length} fichiers autour de « ${r} » avec des marques de version (${groupe.map((f) => f.nom).slice(0, 4).join(", ")})`,
      octetsLiberables: autres.reduce((s, f) => s + f.taille, 0),
      precautions: [
        "Ce ne sont PAS des doublons : c'est un historique mal rangé. Les archiver conserve l'histoire ; les supprimer la perd.",
        `Le plus récent est « ${garder.nom} » — mais un nom qui dit « FINAL » n'est pas une preuve : vérifier la date et le contenu avant de trancher.`,
      ],
      confiance: 0.75,
    });
  }

  // ── 3. RESSEMBLANTS : noms proches, taille voisine, contenu différent (ou inconnu).
  const restants = fichiers.filter((f) => !casesUtilisees.has(f.id));
  const parTaille = [...restants].sort((a, b) => a.taille - b.taille);
  for (let i = 0; i < parTaille.length; i += 1) {
    const a = parTaille[i]!;
    if (casesUtilisees.has(a.id)) continue;
    const proches: Fichier[] = [];
    for (let j = i + 1; j < parTaille.length; j += 1) {
      const b = parTaille[j]!;
      if (casesUtilisees.has(b.id)) continue;
      // La taille est le filtre bon marché : au-delà de 10 % d'écart, on arrête de comparer.
      if (a.taille > 0 && b.taille > a.taille * 1.1) break;
      if (a.empreinte && b.empreinte && a.empreinte === b.empreinte) continue;
      const ra = radical(a.nom), rb = radical(b.nom);
      if (Math.min(ra.length, rb.length) < 5) continue;
      if (distanceNoms(ra, rb, seuil) <= seuil) proches.push(b);
    }
    if (!proches.length) continue;
    const groupe = [a, ...proches];
    const garder = choisirLeMaitre(groupe);
    for (const f of groupe) casesUtilisees.add(f.id);
    groupes.push({
      nature: "RESSEMBLANT", garder, autres: groupe.filter((f) => f !== garder),
      raison: `${groupe.length} fichiers aux noms proches et de taille voisine (${groupe.map((f) => f.nom).slice(0, 3).join(", ")})`,
      octetsLiberables: 0,
      precautions: [
        "SOUPÇON, pas doublon : les contenus DIFFÈRENT (empreintes distinctes) ou n'ont pas pu être comparés. Ne rien supprimer sans les ouvrir.",
        "Deux devis au nom presque identique pour deux clients différents ressemblent exactement à ça.",
      ],
      confiance: 0.4,
    });
  }

  groupes.sort((a, b) => (b.confiance - a.confiance) || (b.autres.length - a.autres.length));
  const limites = [
    "Aucun fichier n'est supprimé ni déplacé par cette analyse : elle PROPOSE, une personne décide.",
    ...(fichiers.some((f) => !f.empreinte) ? [`${fichiers.filter((f) => !f.empreinte).length} fichier(s) sans empreinte de contenu : pour eux, seuls le nom et la taille ont pu être comparés, et un « identique » n'a pas pu être prouvé.`] : []),
    ...(options.ignorerReferences ? ["Les références (pièces de courrier, documents légaux) n'ont PAS été vérifiées : un fichier supprimé peut casser un lien."] : []),
  ];
  return {
    fichiers: fichiers.length, groupes,
    identiques: groupes.filter((g) => g.nature === "IDENTIQUE").length,
    versions: groupes.filter((g) => g.nature === "VERSION").length,
    ressemblants: groupes.filter((g) => g.nature === "RESSEMBLANT").length,
    octetsLiberables: groupes.reduce((s, g) => s + g.octetsLiberables, 0),
    octetsDejaPartages, limites,
  };
}

/** Les fichiers que PERSONNE ne référence et que personne n'a ouverts depuis longtemps. */
export function orphelins(fichiers: readonly Fichier[], joursSansTouche = 365, maintenant = new Date()): { fichier: Fichier; joursSansModification: number; raison: string }[] {
  const t = maintenant.getTime();
  return fichiers
    .filter((f) => (f.references ?? 0) === 0)
    .map((f) => {
      const dernier = Math.max(instant(f.modifieLe), instant(f.creeLe));
      return { fichier: f, joursSansModification: dernier ? Math.floor((t - dernier) / 86_400_000) : -1 };
    })
    .filter((x) => x.joursSansModification >= joursSansTouche)
    .sort((a, b) => b.joursSansModification - a.joursSansModification)
    .map((x) => ({ ...x, raison: `aucune référence dans l'ERP et ${x.joursSansModification} jours sans modification — candidat à l'ARCHIVAGE, pas à la suppression` }));
}
