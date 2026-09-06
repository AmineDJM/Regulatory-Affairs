/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉSOLUTION D'ENTITÉS — le scoreur PUR (F9, mandat 4 §24).
 *
 * « Hetero », « Cherif Raihana », « Lenvatinib », « CHU Tizi », « r.cherif@adventum.dz » : une
 * mention devient UNE ligne de l'ERP — ou une question, quand plusieurs lignes se valent. Ce
 * fichier ne connaît ni Prisma ni les tables : il note un candidat contre une requête (exact,
 * sans générique, acronyme, ordre des mots, faute de frappe, sous-ensemble de jetons, alias,
 * identifiant), puis TRANCHE : CERTAIN, PROBABLE, AMBIGU (avec la question à poser), INCONNU.
 *
 * ── LA RÈGLE QUI GOUVERNE LES SEUILS ─────────────────────────────────────────────────────
 *
 * Se tromper d'entité avec assurance est le défaut le plus coûteux du système (un mail au
 * mauvais Nadir, une tâche sur le mauvais dossier). Donc : CERTAIN exige un score haut ET un
 * écart net avec le second ; deux candidats proches font une QUESTION, jamais un choix.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { foldOrg, coreTokens, initialsOf, typoSimilarity } from "@/lib/name-match";

export const TYPES_ENTITE = ["PERSONNE", "SOCIETE", "FOURNISSEUR", "PRODUIT", "MOLECULE", "MARQUE", "HOPITAL", "INSTITUTION", "PARTENAIRE", "MEDECIN"] as const;
export type TypeEntite = (typeof TYPES_ENTITE)[number];

export const LIBELLE_TYPE: Record<TypeEntite, string> = {
  PERSONNE: "personne", SOCIETE: "société du groupe", FOURNISSEUR: "fournisseur", PRODUIT: "produit / dossier", MOLECULE: "molécule (DCI)",
  MARQUE: "marque", HOPITAL: "hôpital", INSTITUTION: "institution", PARTENAIRE: "partenaire / laboratoire", MEDECIN: "médecin",
};

export type Preuve = "identifiant" | "email" | "domaine" | "exact" | "alias" | "sans_generique" | "acronyme" | "ordre" | "typo" | "jetons" | "relation";

export interface Candidat {
  type: TypeEntite;
  id: string;
  libelle: string;
  /** Ce qui distingue ce candidat d'un homonyme : poste, société, forme, ville… */
  detail: string | null;
  score: number;
  preuves: Preuve[];
  href: string | null;
}

export type Verdict = "CERTAIN" | "PROBABLE" | "AMBIGU" | "INCONNU";

export const SEUILS = {
  /** Au-dessus, seul ou nettement devant : on agit. */
  certain: 0.92,
  /** Au-dessus, nettement devant : on agit en le disant. */
  probable: 0.78,
  /** En dessous, un candidat n'est pas un candidat. */
  plancher: 0.55,
  /** L'écart avec le second qui fait une réponse au lieu d'une question. */
  ecartNet: 0.12,
} as const;

// ─────────────────────────────── La requête ───────────────────────────────

export interface Identifiant { kind: "email" | "domaine" | "reference"; valeur: string }

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const DOMAINE_RE = /^@?([a-z0-9-]+\.)+[a-z]{2,}$/i;
const REFERENCE_RE = /^[A-Z]{2,6}-?\d{2,}[A-Z0-9-]*$/;

/** Un e-mail, un domaine (« hetero.com », « @hetero.com ») ou une référence (« PRD-014 ») : on ne les note pas, on les CHERCHE. */
export function detecterIdentifiant(requete: string): Identifiant | null {
  const q = requete.trim().replace(/^<|>$/g, "");
  if (EMAIL_RE.test(q)) return { kind: "email", valeur: q.toLowerCase() };
  if (DOMAINE_RE.test(q) && q.includes(".")) return { kind: "domaine", valeur: q.replace(/^@/, "").toLowerCase() };
  if (REFERENCE_RE.test(q.toUpperCase()) && /\d/.test(q)) return { kind: "reference", valeur: q.toUpperCase() };
  return null;
}

/** Les mots de liaison d'une mention (« le dossier Lenvatinib », « chez Hetero », « Dr Haddad »). */
const HABILLAGE = /^(le|la|les|l|un|une|du|de|des|d|chez|avec|pour|dossier|fiche|produit|societe|fournisseur|laboratoire|labo|hopital|institution|dr|docteur|pr|professeur|monsieur|madame|mr|mme|m)\s+/;

export function normaliserRequete(requete: string): string {
  let q = foldOrg(requete).replace(/[«»"]/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i += 1) q = q.replace(HABILLAGE, "");
  return q.replace(/\s+\?$/, "").trim();
}

/** Les molécules d'une DCI, triées : « A + B » = « B + A ». */
export function plierMolecules(dci: string | null | undefined): string {
  // Découper AVANT de plier : le pli remplace « / » par un espace et fusionnerait les molécules.
  return (dci ?? "").split(/\s*[+/,]\s*|\s+et\s+/i).map((m) => foldOrg(m)).filter(Boolean).sort().join("+");
}

// ─────────────────────────────── Le score d'un nom ───────────────────────────────

export interface ScoreNom { score: number; preuve: Preuve | null }

/** Les formes juridiques et génériques qui ne distinguent pas deux sociétés — plus larges que le cœur de `name-match`. */
const GENERIQUES = new Set([
  "sarl", "spa", "eurl", "sas", "sasu", "snc", "ltd", "limited", "llc", "inc", "incorporated", "gmbh", "ag", "sa", "plc", "co", "corp",
  "corporation", "company", "compagnie", "group", "groupe", "holding", "industries", "industrie", "international", "pvt", "pharma",
  "pharmaceutical", "pharmaceuticals", "pharmaceutique", "pharmaceutiques", "laboratoire", "laboratoires", "laboratories", "labs", "lab",
  "de", "du", "des", "la", "le", "les", "l", "d", "et", "the", "of",
]);

const jetons = (s: string): string[] => foldOrg(s).split(" ").filter((t) => t.length >= 2);
/** Les jetons SANS les génériques — « hetero labs ltd » et « hetero labs limited » se réduisent tous deux à « hetero ». */
const jetonsPropres = (s: string): string[] => jetons(s).filter((t) => !GENERIQUES.has(t));

/** Les preuves qui DÉSIGNENT (structure, identifiant) — par opposition à une ressemblance de frappe. */
const STRUCTURELLES: ReadonlySet<Preuve> = new Set(["identifiant", "email", "domaine", "exact", "alias", "sans_generique", "acronyme", "ordre", "jetons", "relation"]);
export const estStructurelle = (c: Pick<Candidat, "preuves">): boolean => c.preuves.some((p) => STRUCTURELLES.has(p));

/**
 * NOTER un nom candidat contre la requête. L'ordre des épreuves est celui de la certitude :
 * identique → sans générique → ordre des mots → acronyme → sous-ensemble de jetons → faute de frappe.
 */
export function scorerNom(requete: string, candidat: string): ScoreNom {
  const q = normaliserRequete(requete);
  const c = foldOrg(candidat);
  if (!q || !c) return { score: 0, preuve: null };
  if (q === c) return { score: 1, preuve: "exact" };
  const qc = coreTokens(q).join(" ");
  const cc = coreTokens(c).join(" ");
  if (qc && cc && qc === cc) return { score: 0.95, preuve: "sans_generique" };
  const qp = jetonsPropres(q); const cp = jetonsPropres(c);
  if (qp.length && cp.length && qp.join(" ") === cp.join(" ")) return { score: 0.95, preuve: "sans_generique" };
  if (qp.length >= 2 && qp.length === cp.length && [...qp].sort().join(" ") === [...cp].sort().join(" ")) return { score: 0.95, preuve: "ordre" };
  const qj = jetons(q); const cj = jetons(c);
  if (qj.length >= 2 && qj.length === cj.length && [...qj].sort().join(" ") === [...cj].sort().join(" ")) return { score: 0.95, preuve: "ordre" };
  const qJoint = q.replace(/\s+/g, "");
  if (qJoint.length >= 2 && qJoint.length <= 6 && initialsOf(candidat) === qJoint) return { score: 0.88, preuve: "acronyme" };
  // Tous les jetons PROPRES de la requête sont dans le candidat (« raihana » ⊂ « raihana cherif », « sun pharma » ⊂ « sun pharmaceutical industries »).
  if (qp.length > 0 && qp.every((t) => cp.includes(t))) {
    const part = qp.length / Math.max(cp.length, 1);
    return { score: 0.8 + 0.1 * part, preuve: "jetons" };
  }
  if (qj.length > 0 && qj.every((t) => cj.includes(t))) {
    const part = qj.length / Math.max(cj.length, 1);
    return { score: 0.8 + 0.1 * part, preuve: "jetons" };
  }
  // Une faute de frappe : chaque jeton de la requête proche d'un jeton du candidat (Levenshtein bornée).
  if (qj.length > 0 && cj.length > 0) {
    let somme = 0; let n = 0;
    for (const t of qj) {
      const meilleur = Math.max(0, ...cj.map((u) => typoSimilarity(t, u)));
      if (meilleur < 0.75) return { score: 0, preuve: null };
      somme += meilleur; n += 1;
    }
    const moy = somme / n;
    const couverture = qj.length / Math.max(cj.length, 1);
    return { score: Math.min(0.9, 0.55 + 0.3 * moy * couverture + 0.05 * moy), preuve: "typo" };
  }
  return { score: 0, preuve: null };
}

// ─────────────────────────────── Trancher ───────────────────────────────

export interface Tranche {
  verdict: Verdict;
  retenu: Candidat | null;
  candidats: Candidat[];
  question: string | null;
}

/** Fusionne les candidats identiques (type, id) en gardant le meilleur score et l'union des preuves. */
export function dedoublonner(candidats: readonly Candidat[]): Candidat[] {
  const m = new Map<string, Candidat>();
  for (const c of candidats) {
    const k = `${c.type}:${c.id}`;
    const ex = m.get(k);
    if (!ex) m.set(k, { ...c, preuves: [...c.preuves] });
    else {
      ex.score = Math.max(ex.score, c.score);
      for (const p of c.preuves) if (!ex.preuves.includes(p)) ex.preuves.push(p);
      if (!ex.detail && c.detail) ex.detail = c.detail;
    }
  }
  return [...m.values()].sort((a, b) => b.score - a.score || a.libelle.localeCompare(b.libelle));
}

export function trancher(requete: string, bruts: readonly Candidat[], limite = 6): Tranche {
  const candidats = dedoublonner(bruts).filter((c) => c.score >= SEUILS.plancher).slice(0, limite);
  if (candidats.length === 0) return { verdict: "INCONNU", retenu: null, candidats: [], question: null };
  const [top] = candidats;
  // Le CONCURRENT est le premier candidat qui désigne autant que le premier : une ressemblance de
  // frappe ne concurrence pas une désignation structurelle (« Haddadi » ⊂ « Meriem Haddadi » bat
  // « Haddad » ≈ « Haddadi »), et un identifiant n'a pas de concurrent.
  const identifiant = top.preuves.some((p) => p === "identifiant" || p === "email");
  const second = candidats.slice(1).find((c) => !estStructurelle(top) || estStructurelle(c) || c.score >= top.score - 0.02) ?? null;
  const ecart = top.score - (second?.score ?? 0);
  if (identifiant && (!second || ecart >= 0.001)) return { verdict: "CERTAIN", retenu: top, candidats, question: null };
  if (top.score >= SEUILS.certain && (!second || ecart >= SEUILS.ecartNet)) return { verdict: "CERTAIN", retenu: top, candidats, question: null };
  // Seul candidat, et il DÉSIGNE (tous les jetons présents, acronyme, domaine, forme juridique près) : certain.
  if (!second && top.score >= SEUILS.probable && estStructurelle(top)) return { verdict: "CERTAIN", retenu: top, candidats, question: null };
  if (top.score >= SEUILS.probable && (!second || ecart >= SEUILS.ecartNet)) return { verdict: "PROBABLE", retenu: top, candidats, question: null };
  const proches = candidats.filter((c) => top.score - c.score < SEUILS.ecartNet);
  return { verdict: "AMBIGU", retenu: null, candidats, question: questionDeDesambiguation(requete, proches.length >= 2 ? proches : candidats) };
}

/** La question à poser quand plusieurs lignes se valent — avec ce qui les distingue. */
export function questionDeDesambiguation(requete: string, candidats: readonly Candidat[]): string {
  const lignes = candidats.slice(0, 4).map((c, i) => `${i + 1}. ${c.libelle}${c.detail ? ` — ${c.detail}` : ""} (${LIBELLE_TYPE[c.type]})`);
  return `« ${requete.trim()} » peut désigner ${candidats.length >= 4 ? "plusieurs lignes" : `${Math.min(candidats.length, 4)} lignes`} : ${lignes.join(" ; ")}. Laquelle ?`;
}

export const LIBELLE_VERDICT: Record<Verdict, string> = {
  CERTAIN: "certain", PROBABLE: "probable — dit comme tel", AMBIGU: "ambigu — à demander", INCONNU: "inconnu — rien ne correspond",
};
