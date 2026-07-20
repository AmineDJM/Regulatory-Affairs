import type { AuditResult, Finding } from "./lib";

/**
 * Triage IA (optionnel) : on réutilise l'infrastructure IA **existante** de
 * l'application (`src/lib/ai.ts` → `askClaude`, qui respecte `ANTHROPIC_API_KEY`,
 * le modèle configuré et le proxy). Aucun nouveau SDK, aucune clé en dur. Si l'IA
 * n'est pas configurée, on renvoie `null` (le rapport déterministe reste complet).
 */
export async function aiTriage(res: AuditResult): Promise<string | null> {
  const spec = "../../src/lib/ai";
  const { aiConfigured, askClaude } = (await import(spec)) as typeof import("../../src/lib/ai");
  if (!aiConfigured()) {
    console.warn("  ⚠ IA non configurée (ANTHROPIC_API_KEY absente) — triage ignoré.");
    return null;
  }

  const fmt = (f: Finding) => `- [${f.severity}] ${f.code}${f.route ? ` ${f.route}` : ""} — ${f.message}`;
  const list = res.findings.length ? res.findings.map(fmt).join("\n") : "(aucun constat automatique)";
  const prompt = [
    "Tu es ingénieur QA d'un ERP interne (Next.js + RBAC). On te donne les constats bruts d'un",
    "auto-testeur de cohérence (pages, navigation, matrice rôles→modules). Rends une synthèse",
    "en FRANÇAIS, en Markdown, SANS préambule :",
    "1) un verdict global en une phrase,",
    "2) les constats classés du plus critique au moins critique,",
    "3) pour chacun, une piste de correction concrète et brève.",
    "Si aucun constat, confirme la cohérence et propose 2-3 vérifications complémentaires utiles.",
    "",
    `Périmètre : ${res.routeCount} pages, ${res.matrix.length} rôles.`,
    "",
    "Constats :",
    list,
  ].join("\n");

  const r = await askClaude(prompt, { maxTokens: 1400 });
  if (!r.ok || !r.text) {
    console.warn(`  ⚠ Triage IA échoué : ${r.error ?? "réponse vide"}`);
    return null;
  }
  return `## Triage IA\n\n${r.text.trim()}`;
}
