/**
 * Rapprochements PCH pour les appels d'offres — **serveur uniquement** :
 *  1. VERROU PRIX depuis les réceptions PCH 2025 (données réelles Pharmatool), en vérifiant
 *     DCI + dosage + forme — renvoie le prix unitaire de référence effectivement reçu.
 *  2. NOMENCLATURE — présence à l'enregistrement (avec origine importation / fabrication locale).
 *
 * Aucune donnée simulée : s'appuie sur les jeux `pch` (réceptions 2025) et `nom` (nomenclature).
 */
import { getMarketData } from "./data";
import { normText, queryTokens, allTokensIn } from "./engine";

export interface PchPriceMatch {
  unitPriceDzd: number | null;
  devise: string | null;
  forme: string | null;
  cond: string | null; // conditionnement (« boîte de N »)
  label: string; // libellé de la ligne Réception rapprochée
  date: string | null;
}

/**
 * Verrou prix : cherche dans les réceptions PCH 2025 la ligne correspondant au produit
 * (tous les tokens DCI + dosage présents ET forme compatible si fournie), avec un prix
 * unitaire non nul. Priorité à la réception la plus récente puis à la plus grosse valeur.
 */
export function pchReceptionPrice(dci: string, dosage?: string | null, form?: string | null): PchPriceMatch | null {
  const data = getMarketData();
  const qt = queryTokens(normText([dci, dosage].filter(Boolean).join(" ")));
  if (!qt.length) return null;
  const formNorm = normText(form ?? "");
  const cands = data.pch.filter((r) => {
    if (r.unitPrice == null || r.unitPrice <= 0) return false;
    const hay = normText(`${r.full ?? ""} ${r.text ?? ""}`);
    if (!allTokensIn(hay, qt)) return false;
    if (formNorm && r.forme && !normText(r.forme).includes(formNorm) && !hay.includes(formNorm)) return false;
    return true;
  });
  if (!cands.length) return null;
  cands.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.valDzd ?? 0) - (a.valDzd ?? 0));
  const best = cands[0];
  return { unitPriceDzd: best.unitPrice, devise: best.devise, forme: best.forme, cond: best.cond, label: (best.full ?? best.text ?? dci).slice(0, 160), date: best.date };
}

export interface NomMatch { count: number; registered: boolean; origins: string; labs: string }

/** Présence à la nomenclature (enregistrements), en vérifiant DCI + dosage + forme. */
export function nomenclatureMatch(dci: string, dosage?: string | null, form?: string | null): NomMatch {
  const data = getMarketData();
  const qt = queryTokens(normText([dci, dosage].filter(Boolean).join(" ")));
  if (!qt.length) return { count: 0, registered: false, origins: "", labs: "" };
  const formNorm = normText(form ?? "");
  const rows = data.nom.filter((r) => {
    const hay = normText(`${r.dciNorm ?? r.dci ?? ""} ${r.dosageNorm ?? r.dosage ?? ""} ${r.full ?? ""}`);
    if (!allTokensIn(hay, qt)) return false;
    if (formNorm && r.formeNorm && !normText(r.formeNorm).includes(formNorm) && !hay.includes(formNorm)) return false;
    return true;
  });
  const origins = [...new Set(rows.map((r) => r.origin).filter(Boolean) as string[])].join(", ");
  const labs = [...new Set(rows.map((r) => r.lab).filter(Boolean) as string[])].slice(0, 5).join("; ");
  return { count: rows.length, registered: rows.length > 0, origins, labs };
}
