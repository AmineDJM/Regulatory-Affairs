/**
 * RÉSOLUTION D'ENTITÉS — le socle PUR (aucun accès base, embarquable partout).
 *
 * Le problème réel : « SD », « SD Pharma », « S.D. Pharmaceuticals » désignent la même société ;
 * « SAI » désigne la « Société Algérienne d'Infectiologie » ; et l'utilisateur écrit ce qu'il
 * veut. La résolution est un CLASSEMENT DE CANDIDATS avec un score et une raison — jamais une
 * fusion silencieuse : deux sociétés réellement différentes restent différentes, et c'est la
 * POLITIQUE d'appel (decisive/ambigu) qui décide d'auto-choisir ou de présenter les candidats.
 *
 * Aucun nom d'entreprise ni d'organisation n'est codé ici : uniquement des PRIMITIVES générales
 * (repli d'accents, initiales, recouvrement de jetons) applicables à des noms jamais vus.
 */

/** Minuscules sans accents ; ponctuation d'entreprise (« . », « & », « - », « / ») → espaces. */
export function foldOrg(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.&\-_/,'’()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots-outils du français courant — ignorés pour les INITIALES et le recouvrement. */
const STOPWORDS = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "en", "au", "aux", "pour", "a", "the", "of"]);

/** Bruit « corporate » — utile au repli quand deux noms ne diffèrent que par lui. */
const CORP_NOISE = new Set([
  "pharma", "pharmaceutical", "pharmaceuticals", "pharmaceutique", "laboratoire", "laboratoires",
  "labs", "lab", "sarl", "spa", "eurl", "sas", "ltd", "llc", "inc", "gmbh", "co", "company", "group", "groupe",
]);

/**
 * Jetons significatifs d'un nom, dans l'ordre. Les suites de jetons d'UNE lettre sont
 * recollées AVANT le filtre des mots-outils (« s d pharmaceuticals » → « sd … » : c'est ce
 * que produit « S.D. » après repli — et « d » recollé n'est plus le « d' » du français,
 * qu'un filtre prématuré aurait avalé). Un « d » ISOLÉ (« société algérienne d infectiologie »)
 * reste seul après recollage et tombe, lui, au filtre des mots-outils.
 */
export function orgTokens(s: string): string[] {
  const raw = foldOrg(s).split(" ").filter(Boolean);
  const merged: string[] = [];
  let run = "";
  for (const t of raw) {
    if (t.length === 1) { run += t; continue; }
    if (run) { merged.push(run); run = ""; }
    merged.push(t);
  }
  if (run) merged.push(run);
  return merged.filter((t) => !STOPWORDS.has(t));
}

/** Jetons SANS le bruit corporate — la partie identitaire du nom. */
export function coreTokens(s: string): string[] {
  const t = orgTokens(s).filter((x) => !CORP_NOISE.has(x));
  return t.length ? t : orgTokens(s); // un nom fait UNIQUEMENT de bruit garde ses jetons
}

/** Initiales des jetons significatifs — « société algérienne d'infectiologie » → « sai ». */
export function initialsOf(s: string): string {
  return orgTokens(s).map((t) => t[0]).join("");
}

/** Recouvrement de Jaccard entre deux ensembles de jetons (0..1). */
export function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export interface OrgMatch {
  /** La valeur candidate TELLE QU'ELLE EXISTE dans les données (jamais réécrite). */
  value: string;
  /** 0..1 — comparable d'une requête à l'autre. */
  score: number;
  /** La raison LISIBLE du rapprochement — la confiance s'explique, elle ne s'affirme pas. */
  why: string;
}

/**
 * Classe des candidats face à une requête. Règles, de la plus forte à la plus faible :
 *   • repli exact (« kwality pharma » = « Kwality Pharma ») ;
 *   • identité de cœur (« sd » = « SD Pharmaceuticals » sans le bruit corporate) ;
 *   • ACRONYME : la requête est les initiales du candidat (« sai » ← « Société Algérienne
 *     d'Infectiologie ») — ou l'inverse ;
 *   • la requête est CONTENUE dans le candidat (jetons de la requête tous présents) ;
 *   • recouvrement partiel de jetons (score proportionnel).
 */
export function rankOrgCandidates(query: string, candidates: string[]): OrgMatch[] {
  const q = foldOrg(query);
  if (!q) return [];
  const qTokens = orgTokens(query);
  const qCore = coreTokens(query);
  const qJoined = qTokens.join("");

  const out: OrgMatch[] = [];
  for (const value of candidates) {
    const v = foldOrg(value);
    if (!v) continue;
    const vTokens = orgTokens(value);
    const vCore = coreTokens(value);

    let score = 0;
    let why = "";
    if (v === q) { score = 1; why = "nom identique (accents/ponctuation près)"; }
    else if (qCore.length && vCore.length && qCore.join(" ") === vCore.join(" ")) {
      score = 0.95; why = "même nom sans le générique (Pharma, Laboratoires…)";
    } else if (qJoined.length >= 2 && initialsOf(value) === qJoined) {
      score = 0.88; why = `acronyme des initiales de « ${value} »`;
    } else if (vTokens.join("").length >= 2 && initialsOf(query) === vTokens.join("")) {
      score = 0.85; why = "le candidat est l'acronyme de la requête";
    } else if (qTokens.length && qTokens.every((t) => vTokens.includes(t))) {
      score = 0.8; why = "tous les mots de la requête sont dans le nom";
    } else {
      const overlap = tokenOverlap(qCore, vCore);
      if (overlap > 0) { score = 0.3 + overlap * 0.4; why = "recouvrement partiel de mots"; }
    }
    if (score > 0) out.push({ value, score, why });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface OrgResolution {
  /** decisive : un candidat s'impose. ambiguous : plusieurs plausibles. none : rien de crédible. */
  kind: "decisive" | "ambiguous" | "none";
  best: OrgMatch | null;
  candidates: OrgMatch[];
}

/**
 * POLITIQUE de résolution : auto-choisir SEULEMENT quand un candidat s'impose (score fort ET
 * nettement devant le suivant). Sinon, remonter les candidats — préciser coûte une question,
 * fusionner deux sociétés différentes coûte une erreur de gouvernance.
 */
export function resolveOrg(query: string, candidates: string[]): OrgResolution {
  const ranked = rankOrgCandidates(query, candidates).slice(0, 8);
  if (!ranked.length) return { kind: "none", best: null, candidates: [] };
  const [top, second] = ranked;
  // Plusieurs GRAPHIES de la même société (mêmes jetons de cœur) comptent comme UN candidat.
  const sameCore = second && coreTokens(top.value).join(" ") === coreTokens(second.value).join(" ");
  const decisive = top.score >= 0.8 && (!second || sameCore || top.score - second.score >= 0.2);
  return { kind: decisive ? "decisive" : "ambiguous", best: top, candidates: ranked };
}
