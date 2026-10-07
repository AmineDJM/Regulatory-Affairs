/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MARCHÉ D'UN PRODUIT DU CATALOGUE — part de marché, concurrents, prix de l'explorateur et
 * génériques fraîchement enregistrés (Produits 360, Direction 07/10).
 *
 * Les MÊMES sources et les MÊMES normalisations que l'Explorateur produits (`molecule.ts`) :
 * IQVIA ville (prix par boîte = valeur ÷ volume), réceptions PCH (prix unitaire d'achat),
 * Nomenclature (qui est enregistré, depuis quand). Le marché est le triplet molécule + dosage +
 * forme ; quand il ne rend rien, on élargit (forme, puis molécule) et on le DIT.
 *
 * Ce qui est « à nous » : les lignes dont la marque est l'un de nos noms (nom commercial du
 * dossier, alias) ou dont le laboratoire est l'un des nôtres (société, laboratoire partenaire,
 * détenteur de la DE). Rien d'autre — sans correspondance, la part reste `null`, pas zéro.
 *
 * ⚠️ SERVEUR UNIQUEMENT (lit `./data`, donc `fs`). Les lignes sont préparées UNE fois (radical,
 * forme, dosage, clé labo) : la liste interroge le marché pour chaque produit sans re-normaliser
 * trente mille libellés à chaque fois.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { getMarketData } from "./data";
import { normText } from "./text";
import { moleculeStem, canonicalForm, extractDosage, dosageMatches, type GalenicForm } from "./galenic";
import { labKey } from "./molecule";

interface Ligne { stem: string[]; form: GalenicForm; dosage: string | null; lab: string; labK: string; marque: string; valeur: number; volume: number; prixUnitaire: number | null; date: string | null }
interface Enreg { stem: string[]; form: GalenicForm; dosage: string | null; lab: string; labK: string; marque: string; origine: string; debut: Date | null }

let prepare: { ville: Ligne[]; hopital: Ligne[]; nom: Enreg[]; periode: string; fichier: string } | null = null;

const net = (s: string | null | undefined) => (s ?? "").trim();
const date = (s: string | null | undefined): Date | null => { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

function lignes() {
  if (prepare) return prepare;
  const { iqviaProducts, pch, nom, meta } = getMarketData();
  const ville: Ligne[] = iqviaProducts.map((r) => ({
    stem: moleculeStem(r.mol).split(" ").filter(Boolean), form: canonicalForm(r.pres), dosage: extractDosage(r.pres),
    lab: net(r.lab) || "—", labK: labKey(r.lab), marque: normText(r.brand), valeur: r.valDzd ?? 0, volume: r.vol ?? 0,
    prixUnitaire: (r.vol ?? 0) > 0 ? (r.valDzd ?? 0) / (r.vol as number) : null, date: null,
  }));
  const hopital: Ligne[] = pch.map((r) => {
    const libelle = net(r.text) || net(r.full);
    return {
      stem: moleculeStem(libelle).split(" ").filter(Boolean), form: canonicalForm(r.forme ?? libelle), dosage: extractDosage(libelle),
      lab: net(r.lab) || "—", labK: labKey(r.lab), marque: normText(r.full ?? libelle), valeur: r.valDzd ?? 0, volume: r.vol ?? r.qte ?? 0,
      prixUnitaire: r.unitPrice ?? null, date: r.date ?? null,
    };
  });
  const enregs: Enreg[] = nom.filter((r) => !r.src || r.src.toUpperCase() === "ACTIVE").map((r) => ({
    stem: moleculeStem(r.dciNorm ?? r.dci).split(" ").filter(Boolean), form: canonicalForm(r.formeNorm ?? r.forme),
    dosage: extractDosage(r.dosageNorm ?? r.dosage), lab: net(r.lab) || "—", labK: labKey(r.lab), marque: normText(r.brand),
    origine: net(r.origin).toUpperCase(), debut: date(r.enrInit),
  }));
  prepare = { ville, hopital, nom: enregs, periode: meta.period, fichier: meta.iqviaFile };
  return prepare;
}

/** La règle de `moleculeMatches`, sur des radicaux déjà calculés. */
function memeMolecule(stem: string[], q: string[]): boolean {
  return stem.length > 0 && q.every((w) => stem.some((s) => s.startsWith(w) || w.startsWith(s)));
}

function mediane(v: number[]): number | null {
  const x = v.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!x.length) return null;
  return x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2;
}

export type PerimetreMarche = "DOSAGE_FORME" | "FORME" | "MOLECULE";
export const LIBELLE_PERIMETRE: Record<PerimetreMarche, string> = {
  DOSAGE_FORME: "même molécule, dosage et forme", FORME: "même molécule et forme", MOLECULE: "même molécule, tous dosages",
};

export interface MarcheDuProduit {
  perimetre: PerimetreMarche;
  totalDzd: number;
  notreDzd: number;
  /** Notre part en valeur (ville + hôpital), `null` quand aucune ligne n'est identifiée comme nôtre. */
  partPct: number | null;
  concurrents: { lab: string; partPct: number; nous: boolean }[];
  prix: {
    /** Notre prix par boîte en ville (IQVIA : valeur ÷ volume), et la médiane du marché. */
    ville: { notre: number | null; marcheMediane: number | null };
    /** Notre prix unitaire à l'hôpital (réceptions PCH), sa date la plus récente, la médiane du marché. */
    hopital: { notre: number | null; marcheMediane: number | null; date: string | null };
  };
  /** Enregistrements d'AUTRES laboratoires sur la même molécule (et forme), datés de moins de 12 mois. */
  generiquesRecents: { lab: string; marque: string; date: string; origine: string }[];
  source: { periode: string; fichier: string };
}

export interface ProduitPourMarche {
  dci: string;
  dosage: string | null;
  /** Forme écrite (clé du menu des dossiers ou libellé) — ramenée à la famille galénique. */
  forme: string | null;
  marques: string[];
  labos: string[];
}

/** LE MARCHÉ DU PRODUIT — `null` quand la molécule est absente des trois sources. */
export function marcheDuProduit(p: ProduitPourMarche, maintenant = new Date()): MarcheDuProduit | null {
  const q = moleculeStem(p.dci).split(" ").filter(Boolean);
  if (!q.length || q.join(" ").length < 3) return null;
  const { ville, hopital, nom, periode, fichier } = lignes();
  const forme: GalenicForm | null = p.forme ? canonicalForm(p.forme) : null;
  const formeUtile = forme && forme !== "AUTRE" ? forme : null;
  const dosage = p.dosage ? extractDosage(p.dosage) : null;

  const marques = p.marques.map((m) => normText(m)).filter((m) => m.length >= 3);
  const labos = new Set(p.labos.map((l) => labKey(l)).filter((l) => l.length >= 3));
  const estANous = (l: { marque: string; labK: string }) =>
    labos.has(l.labK) || marques.some((m) => l.marque === m || l.marque.startsWith(`${m} `));

  const garder = (perim: PerimetreMarche) => (l: { stem: string[]; form: GalenicForm; dosage: string | null }) => {
    if (!memeMolecule(l.stem, q)) return false;
    if (perim !== "MOLECULE" && formeUtile && l.form !== formeUtile) return false;
    if (perim === "DOSAGE_FORME" && dosage && !dosageMatches(l.dosage, dosage)) return false;
    return true;
  };

  let perimetre: PerimetreMarche = "DOSAGE_FORME";
  let v: Ligne[] = []; let h: Ligne[] = [];
  for (const perim of ["DOSAGE_FORME", "FORME", "MOLECULE"] as const) {
    v = ville.filter(garder(perim)); h = hopital.filter(garder(perim));
    perimetre = perim;
    if (v.length + h.length > 0) break;
  }

  const parLab = new Map<string, { lab: string; valeur: number; nous: boolean }>();
  let total = 0; let notre = 0;
  for (const l of [...v, ...h]) {
    total += l.valeur;
    const nous = estANous(l);
    if (nous) notre += l.valeur;
    const k = nous ? "__nous__" : l.labK || l.lab;
    const a = parLab.get(k) ?? { lab: nous ? "Nous" : l.lab, valeur: 0, nous };
    if (!nous && l.lab.length < a.lab.length) a.lab = l.lab;
    a.valeur += l.valeur;
    parLab.set(k, a);
  }

  const notresVille = v.filter(estANous);
  const volVille = notresVille.reduce((s, l) => s + l.volume, 0);
  const notresHop = h.filter((l) => estANous(l) && l.prixUnitaire !== null);
  const qteHop = notresHop.reduce((s, l) => s + l.volume, 0);

  const limite = new Date(maintenant.getTime() - 365 * 86_400_000);
  const generiquesRecents = nom
    .filter((r) => memeMolecule(r.stem, q) && (!formeUtile || r.form === formeUtile) && r.debut && r.debut >= limite && !estANous(r))
    .sort((a, b) => (b.debut!.getTime() - a.debut!.getTime()))
    .slice(0, 10)
    .map((r) => ({ lab: r.lab, marque: r.marque || "—", date: r.debut!.toISOString().slice(0, 10), origine: r.origine || "—" }));

  if (total === 0 && generiquesRecents.length === 0 && !nom.some((r) => memeMolecule(r.stem, q))) return null;

  return {
    perimetre,
    totalDzd: total,
    notreDzd: notre,
    partPct: total > 0 && notre > 0 ? Math.round((notre / total) * 1000) / 10 : null,
    concurrents: [...parLab.values()].sort((a, b) => b.valeur - a.valeur).slice(0, 8)
      .map((a) => ({ lab: a.lab, partPct: total > 0 ? Math.round((a.valeur / total) * 1000) / 10 : 0, nous: a.nous })),
    prix: {
      ville: {
        notre: volVille > 0 ? notresVille.reduce((s, l) => s + l.valeur, 0) / volVille : null,
        marcheMediane: mediane(v.map((l) => l.prixUnitaire).filter((x): x is number => x !== null)),
      },
      hopital: {
        notre: qteHop > 0 ? notresHop.reduce((s, l) => s + (l.prixUnitaire as number) * l.volume, 0) / qteHop : (notresHop.length ? mediane(notresHop.map((l) => l.prixUnitaire as number)) : null),
        marcheMediane: mediane(h.map((l) => l.prixUnitaire).filter((x): x is number => x !== null)),
        date: notresHop.reduce<string | null>((max, l) => (l.date && (!max || l.date > max) ? l.date : max), null),
      },
    },
    generiquesRecents,
    source: { periode, fichier },
  };
}
