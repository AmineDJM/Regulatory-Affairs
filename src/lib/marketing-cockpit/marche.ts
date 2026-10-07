import { getMarketData, type IqviaRow, type NomRow, type PchRow } from "@/lib/market/data";
import { labKey } from "@/lib/market/molecule";
import { moleculeMatches } from "@/lib/market/galenic";
import { normText } from "@/lib/market/text";
import { weightedGrowthPy } from "@/lib/market/overview";
import { evolution, partsMensuelles, type LigneSerie } from "./calculs";

/**
 * LE MARCHÉ D'UN PRODUIT, VU DU MARKETING COCKPIT — lu dans les jeux RÉELS déjà embarqués (IQVIA ville, réceptions PCH
 * hôpital, Nomenclature), par les fonctions du module marché. Rien n'est inventé : là où une source ne dit rien, la
 * ligne correspondante n'existe pas.
 *
 * ⚠️ SERVEUR UNIQUEMENT — `market/data` lit des fichiers (`fs`, `zlib`). Aucun composant client ne doit l'importer
 * (`client-bundle-guard.test.ts`) : la page le lit et ne transmet que des nombres.
 *
 *   • PART DE MARCHÉ (ville) : la valeur de nos marques dans leur classe IQVIA ; la part d'il y a un an se reconstruit
 *     par la croissance de chaque ligne (valeur ÷ (1 + croissance)) — seulement si la classe est assez renseignée.
 *   • SUR 12 MOIS : IQVIA ne donne qu'un cumul annuel ; la seule série MENSUELLE réelle est celle des réceptions
 *     hospitalières (PCH) — la part de chaque laboratoire dans les réceptions de la molécule, mois par mois.
 *   • À SURVEILLER : nouvelles AMM concurrentes (Nomenclature), tendance des réceptions PCH, croissance en ville.
 */

export interface SignalMarche { ton: "ok" | "w" | "ko" | "i"; titre: string; detail: string }

export interface MarcheProduit {
  molecule: string;
  classe: string | null;
  /** Notre part de la classe IQVIA (ville), 0..1 — null si nos marques n'y sont pas reconnues. */
  part: { actuelle: number; precedente: number | null } | null;
  /** Parts mensuelles des réceptions PCH de la molécule (« nous » d'abord, puis les deux premiers concurrents). */
  serie: { mois: string[]; lignes: LigneSerie[] } | null;
  aSurveiller: SignalMarche[];
  /** Les AMM concurrentes de moins d'un an — reprises dans « Ce qui bouge ». */
  nouvellesAmm: { marque: string; labo: string; le: Date }[];
}

const clean = (s: string | null | undefined) => (s ?? "").trim();
const dateDe = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const libelleMois = (m: string): string => {
  const [a, mm] = m.split("-").map(Number);
  return `${MOIS_COURTS[(mm || 1) - 1]} ${a}`;
};
const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))} %`;

export function marcheDuProduit(p: { nom: string; dci: string | null; alias: readonly string[] }, maintenant = new Date()): MarcheProduit | null {
  const dci = clean(p.dci);
  if (dci.length < 3) return null;
  const { iqviaProducts, pch, nom } = getMarketData();
  const dciNorm = normText(dci);
  // NOS MARQUES : le nom du produit et ses alias — jamais la DCI elle-même, qui désignerait aussi tous les génériques.
  const marques = [...new Set([p.nom, ...p.alias].map(normText).filter((m) => m.length >= 3 && m !== dciNorm && !moleculeMatches(m, dci)))];
  const estNotreMarque = (brand: string | null) => {
    const b = normText(brand);
    return !!b && marques.some((m) => b === m || b.startsWith(`${m} `));
  };

  const ville = (iqviaProducts as IqviaRow[]).filter((r) => moleculeMatches(r.mol, dci));
  const nos = (iqviaProducts as IqviaRow[]).filter((r) => estNotreMarque(r.brand) && (ville.includes(r) || moleculeMatches(r.mol, dci)));
  const nosLabos = new Set(nos.map((r) => labKey(r.lab)));
  const hopital = (pch as PchRow[]).filter((r) => r.date && moleculeMatches(clean(r.text) || clean(r.full), dci));
  const enregistrements = (nom as NomRow[]).filter((r) => moleculeMatches(r.dciNorm ?? r.dci, dci) && (!r.src || r.src.toUpperCase() === "ACTIVE"));
  if (ville.length === 0 && hopital.length === 0 && enregistrements.length === 0) return null;

  // ── La classe et notre part (ville)
  const valeurParClasse = new Map<string, number>();
  for (const r of nos.length ? nos : ville) valeurParClasse.set(r.cls, (valeurParClasse.get(r.cls) ?? 0) + (r.valDzd ?? 0));
  const classe = [...valeurParClasse].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  let part: MarcheProduit["part"] = null;
  if (classe && nos.length) {
    const rows = (iqviaProducts as IqviaRow[]).filter((r) => r.cls === classe);
    const total = rows.reduce((s, r) => s + (r.valDzd ?? 0), 0);
    const nous = rows.filter((r) => nos.includes(r)).reduce((s, r) => s + (r.valDzd ?? 0), 0);
    if (total > 0) {
      const avant = (r: IqviaRow) => (r.valDzd && r.valDzd > 0 && r.growth != null && r.growth > -1 ? r.valDzd / (1 + r.growth) : null);
      const couvert = rows.filter((r) => avant(r) !== null).reduce((s, r) => s + (r.valDzd ?? 0), 0);
      const nosAvant = nos.filter((r) => r.cls === classe).map(avant);
      const totalAvant = rows.reduce((s, r) => s + (avant(r) ?? 0), 0);
      const precedente = couvert / total >= 0.8 && nosAvant.every((v) => v !== null) && totalAvant > 0
        ? nosAvant.reduce((s: number, v) => s + (v ?? 0), 0) / totalAvant
        : null;
      part = { actuelle: nous / total, precedente };
    }
  }

  // ── Les parts mensuelles des réceptions hospitalières
  const moisDispo = [...new Set(hopital.map((r) => r.date!.slice(0, 7)))].sort().slice(-12);
  const lignes = partsMensuelles(
    hopital.filter((r) => moisDispo.includes(r.date!.slice(0, 7))).map((r) => ({ mois: r.date!.slice(0, 7), cle: labKey(r.lab), nom: clean(r.lab) || "—", valeur: r.valDzd ?? 0 })),
    moisDispo, nosLabos, 2,
  );
  const serie = lignes.length && moisDispo.length >= 2 ? { mois: moisDispo, lignes } : null;

  // ── À surveiller
  const aSurveiller: SignalMarche[] = [];
  const unAn = new Date(maintenant.getTime() - 365 * 86_400_000);
  const nouvellesAmm = enregistrements
    .map((r) => ({ marque: clean(r.brand) || clean(r.dci), labo: clean(r.lab) || "—", le: dateDe(r.enrInit) }))
    .filter((r): r is { marque: string; labo: string; le: Date } => !!r.le && r.le >= unAn && r.le <= maintenant && !nosLabos.has(labKey(r.labo)))
    .sort((a, b) => b.le.getTime() - a.le.getTime());
  for (const a of nouvellesAmm.slice(0, 2)) {
    aSurveiller.push({ ton: "ko", titre: `AMM ${a.marque} (${a.labo})`, detail: `enregistrée le ${a.le.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` });
  }
  if (moisDispo.length >= 6) {
    const derniers = moisDispo.slice(-3), precedents = moisDispo.slice(-6, -3);
    const nosOuTous = (r: PchRow) => (nosLabos.size ? nosLabos.has(labKey(r.lab)) : true);
    const somme = (m: string[]) => hopital.filter((r) => m.includes(r.date!.slice(0, 7)) && nosOuTous(r)).reduce((s, r) => s + (r.valDzd ?? 0), 0);
    const e = evolution(somme(precedents), somme(derniers));
    if (e !== null) {
      aSurveiller.push({
        ton: e < -0.05 ? "w" : e > 0.05 ? "ok" : "i",
        titre: `PCH : réceptions ${nosLabos.size ? "de nos marques" : dci.toLowerCase()} ${pct(e)}`,
        detail: `${libelleMois(derniers[0])} – ${libelleMois(derniers[2])}, contre le trimestre d'avant`,
      });
    }
  }
  const baseVille = nos.length ? nos : ville;
  const croissance = weightedGrowthPy(baseVille.map((r) => r.valDzd), baseVille.map((r) => r.growth));
  if (croissance !== null) {
    aSurveiller.push({
      ton: croissance < -0.05 ? "w" : croissance > 0.05 ? "ok" : "i",
      titre: `Ville : ${pct(croissance)} en valeur${nos.length ? "" : ` (${dci.toLowerCase()}, tout le marché)`}`,
      detail: "IQVIA, 12 mois glissants",
    });
  }

  return { molecule: dci, classe, part, serie, aSurveiller, nouvellesAmm };
}
