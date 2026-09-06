/**
 * LA CALIBRATION D'UN TOUR — ce que le tour a établi, mesuré à la fin, et ce que ça commande.
 *
 * Les faits du tour (F8) sont calibrés contre les ANCRES de la question (montants, références,
 * noms) : un montant demandé qu'aucun fait ne porte rend le tour MANQUANT. Le résultat porte la
 * calibration ; une action proposée sous MANQUANT ou CONTRADICTION reçoit un avertissement que
 * l'écran montre AVANT la confirmation — le code le dit, on ne compte pas sur le modèle pour
 * l'avoir dit.
 */

import { ancresNominales, ancresNumeriques, type FaitSource } from "@/platform/in-process/fabric/provenance";
import { calibrer, enjeuDe, expliquerCalibration, type Calibration } from "./calibrate";

export interface ResultatCalibrable {
  trace: string[];
  proposals?: { warnings: string[]; fields?: { label: string; value: string }[] }[];
  proposal?: { warnings: string[]; fields?: { label: string; value: string }[] };
}

const montantDe = (p: { fields?: { label: string; value: string }[] }): number | null => {
  for (const f of p.fields ?? []) {
    if (!/montant|total|prix|somme/i.test(f.label)) continue;
    const n = Number(f.value.replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Calibre le tour et ANNOTE le résultat : la trace porte la certitude, les propositions leurs avertissements. */
export function calibrerTour<T extends ResultatCalibrable>(question: string, faits: readonly FaitSource[], r: T): { resultat: T; calibration: Calibration } {
  const propositions = r.proposals?.length ?? (r.proposal ? 1 : 0);
  const montants = (r.proposals ?? (r.proposal ? [r.proposal] : [])).map(montantDe).filter((m): m is number => m !== null);
  const enjeu = enjeuDe(question, { propositions, montantMax: montants.length ? Math.max(...montants) : null });
  const requis = [...ancresNumeriques(question), ...ancresNominales(question)].slice(0, 8);
  // Sans lecture, un tour de salutation ou d'accord n'est pas « manquant » : rien n'était exigé.
  const calibration = faits.length || requis.length ? calibrer(faits, { requis: faits.length ? requis : [], enjeu }) : calibrer(faits, { enjeu });
  const avertissement = calibration.certitude === "MANQUANT" || calibration.certitude === "CONTRADICTION"
    ? `Calibration : ${expliquerCalibration(calibration)} — à lever avant de confirmer.`
    : null;
  const annoter = <P extends { warnings: string[] }>(p: P): P => (avertissement && !p.warnings.includes(avertissement) ? { ...p, warnings: [...p.warnings, avertissement] } : p);
  const resultat: T = {
    ...r,
    trace: faits.length ? [...r.trace, expliquerCalibration(calibration)] : r.trace,
    ...(r.proposals ? { proposals: r.proposals.map(annoter) } : {}),
    ...(r.proposal ? { proposal: annoter(r.proposal) } : {}),
  };
  return { resultat, calibration };
}
