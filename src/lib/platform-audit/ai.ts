import { aiConfigured, askClaude } from "@/lib/ai";
import type { PlatformDiagnostic, Finding } from "./engine";

/**
 * Couche « jury de design » du diagnostic. On confie à Claude la photographie factuelle
 * de la plateforme et on lui demande une revue d'expert UX/UI de classe mondiale, ancrée
 * dans les systèmes de référence (Apple HIG, Microsoft Fluent 2, Salesforce Lightning),
 * l'accessibilité (WCAG 2.2), les heuristiques de Nielsen et le contexte pharma.
 * Réutilise l'infra IA existante (`src/lib/ai.ts`).
 */

export interface IdeasResult { ok: boolean; configured: boolean; text?: string; error?: string }

function fmtFinding(f: Finding): string {
  return `- [${f.severity}] (${f.area}) ${f.title} — ${f.detail}${f.suggestion ? ` · Piste: ${f.suggestion}` : ""}`;
}

function buildPrompt(d: PlatformDiagnostic): string {
  const findings = d.findings.length ? d.findings.map(fmtFinding).join("\n") : "(aucun constat automatique)";
  const uploads = d.uploads.map((u) => `- ${u.label} [${u.strategy}, max ${u.maxMb} Mo] · accepte: ${u.accepted.map((x) => "." + x).join(",")} · refuse: ${u.rejected.map((x) => "." + x).join(",") || "aucun"}`).join("\n");
  const roles = d.roles.map((r) => `- ${r.label}: ${r.active} actif(s)${r.active === 0 ? " ⚠" : ""}`).join("\n");
  const stats = d.moduleStats.map((s) => `- ${s.label}: ${s.count}`).join("\n");
  const rbac = d.rbac.map((r) => `- ${r.label}: ${r.globalView ? "tous" : r.modules} module(s)`).join("\n");
  const g = d.design;
  const design = [
    `Navigation: ${g.menuTopLevel} entrées de 1er niveau, ${g.menuTotal} au total (onglets inclus).`,
    `Rôles: ${g.roleCount} ; modules visibles par rôle non-global — min ${g.roleModules.min}, moy ${g.roleModules.avg}, max ${g.roleModules.max}.`,
    g.redundantRoleGroups.length ? `Rôles au périmètre de vue identique: ${g.redundantRoleGroups.map((x) => "[" + x.join(" = ") + "]").join(", ")}.` : "Aucun doublon de périmètre de rôle.",
    `Politiques d'upload distinctes: ${g.uploadPolicies}.`,
    `Temps d'une requête représentative: ${g.sampleQueryMs} ms.`,
  ].join("\n");

  return [
    "RÔLE — Tu es un jury de design produit de classe mondiale : d'anciens responsables de l'Apple Human",
    "Interface Guidelines, du Microsoft Fluent 2 Design System et du Salesforce Lightning Design System, doublés",
    "d'un expert accessibilité (WCAG 2.2) et d'un designer d'ERP pharma. Tu audites « Adventum OS », un ERP",
    "interne pour un laboratoire pharmaceutique algérien (Next.js, RBAC, devise DZD, UI en français).",
    "",
    "MISSION — À partir des FAITS ci-dessous UNIQUEMENT (n'invente aucune donnée ; si un axe n'est pas mesurable",
    "ici, dis-le et explique comment le vérifier), rends une revue exigeante et actionnable, en FRANÇAIS, en",
    "Markdown. Inspire-toi explicitement des meilleures pratiques Apple / Microsoft / Salesforce et cite-les quand",
    "c'est pertinent (clarté, profondeur, déférence Apple ; cohérence et densité Fluent ; patterns et data-tables",
    "Lightning). Sois spécifique, pas de généralités creuses.",
    "",
    "STRUCTURE ATTENDUE :",
    "## Verdict de design",
    "Une phrase franche + une note globale /100.",
    "## Notes par axe",
    "Un tableau Markdown `| Axe | Note /5 | Constat clé |` couvrant EXACTEMENT ces axes :",
    "Responsivité & adaptation · Contenu & hiérarchie (fond) · Forme visuelle & composants (contenant) ·",
    "Cohérence (écrans, libellés, patterns) · Navigation, vues & onglets · Rôles & permissions ·",
    "Performance & temps de réponse · Résilience (perte de connexion, erreurs, états vides) ·",
    "Fichiers & formats · Accessibilité (WCAG) · Adéquation métier pharma.",
    "## Points forts",
    "## Corrections prioritaires",
    "Du plus urgent au moins, chacune avec cause probable + action concrète.",
    "## Inspirations à adopter",
    "3 à 6 patterns précis empruntés à Apple / Microsoft / Salesforce, applicables ici.",
    "",
    "Pour les axes non mesurables en base (responsivité réelle, temps de chargement navigateur, perte de",
    "connexion, accessibilité au clavier), note-les « à mesurer » et renvoie vers le crawl navigateur",
    "(`npm run autotest:live`, viewports mobile/tablette/desktop, offline, axe).",
    "",
    "════════ FAITS ════════",
    `Score de santé technique: ${d.healthScore}/100 · ${d.counts.pages} entrées de menu · ${d.counts.roles} rôles · ${d.counts.modules} modules.`,
    "",
    "— Repères d'ergonomie/structure —",
    design,
    "",
    "— Constats automatiques —",
    findings,
    "",
    "— Formats de fichiers par espace —",
    uploads,
    "",
    "— Couverture des rôles critiques —",
    roles,
    "",
    "— Volumétrie réelle —",
    stats,
    "",
    "— Matrice RBAC (modules visibles par rôle) —",
    rbac,
  ].join("\n");
}

export async function generateIdeas(d: PlatformDiagnostic): Promise<IdeasResult> {
  if (!aiConfigured()) return { ok: false, configured: false, error: "IA non configurée (ANTHROPIC_API_KEY absente)." };
  const r = await askClaude(buildPrompt(d), { maxTokens: 3200, temperature: 0.4 });
  if (!r.ok || !r.text) return { ok: false, configured: r.configured, error: r.error ?? "Réponse IA vide." };
  return { ok: true, configured: true, text: r.text.trim() };
}
