import type { LigneProposee } from "@/lib/pieces-lues/confirmation";
import type { ResultatControle } from "@/lib/pieces-lues/controle";
import type { EntetesReperes } from "@/lib/pieces-lues/entetes";
import { apparierLignes, type StatutAppariement } from "@/lib/pieces-lues/appariement";
import type { PieceLue } from "@/lib/pieces-lues/structure";
import { resteAFacturer, type LigneBC } from "@/lib/promo-material/achats";

/**
 * LA FACTURE PROMO PRÉREMPLIE DEPUIS SA LECTURE, APPARIÉE AUX LIGNES DU BC (lot D2-F, §118.200).
 *
 * Une facture découle d'un BC : chaque ligne lue cherche SA ligne de BC, et trois issues seulement.
 * CERTAINE ou PROBABLE : la ligne lue est reportée sur cette ligne du BC, quantité et prix lus.
 * AMBIGUË : rien n'est choisi — deux lignes du BC lui ressemblent à égalité, et choisir à la place de
 * la personne collerait un prix sur la mauvaise commande (§104.7). HORS BC : listée, jamais reportée
 * d'office sur une autre ligne — on ne paie pas ce que personne n'a commandé (§118.165). Le plafond,
 * lui, reste la règle de l'action (`validerLignesFacture`) : ce module propose, il ne valide rien.
 */
export interface LigneFactureProposee {
  rang: number;
  designation: string;
  quantite: number | null;
  prixUnitaire: number | null;
  statut: StatutAppariement;
  /** La ligne du BC retenue — CERTAINE ou PROBABLE seulement. */
  quoteLineId: string | null;
  /** AMBIGUË : les lignes du BC entre lesquelles rien n'est choisi. */
  candidats: string[];
  phrase: string | null;
}

export interface PrerempliFacturePromo {
  lignes: LigneFactureProposee[];
  /** Les lignes du BC qui restent à facturer et qu'aucune ligne lue n'a prises. */
  bcLibres: string[];
  reference: string | null;
  totalImprime: number | null;
  /** Le total repéré sur la pièce et celui que le modèle a lu ne disent pas la même chose. */
  desaccordTotal: string | null;
}

/** Ce que la confirmation compare : les lignes lues TELLES QUE L'ÉCRAN LES PROPOSE. */
export function lignesProposeesFacturePromo(piece: PieceLue | null): LigneProposee[] {
  if (!piece) return [];
  return piece.lignes.filter((l) => !l.section).map((l) => ({ rang: l.rang, designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire }));
}

export function preremplirFacturePromo(
  piece: PieceLue | null,
  entetes: Pick<EntetesReperes, "totalTtc" | "netAPayer" | "numero">,
  controle: ResultatControle | null,
  lignesBC: readonly LigneBC[],
): PrerempliFacturePromo {
  const lues = lignesProposeesFacturePromo(piece);
  const ouvertes = lignesBC.filter((l) => resteAFacturer(l) > 0);
  const app = apparierLignes(lues, ouvertes.map((l) => ({ id: l.quoteLineId, designation: l.designation, quantite: resteAFacturer(l), prixUnitaire: l.prixUnitaire })));
  const lignes = lues.map((l, i) => {
    const p = app.lignes[i];
    const retenue = p.statut === "CERTAINE" || p.statut === "PROBABLE" ? p.attendueId : null;
    return { ...l, statut: p.statut, quoteLineId: retenue, candidats: p.statut === "AMBIGUE" ? p.candidats : [], phrase: p.phrase };
  });
  const totalImprime = entetes.totalTtc?.valeur ?? entetes.netAPayer?.valeur ?? null;
  const desaccord = (controle?.desaccords ?? []).find((d) => d.quoi !== "LIGNE");
  return {
    lignes,
    bcLibres: app.attenduesLibres,
    reference: entetes.numero?.valeur ?? null,
    totalImprime,
    desaccordTotal: desaccord?.phrase ?? null,
  };
}
