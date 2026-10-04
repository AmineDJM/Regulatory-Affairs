/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MOTEUR DE QUALITÉ DES DONNÉES — le vocabulaire (mandat 4 §23).
 *
 * ── CE QU'IL EST ─────────────────────────────────────────────────────────────────────────
 *
 * Un CONSTAT est une anomalie nommée sur UNE ligne de l'ERP : doublon, champ manquant, donnée
 * périmée, incohérence entre modules, montant contradictoire, statut impossible, relation
 * cassée, e-mail invalide, document orphelin, date incohérente, valeur aberrante. Il porte sa
 * RÈGLE (qui l'a trouvé et pourquoi), sa CRITICITÉ, sa CONFIANCE, et sa RÉSOLUTION :
 *
 *   AUTO     — la correction est sûre, réversible et sans jugement (un e-mail en majuscules) :
 *              le moteur l'applique, journalise avant / après dans l'audit, et le dit ;
 *   PROPOSE  — une correction CONCRÈTE existe mais demande un regard (un contrat actif dont
 *              le terme est passé : expiré, ou renouvelé ?) : elle s'applique d'un clic ;
 *   HUMAIN   — le constat exige une décision (deux fournisseurs à fusionner, deux factures
 *              identiques) : le moteur montre, la personne tranche.
 *
 * Un constat a une SIGNATURE stable : le même défaut, revu la nuit suivante, ne fait pas une
 * deuxième ligne — il compte une occurrence de plus. Un défaut disparu se ferme tout seul.
 *
 * ── LA RÈGLE D'OR ────────────────────────────────────────────────────────────────────────
 *
 * Le moteur ne fusionne, ne supprime, ne réaffecte JAMAIS de lui-même. Ce qu'il corrige seul
 * tient en une ligne : normaliser la forme d'une valeur dont le sens ne change pas. Tout le
 * reste est une décision, et une décision porte le nom d'une personne.
 *
 * Fichier PUR : aucun import. Les détecteurs (Prisma) vivent dans `rules.ts`, le moteur dans
 * `engine.ts`, les correcteurs dans `fix.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const FAMILLES = [
  "DOUBLON", "CHAMP_MANQUANT", "PERIME", "INCOHERENCE_MODULES", "MONTANT", "STATUT_IMPOSSIBLE",
  "RELATION_CASSEE", "EMAIL", "DOCUMENT_ORPHELIN", "DATE", "VALEUR_ABERRANTE",
] as const;
export type FamilleQualite = (typeof FAMILLES)[number];

export const LIBELLE_FAMILLE: Record<FamilleQualite, string> = {
  DOUBLON: "Doublon", CHAMP_MANQUANT: "Champ manquant", PERIME: "Donnée périmée", INCOHERENCE_MODULES: "Incohérence entre modules",
  MONTANT: "Montant contradictoire", STATUT_IMPOSSIBLE: "Statut impossible", RELATION_CASSEE: "Relation cassée", EMAIL: "E-mail",
  DOCUMENT_ORPHELIN: "Document orphelin", DATE: "Date incohérente", VALEUR_ABERRANTE: "Valeur aberrante",
};

export const CRITICITES = ["CRITIQUE", "HAUTE", "NORMALE", "BASSE"] as const;
export type Criticite = (typeof CRITICITES)[number];
export const RANG_CRITICITE: Record<Criticite, number> = { CRITIQUE: 0, HAUTE: 1, NORMALE: 2, BASSE: 3 };
export const LIBELLE_CRITICITE: Record<Criticite, string> = { CRITIQUE: "Critique", HAUTE: "Haute", NORMALE: "Normale", BASSE: "Basse" };

/** AUTO = correction sûre appliquée par le moteur ; PROPOSE = correction concrète à confirmer ; HUMAIN = décision. */
export type Resolution = "AUTO" | "PROPOSE" | "HUMAIN";
export type StatutConstat = "OPEN" | "FIXED" | "DISMISSED" | "RESOLVED";

/** Sous ce seuil, une règle AUTO redevient une PROPOSITION : on ne corrige pas seul ce dont on doute. */
export const SEUIL_AUTO = 0.95;

export interface Correction {
  entite: string;
  entiteId: string;
  champ: string;
  avant: string | null;
  apres: string | null;
  /** Ce que la correction fait, en une ligne lisible avant de cliquer. */
  description: string;
}

export interface Constat {
  regle: string;
  famille: FamilleQualite;
  criticite: Criticite;
  /** 0..1 — à quel point la règle est sûre que c'est une anomalie, pas un cas légitime. */
  confiance: number;
  resolution: Resolution;
  /** Le modèle Prisma (« Employee », « LegalDocument »…) et la ligne. */
  entite: string;
  entiteId: string;
  /** Le module RBAC qui gouverne la VISIBILITÉ du constat (un salaire aberrant reste derrière RH). */
  module: string;
  titre: string;
  detail: string;
  signature: string;
  href: string | null;
  correction: Correction | null;
  montant: number | null;
}

export interface DefinitionRegle {
  id: string;
  famille: FamilleQualite;
  criticite: Criticite;
  resolution: Resolution;
  module: string;
  /** Ce que la règle cherche et pourquoi c'est un défaut — lisible par un humain dans l'écran. */
  description: string;
  /** Les règles LÉGÈRES tournent toutes les heures (risque financier immédiat) ; les autres, la nuit. */
  legere?: boolean;
}

// ─────────────────────────────── Résolution effective ───────────────────────────────

/**
 * La résolution d'un CONSTAT n'est pas celle de sa règle : une règle AUTO dont la confiance
 * tombe sous le seuil redevient une proposition ; une proposition sans correction concrète est
 * une décision humaine. On ne peut pas « corriger d'un clic » ce qu'on n'a pas su formuler.
 */
export function resolutionEffective(regle: Resolution, confiance: number, correction: Correction | null): Resolution {
  if (!correction) return "HUMAIN";
  if (regle === "AUTO") return confiance >= SEUIL_AUTO ? "AUTO" : "PROPOSE";
  return regle;
}

export function signatureDe(regle: string, ...parts: (string | number | null | undefined)[]): string {
  return `${regle}|${parts.map((p) => (p == null ? "" : String(p))).join("|")}`.slice(0, 400);
}

// ─────────────────────────────── Normalisations ───────────────────────────────

export function plierTexte(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
}

/** Les formes juridiques et suffixes qui ne distinguent pas deux sociétés (« Hetero Labs SARL » = « Hetero Labs »). */
const FORMES_JURIDIQUES = /\b(sarl|spa|eurl|sas|sasu|snc|ltd|limited|llc|inc|gmbh|ag|sa|plc|co|corp|corporation|company|pvt|pharma|pharmaceuticals?|laboratoires?|laboratories|labs?|group|groupe)\b/g;

export function cleSociete(nom: string | null | undefined): string {
  return plierTexte(nom).replace(FORMES_JURIDIQUES, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────── Factures : qui a numéroté la pièce ───────────────────────────────

/** Une facture telle que la règle des doublons la lit pour savoir QUI l'a numérotée. */
export interface EmetteurFacture {
  reference: string | null;
  direction: string | null;
  companyId: string | null;
  counterpartyIds: readonly string[];
  counterparty: string | null;
}

/**
 * LA MÊME RÉFÉRENCE N'EST UN DOUBLON QUE CHEZ LE MÊME ÉMETTEUR (§118.196 — audit 360°, rapport 19). Chaque fournisseur
 * numérote ses factures depuis 1, et chaque société du groupe a sa propre série : « FA-2026-001 » chez deux
 * fournisseurs, ou émise par deux sociétés, ce sont deux factures — la règle les dénonçait « quasi certain ». Le groupe
 * ne réunit donc que ce qui PEUT être la même pièce : une facture ÉMISE se compare aux factures de la même société, une
 * facture REÇUE aux factures reçues (sans sens, une facture est reçue : c'est la saisie à la main d'une pièce de
 * fournisseur). `null` sans référence lisible.
 */
export function groupeReferenceFacture(f: EmetteurFacture): string | null {
  const ref = plierTexte(f.reference).replace(/\s+/g, "");
  if (!ref) return null;
  return f.direction === "IN" ? `IN|${f.companyId ?? "?"}|${ref}` : `OUT|${ref}`;
}

export type MemeEmetteur = "OUI" | "NON" | "INCONNU";

/**
 * Deux factures du même groupe viennent-elles du même émetteur ? Une facture émise : oui, le groupe est celui de sa
 * société. Une facture reçue : la partie de l'annuaire d'abord, le nom plié ensuite — et quand rien ne dit qui a émis
 * l'une des deux, on ne devine pas : INCONNU, et le constat dit « à vérifier » au lieu de « quasi certain ».
 */
export function memeEmetteur(a: EmetteurFacture, b: EmetteurFacture): MemeEmetteur {
  if (a.direction === "IN" && b.direction === "IN") return "OUI";
  const ids = new Set(a.counterpartyIds);
  if (b.counterpartyIds.some((x) => ids.has(x))) return "OUI";
  const na = cleSociete(a.counterparty);
  const nb = cleSociete(b.counterparty);
  if (na && nb) return na === nb ? "OUI" : "NON";
  if (a.counterpartyIds.length > 0 && b.counterpartyIds.length > 0) return "NON";
  return "INCONNU";
}

/**
 * LA DÉCISION, pure : dans un groupe de même référence, les jumelles de chaque facture — CERTAINES (même émetteur)
 * ou INCERTAINES (rien ne dit qui a émis l'une des deux). Une facture sans jumelle d'aucune sorte n'est pas un doublon :
 * deux fournisseurs qui numérotent pareil ne font qu'un hasard de numérotation.
 */
export function jumellesDeReference<T extends EmetteurFacture & { id: string }>(g: readonly T[]): { facture: T; certain: boolean; lot: T[] }[] {
  const out: { facture: T; certain: boolean; lot: T[] }[] = [];
  for (const x of g) {
    const autres = g.filter((y) => y.id !== x.id);
    const memes = autres.filter((y) => memeEmetteur(x, y) === "OUI");
    const incertains = autres.filter((y) => memeEmetteur(x, y) === "INCONNU");
    if (memes.length === 0 && incertains.length === 0) continue;
    const certain = memes.length > 0;
    out.push({ facture: x, certain, lot: [x, ...(certain ? memes : incertains)] });
  }
  return out;
}

/**
 * LE CUMUL D'UNE PIÈCE AMONT, pur (§118.196) : les factures d'un bon de commande (ou d'un devis), dans l'ordre de leur
 * date, leurs montants NETS de leurs avoirs ; rend la première qui fait dépasser ce que la pièce engage de plus de
 * `tolerancePct` — ou `null`. Facturer MOINS n'est pas une contradiction : c'est une livraison qui n'est pas finie.
 */
export function depassementDuCumul<T extends { id: string; net: number; quand: number }>(
  factures: readonly T[], base: number, tolerancePct = 1,
): { facture: T; rang: number; cumul: number; ecartPct: number } | null {
  let cumul = 0;
  const triees = [...factures].sort((a, b) => a.quand - b.quand);
  for (const [rang, f] of triees.entries()) {
    cumul = Math.round((cumul + f.net) * 100) / 100;
    if (cumul <= base) continue;
    const ecartPct = base === 0 ? 100 : ((cumul - base) / Math.abs(base)) * 100;
    if (ecartPct > tolerancePct) return { facture: f, rang, cumul, ecartPct };
  }
  return null;
}

/** « Cherif Raihana » et « Raihana Cherif » sont la même clé : les mots triés. */
export function clePersonne(nom: string | null | undefined): string {
  return plierTexte(nom).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter(Boolean).sort().join(" ");
}

/** DCI triée (« A + B » = « B + A »), dosage, unité, forme, conditionnement — ce qui distingue deux dossiers. */
export function cleProduit(p: { dci: string | null; dosage?: string | null; dosageUnit?: string | null; pharmaceuticalForm?: string | null; packaging?: string | null }): string {
  const molecules = plierTexte(p.dci).split(/\s*[+/,]\s*|\s+et\s+/).map((m) => m.trim()).filter(Boolean).sort().join("+");
  return [molecules, plierTexte(p.dosage), plierTexte(p.dosageUnit), plierTexte(p.pharmaceuticalForm), plierTexte(p.packaging)].join("|");
}

export const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

export function emailNormalise(e: string | null | undefined): string {
  return (e ?? "").trim().replace(/^mailto:/i, "").replace(/^<(.*)>$/, "$1").trim().toLowerCase();
}

/** OK tel quel ; NORMALISABLE = valide une fois plié (casse, espaces) ; INVALIDE = pas une adresse. */
export function verdictEmail(e: string | null | undefined): "OK" | "NORMALISABLE" | "INVALIDE" | "VIDE" {
  if (e == null || e.trim() === "") return "VIDE";
  const n = emailNormalise(e);
  if (!EMAIL_RE.test(n)) return "INVALIDE";
  return n === e ? "OK" : "NORMALISABLE";
}

export function mediane(nums: readonly number[]): number | null {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * ABERRANT = au moins `facteur` fois la médiane d'un échantillon d'au moins `nMin` valeurs.
 * Sans échantillon suffisant, rien n'est aberrant : la fausse précision est pire que le silence.
 */
export function estAberrant(x: number, echantillon: readonly number[], facteur = 8, nMin = 8): boolean {
  if (!Number.isFinite(x) || echantillon.length < nMin) return false;
  const med = mediane(echantillon);
  return med !== null && med > 0 && x >= facteur * med;
}

export const joursEntre = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export function trierConstats<T extends { criticite: Criticite; confiance: number }>(cs: readonly T[]): T[] {
  return [...cs].sort((a, b) => RANG_CRITICITE[a.criticite] - RANG_CRITICITE[b.criticite] || b.confiance - a.confiance);
}

export interface Statistiques {
  total: number;
  parFamille: Record<string, number>;
  parCriticite: Record<Criticite, number>;
  parResolution: Record<Resolution, number>;
}

export function statistiques(cs: readonly Pick<Constat, "famille" | "criticite" | "resolution">[]): Statistiques {
  const st: Statistiques = { total: cs.length, parFamille: {}, parCriticite: { CRITIQUE: 0, HAUTE: 0, NORMALE: 0, BASSE: 0 }, parResolution: { AUTO: 0, PROPOSE: 0, HUMAIN: 0 } };
  for (const c of cs) {
    st.parFamille[c.famille] = (st.parFamille[c.famille] ?? 0) + 1;
    st.parCriticite[c.criticite] += 1;
    st.parResolution[c.resolution] += 1;
  }
  return st;
}
