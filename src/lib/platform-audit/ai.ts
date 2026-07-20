import { aiConfigured, askClaude } from "@/lib/ai";
import type { PlatformDiagnostic, Finding } from "./engine";

/**
 * Couche « idées » du diagnostic : on donne à Claude la photographie factuelle de la
 * plateforme (constats, formats acceptés, couverture des rôles, volumétrie, matrice
 * RBAC) et on lui demande des propositions CONCRÈTES — corrections prioritaires,
 * simplifications, améliorations, réglages rapides. Réutilise l'infra IA existante
 * (`src/lib/ai.ts`) : clé, modèle et proxy déjà configurés.
 */

export interface IdeasResult { ok: boolean; configured: boolean; text?: string; error?: string }

function fmtFinding(f: Finding): string {
  return `- [${f.severity}] (${f.area}) ${f.title} — ${f.detail}${f.suggestion ? ` · Piste: ${f.suggestion}` : ""}`;
}

function buildPrompt(d: PlatformDiagnostic): string {
  const findings = d.findings.length ? d.findings.map(fmtFinding).join("\n") : "(aucun constat automatique)";
  const uploads = d.uploads.map((u) => `- ${u.label} [${u.strategy}, max ${u.maxMb} Mo] · refuse: ${u.rejected.map((x) => "." + x).join(", ") || "aucun"}`).join("\n");
  const roles = d.roles.map((r) => `- ${r.label}: ${r.active} actif(s)${r.active === 0 ? " ⚠" : ""}`).join("\n");
  const stats = d.moduleStats.map((s) => `- ${s.label}: ${s.count}`).join("\n");
  const rbac = d.rbac.map((r) => `- ${r.label}: ${r.globalView ? "tous" : r.modules} module(s)`).join("\n");

  return [
    "Tu es directeur technique + designer produit d'un ERP interne (Adventum Pharma, Algérie ; Next.js, RBAC, DZD).",
    "Voici le diagnostic factuel automatique de la plateforme. À partir de CES faits uniquement (n'invente aucune",
    "donnée), rends une analyse en FRANÇAIS, en Markdown clair, structurée EXACTEMENT ainsi :",
    "",
    "## Verdict",
    "Une phrase franche sur l'état de santé (mentionne le score).",
    "## Corrections prioritaires",
    "Les constats critiques/avertissements, du plus urgent au moins, avec pour chacun la cause probable et une correction concrète et actionnable.",
    "## Simplifications",
    "2 à 5 idées pour réduire la complexité (fusionner des écrans/rôles, retirer l'inutilisé au vu de la volumétrie, alléger un parcours).",
    "## Améliorations",
    "2 à 5 idées à fort impact (automatisations, garde-fous, UX, notifications) réalistes pour cette plateforme.",
    "## Réglages rapides",
    "Quick-wins de configuration immédiats (ex. accepter un format de fichier manquant, créer/activer un rôle absent, ajuster une limite).",
    "",
    "Sois concret et spécifique aux faits ci-dessous. Pas de généralités creuses. Pas de préambule.",
    "",
    `### Faits`,
    `Score de santé: ${d.healthScore}/100 · ${d.counts.pages} entrées de menu · ${d.counts.roles} rôles · ${d.counts.modules} modules.`,
    "",
    "Constats:",
    findings,
    "",
    "Formats de fichiers acceptés par espace:",
    uploads,
    "",
    "Couverture des rôles critiques:",
    roles,
    "",
    "Volumétrie (données réelles):",
    stats,
    "",
    "Matrice RBAC (modules visibles par rôle):",
    rbac,
  ].join("\n");
}

export async function generateIdeas(d: PlatformDiagnostic): Promise<IdeasResult> {
  if (!aiConfigured()) return { ok: false, configured: false, error: "IA non configurée (ANTHROPIC_API_KEY absente)." };
  const r = await askClaude(buildPrompt(d), { maxTokens: 2200, temperature: 0.4 });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Réponse IA vide." };
  return { ok: true, configured: true, text: r.text.trim() };
}
