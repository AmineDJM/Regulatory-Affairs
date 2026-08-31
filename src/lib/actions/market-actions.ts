"use server";

import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { searchProducts, type MarketProduct, type MarketSegment } from "@/lib/market/products";
import {
  analyzeMolecule, moleculeSuggestions, labSuggestions, GALENIC_FORMS,
  type MoleculeAnalysis, type GalenicForm,
} from "@/lib/market/molecule";

export interface MarketProductSearchResult {
  ok: boolean;
  products: MarketProduct[];
  total: number;
  error?: string;
}

const asForm = (v: string | undefined | null): GalenicForm | null =>
  v && (GALENIC_FORMS as readonly string[]).includes(v) ? (v as GalenicForm) : null;

/**
 * QUI PEUT INTERROGER LE MARCHÉ — l'un OU l'autre des deux écrans.
 *
 * Ces trois lectures servent DEUX modules désormais distincts : « Market Intelligence » et
 * « Explorateur produits ». Les avoir gardées sur le seul droit historique aurait fait de la
 * séparation un piège : on ouvre l'Explorateur à quelqu'un, il voit l'écran, et chaque
 * recherche lui répond « Non autorisé ». Un module qu'on ouvre à moitié est pire qu'un module
 * fermé — il fait croire à une panne.
 */
const peutInterrogerLeMarche = (user: Parameters<typeof userCan>[0]): boolean =>
  userCan(user, "BUSINESS_DEVELOPMENT", "VIEW") || userCan(user, "PRODUCT_EXPLORER", "VIEW");

/**
 * Recherche de produits (marché ville IQVIA + marché hospitalier PCH) pour l'explorateur de
 * l'Intelligence marché. On cherche **par la case que l'on remplit** : molécule (comparée par
 * radical), nom de produit, ou laboratoire (réconcilié entre les trois sources).
 * Read-only ; la donnée reste côté serveur.
 */
export async function searchMarketProducts(input: {
  q?: string; molecule?: string; brand?: string; labName?: string;
  form?: string; dosage?: string; cls?: string; lab?: string; segment?: string;
}): Promise<MarketProductSearchResult> {
  const user = await requireUser();
  if (!peutInterrogerLeMarche(user)) return { ok: false, products: [], total: 0, error: "Non autorisé." };
  const segment = input.segment === "VILLE" || input.segment === "HOPITAL" ? (input.segment as MarketSegment) : null;
  const res = searchProducts({
    q: input.q, molecule: input.molecule, brand: input.brand, labName: input.labName,
    form: asForm(input.form), dosage: input.dosage,
    cls: input.cls, lab: input.lab, segment, limit: 60,
  });
  return { ok: true, products: res.products, total: res.total };
}

export interface MoleculeAnalysisResult {
  ok: boolean;
  analysis: MoleculeAnalysis | null;
  error?: string;
}

/**
 * ANALYSE D'UNE MOLÉCULE : poids du marché, partage ville / hôpital, part de marché de chaque
 * laboratoire, concentration, et qui est enregistré (fabriqué localement ou importé).
 * C'est la réponse à « qui est déjà sur ce marché, et combien pèse-t-il ? ».
 */
export async function analyzeMarketMolecule(input: {
  molecule: string; dosage?: string; form?: string;
}): Promise<MoleculeAnalysisResult> {
  const user = await requireUser();
  if (!peutInterrogerLeMarche(user)) return { ok: false, analysis: null, error: "Non autorisé." };
  const molecule = (input.molecule ?? "").trim();
  if (molecule.length < 3) return { ok: false, analysis: null, error: "Indiquez au moins 3 caractères de molécule." };
  try {
    const analysis = analyzeMolecule({ molecule, dosage: input.dosage || null, form: asForm(input.form) });
    return analysis
      ? { ok: true, analysis }
      : { ok: false, analysis: null, error: `Aucune donnée pour « ${molecule} » dans IQVIA, PCH ou la nomenclature.` };
  } catch (err) {
    console.error("[market] analyzeMarketMolecule failed", err);
    return { ok: false, analysis: null, error: "Analyse impossible." };
  }
}

/** Suggestions pendant la frappe : molécules connues (les plus grosses d'abord) et laboratoires. */
export async function marketSuggestions(kind: "molecule" | "lab", q: string): Promise<string[]> {
  const user = await requireUser();
  if (!peutInterrogerLeMarche(user)) return [];
  try {
    return kind === "molecule" ? moleculeSuggestions(q).map((m) => m.label) : labSuggestions(q);
  } catch {
    return [];
  }
}
