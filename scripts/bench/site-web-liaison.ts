/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * BANC À DEUX SERVEURS — l'ERP et le site Adventum lancés ENSEMBLE sur ce poste, reliés par le
 * VRAI bloc que l'écran de l'ERP fabrique (§118.159).
 *
 * Tout est réel sauf l'adresse : deux `next start` (les builds de production des deux dépôts), la
 * base des bancs, un vrai navigateur. Le banc ne fabrique ni la clé, ni la signature, ni la
 * candidature : il clique là où une personne cliquerait, et LIT ce qui en résulte — dans la base de
 * l'ERP, sur les pages du site, sur l'écran de l'ERP.
 *
 * Ce qu'il éprouve, dans l'ordre où une vraie mise en service le vit :
 *   1. « Générer la clé » affiche un bloc de trois lignes, dont l'adresse de l'ERP ;
 *   2. le site démarré avec ce bloc est reconnu SANS autre geste : la clé en attente devient active ;
 *   3. une offre publiée dans l'ERP apparaît sur le site, sous l'identifiant de l'ERP ;
 *   4. un candidat postule sur le site avec un CV : la candidature entre dans le recrutement de
 *      l'ERP, CV compris, OCTET POUR OCTET — et le site n'en garde rien ;
 *   5. le site redémarre sur un disque VIDE (le plan gratuit de Render) : l'offre y est encore ;
 *   6. une candidature spontanée arrive « à trier », avec sa raison ;
 *   7. l'écran de l'ERP dit ce que le site dit de lui-même ;
 *   8. les articles écrits dans le DÉPÔT du site sont REPRIS dans l'ERP (§118.160) — ceux du vrai
 *      dépôt, pas un décor — et le blog les sert aux mêmes adresses, en version de l'ERP ; les offres
 *      d'exemple sont reprises en brouillon et restent hors de la page Carrières ;
 *   9. modifier un article repris dans l'ERP change sa page sur le site ;
 *  10. supprimer un article repris le retire du blog, et il ne REVIENT PAS après un redémarrage du
 *      site sur un disque vide — la pierre tombale revient de l'ERP avec le reste ;
 *  11. supprimer l'offre dans l'ERP la retire du site (un DELETE signé sur la chaîne vide).
 *
 * RIEN NE SORT DE LA MACHINE : l'ERP tourne sorties INTERDITES (`ADAM_SORTIE_INTERDITE=1`) et ne
 * parle au site que parce qu'il est LOCAL (exemption nommée de `site-web/transport.ts`) ; le site ne
 * parle qu'à l'ERP local ; aucun appel de modèle. Les deux serveurs démarrent avec un environnement
 * CONSTRUIT, pas hérité : le préchargement du banc (mandataire, jeton de présence) n'a rien à y faire.
 *
 * SABOTAGE (§118.17 — un banc dont on ne sait pas nommer l'échec n'est pas un banc) :
 * `BANC_SABOTAGE=sans-secret` démarre le site SANS la ligne `ERP_WEBHOOK_SECRET` — le bloc collé en
 * partie. Attendu : la clé est quand même reconnue (le site ne vérifie rien sans secret), mais la
 * candidature, non signée, est REFUSÉE par l'ERP et reste en attente sur le site. Le banc DOIT
 * tomber à l'étape 4 en le disant.
 *
 * Lancement : `npm run build` ici, `npm run build` dans le dépôt du site (`SITE_DIR`, défaut
 * `../adventumwebsite`), puis `npm run bench:site-web`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium, type Browser, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { deleteFileByKey } from "@/lib/storage";

const ERP_DIR = process.cwd();
const SITE_DIR = path.resolve(process.env.SITE_DIR ?? path.join(ERP_DIR, "..", "adventumwebsite"));
const ERP_PORT = Number(process.env.BANC_ERP_PORT ?? 3301);
const SITE_PORT = Number(process.env.BANC_SITE_PORT ?? 3302);
const ERP = `http://localhost:${ERP_PORT}`;
const SITE = `http://localhost:${SITE_PORT}`;
const SABOTAGE = process.env.BANC_SABOTAGE ?? "";

const TAG = "__liaison__";
const SA_EMAIL = `${TAG}sa@bench.dz`;
const MOT_DE_PASSE = "Liaison!Banc#2026";
/** Le secret du SERVEUR de banc (session, sceau des clés) — rien à voir avec la clé de liaison. */
const SECRET_SERVEUR = "banc-liaison-serveur-3f9c2a71e0d84b56a1c7e2f09b3d4c58";
const REF = `${TAG}REC-1`;
const POSTE = `${TAG} Responsable affaires reglementaires`;
const CANDIDAT = { nom: `${TAG} Candidate Offre`, email: `${TAG.replace(/_/g, "")}.offre@example.test`, tel: "+213 555 12 34 56" };
const SPONTANE = { nom: `${TAG} Candidat Spontane`, email: `${TAG.replace(/_/g, "")}.spontane@example.test` };
const SORTIE = path.join(ERP_DIR, "bench-out", "site-web-liaison");

/** Un vrai PDF minimal : le site et l'ERP le reconnaissent à ses premiers octets, pas à son nom. */
const PDF = Buffer.concat([
  Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n"),
  Buffer.from(`% CV de banc ${new Date().toISOString()}\n`),
  Buffer.alloc(900, 0x20),
  Buffer.from("\ntrailer << /Root 1 0 R >>\n%%EOF\n"),
]);
const sha256 = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");
const signer = (corps: string, secret: string) => `sha256=${crypto.createHmac("sha256", secret).update(corps, "utf8").digest("hex")}`;

// ───────────────────────────── Journal du banc ─────────────────────────────

type Etape = { nom: string; ok: boolean; ms: number; detail: string };
const etapes: Etape[] = [];
const t0 = Date.now();

async function etape(nom: string, fn: () => Promise<string>): Promise<void> {
  const debut = Date.now();
  try {
    const detail = await fn();
    etapes.push({ nom, ok: true, ms: Date.now() - debut, detail });
    console.info(`  ✓ ${nom} — ${detail} (${Date.now() - debut} ms)`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    etapes.push({ nom, ok: false, ms: Date.now() - debut, detail });
    console.error(`  ✗ ${nom} — ${detail}`);
    throw new EchecDEtape(nom);
  }
}
class EchecDEtape extends Error {}

function exiger(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function attendre<T>(quoi: string, fn: () => Promise<T | null | undefined | false>, delaiMs: number, pasMs = 500): Promise<T> {
  const fin = Date.now() + delaiMs;
  let dernier: unknown = null;
  while (Date.now() < fin) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (e) {
      dernier = e;
    }
    await new Promise((r) => setTimeout(r, pasMs));
  }
  throw new Error(`${quoi} : rien après ${Math.round(delaiMs / 1000)} s${dernier ? ` (dernière erreur : ${dernier instanceof Error ? dernier.message : String(dernier)})` : ""}`);
}

// ───────────────────────────── HTTP sans `fetch` ─────────────────────────────
// Le préchargement du banc route `fetch` par le mandataire du conteneur : une requête vers
// localhost n'a rien à y faire. `node:http` ne passe pas par ce dispatcher.

function requete(url: string, entetes: Record<string, string> = {}): Promise<{ statut: number; corps: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: entetes, timeout: 15_000 }, (res) => {
      const morceaux: Buffer[] = [];
      res.on("data", (c: Buffer) => morceaux.push(c));
      res.on("end", () => resolve({ statut: res.statusCode ?? 0, corps: Buffer.concat(morceaux).toString("utf8") }));
    });
    req.on("timeout", () => req.destroy(new Error("délai dépassé")));
    req.on("error", reject);
  });
}

// ───────────────────────────── Les deux serveurs ─────────────────────────────

type Serveur = { nom: string; proc: ChildProcess; journal: string };

/** Un environnement CONSTRUIT : ni NODE_OPTIONS du banc, ni jeton de présence, ni clé de fournisseur. */
function envDeBase(): NodeJS.ProcessEnv {
  const garder = ["PATH", "HOME", "TMPDIR", "LANG", "TZ", "NODE_EXTRA_CA_CERTS"];
  const env: Record<string, string> = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
  for (const k of garder) {
    const v = process.env[k];
    if (v) env[k] = v;
  }
  return env as NodeJS.ProcessEnv;
}

function demarrer(nom: string, dossier: string, port: number, env: NodeJS.ProcessEnv): Serveur {
  fs.mkdirSync(SORTIE, { recursive: true });
  const journal = path.join(SORTIE, `${nom}-${Date.now()}.log`);
  const flux = fs.createWriteStream(journal);
  const proc = spawn(path.join(dossier, "node_modules", ".bin", "next"), ["start", "-p", String(port)], {
    cwd: dossier, env, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout?.pipe(flux);
  proc.stderr?.pipe(flux);
  return { nom, proc, journal };
}

async function arreter(s: Serveur | null): Promise<void> {
  if (!s || s.proc.exitCode !== null) return;
  const fini = new Promise<void>((r) => s.proc.once("exit", () => r()));
  try { process.kill(-s.proc.pid!, "SIGTERM"); } catch { /* déjà parti */ }
  const delai = new Promise<"delai">((r) => setTimeout(() => r("delai"), 10_000));
  if ((await Promise.race([fini.then(() => "ok" as const), delai])) === "delai") {
    try { process.kill(-s.proc.pid!, "SIGKILL"); } catch { /* déjà parti */ }
  }
}

async function pret(url: string, delaiMs: number): Promise<void> {
  await attendre(`le serveur ${url} répond`, async () => {
    const r = await requete(url);
    return r.statut > 0 && r.statut < 500;
  }, delaiMs, 1_000);
}

// ───────────────────────────── Le décor ─────────────────────────────

async function nettoyer(): Promise<void> {
  const cands = await prisma.siteCandidature.findMany({ where: { email: { in: [CANDIDAT.email, SPONTANE.email] } }, select: { id: true, cvCle: true, candidateId: true } });
  for (const c of cands) {
    if (c.candidateId) await prisma.document.deleteMany({ where: { entityType: "RECRUITMENT_CANDIDATE", entityId: c.candidateId } });
  }
  await prisma.siteCandidature.deleteMany({ where: { id: { in: cands.map((c) => c.id) } } });
  for (const c of cands) if (c.cvCle) await deleteFileByKey(c.cvCle).catch(() => undefined);
  await prisma.recruitmentCandidate.deleteMany({ where: { email: { in: [CANDIDAT.email, SPONTANE.email] } } });

  const offres = await prisma.jobPosting.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } });
  const pubs = await prisma.sitePublication.findMany({ where: { externalId: { in: offres.map((o) => o.id) } }, select: { id: true } });
  await prisma.sitePushAttempt.deleteMany({ where: { publicationId: { in: pubs.map((p) => p.id) } } });
  await prisma.sitePublication.deleteMany({ where: { id: { in: pubs.map((p) => p.id) } } });
  await prisma.jobPosting.deleteMany({ where: { id: { in: offres.map((o) => o.id) } } });
  await prisma.recruitmentRequest.deleteMany({ where: { reference: REF } });

  // La liaison est un état GLOBAL de la base : ce banc part d'une base où le site n'a jamais été
  // relié, et la rend dans cet état. C'est la base des bancs (garde de `prisma.ts`), pas celle de
  // l'entreprise.
  await prisma.siteWebCle.deleteMany({});
  await prisma.siteReconciliation.deleteMany({});
  // LA REPRISE (§118.160) : ce que le banc a repris du VRAI dépôt du site (ses articles, ses offres
  // d'exemple), et tout l'état de publication qui en découle — y compris celui des articles repris
  // puis supprimés, que plus aucune ligne de contenu ne désigne.
  const reprises = await prisma.siteReprise.findMany({ select: { articleId: true, jobId: true } });
  await prisma.sitePushAttempt.deleteMany({});
  await prisma.sitePublication.deleteMany({});
  await prisma.siteReprise.deleteMany({});
  await prisma.blogArticle.deleteMany({ where: { id: { in: reprises.flatMap((r) => (r.articleId ? [r.articleId] : [])) } } });
  await prisma.jobPosting.deleteMany({ where: { id: { in: reprises.flatMap((r) => (r.jobId ? [r.jobId] : [])) } } });
  await prisma.appSetting.updateMany({ data: { siteBlocageEmpreinte: null, siteBlocageAt: null, siteBlocageMotif: null } });

  // Les notifications que l'ERP a envoyées PAR RÔLE pendant le banc (les RH, les Super Admins de la
  // base des bancs) : elles désignent des objets que ce nettoyage vient de retirer.
  await prisma.notification.deleteMany({
    where: {
      createdAt: { gte: new Date(t0) },
      title: { in: ["Site web relié", "Candidature reçue du site", "Candidature reçue du site — à trier", "CV reçu à présélectionner", "Site web : contenus repris du site"] },
    },
  });

  const users = await prisma.user.findMany({ where: { email: SA_EMAIL }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function semer(): Promise<{ saId: string; demandeId: string }> {
  const sa = await prisma.user.create({
    data: { email: SA_EMAIL, name: `${TAG} Super Admin`, passwordHash: await bcrypt.hash(MOT_DE_PASSE, 10), role: "SUPER_ADMIN" },
  });
  const demande = await prisma.recruitmentRequest.create({
    data: {
      reference: REF, requesterId: sa.id, position: POSTE, contractType: "CDI",
      justification: "Banc de liaison — poste fictif", missions: "Préparer les dossiers d'enregistrement\nSuivre les variations",
      skills: "Pharmacien\nAnglais courant", stage: "SOURCING",
    },
  });
  return { saId: sa.id, demandeId: demande.id };
}

// ───────────────────────────── Le navigateur ─────────────────────────────

async function connecter(page: Page): Promise<void> {
  await page.goto(`${ERP}/login`);
  await page.getByLabel(/e-?mail/i).fill(SA_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: /connexion|se connecter/i }).click();
  // La toute première page servie après un démarrage compile ses dépendances : lente (§118.124b).
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
}

async function postuler(page: Page, qui: { nom: string; email: string; tel?: string }, message: string): Promise<string> {
  await page.getByLabel("Nom et prénom").fill(qui.nom);
  await page.getByLabel("E-mail").fill(qui.email);
  if (qui.tel) await page.getByLabel("Téléphone (facultatif)").fill(qui.tel);
  await page.getByLabel("Quelques mots (facultatif)").fill(message);
  await page.getByLabel(/Votre CV/).setInputFiles({ name: "cv-banc.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByLabel(/J'accepte qu'Adventum Pharma traite mes données/).check();
  await page.getByRole("button", { name: "Envoyer ma candidature" }).click();
  const recu = page.getByRole("status").filter({ hasText: "Candidature reçue." });
  // Le refus du FORMULAIRE, et lui seul : Next.js pose un annonceur de navigation `role="alert"`
  // qui lit le titre de la page à chaque changement — mesuré au premier passage, où le banc a pris
  // « __liaison__ Responsable affaires reglementaires — · Adventum Pharma » pour un refus (§118.92).
  const erreur = page.locator("form [role=alert]");
  // Chaque attente porte son propre rattrapage : la perdante expire après la gagnante, et une
  // promesse rejetée que personne n'écoute arrête le processus.
  const issue = await Promise.race([
    recu.waitFor({ timeout: 30_000 }).then(() => "recu" as const, () => "rien" as const),
    erreur.waitFor({ timeout: 30_000 }).then(() => "erreur" as const, () => "rien" as const),
  ]);
  if (issue === "erreur") throw new Error(`le site refuse la candidature : « ${(await erreur.textContent())?.trim()} »`);
  if (issue === "rien") throw new Error("ni accusé de réception ni refus au bout de 30 s");
  const reference = (await recu.locator("span.font-mono").textContent())?.trim() ?? "";
  exiger(/^[0-9A-F]{8}$/.test(reference), `référence illisible : « ${reference} »`);
  return reference;
}

// ───────────────────────────── Le parcours ─────────────────────────────

async function main(): Promise<void> {
  console.info(`[banc] ERP ${ERP} (${ERP_DIR}) · site ${SITE} (${SITE_DIR})${SABOTAGE ? ` · SABOTAGE ${SABOTAGE}` : ""}`);
  for (const [nom, dossier] of [["ERP", ERP_DIR], ["site", SITE_DIR]] as const) {
    exiger(fs.existsSync(path.join(dossier, ".next", "BUILD_ID")), `${nom} : aucun build de production dans ${dossier} — lancez « npm run build » d'abord.`);
    exiger(fs.existsSync(path.join(dossier, "node_modules", ".bin", "next")), `${nom} : dépendances absentes dans ${dossier} — « npm ci » d'abord.`);
  }

  let erp: Serveur | null = null;
  let site: Serveur | null = null;
  let navigateur: Browser | null = null;
  const disques: string[] = [];
  let bloc: Record<string, string> = {};
  let offreId = "";

  const demarrerSite = (disque: string) => {
    const env = { ...envDeBase(), JOBS_DATA_DIR: disque, ERP_API_KEY: bloc.ERP_API_KEY, ERP_BASE_URL: bloc.ERP_BASE_URL };
    if (SABOTAGE !== "sans-secret") Object.assign(env, { ERP_WEBHOOK_SECRET: bloc.ERP_WEBHOOK_SECRET });
    return demarrer("site", SITE_DIR, SITE_PORT, env);
  };
  const apiSite = (chemin: string) =>
    requete(`${SITE}/api/v1${chemin}`, {
      authorization: `Bearer ${bloc.ERP_API_KEY}`,
      ...(bloc.ERP_WEBHOOK_SECRET && SABOTAGE !== "sans-secret" ? { "x-adventum-signature": signer("", bloc.ERP_WEBHOOK_SECRET) } : {}),
    });

  let echec = false;
  try {
    await nettoyer();
    const { demandeId } = await semer();

    erp = demarrer("erp", ERP_DIR, ERP_PORT, {
      ...envDeBase(),
      DATABASE_URL: process.env.DATABASE_URL!,
      ADAM_SORTIE_INTERDITE: "1",
      ADVENTUM_BASE_URL: SITE,
      APP_URL: ERP,
      NEXTAUTH_URL: ERP,
      NEXTAUTH_SECRET: SECRET_SERVEUR,
      SCHEDULER_TICK_MS: "15000",
    });
    await pret(`${ERP}/login`, 120_000);
    navigateur = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
    const erpPage = await (await navigateur.newContext()).newPage();
    erpPage.on("dialog", (d) => void d.accept());
    await connecter(erpPage);

    await etape("1. « Générer la clé » affiche le bloc à coller", async () => {
      // La liaison vit dans la console d'administration (§118.160) : c'est là que le Super Admin la relie.
      await erpPage.goto(`${ERP}/admin/site-web`);
      await erpPage.getByText("Pas encore relié", { exact: true }).first().waitFor({ timeout: 30_000 });
      await erpPage.getByRole("button", { name: "Générer la clé" }).click();
      const texte = (await erpPage.getByTestId("bloc-cle").textContent({ timeout: 30_000 })) ?? "";
      const lignes = texte.trim().split("\n");
      bloc = Object.fromEntries(lignes.map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
      exiger(lignes.length === 3, `3 lignes attendues, ${lignes.length} lues`);
      exiger((bloc.ERP_API_KEY ?? "").length >= 24, "ERP_API_KEY absente ou trop courte (le site en exige 24 caractères)");
      exiger((bloc.ERP_WEBHOOK_SECRET ?? "").length >= 24, "ERP_WEBHOOK_SECRET absent");
      exiger(bloc.ERP_BASE_URL === ERP, `ERP_BASE_URL vaut « ${bloc.ERP_BASE_URL} » au lieu de ${ERP}`);
      const enAttente = await prisma.siteWebCle.count({ where: { etat: "ATTENTE" } });
      exiger(enAttente === 1, `${enAttente} clé(s) en attente en base au lieu d'une`);
      return `ERP_API_KEY (${bloc.ERP_API_KEY.length} car.), ERP_WEBHOOK_SECRET, ERP_BASE_URL=${bloc.ERP_BASE_URL}`;
    });

    const disque1 = fs.mkdtempSync(path.join(os.tmpdir(), "banc-site-1-"));
    disques.push(disque1);
    const attente = await prisma.siteWebCle.findFirstOrThrow({ where: { etat: "ATTENTE" }, select: { id: true } });
    site = demarrerSite(disque1);
    const demarreLe = Date.now();

    await etape("2. Le site démarré avec ce bloc est reconnu, sans autre geste", async () => {
      await pret(`${SITE}/api/v1/health`, 120_000);
      const cle = await attendre("la clé en attente devient active", async () => {
        const l = await prisma.siteWebCle.findUnique({ where: { id: attente.id }, select: { etat: true, dernierConstat: true } });
        return l?.etat === "ACTIVE" ? l : null;
      }, 120_000, 1_000);
      await erpPage.goto(`${ERP}/admin/site-web`);
      await erpPage.getByText("Relié", { exact: true }).first().waitFor({ timeout: 30_000 });
      return `active ${Math.round((Date.now() - demarreLe) / 1000)} s après le démarrage du site — « ${cle.dernierConstat} » ; l'écran dit « Relié »`;
    });

    await etape("3. Une offre publiée dans l'ERP apparaît sur le site", async () => {
      await erpPage.goto(`${ERP}/site-web/offres/nouvelle?demande=${demandeId}`);
      await erpPage.getByRole("button", { name: "Publier sur le site" }).click();
      await erpPage.waitForURL((u) => /^\/site-web\/offres\/(?!nouvelle$)[a-z0-9]+$/.test(u.pathname), { timeout: 60_000 });
      offreId = erpPage.url().split("/").pop()!;
      const publieLe = Date.now();
      await attendre("l'offre sur /carrieres", async () => (await requete(`${SITE}/carrieres`)).corps.includes(POSTE), 90_000, 1_000);
      const r = await apiSite(`/jobs/${offreId}`);
      exiger(r.statut === 200, `GET /api/v1/jobs/${offreId} (lecture SIGNÉE) : ${r.statut} ${r.corps.slice(0, 160)}`);
      const job = (JSON.parse(r.corps) as { job: { externalId: string; published: boolean; slug: string } }).job;
      exiger(job.externalId === offreId && job.published, `offre reçue ${JSON.stringify(job).slice(0, 160)}`);
      return `en ligne ${Math.round((Date.now() - publieLe) / 1000)} s après « Publier » — /carrieres/${job.slug}, externalId = identifiant de l'ERP`;
    });

    const visiteur = await (await navigateur.newContext({ locale: "fr-FR" })).newPage();
    let reference1 = "";
    await etape("4. Une candidature avec CV entre dans le recrutement de l'ERP, octet pour octet", async () => {
      await visiteur.goto(`${SITE}/carrieres`);
      await visiteur.getByRole("link", { name: new RegExp(POSTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
      await visiteur.waitForURL((u) => u.pathname.startsWith("/carrieres/"), { timeout: 30_000 });
      await visiteur.getByText("Postuler en ligne", { exact: true }).waitFor({ timeout: 30_000 });
      reference1 = await postuler(visiteur, CANDIDAT, "Candidature déposée par le banc de liaison.");
      const c = await attendre("la candidature dans la base de l'ERP", () =>
        prisma.siteCandidature.findFirst({ where: { email: CANDIDAT.email }, select: { id: true, etat: true, candidateId: true, cvCle: true, siteId: true, jobPostingId: true } }),
        30_000, 500);
      exiger(c.siteId.slice(0, 8).toUpperCase() === reference1, `la référence donnée au candidat (${reference1}) ne désigne pas la ligne reçue (${c.siteId})`);
      exiger(c.jobPostingId === offreId, "la candidature n'est pas rattachée à l'offre");
      exiger(c.etat === "RATTACHEE" && c.candidateId, `état ${c.etat} : le poste est ouvert, elle devait entrer seule dans le recrutement`);
      const cand = await prisma.recruitmentCandidate.findUniqueOrThrow({ where: { id: c.candidateId! }, select: { requestId: true, fullName: true } });
      exiger(cand.requestId === demandeId, "le candidat n'est pas dans le bon recrutement");
      const doc = await prisma.document.findFirst({ where: { entityType: "RECRUITMENT_CANDIDATE", entityId: c.candidateId! }, select: { fileKey: true } });
      exiger(doc?.fileKey === c.cvCle, "le CV n'est pas une pièce du candidat");
      // Les octets, relus par la route que l'écran des RH ouvre — sous la session d'une personne.
      const cv = await erpPage.request.get(`${ERP}/api/site-web/candidatures/${c.id}/cv?dl=1`);
      exiger(cv.status() === 200, `la route du CV répond ${cv.status()}`);
      exiger(sha256(await cv.body()) === sha256(PDF), "le CV relu dans l'ERP n'est pas le fichier envoyé");
      await erpPage.goto(`${ERP}/recrutement/candidatures?etat=RATTACHEE`);
      await erpPage.getByText(CANDIDAT.nom).first().waitFor({ timeout: 30_000 });
      // Le site ne garde rien : sa copie est effacée dès que l'ERP l'a.
      const restes = fs.existsSync(path.join(disque1, "applications")) ? fs.readdirSync(path.join(disque1, "applications")).filter((n) => n.endsWith(".json")) : [];
      exiger(restes.length === 0, `${restes.length} candidature(s) encore sur le disque du site`);
      return `référence ${reference1} → ${REF}, CV identique (sha256 ${sha256(PDF).slice(0, 12)}…), visible dans « Entrées dans un recrutement », rien sur le site`;
    });

    await etape("5. Le site redémarre sur un disque VIDE : l'offre y est encore", async () => {
      await arreter(site);
      const disque2 = fs.mkdtempSync(path.join(os.tmpdir(), "banc-site-2-"));
      disques.push(disque2);
      site = demarrerSite(disque2);
      const debut = Date.now();
      await pret(`${SITE}/api/v1/health`, 120_000);
      await attendre("l'offre rechargée depuis l'ERP", async () => (await requete(`${SITE}/carrieres`)).corps.includes(POSTE), 30_000, 1_000);
      const h = JSON.parse((await apiSite("/health")).corps) as { erp?: { lastRestore?: { ok: boolean; jobs: number } }; bootId?: string };
      exiger(h.erp?.lastRestore?.ok === true, `rechargement : ${JSON.stringify(h.erp?.lastRestore)}`);
      return `offre de retour ${Math.round((Date.now() - debut) / 1000)} s après le redémarrage — rechargement ${h.erp!.lastRestore!.jobs} offre(s)`;
    });

    await etape("6. Une candidature spontanée arrive « à trier », avec sa raison", async () => {
      await visiteur.goto(`${SITE}/carrieres`);
      await postuler(visiteur, SPONTANE, "Candidature spontanée du banc.");
      const c = await attendre("la candidature spontanée dans l'ERP", () =>
        prisma.siteCandidature.findFirst({ where: { email: SPONTANE.email }, select: { etat: true, motif: true, candidateId: true } }), 30_000, 500);
      exiger(c.etat === "NOUVELLE" && !c.candidateId, `état ${c.etat} : une spontanée ne se rattache pas seule`);
      exiger(c.motif === "Candidature spontanée.", `motif « ${c.motif} »`);
      await erpPage.goto(`${ERP}/recrutement/candidatures`);
      await erpPage.getByText(SPONTANE.nom).first().waitFor({ timeout: 30_000 });
      return "« À trier », motif « Candidature spontanée. »";
    });

    await etape("7. L'écran de l'ERP dit ce que le site dit de lui-même", async () => {
      await erpPage.goto(`${ERP}/admin/site-web`);
      await erpPage.getByRole("button", { name: "Vérifier la connexion" }).click();
      for (const phrase of ["Le site reconnaît la clé de l'ERP.", "Le site connaît l'adresse de l'ERP", "Le site signe ses envois"]) {
        await erpPage.getByText(phrase).first().waitFor({ timeout: 30_000 });
      }
      return "clé reconnue · adresse de l'ERP connue · envois signés";
    });

    // ── LA REPRISE DES CONTENUS DU SITE (§118.160) — sur le VRAI dépôt du site, pas sur un décor ──
    let repris: { id: string; slug: string; titre: string }[] = [];
    await etape("8. Les articles du site sont REPRIS dans l'ERP, et le blog les sert aux mêmes adresses — version de l'ERP", async () => {
      const depot = JSON.parse((await apiSite("/repository")).corps) as { articles: { slug: string }[]; sampleJobs: { slug: string; title: string }[] };
      exiger(depot.articles.length > 0, "le dépôt du site ne rend aucun article");
      await erpPage.goto(`${ERP}/admin/site-web`);
      await erpPage.getByRole("button", { name: "Rapprocher maintenant" }).click();
      const lignes = await attendre("les articles repris dans l'ERP", async () => {
        const r = await prisma.siteReprise.findMany({ where: { origine: "ARTICLE_DEPOT" }, select: { articleId: true, cleSite: true, titre: true } });
        return r.length === depot.articles.length ? r : null;
      }, 90_000, 1_000);
      repris = lignes.map((l) => ({ id: l.articleId!, slug: l.cleSite, titre: l.titre }));
      const posts = await attendre("les versions de l'ERP servies par le site", async () => {
        const j = JSON.parse((await apiSite("/posts")).corps) as { posts: { replacesFile: string | null; body?: unknown }[]; readOnlyFileArticles: unknown[] };
        return j.readOnlyFileArticles.length === 0 && j.posts.filter((p) => p.replacesFile).length === depot.articles.length ? j : null;
      }, 90_000, 1_000);
      // Le contrat (PostRecord) inclut le corps : sans lui, l'ERP ne peut pas dire ce que le site détient.
      exiger(posts.posts.every((p) => typeof p.body === "string" && p.body.length > 0), "la liste du site ne rend pas le corps des articles");
      for (const a of repris) {
        const page = await requete(`${SITE}/blog/${a.slug}`);
        exiger(page.statut === 200, `/blog/${a.slug} répond ${page.statut} : une adresse déjà partagée serait cassée`);
      }
      // Les offres d'exemple : reprises en BROUILLON — dans l'ERP, jamais sur la page Carrières.
      const exemples = await prisma.siteReprise.findMany({ where: { origine: "OFFRE_EXEMPLE" }, select: { job: { select: { published: true } } } });
      exiger(exemples.length === depot.sampleJobs.length && exemples.every((e) => e.job?.published === false), `offres d'exemple : ${JSON.stringify(exemples)}`);
      const offresDuSite = JSON.parse((await apiSite("/jobs")).corps) as { jobs: { title: string; published: boolean }[] };
      const exposees = offresDuSite.jobs.filter((j) => j.published && depot.sampleJobs.some((e) => e.title === j.title));
      exiger(exposees.length === 0, `${exposees.length} offre(s) d'exemple en ligne : un poste fictif attirerait des candidatures`);
      await erpPage.goto(`${ERP}/admin/site-web`);
      await erpPage.getByText("Contenus repris du site", { exact: true }).waitFor({ timeout: 30_000 });
      // UN RAPPROCHEMENT DE PLUS NE REPOUSSE RIEN : le site rend ce qu'il détient (le corps compris),
      // l'ERP le compare et le trouve conforme. Mesuré avant la correction : les cinq articles
      // repartaient à chaque passage, « écart sur body », parce que la liste du site omettait le corps.
      const avant = new Date();
      await erpPage.getByRole("button", { name: "Rapprocher maintenant" }).click();
      const second = await attendre("un second rapprochement", () =>
        prisma.siteReconciliation.findFirst({ where: { startedAt: { gte: avant }, ok: true }, select: { repousses: true, ecarts: true, conformes: true } }),
        60_000, 1_000);
      exiger(second.repousses === 0, `un rapprochement sans changement a repoussé ${second.repousses} contenu(s) : ${JSON.stringify(second.ecarts).slice(0, 300)}`);
      return `${repris.length} article(s) repris et servis par l'ERP (${posts.posts.length} au total), aucun fichier du dépôt affiché ; ${exemples.length} offre(s) d'exemple en brouillon ; un rapprochement de plus : ${second.conformes} conforme(s), 0 repoussé`;
    });

    await etape("9. Modifier un article repris dans l'ERP change sa page sur le site", async () => {
      const cible = repris[0]!;
      const nouveau = `${cible.titre.slice(0, 150)} — mis à jour depuis l'ERP`;
      await erpPage.goto(`${ERP}/site-web/articles/${cible.id}`);
      await erpPage.locator("#article-titre").fill(nouveau);
      await erpPage.getByRole("button", { name: "Enregistrer les modifications" }).click();
      await attendre("le nouveau titre sur le site", async () => {
        const r = await apiSite(`/posts/${cible.id}`);
        return r.statut === 200 && (JSON.parse(r.corps) as { post?: { title?: string } }).post?.title === nouveau;
      }, 90_000, 1_000);
      exiger((await requete(`${SITE}/blog/${cible.slug}`)).statut === 200, "l'adresse a changé");
      return `« ${nouveau} » servi à /blog/${cible.slug}`;
    });

    await etape("10. Supprimer un article repris le retire du blog — il ne revient pas, même après un redémarrage du site sur un disque VIDE", async () => {
      const cible = repris[1] ?? repris[0]!;
      await erpPage.goto(`${ERP}/site-web/articles/${cible.id}`);
      await erpPage.getByRole("button", { name: "Supprimer" }).click();
      await attendre("la page retirée", async () => (await requete(`${SITE}/blog/${cible.slug}`)).statut === 404, 90_000, 1_000);
      await arreter(site);
      const disque3 = fs.mkdtempSync(path.join(os.tmpdir(), "banc-site-3-"));
      disques.push(disque3);
      site = demarrerSite(disque3);
      await pret(`${SITE}/api/v1/health`, 120_000);
      await attendre("le rechargement depuis l'ERP", async () => {
        const h = JSON.parse((await apiSite("/health")).corps) as { erp?: { lastRestore?: { ok: boolean } } };
        return h.erp?.lastRestore?.ok === true;
      }, 60_000, 1_000);
      const apres = await requete(`${SITE}/blog/${cible.slug}`);
      exiger(apres.statut === 404, `après le redémarrage, /blog/${cible.slug} répond ${apres.statut} : le fichier du dépôt est revenu`);
      exiger(!(await requete(`${SITE}/blog`)).corps.includes(`/blog/${cible.slug}"`), "la liste du blog le montre encore");
      const autre = repris.find((a) => a.id !== cible.id);
      if (autre) exiger((await requete(`${SITE}/blog/${autre.slug}`)).statut === 200, `/blog/${autre.slug} a disparu avec lui`);
      return `/blog/${cible.slug} : 404, et toujours 404 après un redémarrage sur disque vide ; les autres articles repris sont revenus`;
    });

    await etape("11. Supprimer l'offre dans l'ERP la retire du site (DELETE signé sur la chaîne vide)", async () => {
      await erpPage.goto(`${ERP}/site-web/offres/${offreId}`);
      await erpPage.getByRole("button", { name: "Supprimer" }).click();
      await attendre("l'offre retirée de /carrieres", async () => !(await requete(`${SITE}/carrieres`)).corps.includes(POSTE), 90_000, 1_000);
      const r = await apiSite(`/jobs/${offreId}`);
      exiger(r.statut === 404, `GET /api/v1/jobs/${offreId} répond ${r.statut}`);
      return "retirée du site, 404 sur son identifiant";
    });
  } catch (e) {
    echec = true;
    if (!(e instanceof EchecDEtape)) {
      console.error("[banc] arrêt :", e);
      etapes.push({ nom: "banc", ok: false, ms: 0, detail: e instanceof Error ? e.message : String(e) });
    }
  } finally {
    await navigateur?.close().catch(() => undefined);
    await arreter(site);
    await arreter(erp);
    await nettoyer().catch((e) => console.error("[banc] nettoyage incomplet :", e));
    for (const d of disques) fs.rmSync(d, { recursive: true, force: true });
    await prisma.$disconnect();
  }

  const ok = etapes.filter((e) => e.ok).length;
  console.info(`\n[banc] ${ok}/${etapes.length} étapes · ${Math.round((Date.now() - t0) / 1000)} s · journaux des serveurs : ${path.relative(ERP_DIR, SORTIE)}/`);
  if (SABOTAGE) {
    // Un sabotage qui laisse le banc vert est un TROU, pas un succès (§118.17).
    const tombe = echec && etapes.some((e) => !e.ok);
    console.info(tombe ? `[banc] SABOTAGE « ${SABOTAGE} » : le banc tombe, comme il le doit.` : `[banc] SABOTAGE « ${SABOTAGE} » : le banc est resté VERT — il ne voit pas ce défaut.`);
    process.exit(tombe ? 0 : 1);
  }
  process.exit(echec ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
