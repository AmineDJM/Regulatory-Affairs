import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES, PERMISSIONS, can, hasGlobalView, type Module } from "../../src/lib/rbac";
import { NAVIGATION, moduleForPath, MODULE_LABELS, ROLE_LABELS } from "../../src/lib/labels";
import type { UserRole } from "@prisma/client";

/**
 * Auto-testeur — couche déterministe (aucun serveur requis).
 *
 * On importe le **vrai** code RBAC/navigation de l'application (pas une copie) puis on
 * confronte trois sources de vérité :
 *   1. les **pages** réellement présentes (fichiers `page.tsx`),
 *   2. la **garde** de chaque page (`requireModule("X")` / `requireUser` / rien),
 *   3. la **navigation** (le « menu / console ») et la matrice **rôles → modules**.
 * Toute divergence est un défaut de cohérence backend/front/console/rôles.
 */

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP_DIR = path.join(REPO_ROOT, "src", "app");

export const ALL_ROLES = Object.keys(PERMISSIONS) as UserRole[];

export type GateKind = "module" | "user" | "none" | "notfound" | "redirect";
export interface RouteInfo {
  route: string; // chemin URL (ex. « /sponsoring », « /field-reports/[id] »)
  file: string; // chemin relatif au dépôt
  dynamic: boolean; // contient un segment [param]
  gateKind: GateKind;
  gateModule: string | null; // module de requireModule(...)
  notFoundGuarded: boolean; // la page appelle notFound() (garde d'accès fine)
}

export type Severity = "bug" | "warning" | "info";
export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  file?: string;
  route?: string;
}

// ───────────────────────────── Découverte des routes ─────────────────────────────

/** Convertit un dossier `src/app/(app)/foo/[id]` en route URL `/foo/[id]`. */
function dirToRoute(absDir: string): string {
  const rel = path.relative(APP_DIR, absDir).split(path.sep);
  const parts = rel.filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")) && seg !== "@" && seg !== "");
  return "/" + parts.join("/");
}

function walkPages(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPages(full, out);
    else if (entry.name === "page.tsx" || entry.name === "page.ts") out.push(full);
  }
}

/** Extrait la garde d'accès d'une page depuis sa source (analyse statique). */
function extractGate(src: string): Pick<RouteInfo, "gateKind" | "gateModule" | "notFoundGuarded"> {
  const notFoundGuarded = /\bnotFound\s*\(/.test(src);
  const mod = src.match(/requireModule\s*\(\s*["'`]([A-Z_]+)["'`]/);
  if (mod) return { gateKind: "module", gateModule: mod[1], notFoundGuarded };
  if (/\brequireUser\s*\(|\bgetCurrentUser\s*\(|\brequireAdmin\s*\(|\brequireSuperAdmin\s*\(|\brequirePortal|\bgetPortal/.test(src)) {
    return { gateKind: "user", gateModule: null, notFoundGuarded };
  }
  // Page de simple redirection (ex. « / » → /mon-espace, /comptabilite → /finances) : pas
  // de contenu propre, donc pas de garde de module attendue.
  if (/\bredirect\s*\(/.test(src) && !/requireModule|requireUser|getCurrentUser/.test(src)) {
    return { gateKind: "redirect", gateModule: null, notFoundGuarded };
  }
  return { gateKind: notFoundGuarded ? "notfound" : "none", gateModule: null, notFoundGuarded };
}

/** Découvre toutes les pages de l'application (sous `src/app`, y compris hors `(app)`). */
export function discoverRoutes(): RouteInfo[] {
  const files: string[] = [];
  walkPages(APP_DIR, files);
  const routes = files.map((file) => {
    const src = fs.readFileSync(file, "utf8");
    const route = dirToRoute(path.dirname(file)) || "/";
    return {
      route,
      file: path.relative(REPO_ROOT, file),
      dynamic: /\[[^\]]+\]/.test(route),
      ...extractGate(src),
    };
  });
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

// ───────────────────────────── Cohérence (findings) ─────────────────────────────

const MODULE_SET = new Set<string>(MODULES);
/** Routes publiques légitimes (hors garde applicative) — ne pas signaler. */
const PUBLIC_PREFIXES = ["/login", "/change-password", "/onboarding", "/portal", "/portail", "/setup", "/reset"];
/** Modules sans entrée de menu dédiée mais légitimes (accès via topbar/onglets/flux). */
const MENULESS_OK = new Set<Module>(["MESSAGING", "NOTIFICATIONS", "DOCUMENTS", "CONGRESS_NATIONAL", "PROMO_MATERIAL"]);

function isPublic(route: string): boolean {
  return PUBLIC_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`));
}

/** Retrouve la page desservant une route de menu (exacte, sinon dynamique parente). */
export function findServingRoute(routes: RouteInfo[], href: string): RouteInfo | null {
  const clean = href.split("?")[0].split("#")[0];
  const exact = routes.find((r) => r.route === clean);
  if (exact) return exact;
  // Lien vers un sous-chemin dynamique (ex. /drive/espace vers /drive/espace/[id]) : on
  // considère la page si un préfixe correspond.
  return routes.find((r) => clean.startsWith(`${r.route}/`)) ?? null;
}

export function auditCoherence(routes: RouteInfo[]): Finding[] {
  const findings: Finding[] = [];
  const byRoute = new Map(routes.map((r) => [r.route, r]));

  // 1) Gardes de page.
  for (const r of routes) {
    if (isPublic(r.route)) continue;
    if (r.gateKind === "module" && !MODULE_SET.has(r.gateModule!)) {
      findings.push({ severity: "bug", code: "BAD_MODULE_GATE", route: r.route, file: r.file,
        message: `requireModule("${r.gateModule}") ne correspond à aucun module RBAC connu — garde morte (accès jamais accordé).` });
    }
    if (r.gateKind === "none") {
      findings.push({ severity: "warning", code: "NO_MODULE_GATE", route: r.route, file: r.file,
        message: `Page sans garde de module (requireModule) ni garde utilisateur explicite — l'accès n'est restreint que par le layout. Vérifier que c'est voulu.` });
    }
  }

  // 2) Navigation (le « menu / console ») → pages réelles + cohérence de module.
  const navTargets: { label: string; href: string; module: Module }[] = [];
  for (const n of NAVIGATION) {
    navTargets.push({ label: n.label, href: n.href, module: n.module });
    for (const t of n.tabs ?? []) navTargets.push({ label: `${n.label} › ${t.label}`, href: t.href, module: t.module });
  }
  for (const t of navTargets) {
    const serving = findServingRoute(routes, t.href);
    if (!serving) {
      findings.push({ severity: "bug", code: "NAV_BROKEN_LINK",
        message: `Entrée de menu « ${t.label} » → ${t.href} : aucune page ne dessert cette route (lien mort / 404).` });
      continue;
    }
    if (serving.gateKind === "module" && serving.gateModule && serving.gateModule !== t.module) {
      findings.push({ severity: "warning", code: "NAV_MODULE_MISMATCH", route: serving.route, file: serving.file,
        message: `Menu « ${t.label} » annonce le module ${t.module} mais la page ${serving.route} est gardée par ${serving.gateModule} : un utilisateur voit l'entrée sans pouvoir ouvrir la page (ou l'inverse).` });
    }
  }

  // 3) moduleForPath (résolution runtime) vs garde réelle de la page.
  for (const r of routes) {
    if (r.dynamic || isPublic(r.route) || r.gateKind !== "module") continue;
    const resolved = moduleForPath(r.route);
    if (resolved && r.gateModule && resolved !== r.gateModule) {
      findings.push({ severity: "warning", code: "MODULEFORPATH_MISMATCH", route: r.route, file: r.file,
        message: `moduleForPath("${r.route}") = ${resolved} mais la page est gardée par ${r.gateModule} (badge/état actif du menu potentiellement incohérent).` });
    }
  }

  // 4) Modules RBAC orphelins (aucune page ne les garde) — permission potentiellement morte.
  const gatedModules = new Set(routes.filter((r) => r.gateKind === "module").map((r) => r.gateModule));
  for (const m of MODULES) {
    if (!gatedModules.has(m) && !MENULESS_OK.has(m)) {
      findings.push({ severity: "info", code: "MODULE_WITHOUT_PAGE",
        message: `Module ${m} (${MODULE_LABELS[m]}) n'est la garde d'aucune page — permission éventuellement inutilisée.` });
    }
  }

  // 5) Sanité : chaque module de menu doit exister dans la matrice RBAC.
  for (const t of navTargets) {
    if (!MODULE_SET.has(t.module)) {
      findings.push({ severity: "bug", code: "NAV_UNKNOWN_MODULE",
        message: `Entrée de menu « ${t.label} » référence un module inconnu (${t.module}).` });
    }
  }

  void byRoute;
  return findings;
}

// ───────────────────────────── Matrice rôles → modules ─────────────────────────────

export interface RoleAccess {
  role: UserRole;
  label: string;
  globalView: boolean;
  viewModules: Module[]; // modules dont le rôle a la VUE (via can() = matrice + vue globale)
}

export function roleAccessMatrix(): RoleAccess[] {
  return ALL_ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role] ?? role,
    globalView: hasGlobalView(role),
    viewModules: MODULES.filter((m) => can(role, m, "VIEW")),
  }));
}

/** Verdict prédictif : le rôle peut-il VOIR la page à cette route ? (garde de module) */
export function predictAccess(role: UserRole, r: RouteInfo): "allow" | "deny" | "n/a" {
  if (r.gateKind !== "module" || !MODULE_SET.has(r.gateModule!)) return "n/a";
  return can(role, r.gateModule as Module, "VIEW") ? "allow" : "deny";
}

// ───────────────────────────── Rapport ─────────────────────────────

export interface AuditResult {
  generatedAt: string;
  routeCount: number;
  routes: RouteInfo[];
  findings: Finding[];
  matrix: RoleAccess[];
  live?: unknown;
}

const SEV_ORDER: Record<Severity, number> = { bug: 0, warning: 1, info: 2 };
const SEV_ICON: Record<Severity, string> = { bug: "🔴", warning: "🟠", info: "🔵" };

export function renderMarkdown(res: AuditResult): string {
  const bugs = res.findings.filter((f) => f.severity === "bug");
  const warns = res.findings.filter((f) => f.severity === "warning");
  const infos = res.findings.filter((f) => f.severity === "info");
  const gated = res.routes.filter((r) => r.gateKind === "module").length;
  const userOnly = res.routes.filter((r) => r.gateKind === "user").length;
  const ungated = res.routes.filter((r) => r.gateKind === "none").length;

  const L: string[] = [];
  L.push(`# Auto-testeur AMD — rapport de cohérence`);
  L.push("");
  L.push(`_Généré le ${res.generatedAt}_`);
  L.push("");
  L.push(`## Synthèse`);
  L.push("");
  L.push(`| | Nombre |`);
  L.push(`|---|---:|`);
  L.push(`| Pages découvertes | ${res.routeCount} |`);
  L.push(`| Pages gardées par module | ${gated} |`);
  L.push(`| Pages gardées utilisateur seul | ${userOnly} |`);
  L.push(`| Pages sans garde explicite | ${ungated} |`);
  L.push(`| Rôles analysés | ${res.matrix.length} |`);
  L.push(`| 🔴 Bugs | ${bugs.length} |`);
  L.push(`| 🟠 Avertissements | ${warns.length} |`);
  L.push(`| 🔵 Infos | ${infos.length} |`);
  L.push("");

  const sorted = [...res.findings].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.code.localeCompare(b.code));
  L.push(`## Constats (${res.findings.length})`);
  L.push("");
  if (sorted.length === 0) {
    L.push(`✅ Aucun défaut de cohérence détecté.`);
  } else {
    for (const f of sorted) {
      const loc = f.route ? ` \`${f.route}\`` : "";
      const file = f.file ? ` — \`${f.file}\`` : "";
      L.push(`- ${SEV_ICON[f.severity]} **${f.code}**${loc} — ${f.message}${file}`);
    }
  }
  L.push("");

  L.push(`## Matrice rôles → modules (VUE)`);
  L.push("");
  L.push(`Modules visibles par rôle (d'après le **vrai** moteur RBAC \`can(role, module, "VIEW")\`).`);
  L.push("");
  L.push(`| Rôle | Vue globale | # modules | Modules |`);
  L.push(`|---|:-:|---:|---|`);
  for (const m of res.matrix) {
    const mods = m.globalView ? "_tous (vue globale)_" : m.viewModules.map((x) => MODULE_LABELS[x]).join(", ") || "—";
    L.push(`| ${m.label} | ${m.globalView ? "✓" : ""} | ${m.globalView ? MODULES.length : m.viewModules.length} | ${mods} |`);
  }
  L.push("");

  if (res.live) {
    L.push(String((res.live as { markdown?: string }).markdown ?? ""));
  }
  return L.join("\n");
}
