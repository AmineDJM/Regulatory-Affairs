import { cleDEtablissement, indexerEtablissements, type EtablissementConnu, type Rattachement } from "@/lib/annuaires/rattachement";
import { cleDeSpecialite } from "@/lib/annuaires/specialites";
import { foldText, wilayaInText } from "@/lib/medical/wilaya";
import type { Lettre } from "./regles";

/**
 * L'IMPORT DU CLASSEUR DE LA DIRECTION, « en une fois » — les DÉCISIONS, sans base (Direction, 08/10 : « un espace où
 * j'importe exactement ce fichier et ça fait le tout, annuaires et tout connectés »).
 *
 *   • l'ÉTABLISSEMENT d'une ligne (« CHU d'Oran ») retrouve celui de l'annuaire (« CHU Oran ») : d'abord le nom exact
 *     (la règle de `rattachement.ts`), puis le même nom sans ponctuation ni articles — et seulement s'il n'en désigne
 *     qu'UN. Plusieurs : « à trancher », rien n'est choisi à la place d'une personne ;
 *   • sa WILAYA, pour un établissement à créer, se lit dans son nom (« CHU Tizi Ouzou ») ou dans une commune connue
 *     (« EPH Boufarik » → Blida) ; sinon elle reste vide — jamais devinée ;
 *   • les SPÉCIALITÉS écrites de deux façons (« Pharmacie Hospitalière » / « Pharmacie hospitalière ») n'en font qu'une ;
 *   • la LETTRE du fichier fait foi : quand le calcul en donne une autre, elle est gardée comme décision motivée
 *     (« Lettre du fichier importé ») — le résultat est EXACTEMENT le fichier, et l'écart reste lisible.
 *
 * Module PUR — testé sans base.
 */

const ARTICLES = new Set(["de", "d", "du", "des", "la", "le", "l", "les"]);

/** La clé SOUPLE d'un établissement : sans casse, accents, ponctuation ni articles — « CHU d'Oran » ≡ « CHU Oran ». */
export function cleSoupleEtablissement(nom: string): string {
  return foldText(nom).split(" ").filter((m) => m && !ARTICLES.has(m)).join(" ");
}

/**
 * L'INDEX DES ÉTABLISSEMENTS pour l'import : le nom exact d'abord (casse, accents, espaces), puis la clé souple parmi
 * les établissements ACTIFS — retenue seulement quand elle n'en désigne qu'un.
 */
export function indexerEtablissementsSouple(etablissements: readonly EtablissementConnu[]): (nom: string | null | undefined) => Rattachement {
  const strict = indexerEtablissements(etablissements);
  const parCle = new Map<string, EtablissementConnu[]>();
  for (const e of etablissements) {
    if (!e.isActive) continue;
    const cle = cleSoupleEtablissement(e.name);
    if (cle) parCle.set(cle, [...(parCle.get(cle) ?? []), e]);
  }
  return (nom) => {
    const r = strict(nom);
    if (r.statut !== "inconnu") return r;
    const cands = parCle.get(cleSoupleEtablissement(String(nom ?? ""))) ?? [];
    if (cands.length === 1) return { statut: "trouve", etablissement: cands[0] };
    if (cands.length > 1) return { statut: "ambigu", candidats: cands };
    return { statut: "inconnu" };
  };
}

/**
 * Quelques LIEUX qui ne portent pas le nom de leur wilaya — volontairement courte : ce que les classeurs de la BU
 * nomment vraiment. Un établissement absent d'ici et sans wilaya dans son nom reste SANS wilaya (à compléter).
 */
const LIEUX: Record<string, string> = {
  "el kettar": "Alger",
  "hca": "Alger",
  "beni messous": "Alger",
  "mustapha": "Alger",
  "bab el oued": "Alger",
  "boufarik": "Blida",
  "tam": "Tamanrasset",
};

/** La wilaya d'un établissement d'après son NOM, ou null. */
export function wilayaDeLEtablissement(nom: string | null | undefined): string | null {
  if (!nom?.trim()) return null;
  const direct = wilayaInText(nom);
  if (direct) return direct;
  const t = ` ${foldText(nom)} `;
  const lieu = Object.keys(LIEUX).sort((a, b) => b.length - a.length).find((k) => t.includes(` ${k} `));
  return lieu ? LIEUX[lieu] : null;
}

/** Le type d'établissement qu'un nom annonce — CHU, EHS, EPH (sinon AUTRE). */
export function typeDEtablissementSouple(nom: string): "CHU" | "EPH" | "EHS" | "AUTRE" {
  const n = cleDEtablissement(nom);
  if (/^chu\b/.test(n)) return "CHU";
  if (/^ehs\b/.test(n)) return "EHS";
  if (/^eph\b/.test(n)) return "EPH";
  return "AUTRE";
}

/**
 * LES SPÉCIALITÉS DU FICHIER, une par clé (casse et accents mis à part) : le libellé retenu est l'écriture la plus
 * fréquente — à égalité, celle qui a le moins de majuscules (« Pharmacie hospitalière »).
 */
export function specialitesDuFichier(textes: readonly (string | null | undefined)[]): Map<string, string> {
  const compte = new Map<string, Map<string, number>>();
  for (const t of textes) {
    const propre = String(t ?? "").replace(/\s+/g, " ").trim();
    const cle = cleDeSpecialite(propre);
    if (!cle) continue;
    const m = compte.get(cle) ?? new Map<string, number>();
    m.set(propre, (m.get(propre) ?? 0) + 1);
    compte.set(cle, m);
  }
  const majuscules = (s: string) => (s.match(/\p{Lu}/gu) ?? []).length;
  const out = new Map<string, string>();
  for (const [cle, m] of compte) out.set(cle, [...m].sort((a, b) => b[1] - a[1] || majuscules(a[0]) - majuscules(b[0]) || a[0].localeCompare(b[0]))[0][0]);
  return out;
}

/** LA BU QUE LE FICHIER VISE : celle dont le nom (ou une spécialité visée) nomme la spécialité dominante des lignes. */
export function buDuFichier(
  bus: readonly { id: string; name: string; specialites: readonly string[] }[],
  specialites: readonly (string | null | undefined)[],
): string | null {
  const parCle = new Map<string, number>();
  for (const s of specialites) { const k = cleSoupleEtablissement(String(s ?? "")); if (k) parCle.set(k, (parCle.get(k) ?? 0) + 1); }
  const dominantes = [...parCle].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  for (const d of dominantes) {
    const radical = d.split(" ")[0].slice(0, 7);
    if (radical.length < 4) continue;
    const vise = (t: string) => cleSoupleEtablissement(t).split(" ").some((m) => m.startsWith(radical));
    const trouvees = bus.filter((b) => vise(b.name) || b.specialites.some(vise));
    if (trouvees.length === 1) return trouvees[0].id;
    if (trouvees.length > 1) return trouvees.find((b) => vise(b.name))?.id ?? trouvees[0].id;
  }
  return null;
}

/** L'ANNUAIRE DE LA BU : celui qui porte son nom (ou le radical de sa spécialité, « Infectiologues »), s'il est seul. */
export function annuaireDeLaBu(annuaires: readonly { id: string; name: string }[], buNom: string): string | null {
  const exact = annuaires.filter((a) => cleSoupleEtablissement(a.name) === cleSoupleEtablissement(buNom) || cleSoupleEtablissement(a.name) === cleSoupleEtablissement(`BU ${buNom}`));
  if (exact.length === 1) return exact[0].id;
  const radicaux = cleSoupleEtablissement(buNom).split(" ").filter((m) => m.length >= 6 && m !== "segmentation").map((m) => m.slice(0, 7));
  if (radicaux.length === 0) return null;
  const proches = annuaires.filter((a) => cleSoupleEtablissement(a.name).split(" ").some((m) => radicaux.some((r) => m.startsWith(r))));
  return proches.length === 1 ? proches[0].id : null;
}

export type LettreFichier = "H" | "A" | "B" | "C" | "D" | "NA";

export type PlanLettre =
  /** Le fichier ne porte pas de lettre : les décisions en vigueur restent telles quelles. */
  | { action: "aucune" }
  /** Le calcul donne la lettre du fichier : rien à poser (une décision contraire en vigueur est levée). */
  | { action: "calcul" }
  /** Le fichier porte une autre lettre : elle est GARDÉE (dérogation motivée). */
  | { action: "garder"; valeur: Exclude<LettreFichier, "NA">; calculee: Lettre }
  /** Le fichier dit NA, le calcul autre chose : NA ne se force pas (c'est une réponse qui manque) — signalé. */
  | { action: "signaler"; calculee: Lettre };

/** Ce que l'import fait de la lettre d'une ligne, face à la lettre calculée (sans décision manuelle). */
export function planDeLettre(fichier: LettreFichier | null, calculee: Lettre): PlanLettre {
  if (fichier === null) return { action: "aucune" };
  if (fichier === "NA") return calculee === "NA" || calculee === "NC" ? { action: "calcul" } : { action: "signaler", calculee };
  return fichier === calculee ? { action: "calcul" } : { action: "garder", valeur: fichier, calculee };
}

/** Le motif d'une lettre gardée du fichier — « Lettre du fichier importé (Segmentation Finale.xlsx, 08/10/2026) ». */
export function motifLettreFichier(nomFichier: string, le: Date): string {
  return `Lettre du fichier importé (${nomFichier}, ${le.toLocaleDateString("fr-FR", { timeZone: "Africa/Algiers" })})`;
}

/**
 * LES DÉCISIONS EN VIGUEUR à lever, et celle à poser, pour qu'une ligne dise la lettre du fichier : une décision qui dit
 * déjà la bonne lettre est gardée ; toute autre (posée à la main ou par un import précédent) est levée — jamais effacée.
 */
export function ajusterDecisions(
  plan: PlanLettre,
  enVigueur: readonly { id: string; nature: string; valeur: string }[],
): { lever: string[]; poser: string | null } {
  if (plan.action === "signaler" || plan.action === "aucune") return { lever: [], poser: null };
  const voulue = plan.action === "garder" ? plan.valeur : null;
  const bonne = voulue ? enVigueur.find((d) => d.nature === "SEGMENT" && d.valeur === voulue) : undefined;
  return { lever: enVigueur.filter((d) => d !== bonne).map((d) => d.id), poser: voulue && !bonne ? voulue : null };
}

/** Une réponse a-t-elle changé ? (Deux nombres égaux à l'arrondi près, deux absences.) */
export function memeReponse(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  return Math.abs(a - b) < 1e-9;
}

/** Les lettres d'un ensemble de lignes, comptées. */
export function compterLettres(lettres: readonly Lettre[]): Record<Lettre, number> {
  const out: Record<Lettre, number> = { H: 0, A: 0, B: 0, C: 0, D: 0, NA: 0, NC: 0 };
  for (const l of lettres) out[l]++;
  return out;
}
