import { bilanDesNotes, type GrilleCoaching, type Points } from "./grille";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SYNTHÈSE DU COACHING (§118.157) — ce que le directeur des opérations et les managers lisent
 * d'un coup d'œil : où en est chaque collaborateur, et quels axes l'équipe maîtrise le moins.
 * Module PUR.
 *
 * ── SEULES LES FICHES FINALISÉES COMPTENT ───────────────────────────────────────────────────
 *
 * Un brouillon est le travail en cours d'un manager : le compter ferait bouger une moyenne sur
 * une évaluation que personne n'a encore arrêtée, et elle bougerait à nouveau quand il la
 * corrige.
 *
 * ── LE POURCENTAGE, PAS LE TOTAL, POUR COMPARER ─────────────────────────────────────────────
 *
 * Une grille peut gagner un axe : 13/20 hier et 15/24 aujourd'hui ne se comparent pas en points.
 * La tendance et la moyenne se lisent donc en part du maximum ; l'écran affiche quand même le
 * total « 13 / 20 », parce que c'est ce que la fiche dit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface FichePourSynthese {
  collaboratorId: string;
  collaborateur: string;
  visitDate: Date;
  status: "DRAFT" | "FINALIZED";
  grille: GrilleCoaching;
  notes: Record<string, Points>;
}

export interface LigneCollaborateur {
  id: string;
  nom: string;
  fiches: number;
  derniere: { date: Date; total: number; max: number; pct: number };
  moyennePct: number;
  /** Dernière fiche contre l'avant-dernière — `null` tant qu'il n'y en a qu'une. */
  tendance: "hausse" | "baisse" | "stable" | null;
}

export interface LigneAxe {
  cle: string;
  titre: string;
  /** Moyenne des niveaux retenus sur cet axe (1 à 4), `null` si aucune fiche ne l'a noté. */
  moyenne: number | null;
  notes: number;
}

const pct = (total: number, max: number): number => (max > 0 ? Math.round((total / max) * 100) : 0);

/** Écart en points de pourcentage sous lequel on parle de stabilité — une note d'écart sur 20 en fait 5. */
const SEUIL_TENDANCE_PCT = 3;

export function syntheseParCollaborateur(fiches: readonly FichePourSynthese[]): LigneCollaborateur[] {
  const parId = new Map<string, FichePourSynthese[]>();
  for (const f of fiches) {
    if (f.status !== "FINALIZED") continue;
    const liste = parId.get(f.collaboratorId) ?? [];
    liste.push(f);
    parId.set(f.collaboratorId, liste);
  }
  const lignes: LigneCollaborateur[] = [];
  for (const [id, liste] of parId) {
    const triees = [...liste].sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());
    const bilans = triees.map((f) => bilanDesNotes(f.grille, f.notes));
    const derniere = bilans[0]!;
    const precedente = bilans[1];
    const pDerniere = pct(derniere.total, derniere.max);
    let tendance: LigneCollaborateur["tendance"] = null;
    if (precedente) {
      const ecart = pDerniere - pct(precedente.total, precedente.max);
      tendance = ecart > SEUIL_TENDANCE_PCT ? "hausse" : ecart < -SEUIL_TENDANCE_PCT ? "baisse" : "stable";
    }
    lignes.push({
      id,
      nom: triees[0]!.collaborateur,
      fiches: triees.length,
      derniere: { date: triees[0]!.visitDate, total: derniere.total, max: derniere.max, pct: pDerniere },
      moyennePct: Math.round(bilans.reduce((s, b) => s + pct(b.total, b.max), 0) / bilans.length),
      tendance,
    });
  }
  return lignes.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/**
 * LA MOYENNE PAR AXE, sur les axes de la grille COURANTE — un axe se reconnaît à sa CLÉ d'une
 * version à l'autre, même reformulé. Un axe retiré de la grille courante n'apparaît plus : on
 * n'affiche pas une moyenne sur un critère que personne n'évalue plus.
 */
export function syntheseParAxe(fiches: readonly FichePourSynthese[], courante: GrilleCoaching): LigneAxe[] {
  return courante.axes.map((axe) => {
    const valeurs = fiches
      .filter((f) => f.status === "FINALIZED")
      .map((f) => f.notes[axe.cle])
      .filter((p): p is Points => p !== undefined);
    return {
      cle: axe.cle,
      titre: axe.titre,
      moyenne: valeurs.length ? Math.round((valeurs.reduce((s, p) => s + p, 0) / valeurs.length) * 10) / 10 : null,
      notes: valeurs.length,
    };
  });
}
