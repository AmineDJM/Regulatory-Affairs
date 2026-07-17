/**
 * ANALYSE IA d'une étude de marché → structure d'une présentation stratégique — **serveur uniquement**.
 *
 * Alimente la génération de présentations PPTX (Business Development). L'IA reçoit **tout le contexte**
 * de l'étude (toutes les lignes, acteurs, chiffres, commentaires) et renvoie une analyse **structurée**
 * (JSON) : synthèse factuelle + **opinion argumentée** (uniquement dans les champs dédiés) + recommandation.
 *
 * Garde-fous anti-hallucination : l'IA ne s'appuie QUE sur les chiffres fournis ; elle n'invente jamais
 * un acteur, une part de marché ou une valeur absente des données. Les commentaires ajoutés par
 * l'utilisateur (relance) réorientent l'analyse sans introduire de données inventées.
 */

import { askClaude, aiConfigured, aiModel } from "@/lib/ai";
import type { ResearchDetail } from "@/lib/queries/market-research";

const STATUS_FR: Record<string, string> = { IMPORT: "Importation", MANUFACTURING: "Fabrication locale" };

/** Analyse structurée renvoyée par l'IA — sert de source de vérité à la présentation PPTX. */
export interface PresentationAnalysis {
  executiveSummary: string; // synthèse globale, factuelle (2-4 phrases)
  marketOverview: string; // panorama du marché total (taille, structure)
  productAnalyses: { product: string; analysis: string }[]; // une entrée par produit — droit au but
  competition: string; // paysage concurrentiel (importation vs fabrication locale)
  opportunities: string[]; // opportunités identifiées à partir des données
  risks: string[]; // risques / barrières
  opinion: string; // L'OPINION du modèle — recommandation stratégique argumentée
  recommendation: string; // reco finale synthétique (une phrase claire)
}

export interface PresentationAnalysisResult {
  ok: boolean;
  configured: boolean;
  data?: PresentationAnalysis;
  model?: string;
  error?: string;
}

const SYSTEM = `Tu es un analyste stratégique senior du marché pharmaceutique algérien, au service d'Adventum
Pharma (laboratoire algérien, devise DZD, marché suivi en USD pour les tailles de marché). Tu prépares le
contenu d'une PRÉSENTATION stratégique à partir d'une étude de marché concurrentielle.

Tu renvoies UNIQUEMENT un objet JSON valide (aucun texte autour, aucun markdown) avec EXACTEMENT ces clés :
- "executiveSummary" : synthèse globale FACTUELLE de l'étude en 2 à 4 phrases (taille du marché total,
  nombre de produits/molécules étudiés, structure). Aucune opinion ici.
- "marketOverview" : panorama du marché (valeur $ et volume agrégés, prix moyens, concentration). Factuel.
- "productAnalyses" : tableau ; UN objet par produit/molécule de l'étude, { "product": "<nom exact>",
  "analysis": "<2-3 phrases DROIT AU BUT : taille, prix, intensité concurrentielle, positionnement
  importation vs fabrication locale, et ton avis sur l'attractivité de CE produit>" }.
- "competition" : lecture du paysage concurrentiel (poids de l'importation vs fabrication locale, acteurs
  dominants NOMMÉS uniquement s'ils figurent dans les données). Factuel.
- "opportunities" : tableau de 2 à 5 opportunités concrètes DÉDUITES des données (chaîne courte chacune).
- "risks" : tableau de 2 à 5 risques / barrières DÉDUITS des données (chaîne courte chacune).
- "opinion" : TON OPINION argumentée d'analyste — sur quels produits/segments Adventum devrait se
  positionner en priorité et pourquoi, en t'appuyant sur les chiffres. C'est le SEUL endroit (avec
  recommendation) où tu donnes un avis tranché. 3 à 6 phrases.
- "recommendation" : recommandation finale en UNE phrase claire et actionnable.

RÈGLES ABSOLUES :
1. N'invente JAMAIS un chiffre, un acteur, une part de marché, un prix ou un produit absent des données
   fournies. Si une donnée manque, dis-le ("non renseigné") plutôt que de l'inventer.
2. Va DROIT AU BUT — pas de remplissage, pas de généralités creuses sur "le marché pharmaceutique".
3. Ton opinion n'apparaît QUE dans "opinion", "recommendation" et le jugement d'attractivité de
   "productAnalyses". Les autres champs restent strictement factuels.
4. Si des commentaires additionnels sont fournis, RÉORIENTE l'analyse en conséquence (angle, priorités)
   sans jamais introduire de données non fournies.
5. Écris en français professionnel.`;

/** Construit la représentation textuelle COMPLÈTE de l'étude passée à l'IA (contexte intégral). */
function buildContext(d: ResearchDetail): string {
  const lines: string[] = [];
  lines.push(`ÉTUDE DE MARCHÉ : ${d.title}`);
  if (d.notes) lines.push(`Notes : ${d.notes}`);
  lines.push(`Nombre de produits/molécules étudiés : ${d.rows.length}`);
  lines.push("");
  d.rows.forEach((r, i) => {
    lines.push(`--- Produit ${i + 1} : ${r.product} ---`);
    if (r.therapeuticClass) lines.push(`Classe thérapeutique : ${r.therapeuticClass}`);
    lines.push(`Taille du marché (volume, boîtes) : ${r.marketVolume ?? "non renseigné"}`);
    lines.push(`Taille du marché (valeur, $) : ${r.marketValueUsd ?? "non renseigné"}`);
    lines.push(`Prix moyen par boîte ($) : ${r.avgPricePerBoxUsd ?? "non renseigné"}`);
    lines.push(`Nombre d'acteurs : ${r.players.length}`);
    if (r.players.length) {
      r.players.forEach((p) => {
        const parts = [`  • ${p.name}`];
        if (p.marketShareValue != null) parts.push(`part de marché (valeur) : ${p.marketShareValue}`);
        if (p.status) parts.push(STATUS_FR[p.status] ?? p.status);
        lines.push(parts.join(" — "));
      });
    }
    if (r.comment) lines.push(`Commentaire : ${r.comment}`);
    lines.push("");
  });
  return lines.join("\n");
}

function extractJson(text: string): PresentationAnalysis | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as Partial<PresentationAnalysis> & Record<string, unknown>;
    const strArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [];
    const products = Array.isArray(raw.productAnalyses)
      ? raw.productAnalyses
          .filter((p): p is { product: string; analysis: string } => Boolean(p && typeof p === "object"))
          .map((p) => ({ product: String((p as { product?: unknown }).product ?? "").trim(), analysis: String((p as { analysis?: unknown }).analysis ?? "").trim() }))
          .filter((p) => p.product || p.analysis)
      : [];
    return {
      executiveSummary: String(raw.executiveSummary ?? "").trim(),
      marketOverview: String(raw.marketOverview ?? "").trim(),
      productAnalyses: products,
      competition: String(raw.competition ?? "").trim(),
      opportunities: strArr(raw.opportunities),
      risks: strArr(raw.risks),
      opinion: String(raw.opinion ?? "").trim(),
      recommendation: String(raw.recommendation ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Analyse une étude de marché et renvoie la structure de présentation.
 * `instruction` = commentaires additionnels de l'utilisateur (relance ciblée) — optionnel.
 * Palier QUALITÉ (raisonnement stratégique) via askClaude ; surchargable par AI_MODEL.
 */
export async function analyzeMarketResearch(d: ResearchDetail, instruction?: string): Promise<PresentationAnalysisResult> {
  if (!aiConfigured()) return { ok: false, configured: false, error: "Clé ANTHROPIC_API_KEY non configurée." };
  if (!d.rows.length) return { ok: false, configured: true, error: "L'étude ne contient aucune ligne à analyser." };

  const context = buildContext(d);
  const extra = instruction && instruction.trim()
    ? `\n\nCOMMENTAIRES ADDITIONNELS À PRENDRE EN COMPTE (réoriente l'analyse en conséquence, sans inventer de données) :\n"""${instruction.trim().slice(0, 4000)}"""`
    : "";
  const prompt = `Voici l'intégralité des données de l'étude de marché à analyser :\n\n"""${context.slice(0, 24000)}"""${extra}\n\nRenvoie l'analyse structurée en JSON (les clés demandées, rien d'autre).`;

  const r = await askClaude(prompt, { system: SYSTEM, maxTokens: 3000, temperature: 0.2 });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Analyse impossible." };
  const data = extractJson(r.text);
  if (!data) return { ok: false, configured: true, error: "Réponse IA non exploitable." };
  return { ok: true, configured: true, data, model: aiModel() };
}
