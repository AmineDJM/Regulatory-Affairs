/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APPARIER LES LIGNES LUES AUX LIGNES ATTENDUES — une facture aux lignes de son BC, par exemple
 * — sans jamais choisir à égalité (lot D2, §118.34, §118.36).
 *
 * Une ligne lue se rapproche d'une ligne attendue par sa DÉSIGNATION (jetons pliés par
 * `plierTexte`, le pli du moteur de qualité ; une abréviation de quatre lettres au moins
 * compte pour moitié : « Fiche POSO » ≈ « Fiche posologique »), son PRIX (au centime) et sa QUANTITÉ :
 *
 *   CERTAINE  — désignation quasi identique, même prix, et AUCUNE autre ligne attendue ne
 *               partage cette évidence ;
 *   PROBABLE  — une ressemblance suffisante, ou une ressemblance faible et le même prix ;
 *   AMBIGUE   — plusieurs lignes à ÉGALITÉ (les trois « Fiche posologique 500 × 225 » du BC de
 *               référence) : RIEN n'est choisi, la personne apparie ;
 *   HORS      — aucune ligne attendue restante : la ligne n'est jamais reportée d'office sur une
 *               autre (§118.152 i — une lecture ne crée aucun prix).
 *
 * L'appariement est UN À UN, du plus sûr au moins sûr. Une ligne attendue disputée à égalité
 * n'est attribuée à personne ensuite : la donner au premier candidat plus faible serait un choix
 * fait à la place d'une personne, sous l'apparence d'un calcul.
 *
 * Module PUR.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { phraseLigneAmbigue, phraseLigneHors } from "@/lib/pieces-lues/phrases";
import { plierTexte } from "@/lib/quality/model";

export interface LigneAApparier {
  designation: string;
  quantite: number | null;
  prixUnitaire: number | null;
}

export interface LigneAttendue extends LigneAApparier {
  id: string;
}

export type StatutAppariement = "CERTAINE" | "PROBABLE" | "AMBIGUE" | "HORS";

export interface PaireLue {
  statut: StatutAppariement;
  /** La ligne attendue retenue — CERTAINE ou PROBABLE seulement. */
  attendueId: string | null;
  /** AMBIGUE : les lignes attendues entre lesquelles rien n'est choisi. */
  candidats: string[];
  /** La ressemblance retenue (désignation, plus le prix et la quantité égaux). */
  score: number;
  /** Ce qu'il faut dire à la personne — `null` pour une paire CERTAINE ou PROBABLE. */
  phrase: string | null;
}

export interface ResultatAppariement {
  /** Une entrée par ligne lue, dans le même ordre. */
  lignes: PaireLue[];
  /** Les lignes attendues que rien n'apparie (y compris celles disputées à égalité). */
  attenduesLibres: string[];
}

export const SEUIL_CERTAIN = 0.85;
export const SEUIL_PROBABLE = 0.5;
/** Une ressemblance faible ne compte qu'avec le même prix. */
const SEUIL_AVEC_PRIX = 0.25;
const BONUS_PRIX = 0.3;
const BONUS_QUANTITE = 0.1;
const EPS = 1e-9;

const VIDES = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "et", "en", "a", "au", "aux", "pour", "sur", "par", "un", "une", "avec"]);
const estMot = (t: string): boolean => /^[a-z]+$/.test(t);

function jetons(s: string): string[] {
  return [...new Set(plierTexte(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter((t) => t && !VIDES.has(t) && (t.length > 1 || /\d/.test(t))))];
}

/**
 * Dice sur les jetons : les identiques d'abord, puis les abréviations (préfixe de quatre lettres au moins), qui
 * comptent pour MOITIÉ — « Fiche POSO » ressemble à « Fiche posologique », elle ne lui est pas identique : une
 * abréviation rend une paire PROBABLE, jamais CERTAINE à elle seule.
 */
function ressemblance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const pris = new Set<number>();
  let communs = 0;
  const restants: string[] = [];
  for (const x of a) {
    const k = b.findIndex((y, i) => !pris.has(i) && y === x);
    if (k >= 0) { pris.add(k); communs += 1; } else restants.push(x);
  }
  for (const x of restants) {
    const k = b.findIndex((y, i) => !pris.has(i) && estMot(x) && estMot(y) && Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));
    if (k >= 0) { pris.add(k); communs += 0.5; }
  }
  return (2 * communs) / (a.length + b.length);
}

const memePrix = (a: number | null, b: number | null): boolean => a !== null && b !== null && Math.round(a * 100) === Math.round(b * 100);
const memeQuantite = (a: number | null, b: number | null): boolean => a !== null && b !== null && Math.abs(a - b) < 0.0005;

interface Evaluation { i: number; j: number; sim: number; prix: boolean; score: number }

export function apparierLignes(lues: readonly LigneAApparier[], attendues: readonly LigneAttendue[]): ResultatAppariement {
  const jl = lues.map((l) => jetons(l.designation));
  const ja = attendues.map((a) => jetons(a.designation));
  const evaluations: Evaluation[] = [];
  for (let i = 0; i < lues.length; i++) {
    for (let j = 0; j < attendues.length; j++) {
      const sim = ressemblance(jl[i], ja[j]);
      const prix = memePrix(lues[i].prixUnitaire, attendues[j].prixUnitaire);
      if (sim < SEUIL_PROBABLE && !(sim >= SEUIL_AVEC_PRIX && prix)) continue;
      const score = sim + (prix ? BONUS_PRIX : 0) + (memeQuantite(lues[i].quantite, attendues[j].quantite) ? BONUS_QUANTITE : 0);
      evaluations.push({ i, j, sim, prix, score });
    }
  }
  evaluations.sort((x, y) => y.score - x.score);

  const lignes: PaireLue[] = lues.map(() => ({ statut: "HORS", attendueId: null, candidats: [], score: 0, phrase: null }));
  const luFixe = new Set<number>();
  const attenduePrise = new Set<number>();
  const attendueDisputee = new Set<number>();

  // DU PLUS SÛR AU MOINS SÛR, PAR NIVEAUX D'ÉGALITÉ. À un même niveau, une ligne lue qui a plusieurs candidates, ou
  // une ligne attendue que plusieurs lignes lues réclament, ne s'attribue pas : elle est ambiguë, et la ligne
  // attendue disputée sort du jeu (la donner ensuite à un candidat plus faible serait choisir en silence).
  for (let k = 0; k < evaluations.length;) {
    let fin = k;
    while (fin < evaluations.length && Math.abs(evaluations[fin].score - evaluations[k].score) < EPS) fin += 1;
    const niveau = evaluations.slice(k, fin).filter((e) => !luFixe.has(e.i) && !attenduePrise.has(e.j) && !attendueDisputee.has(e.j));
    const parLu = new Map<number, Evaluation[]>();
    const parAttendue = new Map<number, Evaluation[]>();
    for (const e of niveau) {
      parLu.set(e.i, [...(parLu.get(e.i) ?? []), e]);
      parAttendue.set(e.j, [...(parAttendue.get(e.j) ?? []), e]);
    }
    const ambigues = new Set<number>();
    const disputees = new Set<number>();
    for (const e of niveau) {
      if ((parLu.get(e.i)?.length ?? 0) > 1 || (parAttendue.get(e.j)?.length ?? 0) > 1) { ambigues.add(e.i); disputees.add(e.j); }
    }
    for (const e of niveau) {
      if (ambigues.has(e.i) || disputees.has(e.j) || luFixe.has(e.i) || attenduePrise.has(e.j)) continue;
      // CERTAINE seulement si aucune AUTRE ligne attendue ne porte la même évidence (désignation et prix).
      const rivale = evaluations.some((x) => x.i === e.i && x.j !== e.j && x.sim >= SEUIL_CERTAIN && x.prix);
      const statut: StatutAppariement = e.sim >= SEUIL_CERTAIN && e.prix && !rivale ? "CERTAINE" : "PROBABLE";
      lignes[e.i] = { statut, attendueId: attendues[e.j].id, candidats: [], score: e.score, phrase: null };
      luFixe.add(e.i);
      attenduePrise.add(e.j);
    }
    for (const i of ambigues) {
      const candidats = niveau.filter((e) => e.i === i).map((e) => e.j);
      lignes[i] = {
        statut: "AMBIGUE", attendueId: null, candidats: candidats.map((j) => attendues[j].id), score: niveau.find((e) => e.i === i)?.score ?? 0,
        phrase: phraseLigneAmbigue(lues[i].designation, candidats.map((j) => attendues[j].designation)),
      };
      luFixe.add(i);
    }
    for (const j of disputees) attendueDisputee.add(j);
    k = fin;
  }

  // Une ligne lue dont TOUTES les candidates ont été disputées à égalité par d'autres reste ambiguë, avec elles ;
  // celle qui n'avait aucune candidate, ou dont les candidates sont prises par plus sûr qu'elle, est HORS.
  for (let i = 0; i < lues.length; i++) {
    if (luFixe.has(i)) continue;
    const disputees = [...new Set(evaluations.filter((e) => e.i === i && attendueDisputee.has(e.j)).map((e) => e.j))];
    lignes[i] = disputees.length > 0
      ? { statut: "AMBIGUE", attendueId: null, candidats: disputees.map((j) => attendues[j].id), score: 0, phrase: phraseLigneAmbigue(lues[i].designation, disputees.map((j) => attendues[j].designation)) }
      : { statut: "HORS", attendueId: null, candidats: [], score: 0, phrase: phraseLigneHors(lues[i].designation) };
  }

  return { lignes, attenduesLibres: attendues.filter((_, j) => !attenduePrise.has(j)).map((a) => a.id) };
}
