import { DIRECTIONS_PAR_DEFAUT, codeDirection, lireNombre } from "./pch-central";

/**
 * LE RELEVÉ DE STOCK DE LA PCH, REÇU EN FICHIER (Excel / CSV) — la lecture PURE (aucune base, aucun `xlsx` : le classeur
 * est lu côté serveur en lignes brutes, comme pour « Ventes PCH »).
 *
 * Trois façons d'écrire un relevé, toutes reconnues :
 *   • UNE LIGNE PAR PRODUIT ET PAR LIEU — colonnes « code produit » (CODE_PRO / POSTE) et / ou « désignation », une
 *     « quantité » (STOCK, QTE…) et, facultatif, la direction régionale (colonne ANNEXE / DR / DIRECTION) ;
 *   • UN TABLEAU LARGE — une colonne par lieu (« PCH », « DRA », « DRBE »…) : chaque cellule est le stock du lieu ;
 *   • UN ONGLET PAR DIRECTION — le nom de l'onglet (« DRO ») donne le lieu de ses lignes.
 * Le produit se retrouve par le CODE PCH (le poste des fichiers Ventes PCH) puis par la désignation — côté serveur.
 */

export interface LigneReleveFichier {
  /** La ligne telle qu'on l'a lue, pour la vérification à l'écran. */
  texte: string;
  libelle: string;
  /** Le code produit de la PCH (CODE_PRO / POSTE), s'il est écrit. */
  poste: number | null;
  quantite: number | null;
  /** Le lieu lu : un code de DR, « CENTRAL » pour la PCH centrale, ou nul (le lieu choisi à l'écran s'applique). */
  lieu: string | null;
}

export interface FeuilleBrute { nom: string; lignes: readonly (readonly unknown[])[] }

/** Un en-tête comparable : « Qté stock » → « QTE_STOCK ». */
export function cleColonne(v: unknown): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const COLONNES_POSTE = new Set(["CODE_PRO", "CODE_PRODUIT", "POSTE", "CODE", "CODE_ARTICLE", "CODE_PCH", "REF", "REFERENCE"]);
const COLONNES_DESIGNATION = new Set(["DESI_PRO", "DESIGNATION", "PRODUIT", "LIBELLE", "DCI", "ARTICLE", "DESIGNATION_PRODUIT", "NOM"]);
const COLONNES_LIEU = new Set(["ANNEXE", "DR", "DIRECTION", "DIRECTION_REGIONALE", "REGION", "SITE", "DEPOT", "LIEU"]);
const COLONNES_CENTRALES = new Set(["PCH", "CENTRAL", "CENTRALE", "PCH_CENTRAL", "PCH_CENTRALE", "SIEGE"]);

const estQuantite = (cle: string) => cle.includes("STOCK") || cle === "QTE" || cle.startsWith("QTE_") || cle.startsWith("QUANTITE") || cle === "SOLDE" || cle === "DISPONIBLE";

/** Une quantité de cellule : un entier ≥ 0 — « 1 540 », 1540, « 1.540 ». Illisible ou négative → null. */
export function quantiteDeCellule(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (v === null || v === undefined) return null;
  return lireNombre(String(v));
}

const texteDe = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();

/** Le lieu d'une cellule « lieu » : un code de DR, ou la PCH centrale. */
export function lieuDeCellule(v: unknown): string | null {
  const dr = codeDirection(v);
  if (dr) return dr;
  return COLONNES_CENTRALES.has(cleColonne(v)) ? "CENTRAL" : null;
}

interface Plan {
  ligne: number;
  poste: number;
  designation: number;
  quantite: number;
  lieu: number;
  /** Colonnes « une par lieu » du tableau large : [index, lieu]. */
  larges: [number, string][];
}

function chercherEntete(lignes: FeuilleBrute["lignes"]): Plan | null {
  for (let i = 0; i < Math.min(15, lignes.length); i++) {
    const cles = (lignes[i] ?? []).map(cleColonne);
    const poste = cles.findIndex((c) => COLONNES_POSTE.has(c));
    const designation = cles.findIndex((c) => COLONNES_DESIGNATION.has(c));
    if (poste < 0 && designation < 0) continue;
    const larges: [number, string][] = [];
    // Un en-tête de lieu : une DR connue (ou la PCH centrale) — « DRUG » n'est pas une direction.
    cles.forEach((c, idx) => {
      const l = lieuDeCellule(c);
      if (l && (l === "CENTRAL" || (DIRECTIONS_PAR_DEFAUT as readonly string[]).includes(l))) larges.push([idx, l]);
    });
    const lieu = cles.findIndex((c) => COLONNES_LIEU.has(c));
    const quantite = cles.findIndex(estQuantite);
    // Un tableau large a plusieurs colonnes de lieu ; sinon il faut une colonne de quantité.
    if (larges.length >= 1 && quantite < 0) return { ligne: i, poste, designation, quantite: -1, lieu: -1, larges };
    if (quantite >= 0) return { ligne: i, poste, designation, quantite, lieu, larges: [] };
  }
  return null;
}

/** Le lieu qu'un NOM D'ONGLET désigne (« DRO », « Stock DRA ») — nul pour « Feuil1 », « PCH ». */
export function lieuDeLOnglet(nom: string): string | null {
  const mots = nom.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  for (const m of mots) { const dr = codeDirection(m); if (dr) return dr; }
  return mots.some((m) => COLONNES_CENTRALES.has(m)) ? "CENTRAL" : null;
}

/** Toutes les lignes lisibles d'un classeur — chaque onglet avec son propre en-tête. Rien de reconnu → liste vide. */
export function lireReleveFichier(feuilles: readonly FeuilleBrute[]): LigneReleveFichier[] {
  const out: LigneReleveFichier[] = [];
  for (const f of feuilles) {
    const plan = chercherEntete(f.lignes);
    if (!plan) continue;
    const lieuOnglet = lieuDeLOnglet(f.nom);
    for (let i = plan.ligne + 1; i < f.lignes.length; i++) {
      const r = f.lignes[i] ?? [];
      const libelle = plan.designation >= 0 ? texteDe(r[plan.designation]) : "";
      const brutPoste = plan.poste >= 0 ? texteDe(r[plan.poste]) : "";
      const poste = /^\d{1,9}$/.test(brutPoste) ? Number(brutPoste) : null;
      if (!libelle && poste === null) continue;
      const nom = libelle || brutPoste;
      const texte = r.map(texteDe).filter(Boolean).join(" · ");
      if (plan.larges.length) {
        for (const [idx, lieu] of plan.larges) {
          const q = quantiteDeCellule(r[idx]);
          if (q === null) continue;
          out.push({ texte, libelle: nom, poste, quantite: q, lieu });
        }
        continue;
      }
      const lieuLigne = plan.lieu >= 0 ? lieuDeCellule(r[plan.lieu]) : null;
      out.push({ texte, libelle: nom, poste, quantite: quantiteDeCellule(r[plan.quantite]), lieu: lieuLigne ?? lieuOnglet });
    }
  }
  return out;
}
