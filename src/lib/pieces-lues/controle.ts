/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRÔLE ARITHMÉTIQUE D'UNE PIÈCE LUE — les lignes recalculées contre les totaux imprimés
 * (lot D2, P3, P4, §118.16, §118.59).
 *
 * Les lignes lues sont recalculées par `calculerTotaux` — LA SEULE arithmétique commerciale du
 * dépôt (TVA par taux, taxes additionnelles HORS base de TVA, timbre sur un règlement en espèces,
 * remises), au centime —, puis comparées aux totaux REPÉRÉS sur le papier par un chemin qui ne
 * doit rien au modèle (`entetes.ts`), à ± 1 DZD. Trois listes, et chacune est NOMMÉE :
 *
 *   ECARTS      — un total recalculé qui ne tombe pas sur le total imprimé ;
 *   MANQUES     — ce qui n'a PAS pu être contrôlé : un total absent du papier, illisible, imprimé
 *                 deux fois différemment, une ligne au chiffre illisible, un taux de TVA inconnu.
 *                 UN TOTAL ABSENT N'EST JAMAIS UN ACCORD : `conforme` ne vaut vrai que si les trois
 *                 listes sont vides ;
 *   DESACCORDS  — deux lectures du même chiffre qui divergent : le total du repérage contre celui
 *                 du modèle, ou une ligne dont quantité × prix ne fait pas le montant imprimé.
 *
 * Rien n'est deviné : un taux de TVA de ligne inconnu n'est pas remplacé par 19 % (la TVA et le
 * TTC ne sont alors pas contrôlés, et c'est dit) ; une ligne au prix illisible n'est pas recalculée
 * « sans elle ». Les écarts se calculent en CENTIMES entiers : 1,40 - 0,30 fait 1,10, pas
 * 1,0999999999999999.
 *
 * Module PUR.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  arrondirCentimes, calculerTotaux, type LigneCommerciale, type ModePaiement, type TotauxCommerciaux,
} from "@/lib/artifact/factory/commercial";
import type { ConflitRepere, Repere, TotauxReperes } from "@/lib/pieces-lues/entetes";
import {
  PHRASE_AUCUNE_LIGNE, PHRASE_REMISE_GLOBALE_ILLISIBLE, causeTvaSurTaxes, nomDuTotal, phraseConflit, phraseDesaccord,
  phraseDesaccordLigne, phraseDeviseEtrangere, phraseEcartTotal, phraseLignesIncompletes, phraseTaxeNonReperee,
  phraseTotalAbsent, phraseTotalIllisible, phraseTvaInconnue,
} from "@/lib/pieces-lues/phrases";
import type { LigneLue, PieceLue } from "@/lib/pieces-lues/structure";

/** ± 1 DZD — la tolérance de toutes les retranscriptions du dépôt (`ecartDeRetranscription`, `ecartTotalImprime`). */
export const TOLERANCE_CENTIMES = 100;

export type QuoiTotal = "HT" | "TVA" | "TVA_TOTAL" | "TAXE" | "TIMBRE" | "TTC" | "NET";

export interface EcartControle {
  quoi: QuoiTotal;
  taux: number | null;
  libelle: string | null;
  calcule: number;
  imprime: number;
  /** Imprimé - calculé, au centime. */
  ecart: number;
  phrase: string;
}

export interface ManqueControle {
  quoi: QuoiTotal | "LIGNES" | "TVA_LIGNES" | "REMISE" | "DEVISE";
  phrase: string;
}

export interface DesaccordControle {
  quoi: QuoiTotal | "LIGNE";
  /** Le rang de la ligne, pour un désaccord de ligne. */
  rang: number | null;
  repere: number;
  modele: number;
  phrase: string;
}

export interface ResultatControle {
  ecarts: EcartControle[];
  manques: ManqueControle[];
  desaccords: DesaccordControle[];
  /**
   * Les totaux recalculés depuis les lignes ; `null` quand ils ne peuvent pas l'être. Quand
   * `tvaControlee` est faux, seuls le HT et les taxes en sont fiables.
   */
  calcule: TotauxCommerciaux | null;
  tvaControlee: boolean;
  /** Vrai seulement si RIEN n'est à dire : ni écart, ni manque, ni désaccord. */
  conforme: boolean;
}

const centimes = (x: number): number => Math.round(arrondirCentimes(x) * 100);
const dzd = (c: number): number => c / 100;
const memeTaux = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/** Une ligne qu'on ne peut pas recalculer : quantité, prix ou remise illisible (ou absent alors que la ligne est chiffrée). */
const incomplete = (l: LigneLue): boolean =>
  l.quantite === null || l.prixUnitaire === null || l.illisibles.some((i) => i.champ === "remise");

export function controlerPiece(piece: PieceLue, reperes: TotauxReperes): ResultatControle {
  const ecarts: EcartControle[] = [];
  const manques: ManqueControle[] = [];
  const desaccords: DesaccordControle[] = [];
  const conflitSur = (quoi: ConflitRepere["quoi"], taux?: number) =>
    reperes.conflits.some((k) => k.quoi === quoi && (taux === undefined || (typeof k.taux === "number" && memeTaux(k.taux, taux))));

  // ── 0. Ce qui empêche de contrôler, dit avant tout le reste. (Une date en conflit regarde l'en-tête, pas le calcul.)
  for (const k of reperes.conflits) if (k.quoi !== "DATE") manques.push({ quoi: k.quoi, phrase: phraseConflit(k.champ, k.valeurs) });
  if (piece.devise && piece.devise !== "DZD") {
    manques.push({ quoi: "DEVISE", phrase: phraseDeviseEtrangere(piece.devise) });
    return { ecarts, manques, desaccords, calcule: null, tvaControlee: false, conforme: false };
  }

  // ── 1. Les lignes, recalculées par l'arithmétique commune — ou pas du tout. ───────────────
  const chiffrees = piece.lignes.filter((l) => !l.section);
  let calcule: TotauxCommerciaux | null = null;
  let tvaControlee = false;
  if (chiffrees.length === 0) {
    manques.push({ quoi: "LIGNES", phrase: PHRASE_AUCUNE_LIGNE });
  } else if (chiffrees.some(incomplete)) {
    manques.push({ quoi: "LIGNES", phrase: phraseLignesIncompletes(chiffrees.filter(incomplete).map((l) => l.rang)) });
  } else if (piece.illisibles.some((i) => i.champ === "remiseGlobale")) {
    manques.push({ quoi: "REMISE", phrase: PHRASE_REMISE_GLOBALE_ILLISIBLE });
  } else {
    // LE TAUX D'UNE LIGNE QUI N'EN DIT PAS : celui que le papier imprime s'il n'y en a qu'un (repérage), sinon le
    // taux unique lu par le modèle ; sinon INCONNU — et la TVA n'est pas contrôlée, plutôt que d'y mettre 19 %.
    const tauxDefaut = reperes.tva.length === 1 ? reperes.tva[0].taux : piece.tvaDefaut;
    const sansTaux = chiffrees.filter((l) => (l.tva === null && tauxDefaut === null) || l.illisibles.some((i) => i.champ === "tva"));
    tvaControlee = sansTaux.length === 0;
    if (!tvaControlee) manques.push({ quoi: "TVA_LIGNES", phrase: phraseTvaInconnue(sansTaux.map((l) => l.rang)) });

    // Les taxes additionnelles : leur taux IMPRIMÉ (repérage) d'abord, celui du modèle sinon.
    const taxes = reperes.taxes.length > 0
      ? reperes.taxes.map((t) => ({ libelle: t.libelle, taux: t.taux }))
      : piece.taxes.filter((t): t is typeof t & { taux: number } => t.taux !== null).map((t) => ({ libelle: t.libelle, taux: t.taux }));
    // Un timbre imprimé dit à lui seul que le règlement est en espèces.
    const timbreImprime = reperes.timbre?.valeur ?? null;
    const mode: ModePaiement | null = (timbreImprime !== null && timbreImprime > 0) || piece.modePaiement === "ESPECES" ? "ESPECES" : null;
    const lignes: LigneCommerciale[] = chiffrees.map((l) => ({
      designation: l.designation, quantite: l.quantite as number, prixUnitaire: l.prixUnitaire as number,
      remise: l.remise, tva: l.tva ?? tauxDefaut ?? 0,
    }));
    calcule = calculerTotaux({ lignes, tvaDefaut: tauxDefaut ?? 0, remiseGlobale: piece.remiseGlobale, taxes, modePaiement: mode });
    if (reperes.taxes.length === 0 && !conflitSur("TAXE")) {
      for (const t of calcule.taxes) manques.push({ quoi: "TAXE", phrase: phraseTaxeNonReperee(nomDuTotal("TAXE", t.taux, t.libelle)) });
    }
  }

  // ── 2. Les totaux imprimés, un par un. Absent ou illisible : NOMMÉ. ──────────────────────
  const comparer = (quoi: QuoiTotal, repere: Repere<number> | null, valeur: number | null, o: { taux?: number; libelle?: string; nommerAbsence: boolean; cause?: (imprime: number) => string | null }) => {
    const nom = nomDuTotal(quoi, o.taux ?? null, o.libelle ?? null);
    if (!repere) {
      if (o.nommerAbsence && !conflitSur(quoi, o.taux)) manques.push({ quoi, phrase: phraseTotalAbsent(nom) });
      return;
    }
    if (repere.valeur === null) { manques.push({ quoi, phrase: phraseTotalIllisible(nom, repere.raison) }); return; }
    if (valeur === null) return;
    const ecart = centimes(repere.valeur) - centimes(valeur);
    if (Math.abs(ecart) <= TOLERANCE_CENTIMES) return;
    ecarts.push({
      quoi, taux: o.taux ?? null, libelle: o.libelle ?? null, calcule: valeur, imprime: repere.valeur, ecart: dzd(ecart),
      phrase: phraseEcartTotal(nom, valeur, repere.valeur, dzd(ecart), o.cause?.(repere.valeur) ?? null),
    });
  };

  comparer("HT", reperes.totalHt, calcule?.totalHt ?? null, { nommerAbsence: true });
  for (const t of reperes.taxes) {
    const c = calcule?.taxes.find((x) => memeTaux(x.taux, t.taux));
    comparer("TAXE", t.montant, calcule ? c?.montant ?? 0 : null, { taux: t.taux, libelle: t.libelle, nommerAbsence: false });
  }

  // LA TVA. Une TVA imprimée calculée sur le HT AUGMENTÉ des taxes additionnelles est une faute qu'on sait nommer.
  const tvaOk = calcule !== null && tvaControlee;
  const totalTaxes = calcule?.totalTaxes ?? 0;
  const causeTaxes = (taux: number) => (imprime: number): string | null => {
    if (!calcule || totalTaxes <= 0) return null;
    const base = arrondirCentimes(calcule.totalHt + totalTaxes);
    return Math.abs(centimes(imprime) - centimes(base * taux)) <= TOLERANCE_CENTIMES ? causeTvaSurTaxes(base) : null;
  };
  for (const t of reperes.tva) {
    const c = calcule?.tva.find((x) => memeTaux(x.taux, t.taux));
    comparer("TVA", t.montant, tvaOk ? c?.montant ?? 0 : null, { taux: t.taux, nommerAbsence: false, cause: causeTaxes(t.taux) });
  }
  if (tvaOk && calcule) {
    const tauxImprimes = reperes.tva.map((t) => t.taux);
    const aucuneTva = reperes.tva.length === 0 && !reperes.totalTva && !conflitSur("TVA_TOTAL") && !reperes.conflits.some((k) => k.quoi === "TVA");
    if (aucuneTva && calcule.totalTva > 0) {
      manques.push({ quoi: "TVA", phrase: phraseTotalAbsent("TVA") });
    } else if (!reperes.totalTva) {
      for (const t of calcule.tva) {
        if (t.montant > 0 && !tauxImprimes.some((x) => memeTaux(x, t.taux)) && !conflitSur("TVA", t.taux)) {
          manques.push({ quoi: "TVA", phrase: phraseTotalAbsent(nomDuTotal("TVA", t.taux)) });
        }
      }
    }
  }
  const tauxUnique = calcule && calcule.tva.length === 1 ? calcule.tva[0].taux : null;
  comparer("TVA_TOTAL", reperes.totalTva, tvaOk && calcule ? calcule.totalTva : null, { nommerAbsence: false, cause: tauxUnique !== null ? causeTaxes(tauxUnique) : undefined });

  // LE TIMBRE : dû (espèces) et absent du papier, nommé ; son MONTANT suit le TTC, donc la TVA : comparé seulement si elle l'est.
  comparer("TIMBRE", reperes.timbre, tvaOk && calcule ? calcule.timbre : null, { nommerAbsence: !!calcule && calcule.timbre > 0 });

  // LE TOTAL FINAL. Un « Total TTC » s'imprime avant ou après le timbre — les deux présentations existent : il
  // tombe juste s'il égale l'une ou l'autre. Le « Net à payer », lui, est ce que le client paie, timbre compris.
  const ttcAvantTimbre = calcule ? arrondirCentimes(calcule.totalTtc - calcule.timbre) : null;
  const finalAbsent = !reperes.totalTtc && !reperes.netAPayer && !conflitSur("TTC") && !conflitSur("NET");
  if (finalAbsent) manques.push({ quoi: "TTC", phrase: phraseTotalAbsent(`${nomDuTotal("TTC")} (ou ${nomDuTotal("NET")})`) });
  if (reperes.totalTtc) {
    let reference: number | null = null;
    const imprime = reperes.totalTtc.valeur;
    if (tvaOk && calcule && ttcAvantTimbre !== null) {
      const proche = imprime === null ? undefined : [calcule.totalTtc, ttcAvantTimbre].find((v) => Math.abs(centimes(imprime) - centimes(v)) <= TOLERANCE_CENTIMES);
      reference = proche ?? (reperes.timbre ? ttcAvantTimbre : calcule.totalTtc);
    }
    comparer("TTC", reperes.totalTtc, reference, { nommerAbsence: false });
  }
  comparer("NET", reperes.netAPayer, tvaOk && calcule ? calcule.totalTtc : null, { nommerAbsence: false });

  // ── 3. Les désaccords : deux lectures du même chiffre (P4). ──────────────────────────────
  const recouper = (quoi: QuoiTotal, repere: number | null | undefined, modele: number | null, autre?: number | null) => {
    if (repere === null || repere === undefined || modele === null) return;
    const loin = (v: number) => Math.abs(centimes(v) - centimes(modele)) > TOLERANCE_CENTIMES;
    if (loin(repere) && (autre === null || autre === undefined || loin(autre))) {
      desaccords.push({ quoi, rang: null, repere, modele, phrase: phraseDesaccord(nomDuTotal(quoi), repere, modele) });
    }
  };
  const somme = (rs: readonly Repere<number>[]): number | null =>
    rs.length > 0 && rs.every((r) => r.valeur !== null) ? dzd(rs.reduce((s, r) => s + centimes(r.valeur as number), 0)) : null;
  recouper("HT", reperes.totalHt?.valeur, piece.totaux.ht);
  recouper("TVA_TOTAL", reperes.totalTva?.valeur ?? somme(reperes.tva.map((t) => t.montant)), piece.totaux.tva);
  recouper("TAXE", somme(reperes.taxes.map((t) => t.montant)), piece.totaux.taxes);
  recouper("TIMBRE", reperes.timbre?.valeur, piece.totaux.timbre);
  recouper("TTC", reperes.totalTtc?.valeur ?? reperes.netAPayer?.valeur, piece.totaux.ttc, reperes.totalTtc ? reperes.netAPayer?.valeur : null);

  // Une ligne : quantité × prix (remise déduite) contre le montant que la ligne imprime.
  for (const l of chiffrees) {
    if (l.quantite === null || l.prixUnitaire === null || l.montantHt === null || l.illisibles.some((i) => i.champ === "remise")) continue;
    const brut = arrondirCentimes(l.quantite * l.prixUnitaire);
    const ht = arrondirCentimes(brut - arrondirCentimes(brut * (l.remise ?? 0)));
    if (Math.abs(centimes(ht) - centimes(l.montantHt)) > TOLERANCE_CENTIMES) {
      desaccords.push({ quoi: "LIGNE", rang: l.rang, repere: l.montantHt, modele: ht, phrase: phraseDesaccordLigne(l.rang, l.quantite, l.prixUnitaire, ht, l.montantHt) });
    }
  }

  return { ecarts, manques, desaccords, calcule, tvaControlee, conforme: ecarts.length === 0 && manques.length === 0 && desaccords.length === 0 };
}
