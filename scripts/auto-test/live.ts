import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { RouteInfo, RoleAccess, Finding } from "./lib";
import { predictAccess } from "./lib";
import type { UserRole } from "@prisma/client";

/**
 * Crawl EN DIRECT (couche dynamique, optionnelle). Pilote un navigateur (Playwright)
 * contre une instance en marche pour :
 *  - une passe **anonyme** : chaque page applicative DOIT rediriger vers /login
 *    (toute page qui s'ouvre sans authentification = fuite d'accès) ;
 *  - une passe **par rôle** (comptes fournis via `AUTOTEST_CREDENTIALS`, ou semés
 *    avec `--seed`) : on visite 100 % des pages, on compare l'accès réel à la
 *    matrice RBAC prédite, on capture les erreurs console / overlays Next, et on
 *    dépose des **pièces jointes jetables** (PDF + ZIP) dans les zones d'upload.
 *
 * Tout est best-effort et dégradé proprement : Playwright absent, instance
 * injoignable ou seeding impossible → on l'indique sans casser l'audit statique.
 */

interface LiveOpts {
  baseUrl: string | null;
  seed: boolean;
  routes: RouteInfo[];
  matrix: RoleAccess[];
}
interface LiveResult { markdown: string; findings: Finding[] }

interface Cred { role: UserRole; email: string; password: string; disposable?: boolean }
interface PageVisit { route: string; status: number | null; finalUrl: string; denied: boolean; consoleErrors: number; nextError: boolean; uploadTried: boolean }

// Cible de « landing sûr » : une redirection vers l'une de ces routes = accès refusé.
const SAFE_LANDING = ["/mon-espace", "/mon-travail", "/dashboard", "/no-access"];
const SEED_TAG = "autotest.invalid";

// ───────────────────────────── Pièces jointes jetables ─────────────────────────────

/** Génère un PDF minimal valide + un ZIP vide valide dans un dossier temporaire. */
function makeDisposableFiles(): { dir: string; pdf: string; zip: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "amd-autotest-"));
  const pdf = path.join(dir, "piece-jointe-jetable.pdf");
  // PDF valide minimal (1 page vide).
  fs.writeFileSync(pdf, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Root 1 0 R/Size 4>>\n%%EOF");
  const zip = path.join(dir, "archive-jetable.zip");
  // Archive ZIP vide valide : End Of Central Directory (22 octets).
  fs.writeFileSync(zip, Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]));
  return { dir, pdf, zip, cleanup: () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } } };
}

// ───────────────────────────── Comptes ─────────────────────────────

function credentialsFromEnv(): Cred[] {
  const raw = process.env.AUTOTEST_CREDENTIALS;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Cred[];
    return Array.isArray(arr) ? arr.filter((c) => c.role && c.email && c.password) : [];
  } catch {
    console.warn("  ⚠ AUTOTEST_CREDENTIALS n'est pas un JSON valide — ignoré.");
    return [];
  }
}

/** Sème un compte jetable par rôle (best-effort ; local/dev). Renvoie les identifiants. */
async function seedDisposableUsers(roles: UserRole[]): Promise<{ creds: Cred[]; cleanup: () => Promise<void> }> {
  const prismaSpec = "../../src/lib/prisma";
  const bcryptSpec = "bcryptjs";
  const { prisma } = (await import(prismaSpec)) as typeof import("../../src/lib/prisma");
  const bcrypt = ((await import(bcryptSpec)) as { default?: typeof import("bcryptjs") }).default ?? (await import(bcryptSpec)) as typeof import("bcryptjs");
  const password = `AutoTest!${crypto.randomBytes(6).toString("hex")}`;
  const hash = bcrypt.hashSync(password, 10);
  const creds: Cred[] = [];
  for (const role of roles) {
    const email = `autotest+${role.toLowerCase()}@${SEED_TAG}`;
    try {
      await prisma.user.upsert({
        where: { email },
        update: { role, isActive: true, mustChangePassword: false, passwordHash: hash },
        create: { email, name: `AutoTest ${role}`, role, isActive: true, mustChangePassword: false, passwordHash: hash },
      });
      creds.push({ role, email, password, disposable: true });
    } catch (e) {
      console.warn(`  ⚠ Seeding ${role} impossible : ${(e as Error).message}`);
    }
  }
  const cleanup = async () => {
    try { await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_TAG}` } } }); } catch { /* noop */ }
    try { await prisma.$disconnect(); } catch { /* noop */ }
  };
  return { creds, cleanup };
}

// ───────────────────────────── Navigateur ─────────────────────────────

async function launchBrowser(): Promise<{ browser: any; close: () => Promise<void> }> {
  const spec = "playwright";
  let chromium: any;
  try {
    ({ chromium } = (await import(spec)) as any);
  } catch {
    throw new Error("Playwright non installé (`npm i -D playwright`). Le crawl en direct est ignoré.");
  }
  const execPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
  const launchOpts: Record<string, unknown> = { headless: true };
  if (fs.existsSync(execPath)) launchOpts.executablePath = execPath;
  const browser = await chromium.launch(launchOpts);
  return { browser, close: () => browser.close() };
}

function isDenied(requested: string, finalUrl: string): boolean {
  try {
    const u = new URL(finalUrl);
    if (u.searchParams.has("denied")) return true;
    const p = u.pathname;
    if (p === requested || p.startsWith(`${requested}/`)) return false;
    return SAFE_LANDING.some((s) => p === s || p.startsWith(`${s}/`)) || p === "/login" || p.startsWith("/login");
  } catch {
    return false;
  }
}

/** Visite une route dans un contexte donné, capture le résultat. */
async function visit(context: any, baseUrl: string, route: string, files: { pdf: string; zip: string } | null): Promise<PageVisit> {
  const page = await context.newPage();
  let consoleErrors = 0;
  page.on("console", (m: any) => { if (m.type() === "error") consoleErrors++; });
  let status: number | null = null;
  let uploadTried = false;
  try {
    const resp = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    status = resp ? resp.status() : null;
    await page.waitForTimeout(150);
    // Dépose (sans soumettre) une pièce jointe jetable si une zone d'upload existe.
    if (files) {
      const input = await page.$('input[type="file"]');
      if (input) {
        try { await input.setInputFiles([files.pdf, files.zip].filter(Boolean)); uploadTried = true; } catch { /* accept refusé : normal */ }
      }
    }
    const nextError = (await page.$("nextjs-portal, [data-nextjs-dialog], .nextjs-container-errors-header")) != null;
    const finalUrl = page.url();
    return { route, status, finalUrl, denied: isDenied(route, finalUrl), consoleErrors, nextError, uploadTried };
  } catch (e) {
    return { route, status, finalUrl: `${baseUrl}${route}`, denied: false, consoleErrors, nextError: true, uploadTried, ...{ error: (e as Error).message } } as PageVisit;
  } finally {
    await page.close();
  }
}

async function login(context: any, baseUrl: string, cred: Cred): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.fill('input[name="email"]', cred.email);
    await page.fill('input[name="password"]', cred.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(300);
    return !page.url().includes("/login");
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

// ───────────────────────────── Orchestration ─────────────────────────────

export async function runLiveCrawl(opts: LiveOpts): Promise<LiveResult> {
  const findings: Finding[] = [];
  if (!opts.baseUrl) throw new Error("--live requiert --base-url=<url> (ou AUTOTEST_BASE_URL).");
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const testable = opts.routes.filter((r) => !r.dynamic && r.gateKind === "module");
  const files = makeDisposableFiles();

  const { browser, close } = await launchBrowser();
  const md: string[] = ["", "## Crawl en direct", "", `Cible : \`${baseUrl}\` — ${testable.length} pages testables (statiques, gardées par module).`];
  let seedCleanup: (() => Promise<void>) | null = null;

  try {
    // 1) Passe anonyme : toute page doit rediriger vers /login.
    const anon = await browser.newContext();
    let leaks = 0;
    for (const r of testable) {
      const v = await visit(anon, baseUrl, r.route, null);
      const redirectedToLogin = v.finalUrl.includes("/login");
      if (!redirectedToLogin && (v.status ?? 0) < 400) {
        leaks++;
        findings.push({ severity: "bug", code: "AUTH_LEAK", route: r.route,
          message: `Page ouverte SANS authentification (statut ${v.status}, URL finale ${v.finalUrl}) — fuite d'accès potentielle.` });
      }
    }
    await anon.close();
    md.push("", `**Passe anonyme** : ${testable.length} pages · ${leaks} fuite(s) d'accès.`);

    // 2) Passes par rôle.
    let creds = credentialsFromEnv();
    if (opts.seed) {
      const seeded = await seedDisposableUsers(opts.matrix.map((m) => m.role));
      seedCleanup = seeded.cleanup;
      creds = [...creds, ...seeded.creds];
    }
    if (creds.length === 0) {
      md.push("", "_Aucun compte fourni (`AUTOTEST_CREDENTIALS`) ni semé (`--seed`) : passes par rôle ignorées._");
    }

    for (const cred of creds) {
      const ctx = await browser.newContext();
      const ok = await login(ctx, baseUrl, cred);
      if (!ok) {
        findings.push({ severity: "warning", code: "LOGIN_FAILED", message: `Connexion impossible pour le rôle ${cred.role} (${cred.email}).` });
        await ctx.close();
        continue;
      }
      let mismatches = 0, errors = 0, uploads = 0;
      for (const r of testable) {
        const v = await visit(ctx, baseUrl, r.route, files);
        const predicted = predictAccess(cred.role, r);
        const actual = v.denied ? "deny" : "allow";
        if (predicted !== "n/a" && predicted !== actual) {
          mismatches++;
          findings.push({ severity: "warning", code: "LIVE_RBAC_MISMATCH", route: r.route,
            message: `Rôle ${cred.role} : accès réel « ${actual} » ≠ prédit « ${predicted} » (URL finale ${v.finalUrl}).` });
        }
        if (v.nextError) {
          errors++;
          findings.push({ severity: "bug", code: "PAGE_ERROR", route: r.route,
            message: `Rôle ${cred.role} : erreur d'exécution / overlay Next sur ${r.route} (statut ${v.status}).` });
        }
        if (v.uploadTried) uploads++;
      }
      md.push(`- Rôle **${cred.role}** : ${testable.length} pages · ${mismatches} écart(s) RBAC · ${errors} erreur(s) · ${uploads} upload(s) testé(s)${cred.disposable ? " · _compte jetable_" : ""}`);
      await ctx.close();
    }
  } finally {
    files.cleanup();
    if (seedCleanup) await seedCleanup();
    await close();
  }

  return { markdown: md.join("\n"), findings };
}
