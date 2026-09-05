/**
 * AUDIT UI MESURÉ — chaque route, dans un vrai Chromium, à deux largeurs.
 *
 * ── POURQUOI UN NAVIGATEUR, ET PAS UNE RELECTURE DES SOURCES ────────────────────────────────
 *
 * « Rien ne dépasse sur mobile » ne se vérifie pas en lisant du JSX : une largeur vient d'un
 * `min-w`, d'un `whitespace-nowrap`, d'une image, d'un tableau, d'un mot sans espace, d'une
 * police plus large que prévu — et la coque de l'application (`<main overflow-x-hidden>`) CLIPPE
 * ce qui dépasse au lieu de faire défiler la page : `document.scrollWidth` ne dit donc rien. Le
 * seul témoin fiable est la boîte de chaque élément, mesurée par le moteur de rendu.
 *
 * ── CE QUE CE SCRIPT MESURE, PAGE PAR PAGE ──────────────────────────────────────────────────
 *
 *   • le statut HTTP du document et l'URL d'arrivée (une redirection vers /login = session
 *     perdue ; vers /no-access = droit manquant — les deux se lisent) ;
 *   • le texte d'une page d'erreur (404 de Next, « Application error », 500) ;
 *   • les ÉLÉMENTS qui débordent du viewport hors de tout conteneur défilant horizontalement —
 *     les plus EXTÉRIEURS seulement, avec leur balise, leurs classes et leur texte, pour que le
 *     rapport nomme le coupable et pas ses trois cents descendants ;
 *   • les erreurs console et les exceptions non rattrapées ;
 *   • tous les liens internes rencontrés (`a[href^="/"]`) — y compris ceux vers des fiches avec
 *     de VRAIS identifiants — dont le statut est ensuite vérifié un par un : c'est le « 404 en
 *     plein milieu » que l'inventaire des routes ne peut pas voir.
 *
 * ── CE QU'IL NE FAIT PAS ────────────────────────────────────────────────────────────────────
 *
 * Aucun appel IA, aucune écriture métier : il lit. Le seul écrit est le compte d'audit
 * (`__uiaudit__`), retiré à la fin. Les routes dynamiques sans enregistrement réel dans la base
 * sont listées « non couvertes » plutôt que visitées avec un identifiant inventé.
 *
 *   npx tsx scripts/ui-audit/run.ts            → rapport dans ui-audit-out/
 *   npx tsx scripts/ui-audit/run.ts --only=/rh  → une seule racine, pour itérer vite
 *   npx tsx scripts/ui-audit/run.ts --shots     → capture chaque page qui déborde (mobile)
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// La MESURE est partagée avec la spec E2E (`e2e/ui-audit.spec.ts`) : une seule définition de
// « déborder » et de « page cassée », sinon l'audit et le cliquet finiraient par se contredire.
import { MESURE_DEBORDEMENTS, ERREURS, type Overflow } from "../../e2e/measure";

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/amd_internal_os?schema=public";
const SECRET = process.env.NEXTAUTH_SECRET ?? "ui-audit-secret-local-only";
const OUT = path.join(process.cwd(), "ui-audit-out");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
const SHOTS = process.argv.includes("--shots");

const ADMIN = { email: "__uiaudit__admin@test.dz", password: "UiAudit!MotDePasse#2026", name: "__uiaudit__ Admin" };

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "desktop", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
] as const;

/** Les routes qu'on ne visite pas connecté : flux publics à jeton, ou coque à part. */
const EXCLUES: RegExp[] = [
  /^\/api\//, /^\/invite\//, /^\/inscription\//, /^\/meet\//, /^\/office-embed\//,
  /^\/portail(\/|$)/, /^\/onboarding$/, /^\/change-password$/,
];

interface PageResult {
  route: string; url: string; viewport: string;
  status: number | null; finalUrl: string; redirected: boolean;
  errorText: string | null;
  overflows: Overflow[];
  consoleErrors: string[]; pageErrors: string[];
  links: string[];
  ms: number;
}
interface LinkResult { href: string; status: number | null; finalUrl: string; from: string[] }

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

// ─────────────────────────────────────── ROUTES ───────────────────────────────────────

function pagesTsx(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pagesTsx(p, acc);
    else if (e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

function inventaire(): string[] {
  const app = path.join(process.cwd(), "src/app");
  return pagesTsx(app)
    .map((f) => "/" + path.dirname(path.relative(app, f)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s)).join("/"))
    .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")))
    .sort();
}

/**
 * UN VRAI ENREGISTREMENT POUR CHAQUE SEGMENT DYNAMIQUE — ou rien.
 *
 * On ne visite jamais `/regulatory/abc123` avec un identifiant inventé : la page rendrait 404 et
 * l'on ne saurait pas si c'est la route ou la donnée. Chaque motif a sa requête ; quand la base
 * n'a rien, la route est déclarée « non couverte », ce qui est une information, pas un échec.
 */
async function resoudreDynamique(route: string): Promise<string | null> {
  const first = async (rows: Promise<{ id: string }[]>): Promise<string | null> => (await rows)[0]?.id ?? null;
  const R: Record<string, () => Promise<string | null>> = {
    // Le compte d'audit est SUPER_ADMIN : il voit aussi les dossiers verrouillés du pipeline —
    // et sur une base d'acceptation, ce sont souvent les seuls qui existent.
    "/regulatory/[id]": () => first(prisma.regulatoryProduct.findMany({ select: { id: true }, take: 1 })),
    "/admin/users/[id]": () => first(prisma.user.findMany({ select: { id: true }, take: 1, where: { isActive: true } })),
    "/drive/[id]": () => first(prisma.driveNode.findMany({ select: { id: true }, take: 1, where: { type: "FOLDER", isTrashed: false } })),
    "/drive/espace/[id]": () => first(prisma.driveSpace.findMany({ select: { id: true }, take: 1 })),
    "/rh/[id]": () => first(prisma.employee.findMany({ select: { id: true }, take: 1 })),
    "/legal/[id]": () => first(prisma.legalDocument.findMany({ select: { id: true }, take: 1 })),
    "/courriers/[id]": () => first(prisma.mailEntry.findMany({ select: { id: true }, take: 1 })),
    "/dossiers/[id]": () => first(prisma.dossier.findMany({ select: { id: true }, take: 1 })),
    "/pch/[id]": () => first(prisma.pchTender.findMany({ select: { id: true }, take: 1 })),
    "/events/[id]": () => first(prisma.event.findMany({ select: { id: true }, take: 1 })),
    "/events/[id]/checkin": () => first(prisma.event.findMany({ select: { id: true }, take: 1 })),
    "/mon-espace/taches/[id]": () => first(prisma.task.findMany({ select: { id: true }, take: 1 })),
    "/demandes/[id]": () => first(prisma.administrativeRequest.findMany({ select: { id: true }, take: 1, where: { deletedAt: null } })),
    "/validations/[id]": () => first(prisma.validationRequest.findMany({ select: { id: true }, take: 1 })),
    "/validations/paiements/[id]": () => first(prisma.paymentRequest.findMany({ select: { id: true }, take: 1 })),
    "/finances/paiements/[id]": () => first(prisma.paymentRequest.findMany({ select: { id: true }, take: 1 })),
    "/directives/[id]": () => first(prisma.directive.findMany({ select: { id: true }, take: 1 })),
    "/support/[id]": () => first(prisma.supportRequest.findMany({ select: { id: true }, take: 1 })),
    "/missions/[id]": () => first(prisma.mission.findMany({ select: { id: true }, take: 1 })),
    "/meetings/[id]": () => first(prisma.meeting.findMany({ select: { id: true }, take: 1 })),
    "/pieces/[id]": () => first(prisma.documentRequest.findMany({ select: { id: true }, take: 1 })),
    "/sponsoring/[id]": () => first(prisma.sponsoringRequest.findMany({ select: { id: true }, take: 1 })),
    "/congress-national/[id]": () => first(prisma.congressNational.findMany({ select: { id: true }, take: 1 })),
    "/congress-international/[id]": () => first(prisma.congressInternational.findMany({ select: { id: true }, take: 1 })),
    "/consulting/[id]": () => first(prisma.consultingContract.findMany({ select: { id: true }, take: 1 })),
    "/ad-pro/autres/[id]": () => first(prisma.adProOtherRequest.findMany({ select: { id: true }, take: 1 })),
    "/promo-material/[id]": () => first(prisma.promoMaterial.findMany({ select: { id: true }, take: 1 })),
    "/information-medicale/[id]": () => first(prisma.medicalInfoDeclaration.findMany({ select: { id: true }, take: 1 })),
    "/field-reports/[id]": () => first(prisma.fieldReport.findMany({ select: { id: true }, take: 1 })),
    "/logistics/[id]": () => first(prisma.logisticsOrder.findMany({ select: { id: true }, take: 1 })),
    "/recrutement/[id]": () => first(prisma.recruitmentRequest.findMany({ select: { id: true }, take: 1 })),
    "/business-development/[id]": () => first(prisma.businessDevelopmentOpportunity.findMany({ select: { id: true }, take: 1 })),
    "/business-development/etudes/[id]": () => first(prisma.marketResearch.findMany({ select: { id: true }, take: 1 })),
    "/documents/[id]/edit": () => first(prisma.document.findMany({ select: { id: true }, take: 1 })),
    "/drive/[id]/edit": () => first(prisma.driveNode.findMany({ select: { id: true }, take: 1, where: { type: "FILE", isTrashed: false } })),
    "/office/live/[id]": () => first(prisma.artifactSession.findMany({ select: { id: true }, take: 1 })),
    "/regulatory/enregistrement/analyse/[dossierId]": () => first(prisma.regulatoryDossier.findMany({ select: { id: true }, take: 1 })),
  };
  const fn = R[route];
  if (!fn) return null;
  try {
    const id = await fn();
    return id ? route.replace(/\[[^\]]+\]/, id) : null;
  } catch {
    // Un modèle absent du schéma (nom deviné faux) : on le dit « non couvert » — jamais inventé.
    return null;
  }
}

// ─────────────────────────────────────── SERVEUR ───────────────────────────────────────

async function attendre(url: string, ms: number): Promise<void> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status < 500) return;
    } catch { /* pas encore là */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Le serveur ne répond pas sur ${url}`);
}

/**
 * LE PORT DOIT ÊTRE LIBRE AVANT DE DÉMARRER — sinon on audite un fantôme.
 *
 * La première passe a laissé son serveur en vie : `npx next start` lance `next` comme
 * PETIT-FILS, et tuer `npx` ne tue pas le serveur. La seconde passe a donc trouvé le port
 * occupé par l'ANCIEN serveur — dont le dossier `.next` avait été reconstruit sous ses pieds —,
 * a cru qu'il était le sien, et a échoué à se connecter sans dire pourquoi. Un audit qui mesure
 * le mauvais build est pire qu'un audit qui refuse de partir.
 */
async function portLibre(): Promise<boolean> {
  try {
    await fetch(`${BASE}/login`, { redirect: "manual" });
    return false; // quelque chose répond déjà : ce n'est pas le nôtre
  } catch {
    return true;
  }
}

function lancerServeur(): ChildProcess {
  // Le binaire de Next DIRECTEMENT (pas `npx`) et un GROUPE de processus à part (`detached`) :
  // c'est ce qui permet, à la fin, de tuer le serveur et tout ce qu'il a lancé d'un seul geste.
  const bin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL: DB_URL,
      NEXTAUTH_URL: BASE,
      NEXTAUTH_SECRET: SECRET,
      AUTH_SECRET: SECRET,
      AUTH_TRUST_HOST: "true",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const log = fs.createWriteStream(path.join(OUT, "server.log"));
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

/** Tue le groupe entier du serveur — le processus ET ses enfants. */
async function arreterServeur(server: ChildProcess): Promise<void> {
  const pid = server.pid;
  if (!pid) return;
  const signal = (sig: NodeJS.Signals) => { try { process.kill(-pid, sig); } catch { /* déjà parti */ } };
  signal("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  signal("SIGKILL");
}

// ─────────────────────────────────────── MESURE ───────────────────────────────────────

async function visiter(page: Page, route: string, url: string, viewport: string): Promise<PageResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (m: { type: () => string; text: () => string }) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); };
  const onError = (e: Error) => pageErrors.push(String(e.message ?? e).slice(0, 200));
  page.on("console", onConsole);
  page.on("pageerror", onError);
  const t0 = Date.now();
  let status: number | null = null;
  try {
    const resp = await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    status = resp?.status() ?? null;
    // Le temps que les polices, les mesures de chrome et les effets client se posent.
    await page.waitForTimeout(900);
  } catch (e) {
    pageErrors.push(`navigation : ${String((e as Error).message).slice(0, 200)}`);
  }
  const finalUrl = page.url();
  const texte = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "").catch(() => "");
  const errorText = ERREURS.find((re) => re.test(texte))?.source ?? null;
  const overflows = (await page.evaluate(MESURE_DEBORDEMENTS).catch(() => [])) as Overflow[];
  const links = (await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/"]')).map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
      .filter((h) => h && !h.startsWith("/api/") && !h.startsWith("/_next/")),
  ).catch(() => [])) as string[];
  page.off("console", onConsole);
  page.off("pageerror", onError);
  return {
    route, url, viewport, status,
    finalUrl: finalUrl.replace(BASE, ""),
    redirected: finalUrl.replace(BASE, "").split("?")[0] !== url.replace(BASE, "").split("?")[0],
    errorText, overflows, consoleErrors, pageErrors,
    links: Array.from(new Set(links.map((l) => l.split(/[?#]/)[0]))),
    ms: Date.now() - t0,
  };
}

// ─────────────────────────────────────── MAIN ───────────────────────────────────────

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });

  // 1) Le compte d'audit — retiré à la fin, quoi qu'il arrive.
  await prisma.user.deleteMany({ where: { email: { startsWith: "__uiaudit__" } } });
  const admin = await prisma.user.create({
    data: {
      name: ADMIN.name, email: ADMIN.email, role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash(ADMIN.password, 10),
      mustOnboard: false, mustChangePassword: false, isActive: true,
    },
    select: { id: true },
  });

  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    // 2) Le serveur de production (le build `.next` doit être à jour) — sur un port LIBRE.
    if (!(await portLibre())) {
      throw new Error(`Le port ${PORT} répond déjà : un serveur d'une passe précédente tourne encore. Arrêtez-le (ss -ltnp | grep ${PORT}) avant de relancer — auditer un ancien build ne dirait rien du code actuel.`);
    }
    server = lancerServeur();
    await attendre(`${BASE}/login`, 120_000);

    // 3) Une connexion RÉELLE par le formulaire, puis l'état de session est copié aux contextes.
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
    const login = await browser.newContext({ baseURL: BASE });
    const lp = await login.newPage();
    await lp.goto(`${BASE}/login`, { waitUntil: "load" });
    await lp.fill('input[name="email"]', ADMIN.email);
    await lp.fill('input[name="password"]', ADMIN.password);
    await lp.click('button[type="submit"]');
    try {
      await lp.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
    } catch (e) {
      // Dire OÙ l'on est resté et ce que l'écran affiche : un « timeout » nu ne s'explique pas.
      const texte = await lp.evaluate(() => document.body?.innerText?.slice(0, 600) ?? "").catch(() => "");
      throw new Error(`Connexion impossible (${lp.url()}) : ${String((e as Error).message).slice(0, 80)}\n--- écran ---\n${texte}`);
    }
    const state = await login.storageState();
    await login.close();

    // 4) Les routes : statiques telles quelles, dynamiques résolues sur de vrais enregistrements.
    const toutes = inventaire();
    const visites: { route: string; url: string }[] = [];
    const nonCouvertes: string[] = [];
    for (const r of toutes) {
      if (EXCLUES.some((re) => re.test(r))) continue;
      if (ONLY && !r.startsWith(ONLY)) continue;
      if (r.includes("[")) {
        const concret = await resoudreDynamique(r);
        if (concret) visites.push({ route: r, url: `${BASE}${concret}` });
        else nonCouvertes.push(r);
      } else {
        visites.push({ route: r, url: `${BASE}${r}` });
      }
    }

    // LE TÉMOIN DU 404 : une adresse qui n'existe pas doit répondre 404 ET afficher la page
    // « Page introuvable » de l'application — pas la page anglaise de Next hors de la coque.
    // Le rapport la présente comme n'importe quelle route ; c'est son statut ATTENDU qui diffère.
    visites.push({ route: "/__introuvable__ (témoin 404)", url: `${BASE}/__introuvable__-${Date.now()}` });

    // 5) La visite, aux deux largeurs.
    const results: PageResult[] = [];
    const contexts: Record<string, BrowserContext> = {};
    for (const vp of VIEWPORTS) {
      contexts[vp.name] = await browser.newContext({
        storageState: state, baseURL: BASE,
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor,
        locale: "fr-FR",
      });
    }
    let n = 0;
    for (const v of visites) {
      for (const vp of VIEWPORTS) {
        const page = await contexts[vp.name].newPage();
        const r = await visiter(page, v.route, v.url, vp.name);
        results.push(r);
        if (SHOTS && vp.name === "mobile" && r.overflows.length > 0) {
          const nom = v.route.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "racine";
          await page.screenshot({ path: path.join(OUT, "shots", `${nom}.png`), fullPage: false }).catch(() => {});
        }
        await page.close();
      }
      n++;
      process.stdout.write(`\r${n}/${visites.length} ${v.route.padEnd(50)}`);
    }
    process.stdout.write("\n");

    // 6) Les liens découverts, un par un — c'est le « 404 en plein milieu ».
    const dejaVisites = new Set(visites.map((v) => v.url.replace(BASE, "")));
    const decouverts = new Map<string, Set<string>>();
    for (const r of results) for (const l of r.links) {
      if (dejaVisites.has(l)) continue;
      if (!decouverts.has(l)) decouverts.set(l, new Set());
      decouverts.get(l)!.add(r.route);
    }
    const liens: LinkResult[] = [];
    const req = contexts.desktop.request;
    for (const [href, from] of decouverts) {
      try {
        const resp = await req.get(`${BASE}${href}`, { maxRedirects: 5, timeout: 30_000 });
        liens.push({ href, status: resp.status(), finalUrl: resp.url().replace(BASE, ""), from: [...from] });
      } catch (e) {
        liens.push({ href, status: null, finalUrl: String((e as Error).message).slice(0, 120), from: [...from] });
      }
    }

    for (const c of Object.values(contexts)) await c.close();

    // 7) Le rapport.
    const rapport = { generatedAt: new Date().toISOString(), base: BASE, visites: visites.length, nonCouvertes, results, liens };
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(rapport, null, 2));
    fs.writeFileSync(path.join(OUT, "report.md"), markdown(rapport));
    console.log(`\nRapport : ${path.join(OUT, "report.md")}`);
    console.log(resume(rapport));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await arreterServeur(server);
    await prisma.auditLog.deleteMany({ where: { actorId: admin.id } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: admin.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: "__uiaudit__" } } }).catch(() => {});
    await prisma.$disconnect();
  }
}

type Rapport = { generatedAt: string; base: string; visites: number; nonCouvertes: string[]; results: PageResult[]; liens: LinkResult[] };

function resume(r: Rapport): string {
  const pages = r.results;
  const temoin = (p: PageResult) => p.route.startsWith("/__introuvable__");
  // Le témoin est « cassé » s'il ne répond PAS 404 ou s'il n'affiche pas la page française.
  const casse = pages.filter((p) => temoin(p)
    ? !(p.status === 404 && p.errorText === "Page introuvable")
    : (p.status ?? 0) >= 500 || p.errorText || p.pageErrors.length);
  const deb = pages.filter((p) => p.overflows.length);
  const morts = r.liens.filter((l) => (l.status ?? 0) === 404 || (l.status ?? 0) >= 500 || l.status === null);
  const perdus = r.liens.filter((l) => l.finalUrl.startsWith("/login"));
  return [
    `Pages visitées : ${r.visites} routes × 2 largeurs = ${pages.length} rendus`,
    `  cassées (5xx / erreur / exception) : ${casse.length}`,
    `  avec débordement                     : ${deb.length}  (mobile ${deb.filter((p) => p.viewport === "mobile").length}, desktop ${deb.filter((p) => p.viewport === "desktop").length})`,
    `Liens découverts vérifiés : ${r.liens.length} — morts : ${morts.length}, renvoyés à /login : ${perdus.length}`,
    `Routes dynamiques non couvertes (aucun enregistrement) : ${r.nonCouvertes.length}`,
  ].join("\n");
}

function markdown(r: Rapport): string {
  const L: string[] = [`# Audit UI — ${r.generatedAt}`, "", "```", resume(r), "```", ""];
  const pages = r.results;

  const temoin = (p: PageResult) => p.route.startsWith("/__introuvable__");
  const casse = pages.filter((p) => temoin(p)
    ? !(p.status === 404 && p.errorText === "Page introuvable")
    : (p.status ?? 0) >= 500 || p.errorText || p.pageErrors.length);
  L.push(`## Pages cassées (${casse.length})`, "");
  for (const p of casse) L.push(`- **${p.route}** [${p.viewport}] statut ${p.status} → ${p.finalUrl}${p.errorText ? ` · texte d'erreur : \`${p.errorText}\`` : ""}${p.pageErrors.length ? ` · exceptions : ${p.pageErrors.join(" | ")}` : ""}`);
  L.push("");

  const redir = pages.filter((p) => p.redirected && p.viewport === "desktop");
  L.push(`## Redirections (${redir.length})`, "");
  for (const p of redir) L.push(`- ${p.route} → ${p.finalUrl}`);
  L.push("");

  for (const vp of ["mobile", "desktop"] as const) {
    const deb = pages.filter((p) => p.viewport === vp && p.overflows.length);
    L.push(`## Débordements — ${vp} (${deb.length} pages)`, "");
    for (const p of deb) {
      L.push(`### ${p.route}`);
      for (const o of p.overflows) L.push(`- \`<${o.tag}>\` right=${o.right} left=${o.left} w=${o.width} — \`${o.cls}\`${o.text ? ` — « ${o.text} »` : ""}`);
      L.push("");
    }
  }

  const cons = pages.filter((p) => p.consoleErrors.length && p.viewport === "desktop");
  L.push(`## Erreurs console (desktop, ${cons.length} pages)`, "");
  for (const p of cons) L.push(`- **${p.route}** : ${Array.from(new Set(p.consoleErrors)).slice(0, 4).join(" | ")}`);
  L.push("");

  const morts = r.liens.filter((l) => (l.status ?? 0) === 404 || (l.status ?? 0) >= 500 || l.status === null);
  L.push(`## Liens découverts en erreur (${morts.length})`, "");
  for (const l of morts) L.push(`- \`${l.href}\` → ${l.status ?? "réseau"} ${l.finalUrl} — depuis ${l.from.slice(0, 3).join(", ")}`);
  L.push("");
  const perdus = r.liens.filter((l) => l.finalUrl.startsWith("/login"));
  L.push(`## Liens qui renvoient à /login (${perdus.length})`, "");
  for (const l of perdus) L.push(`- \`${l.href}\` — depuis ${l.from.slice(0, 3).join(", ")}`);
  L.push("");

  L.push(`## Routes dynamiques non couvertes (${r.nonCouvertes.length})`, "");
  for (const n of r.nonCouvertes) L.push(`- ${n}`);
  L.push("");

  const lentes = [...pages].sort((a, b) => b.ms - a.ms).slice(0, 10);
  L.push("## Les 10 rendus les plus lents", "");
  for (const p of lentes) L.push(`- ${p.route} [${p.viewport}] ${p.ms} ms`);
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
