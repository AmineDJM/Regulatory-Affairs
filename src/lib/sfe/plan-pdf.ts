import { semainesDuPlan } from "./grille-tournee";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLAN DE TOURNÉE EN PDF — sa MISE EN PAGES, sans rien dessiner (Direction, 07/10 : « exportable une fois confirmé, en PDF
 * très clean »).
 *
 * A4 paysage, UNE SEMAINE par page (dimanche → jeudi) : les jours en colonnes, une ligne par visite — le tableau de l'écran.
 * Une semaine chargée qui ne tient pas sur une page continue sur la suivante, en-tête de tableau répété. Ce module décide
 * QUOI va sur quelle page ; `plan-tournee-pdf.ts` le dessine (pdfkit).
 *
 * PUR : testé sans base ni bibliothèque.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type EtatVisitePdf = "PREVUE" | "FAITE" | "NON_TENUE";

export interface VisitePdf {
  /** `AAAA-MM-JJ`. */
  jour: string;
  nom: string;
  /** « Infectiologie · EHU Oran ». */
  detail: string;
  /** Le niveau de potentiel (`SegmentLevel`), ou `null` — le repère des seuls praticiens hors segmentation. */
  potentiel: string | null;
  /** LA LETTRE DE SEGMENTATION (H, A–D, NA, NC) — la référence du liseré quand elle existe (Direction, 07/10). */
  lettre?: string | null;
  etat: EtatVisitePdf;
}

export interface PagePdf {
  /** La semaine : son premier jour ouvré, et ses jours ouvrés dans la période. */
  semaine: { debut: string; jours: string[] };
  /** Les lignes de CETTE page : pour chaque jour, la visite du rang, ou `null`. */
  lignes: (VisitePdf | null)[][];
  /** Le rang (1, 2…) de la première ligne de la page. */
  premierRang: number;
  /** Vrai sur la page qui suit une page de la même semaine. */
  suite: boolean;
}

/** Combien de lignes de visite tiennent sur une page — la mise en page de `plan-tournee-pdf.ts` (34 pt par ligne). */
export const LIGNES_PAR_PAGE = 11;

const parNom = (a: VisitePdf, b: VisitePdf) => a.nom.localeCompare(b.nom, "fr");

/** Les pages du PDF : une par semaine (au moins une ligne, même vide), découpée quand la semaine déborde. */
export function pagesDuPlan(joursOuvres: readonly string[], visites: readonly VisitePdf[], parPage = LIGNES_PAR_PAGE): PagePdf[] {
  const pages: PagePdf[] = [];
  for (const semaine of semainesDuPlan(joursOuvres)) {
    const colonnes = semaine.jours.map((j) => visites.filter((v) => v.jour === j).sort(parNom));
    const hauteur = Math.max(1, ...colonnes.map((c) => c.length));
    for (let debut = 0; debut < hauteur; debut += parPage) {
      const n = Math.min(parPage, hauteur - debut);
      pages.push({
        semaine,
        lignes: Array.from({ length: n }, (_, i) => colonnes.map((c) => c[debut + i] ?? null)),
        premierRang: debut + 1,
        suite: debut > 0,
      });
    }
  }
  return pages;
}

/**
 * Le résumé du plan : visites, leur répartition par LETTRE de segmentation, et — pour les seules visites dont le praticien
 * n'a pas de lettre — par potentiel (inconnu à part).
 */
export function resumeDuPlan(visites: readonly VisitePdf[]): { total: number; faites: number; nonTenues: number; parLettre: Map<string, number>; parPotentiel: Map<string, number> } {
  const parPotentiel = new Map<string, number>();
  const parLettre = new Map<string, number>();
  for (const v of visites) {
    if (v.lettre) { parLettre.set(v.lettre, (parLettre.get(v.lettre) ?? 0) + 1); continue; }
    const cle = v.potentiel ?? "INCONNU";
    parPotentiel.set(cle, (parPotentiel.get(cle) ?? 0) + 1);
  }
  return {
    total: visites.length,
    faites: visites.filter((v) => v.etat === "FAITE").length,
    nonTenues: visites.filter((v) => v.etat === "NON_TENUE").length,
    parLettre,
    parPotentiel,
  };
}

/** Le nom du fichier : « Plan de tournée — Yacine Habes — octobre 2026.pdf ». */
export function nomDuPdf(kam: string, periode: string): string {
  return `Plan de tournée — ${kam} — ${periode}.pdf`.replace(/[\\/:*?"<>|]+/g, "-");
}
