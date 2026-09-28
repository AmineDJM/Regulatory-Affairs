import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR, getCurrentUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, isTopManagement, userCan, type SessionUser } from "@/lib/rbac";
import {
  enregistrerArticle, leverBlocageSite, relancerEnvoiSite, supprimerArticle, verifierConnexionSite,
} from "@/lib/actions/site-web-actions";
import { enregistrerOffre } from "@/lib/actions/offres-emploi-actions";
import { closeRecruitmentRequest, openRecruitmentSourcing } from "@/lib/actions/recruitment-actions";
import { leverBlocage, lireBlocage, viderFile } from "./file";
import { rapprocherSite, rapprocherSiteSiDu, verifierSante } from "./reconciliation";
import { synchroniserArticle } from "./contenus";
import { lireConfiguration } from "./config";
import { DELAIS_REESSAI_MS, ESSAIS_MAX, slugSuggere } from "./contrat";
import { etatAffiche, etatIntegration, publicationsDe } from "./etat";
import type { ReponseSite, RequeteSite, TransportSite } from "./transport";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PUBLICATION VERS LE SITE, DE BOUT EN BOUT (§118.158) — par les VRAIES actions, la VRAIE
 * file et la VRAIE réconciliation, contre un FAUX SITE en mémoire qui tient le contrat
 * (`docs/openapi.yaml` du dépôt du site) : PUT idempotent sur l'`externalId`, 201 à la création,
 * 200 ensuite, 404 sur un DELETE déjà fait, `GET /jobs` et `GET /posts` qui rendent ce qu'il détient.
 *
 * UN SEUL FICHIER, et c'est voulu : le disjoncteur vit dans une ligne GLOBALE (`AppSetting`), et
 * deux fichiers qui le poseraient et le lèveraient en parallèle se contrediraient. Ici tout est
 * séquentiel, et chaque cas repart d'une file vide de ses propres lignes.
 *
 * AUCUNE REQUÊTE NE SORT : le transport est injecté partout, et le seul cas qui passe par le
 * transport de production prouve justement que la garde le bloque AVANT le réseau.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const TAG = "__siteweb__";
const CLE = "cle-banc-siteweb-9f8e7d6c5b4a";
const ENV_AVANT = {
  base: process.env.ADVENTUM_BASE_URL, cle: process.env.ADVENTUM_API_KEY, secret: process.env.ADVENTUM_WEBHOOK_SECRET,
  reco: process.env.SITE_WEB_RECONCILIATION,
};

function poserEnv() {
  process.env.ADVENTUM_BASE_URL = "https://site.banc.test";
  process.env.ADVENTUM_API_KEY = CLE;
  delete process.env.ADVENTUM_WEBHOOK_SECRET;
  delete process.env.SITE_WEB_RECONCILIATION;
}

const plus = (ms: number) => new Date(Date.now() + ms);

/**
 * CE QU'UN RUN INTERROMPU LAISSE NE DOIT PAS FAUSSER LE SUIVANT (§118.91, §118.136).
 *
 * Mesuré en jouant la série de sabotages : un cas qui tombe avant sa dernière ligne ne supprimait
 * pas ses rapprochements, et le run d'après lisait leurs orphelins comme « déjà signalés » — ou,
 * datés du surlendemain par le cas du battement, les prenait pour le passage précédent. Deux
 * remèdes, parce qu'ils ne protègent pas de la même chose : chaque rapprochement joué est NOTÉ et
 * retiré en `afterEach`, échec compris ; et l'orphelin du banc porte un identifiant PROPRE AU RUN,
 * qu'aucune ligne laissée par un autre run ne peut contenir.
 */
const RUN = Date.now().toString(36);
const ORPHELIN = `orphelin-banc-${RUN}`;
const RAPPROCHEMENTS: string[] = [];
function noter<T extends { id: string | null } | null>(b: T): T {
  if (b?.id) RAPPROCHEMENTS.push(b.id);
  return b;
}

function rep(statut: number | null, corps?: unknown, extra: Partial<ReponseSite> = {}): ReponseSite {
  return {
    statut,
    texte: corps === undefined || corps === null ? null : typeof corps === "string" ? corps : JSON.stringify(corps),
    erreur: statut === null ? "site injoignable : ECONNRESET" : null,
    ms: 4,
    retryAfterS: null,
    location: null,
    ...extra,
  };
}

/** Un transport scripté qui garde la trace de chaque requête. */
function script(reponse: (r: RequeteSite) => ReponseSite | Promise<ReponseSite>): { fn: TransportSite; appels: RequeteSite[] } {
  const appels: RequeteSite[] = [];
  return { appels, fn: async (r) => { appels.push(r); return reponse(r); } };
}

/**
 * LE FAUX SITE — assez fidèle pour que la réconciliation se juge sur ce qu'il DÉTIENT : il écrit
 * ce qu'on lui pousse, dérive un slug du titre quand on n'en donne pas, rend 404 sur un DELETE
 * de ce qu'il n'a pas, et liste ses contenus (plus ceux saisis dans son admin, sans externalId,
 * et les articles de son dépôt).
 */
function fauxSite() {
  const posts = new Map<string, Record<string, unknown>>();
  const jobs = new Map<string, Record<string, unknown>>();
  const manuels: Record<string, unknown>[] = [];
  const depot: { slug: string; title: string; url: string }[] = [];
  const s = script((r) => {
    if (r.methode === "GET" && r.chemin === "/posts") {
      return rep(200, { count: posts.size + manuels.length, posts: [...posts.values(), ...manuels], readOnlyFileArticles: depot });
    }
    if (r.methode === "GET" && r.chemin === "/jobs") return rep(200, { count: jobs.size, jobs: [...jobs.values()] });
    const m = /^\/(posts|jobs)\/(.+)$/.exec(r.chemin);
    if (!m) return rep(404, { error: "not_found" });
    const store = m[1] === "posts" ? posts : jobs;
    const ext = decodeURIComponent(m[2]!);
    if (r.methode === "DELETE") {
      if (!store.has(ext)) return rep(404, { error: "not_found" });
      store.delete(ext);
      return rep(200, { ok: true, deleted: true });
    }
    const b = JSON.parse(r.corps ?? "{}") as Record<string, unknown>;
    const slug = typeof b.slug === "string" ? b.slug : slugSuggere(String(b.title ?? ""));
    const url = m[1] === "posts" ? `/blog/${slug}` : `/carrieres/${slug}`;
    const cree = !store.has(ext);
    store.set(ext, { ...b, externalId: ext, slug, url });
    return rep(cree ? 201 : 200, { ok: true, created: cree, [m[1] === "posts" ? "post" : "job"]: store.get(ext) });
  });
  return { ...s, posts, jobs, manuels, depot };
}

async function actorFor(id: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  const access = await getAccess(id, u.role as SessionUser["role"]);
  return { id, name: u.name, email: u.email, role: u.role as SessionUser["role"], secondaryRole: u.secondaryRole as SessionUser["role"] | null, access, mustChangePassword: false } as CurrentUser;
}

const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const pub = (nature: "JOB" | "POST", externalId: string) =>
  prisma.sitePublication.findUniqueOrThrow({ where: { kind_externalId: { kind: nature, externalId } } });

const notifs = (userId: string, title: string) => prisma.notification.count({ where: { userId, title } });

suite("Site Adventum — file, disjoncteur, recrutement, réconciliation", () => {
  const ids: Record<string, string> = {};

  async function viderLesContenus() {
    await prisma.sitePublication.deleteMany({ where: { label: { startsWith: TAG } } });
    await prisma.blogArticle.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.jobPosting.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.recruitmentRequest.deleteMany({ where: { position: { startsWith: TAG } } });
  }

  async function nettoyer() {
    await viderLesContenus();
    const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const uids = users.map((u) => u.id);
    await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }

  beforeAll(async () => {
    await nettoyer();
    poserEnv();
    const faire = (nom: string, role: string) =>
      prisma.user.create({ data: { name: `${TAG}${nom}`, email: `${TAG}${nom}@t.dz`, role: role as never, passwordHash: "x" } });
    const [dir, sa, fin, pm] = await Promise.all([
      faire("dir", "DIRECTION"), faire("sa", "SUPER_ADMIN"), faire("fin", "FINANCE_BUDGET_MANAGER"), faire("pm", "PRODUCT_MANAGER"),
    ]);
    Object.assign(ids, { dir: dir.id, sa: sa.id, fin: fin.id, pm: pm.id });
  });

  afterEach(async () => {
    await prisma.siteReconciliation.deleteMany({ where: { id: { in: RAPPROCHEMENTS.splice(0) } } });
    await viderLesContenus();
    await leverBlocage();
    poserEnv();
    ACTOR = null;
  });

  afterAll(async () => {
    await nettoyer();
    await leverBlocage();
    for (const [k, v] of [
      ["ADVENTUM_BASE_URL", ENV_AVANT.base], ["ADVENTUM_API_KEY", ENV_AVANT.cle],
      ["ADVENTUM_WEBHOOK_SECRET", ENV_AVANT.secret], ["SITE_WEB_RECONCILIATION", ENV_AVANT.reco],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const publier = async (titre: string, champs: Record<string, string> = {}) => {
    ACTOR = await actorFor(ids.dir!);
    const r = await enregistrerArticle(form({ intention: "publier", title: `${TAG}${titre}`, body: "Introduction.\n\n## Contexte\n\nTexte.", ...champs }));
    expect(r.ok, r.error).toBe(true);
    return r.id!;
  };

  // ───────────────────────────── Prémisses ─────────────────────────────

  it("PRÉMISSES : la Direction écrit les articles et publie les offres ; la Direction Marketing n'a pas les RH ; les Finances n'ont pas le site", async () => {
    const [dir, pm, fin] = await Promise.all([actorFor(ids.dir!), actorFor(ids.pm!), actorFor(ids.fin!)]);
    expect(userCan(dir, "SITE_WEB", "CREATE")).toBe(true);
    expect(userCan(dir, "RH", "UPDATE") || isTopManagement(dir)).toBe(true);
    expect(userCan(pm, "SITE_WEB", "CREATE")).toBe(true);
    expect(userCan(pm, "RH", "UPDATE"), "sans quoi le refus des offres ne prouverait rien").toBe(false);
    expect(isTopManagement(pm)).toBe(false);
    expect(userCan(fin, "SITE_WEB", "VIEW")).toBe(false);
  });

  // ───────────────────────────── La file ─────────────────────────────

  it("un brouillon jamais publié ne part pas : le site n'a pas à le connaître", async () => {
    ACTOR = await actorFor(ids.dir!);
    const r = await enregistrerArticle(form({ intention: "brouillon", title: `${TAG}brouillon`, body: "## A\n\nB" }));
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Brouillon/);
    expect(await prisma.sitePublication.count({ where: { kind: "POST", externalId: r.id! } })).toBe(0);
  });

  it("publier : un PUT sur l'externalId, puis « En ligne » avec l'adresse que le SITE a rendue ; rejouer ne crée rien", async () => {
    const id = await publier("Tracabilite", { description: "Une description.", tags: "qualité, Qualité, lots", category: "Qualité" });
    const avant = await pub("POST", id);
    expect(avant).toMatchObject({ state: "PENDING", operation: "PUT", version: 1, attempts: 0 });
    const corps = JSON.parse(avant.body!) as Record<string, unknown>;
    expect(Object.keys(corps)).toEqual(["title", "body", "description", "category", "tags", "author", "date", "featured", "published"]);
    expect(corps).toMatchObject({ published: true, category: "Qualité", author: "Adventum Pharma", tags: ["qualité", "lots"] });

    const site = fauxSite();
    const b = await viderFile({ transport: site.fn, seulement: [avant.id], maintenant: plus(1_000) });
    expect(b).toMatchObject({ envoyes: 1, reussis: 1 });
    expect(site.appels).toEqual([{ methode: "PUT", chemin: `/posts/${id}`, corps: avant.body }]);
    const apres = await pub("POST", id);
    expect(apres).toMatchObject({ state: "DONE", attempts: 1, lastStatus: 201, confirmedHash: avant.bodyHash, confirmedPublished: true });
    expect(apres.siteUrl).toBe(`/blog/${slugSuggere(`${TAG}Tracabilite`)}`);
    const journal = await prisma.sitePushAttempt.findMany({ where: { publicationId: avant.id } });
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ status: 201, outcome: "SUCCES", version: 1, method: "PUT" });

    // Rejouer le même contenu : rien ne repart, la version ne bouge pas.
    const s2 = await synchroniserArticle(id, ids.dir!);
    expect(s2).toMatchObject({ etat: "INCHANGE", message: "Le site détient déjà cette version." });
    expect((await pub("POST", id)).version).toBe(1);
    expect((await viderFile({ transport: site.fn, seulement: [avant.id], maintenant: plus(5_000) })).envoyes).toBe(0);
  });

  it(`503 : réessais à ${DELAIS_REESSAI_MS.map((d) => d / 1000).join(", ")} s, puis ÉCHEC dit une seule fois, au demandeur ; « Relancer » le remet en file`, async () => {
    const id = await publier("Reessais");
    const ligne = await pub("POST", id);
    const t = script(() => rep(503, { error: "storage not writable" }));
    let m = plus(1_000);
    for (let i = 0; i < ESSAIS_MAX; i += 1) {
      const b = await viderFile({ transport: t.fn, seulement: [ligne.id], maintenant: m });
      expect(b.envoyes, `essai ${i + 1}`).toBe(1);
      const l = await pub("POST", id);
      if (i < ESSAIS_MAX - 1) {
        expect(l).toMatchObject({ state: "PENDING", attempts: i + 1, lastStatus: 503, lastError: "storage not writable" });
        expect(l.nextAttemptAt.getTime() - m.getTime()).toBe(DELAIS_REESSAI_MS[i]);
        if (i === 0) {
          // AVANT l'échéance, rien ne part : l'attente est tenue par la base, pas par la chance.
          expect((await viderFile({ transport: t.fn, seulement: [ligne.id], maintenant: m })).envoyes).toBe(0);
        }
        m = l.nextAttemptAt;
      } else {
        expect(l).toMatchObject({ state: "FAILED", attempts: ESSAIS_MAX });
        expect(l.alertedAt).not.toBeNull();
      }
    }
    expect(t.appels).toHaveLength(ESSAIS_MAX);
    expect((await viderFile({ transport: t.fn, seulement: [ligne.id], maintenant: plus(3_600_000) })).envoyes).toBe(0);
    expect(await notifs(ids.dir!, "Site web : envoi impossible")).toBe(1);

    ACTOR = await actorFor(ids.dir!);
    const r = await relancerEnvoiSite(form({ publicationId: ligne.id }));
    expect(r.ok, r.error).toBe(true);
    expect(await pub("POST", id)).toMatchObject({ state: "PENDING", attempts: 0, alertedAt: null });
  });

  it("réseau : une panne (aucune réponse) ou une exception du transport se réessaient, la cause est gardée", async () => {
    const id = await publier("Reseau");
    const ligne = await pub("POST", id);
    await viderFile({ transport: script(() => rep(null)).fn, seulement: [ligne.id], maintenant: plus(1_000) });
    expect(await pub("POST", id)).toMatchObject({ state: "PENDING", attempts: 1, lastStatus: null, lastError: "site injoignable : ECONNRESET" });
    const l1 = await pub("POST", id);
    await viderFile({ transport: async () => { throw new Error("socket hang up"); }, seulement: [ligne.id], maintenant: l1.nextAttemptAt });
    expect(await pub("POST", id)).toMatchObject({ state: "PENDING", attempts: 2, lastError: "socket hang up" });
  });

  it("429 : Retry-After est honoré — et plafonné à une heure", async () => {
    const id = await publier("Quota");
    const ligne = await pub("POST", id);
    const m = plus(1_000);
    await viderFile({ transport: script(() => rep(429, { error: "rate_limited" }, { retryAfterS: 120 })).fn, seulement: [ligne.id], maintenant: m });
    const l = await pub("POST", id);
    expect(l.nextAttemptAt.getTime() - m.getTime()).toBe(120_000);
    await viderFile({ transport: script(() => rep(429, null, { retryAfterS: 999_999 })).fn, seulement: [ligne.id], maintenant: l.nextAttemptAt });
    const l2 = await pub("POST", id);
    expect(l2.nextAttemptAt.getTime() - l.nextAttemptAt.getTime()).toBe(3_600_000);
  });

  it("4xx : refusé à la PREMIÈRE réponse, jamais réessayé, jamais renvoyé tel quel ; corrigé, il repart", async () => {
    const id = await publier("Refuse");
    const ligne = await pub("POST", id);
    const t = script(() => rep(422, { error: "title: too long" }));
    const b = await viderFile({ transport: t.fn, seulement: [ligne.id], maintenant: plus(1_000) });
    expect(b.refuses).toBe(1);
    expect(await pub("POST", id)).toMatchObject({ state: "FAILED", attempts: 1, lastStatus: 422, lastError: "title: too long" });
    expect(await notifs(ids.dir!, "Site web : contenu refusé")).toBe(1);
    expect((await viderFile({ transport: t.fn, seulement: [ligne.id], maintenant: plus(3_600_000) })).envoyes).toBe(0);

    const s = await synchroniserArticle(id, ids.dir!);
    expect(s.etat).toBe("INCHANGE");
    expect(s.message).toMatch(/refusé ce contenu tel quel/);

    ACTOR = await actorFor(ids.dir!);
    const r = await enregistrerArticle(form({ id, intention: "enregistrer", title: `${TAG}Refuse corrigé`, body: "Introduction.\n\n## Contexte\n\nTexte." }));
    expect(r.ok, r.error).toBe(true);
    expect(await pub("POST", id)).toMatchObject({ state: "PENDING", version: 2, attempts: 0, alertedAt: null });
  });

  it("401 : le DISJONCTEUR — un seul appel, aucune tentative consommée, une alerte aux Super Admins ; une clé changée le lève", async () => {
    const [a, b] = [await publier("Cle un"), await publier("Cle deux")];
    const [la, lb] = [await pub("POST", a), await pub("POST", b)];
    const t = script(() => rep(401, { error: "unauthorized" }));
    const avantAlertes = await notifs(ids.sa!, "Site web : publication suspendue");

    const b1 = await viderFile({ transport: t.fn, seulement: [la.id, lb.id], maintenant: plus(1_000) });
    expect(b1.bloque).toBe(true);
    expect(t.appels).toHaveLength(1);
    const touchee = t.appels[0]!.chemin.endsWith(a) ? a : b;
    expect(await pub("POST", touchee)).toMatchObject({ state: "PENDING", attempts: 0, lastStatus: 401 });
    const blocage = await lireBlocage();
    const conf = lireConfiguration();
    expect(conf.ok).toBe(true);
    expect(blocage?.empreinte).toBe(conf.ok ? conf.config.empreinte : "");
    expect(blocage?.motif).toMatch(/ADVENTUM_API_KEY/);
    expect(await notifs(ids.sa!, "Site web : publication suspendue")).toBe(avantAlertes + 1);

    // Bloqué : plus AUCUN appel, et pas une seconde alerte pour le même incident.
    const b2 = await viderFile({ transport: t.fn, seulement: [la.id, lb.id], maintenant: plus(120_000) });
    expect(b2.bloque).toBe(true);
    expect(t.appels).toHaveLength(1);
    expect(await notifs(ids.sa!, "Site web : publication suspendue")).toBe(avantAlertes + 1);

    // L'écran dit « Suspendu », jamais « Nouvel essai prévu ».
    const vue = (await publicationsDe("POST", [a])).get(a)!;
    expect(etatAffiche(vue, true, "BLOQUE").libelle).toBe("Suspendu");
    const integ = await etatIntegration();
    expect(integ.suspendu).toBe("BLOQUE");

    // LA CLÉ N'EST ÉCRITE NULLE PART — ni au journal, ni dans le motif, ni dans ce que l'écran lit.
    expect(JSON.stringify(integ)).not.toContain(CLE);
    expect(blocage?.motif).not.toContain(CLE);
    expect(await prisma.sitePushAttempt.count({ where: { OR: [{ responseBody: { contains: CLE } }, { error: { contains: CLE } }] } })).toBe(0);
    expect(await prisma.sitePublication.count({ where: { OR: [{ body: { contains: CLE } }, { lastError: { contains: CLE } }] } })).toBe(0);

    // La réparation : une nouvelle clé change l'empreinte, et le blocage tombe de lui-même.
    process.env.ADVENTUM_API_KEY = `${CLE}-nouvelle`;
    const site = fauxSite();
    const b3 = await viderFile({ transport: site.fn, seulement: [la.id, lb.id], maintenant: plus(240_000) });
    expect(b3).toMatchObject({ bloque: false, reussis: 2 });
    expect(await lireBlocage()).toBeNull();
  });

  it("une redirection est une ADRESSE fausse : elle bloque aussi, nomme sa cible ; seul le Super Admin lève à la main", async () => {
    const id = await publier("Redirection");
    const t = script(() => rep(301, null, { location: "https://www.adventumdz.com/api/v1/posts/x" }));
    const b = await viderFile({ transport: t.fn, seulement: [(await pub("POST", id)).id], maintenant: plus(1_000) });
    expect(b.bloque).toBe(true);
    const bl = await lireBlocage();
    expect(bl?.motif).toMatch(/ADVENTUM_BASE_URL/);
    expect(bl?.motif).toContain("https://www.adventumdz.com/api/v1/posts/x");

    ACTOR = await actorFor(ids.dir!);
    expect((await leverBlocageSite()).ok).toBe(false);
    expect(await lireBlocage()).not.toBeNull();
    ACTOR = await actorFor(ids.sa!);
    expect((await leverBlocageSite()).ok).toBe(true);
    expect(await lireBlocage()).toBeNull();
  });

  it("course : un envoi réussi ne confirme QUE la version qu'il portait — la correction faite pendant le vol repart", async () => {
    const id = await publier("Course");
    const v1 = await pub("POST", id);
    let corrige = false;
    const t = script(async () => {
      if (!corrige) {
        corrige = true;
        // Pendant le vol, l'auteur corrige et enregistre : une version 2 entre en file.
        await prisma.blogArticle.update({ where: { id }, data: { title: `${TAG}Course corrigée` } });
        await synchroniserArticle(id, ids.dir!);
      }
      return rep(200, { ok: true, post: { url: "/blog/course" } });
    });
    // UN envoi, pour observer l'entre-deux : sans borne, la même boucle reprend aussitôt la version 2
    // (elle est due) — c'est la bonne conduite, mais elle masquerait ce qu'on veut voir.
    await viderFile({ transport: t.fn, seulement: [v1.id], maintenant: plus(1_000), limite: 1 });
    expect(t.appels).toHaveLength(1);
    const apres = await pub("POST", id);
    expect(apres.version).toBe(2);
    expect(apres.state, "la version 2 n'a jamais été envoyée : elle ne peut pas être « en ligne »").toBe("PENDING");
    expect(apres.confirmedHash).toBe(v1.bodyHash);
    expect(apres.claimedAt).toBeNull();
    await viderFile({ transport: t.fn, seulement: [v1.id], maintenant: plus(2_000) });
    const fin = await pub("POST", id);
    expect(fin).toMatchObject({ state: "DONE", version: 2, confirmedHash: fin.bodyHash });
    expect(JSON.parse(t.appels[1]!.corps!).title).toBe(`${TAG}Course corrigée`);
  });

  it("SORTIE INTERDITE : le transport de production est bloqué AVANT le réseau — rien n'est parti, aucune tentative consommée", async () => {
    const id = await publier("Sortie");
    const ligne = await pub("POST", id);
    const espion = vi.spyOn(global, "fetch");
    const m = plus(1_000);
    const b = await viderFile({ seulement: [ligne.id], maintenant: m });
    expect(b.sortieInterdite).toBe(true);
    expect(b.envoyes).toBe(0);
    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
    const l = await pub("POST", id);
    expect(l).toMatchObject({ state: "PENDING", attempts: 0 });
    expect(l.nextAttemptAt.getTime() - m.getTime()).toBe(10 * 60_000);
    expect(l.lastError).toMatch(/Sortie interdite/);
    const j = await prisma.sitePushAttempt.findFirst({ where: { publicationId: ligne.id }, orderBy: { createdAt: "desc" } });
    expect(j?.outcome).toBe("LOCAL");

    // L'action « Vérifier la connexion » passe par le même transport : elle le DIT.
    ACTOR = await actorFor(ids.dir!);
    const v = await verifierConnexionSite();
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/Sortie interdite/);
  });

  it("non configurée : rien ne part, et la file le dit au lieu de réessayer", async () => {
    const id = await publier("Sans configuration");
    delete process.env.ADVENTUM_API_KEY;
    const t = script(() => rep(200, {}));
    const b = await viderFile({ transport: t.fn, seulement: [(await pub("POST", id)).id], maintenant: plus(1_000) });
    expect(b.nonConfigure).toBe(true);
    expect(t.appels).toHaveLength(0);
    expect(await pub("POST", id)).toMatchObject({ state: "PENDING", attempts: 0 });
  });

  it("supprimer : le DELETE est mis en file avant la ligne, et un 404 vaut « déjà absent » ; jamais envoyé, rien à supprimer", async () => {
    const site = fauxSite();
    const id = await publier("A supprimer");
    await viderFile({ transport: site.fn, seulement: [(await pub("POST", id)).id], maintenant: plus(1_000) });
    expect(site.posts.has(id)).toBe(true);
    site.posts.delete(id); // le site l'a déjà perdu : le DELETE rendra 404

    ACTOR = await actorFor(ids.dir!);
    const r = await supprimerArticle(form({ id }));
    expect(r.ok, r.error).toBe(true);
    expect(r.message).toMatch(/retirée du site/);
    expect(await prisma.blogArticle.count({ where: { id } })).toBe(0);
    const del = await pub("POST", id);
    expect(del).toMatchObject({ operation: "DELETE", state: "PENDING", version: 2 });
    await viderFile({ transport: site.fn, seulement: [del.id], maintenant: plus(2_000) });
    expect(await pub("POST", id)).toMatchObject({ operation: "DELETE", state: "DONE", lastStatus: 404 });

    const r2 = await enregistrerArticle(form({ intention: "brouillon", title: `${TAG}jamais parti`, body: "## A\n\nB" }));
    const r3 = await supprimerArticle(form({ id: r2.id! }));
    expect(r3.message).toMatch(/n'était pas sur le site/);
    expect(await prisma.sitePublication.count({ where: { kind: "POST", externalId: r2.id! } })).toBe(0);
  });

  // ───────────────────────────── Les droits et les refus ─────────────────────────────

  it("les refus : un titre `#` est refusé AVANT écriture, en nommant la ligne ; les Finances n'écrivent pas d'article ; la Direction Marketing ne publie pas d'offre", async () => {
    ACTOR = await actorFor(ids.dir!);
    const h1 = await enregistrerArticle(form({ intention: "publier", title: `${TAG}H1`, body: "Introduction\n# Grand titre\n\nTexte" }));
    expect(h1.ok).toBe(false);
    expect(h1.error).toMatch(/ligne 2/);
    expect(await prisma.blogArticle.count({ where: { title: `${TAG}H1` } })).toBe(0);

    ACTOR = await actorFor(ids.fin!);
    const a = await enregistrerArticle(form({ intention: "brouillon", title: `${TAG}Finances`, body: "## A" }));
    expect(a.ok).toBe(false);
    expect(a.error).toMatch(/Site web/);

    ACTOR = await actorFor(ids.pm!);
    const o = await enregistrerOffre(form({ intention: "brouillon", title: `${TAG}Offre PM` }));
    expect(o.ok).toBe(false);
    expect(o.error).toMatch(/RH/);
    expect(await prisma.jobPosting.count({ where: { title: `${TAG}Offre PM` } })).toBe(0);
  });

  // ───────────────────────────── Les offres suivent le recrutement ─────────────────────────────

  it("offre : ni salaire ni justification ; un poste fermé part INVISIBLE ; ouvrir puis clore le poste la fait suivre, par les vraies actions", async () => {
    const req = await prisma.recruitmentRequest.create({
      data: {
        reference: `${TAG}REC-1`, requesterId: ids.dir!, position: `${TAG}Délégué médical Oncologie`, contractType: "CDI",
        salaryMin: 123_456, salaryMax: 234_567, justification: `${TAG}justification confidentielle`,
        missions: "- Animer le réseau de prescripteurs\n- Préparer les congrès", skills: "Formation en pharmacie", stage: "HR_REVIEW",
      },
    });
    ACTOR = await actorFor(ids.dir!);
    const r = await enregistrerOffre(form({
      intention: "publier", recruitmentRequestId: req.id, title: req.position, department: "Promotion médicale", location: "Alger",
      contractLabel: "CDI", mission: "Animer le réseau de prescripteurs\nPréparer les congrès", profile: "Formation en pharmacie",
    }));
    expect(r.ok, r.error).toBe(true);
    expect(r.message).toMatch(/n'est pas ouvert/);
    const v1 = await pub("JOB", r.id!);
    const corps = JSON.parse(v1.body!) as Record<string, unknown>;
    expect(Object.keys(corps)).toEqual(["title", "department", "location", "type", "experience", "summary", "mission", "profile", "offer", "published"]);
    expect(corps.published, "coché publié, mais le poste n'est pas ouvert").toBe(false);
    expect(v1.body).not.toMatch(/123456|123 456|234567|confidentielle/);

    // Une demande porte UNE offre.
    const double = await enregistrerOffre(form({ intention: "brouillon", recruitmentRequestId: req.id, title: `${TAG}doublon` }));
    expect(double.ok).toBe(false);
    expect(double.error).toMatch(/déjà son offre/);

    expect((await openRecruitmentSourcing(form({ id: req.id }))).ok).toBe(true);
    const v2 = await pub("JOB", r.id!);
    expect(v2.version).toBe(2);
    expect(JSON.parse(v2.body!).published).toBe(true);

    expect((await closeRecruitmentRequest(form({ id: req.id, note: "Poste pourvu" }))).ok).toBe(true);
    const v3 = await pub("JOB", r.id!);
    expect(v3.version).toBe(3);
    expect(JSON.parse(v3.body!).published, "pourvu : l'offre repasse en brouillon côté site, tout de suite").toBe(false);
  });

  // ───────────────────────────── La réconciliation ─────────────────────────────

  it("rapprocher : repousse ce que le site a perdu ou altéré, rejoue une suppression, confirme le conforme — et NOMME sans supprimer ce qu'il ne connaît pas", async () => {
    const site = fauxSite();
    const envoyer = async (id: string) => viderFile({ transport: site.fn, seulement: [(await pub("POST", id)).id], maintenant: plus(1_000) });

    const conforme = await publier("Conforme"); await envoyer(conforme);
    const perdu = await publier("Perdu"); await envoyer(perdu);
    const altere = await publier("Altere"); await envoyer(altere);
    const supprime = await publier("Supprime"); await envoyer(supprime);
    const masque = await publier("Masque", { slug: "slug-du-depot" }); await envoyer(masque);
    const refuse = await publier("Refuse"); // jamais accepté par le site
    await viderFile({ transport: script(() => rep(422, { error: "body: invalid" })).fn, seulement: [(await pub("POST", refuse)).id], maintenant: plus(1_000) });
    // Délai dépassé alors que le site AVAIT écrit : la file le croit perdu, le site le détient.
    const fantome = await publier("Fantome");
    const lf = await pub("POST", fantome);
    await prisma.sitePublication.update({ where: { id: lf.id }, data: { attempts: 2, lastError: "délai dépassé (10000 ms)", nextAttemptAt: plus(3_600_000) } });
    site.posts.set(fantome, { ...JSON.parse(lf.body!), externalId: fantome, slug: "fantome", url: "/blog/fantome" });
    // Un contenu CONNU mais que le contrat refuse aujourd'hui (écrit hors des actions) : ni repoussé, ni orphelin.
    const hors = await prisma.blogArticle.create({ data: { title: `${TAG}Hors contrat`, body: "# Titre interdit\n\nTexte", published: true } });
    await prisma.sitePublication.create({ data: { kind: "POST", externalId: hors.id, label: `${TAG}Hors contrat`, operation: "PUT", state: "DONE" } });
    site.posts.set(hors.id, { externalId: hors.id, title: `${TAG}Hors contrat`, url: "/blog/hors" });

    // Ce que le site a fait de son côté.
    site.posts.delete(perdu);                                                   // redéployé sans disque
    site.posts.set(altere, { ...site.posts.get(altere)!, title: "Titre modifié dans l'admin" });
    ACTOR = await actorFor(ids.dir!);
    expect((await supprimerArticle(form({ id: supprime }))).ok).toBe(true);    // le DELETE n'est pas encore parti
    site.posts.set(ORPHELIN, { externalId: ORPHELIN, title: "Test de mise en service", url: "/blog/test" });
    site.manuels.push({ title: "Saisi dans l'admin du site", url: "/blog/admin" });
    site.depot.push({ slug: "slug-du-depot", title: "Article du dépôt", url: "/blog/slug-du-depot" });

    const alertes0 = await notifs(ids.sa!, "Site web : rapprochement à regarder");
    site.appels.length = 0;
    const bilan = noter(await rapprocherSite({ declencheur: "MANUEL", parId: ids.dir!, maintenant: plus(10_000), transport: site.fn }));
    expect(bilan.ok, bilan.message).toBe(true);

    // Repoussés, et REPARTIS par la file : le site les détient de nouveau, à l'identique.
    expect(site.posts.has(perdu)).toBe(true);
    expect(site.posts.get(altere)!.title).toBe(`${TAG}Altere`);
    // La suppression rejouée.
    expect(site.posts.has(supprime)).toBe(false);
    // L'orphelin N'EST PAS supprimé — et aucune requête ne l'a visé.
    expect(site.posts.has(ORPHELIN)).toBe(true);
    expect(site.appels.some((a) => a.chemin.includes(ORPHELIN))).toBe(false);
    // Le refusé tel quel n'est pas repoussé.
    expect(site.appels.some((a) => a.chemin === `/posts/${refuse}`)).toBe(false);
    expect(await pub("POST", refuse)).toMatchObject({ state: "FAILED", version: 1 });
    // Le fantôme est CONFIRMÉ, sans renvoi.
    expect(await pub("POST", fantome)).toMatchObject({ state: "DONE", lastError: null });
    expect(site.appels.some((a) => a.chemin === `/posts/${fantome}`)).toBe(false);

    const ligne = await prisma.siteReconciliation.findUniqueOrThrow({ where: { id: bilan.id! } });
    expect(ligne.ok).toBe(true);
    const orphelins = ligne.orphelins as { externalId: string }[];
    // Le faux site ne détient que les contenus de ce banc : l'orphelin est le SEUL inconnu.
    expect(orphelins.map((o) => o.externalId)).toEqual([ORPHELIN]);
    expect(orphelins.some((o) => o.externalId === hors.id), "un contenu CONNU n'est jamais « inconnu de l'ERP »").toBe(false);
    const collisions = ligne.collisions as { externalId: string; slug: string }[];
    expect(collisions).toContainEqual(expect.objectContaining({ externalId: masque, slug: "slug-du-depot" }));
    const ecarts = ligne.ecarts as { externalId: string; raison: string }[];
    expect(ecarts.find((e) => e.externalId === perdu)?.raison).toBe("absent du site");
    expect(ecarts.find((e) => e.externalId === altere)?.raison).toBe("écart sur title");
    expect(ecarts.find((e) => e.externalId === refuse)?.raison).toMatch(/refusé ce contenu tel quel/);
    expect(ecarts.find((e) => e.externalId === hors.id)?.raison).toMatch(/non envoyé/);
    expect(ligne.repousses).toBeGreaterThanOrEqual(2);
    expect(ligne.suppressions).toBeGreaterThanOrEqual(1);
    expect(ligne.rejetes).toBeGreaterThanOrEqual(2);
    expect((ligne.manuels as { posts: number }).posts).toBeGreaterThanOrEqual(1);
    expect(ligne.depotSlugs).toContain("slug-du-depot");
    expect(await notifs(ids.sa!, "Site web : rapprochement à regarder")).toBe(alertes0 + 1);

    // Un second passage : tout est conforme, rien ne repart, et PAS de seconde alerte pour les mêmes.
    site.appels.length = 0;
    const second = noter(await rapprocherSite({ declencheur: "MANUEL", parId: ids.dir!, maintenant: plus(20_000), transport: site.fn }));
    expect(second.ok).toBe(true);
    expect(site.appels.filter((a) => a.methode !== "GET")).toEqual([]);
    expect(await notifs(ids.sa!, "Site web : rapprochement à regarder")).toBe(alertes0 + 1);

  });

  it("rapprocher : « déjà signalé » veut dire signalé AVANT — un passage daté plus tard n'est pas le précédent", async () => {
    // LE CAS QUI FAIT TOMBER LA BORNE `startedAt < début` : un passage réussi daté du surlendemain
    // (une instance dont l'horloge avance, un banc qui joue le lendemain) et SANS orphelin. Pris
    // pour « le précédent », il ferait de l'orphelin du jour une nouveauté à CHAQUE passage — la
    // même alerte chaque nuit, le bruit que la déduplication existe pour éviter (§118.32).
    const site = fauxSite();
    const orphelin = `${ORPHELIN}-tard`;
    site.posts.set(orphelin, { externalId: orphelin, title: "Resté sur le site", url: "/blog/reste" });
    const tard = await prisma.siteReconciliation.create({ data: { trigger: "AUTO", startedAt: plus(2 * 86_400_000), ok: true, orphelins: [] } });
    RAPPROCHEMENTS.push(tard.id);
    const titre = "Site web : rapprochement à regarder";
    const a0 = await notifs(ids.sa!, titre);
    expect(noter(await rapprocherSite({ declencheur: "MANUEL", maintenant: plus(1_000), transport: site.fn })).ok).toBe(true);
    expect(await notifs(ids.sa!, titre), "le premier passage signale l'orphelin").toBe(a0 + 1);
    expect(noter(await rapprocherSite({ declencheur: "MANUEL", maintenant: plus(2_000), transport: site.fn })).ok).toBe(true);
    expect(await notifs(ids.sa!, titre), "le second passage l'a déjà vu signalé par le PREMIER").toBe(a0 + 1);
  });

  it("rapprocher : une réponse illisible ou sans liste est un ÉCHEC — jamais « le site n'a rien »", async () => {
    const id = await publier("Illisible");
    const avant = await prisma.sitePublication.findMany({ where: { label: { startsWith: TAG } }, select: { id: true, version: true } });
    const html = noter(await rapprocherSite({ declencheur: "MANUEL", transport: script(() => rep(200, "<html>maintenance</html>")).fn, maintenant: plus(1_000) }));
    expect(html.ok).toBe(false);
    expect(html.message).toMatch(/illisible/);
    const sansListe = noter(await rapprocherSite({ declencheur: "MANUEL", transport: script((r) => rep(200, r.chemin === "/jobs" ? { count: 0 } : { count: 0, posts: [] })).fn, maintenant: plus(2_000) }));
    expect(sansListe.ok).toBe(false);
    expect(sansListe.message).toMatch(/sans la liste attendue/);
    const apres = await prisma.sitePublication.findMany({ where: { label: { startsWith: TAG } }, select: { id: true, version: true } });
    expect(apres).toEqual(avant);
    expect(id).toBeTruthy();
  });

  it("le pas du battement : un rapprochement par jour, un nouvel essai une heure après un échec, débrayable", async () => {
    const dernier = await prisma.siteReconciliation.findFirst({ orderBy: { startedAt: "desc" }, select: { startedAt: true } });
    const base = new Date(Math.max(Date.now(), dernier?.startedAt.getTime() ?? 0) + 2 * 86_400_000);
    const heure = 3_600_000;
    const site = fauxSite();
    const panne = script(() => rep(503, { error: "down" }));

    expect(noter(await rapprocherSiteSiDu(base, site.fn))?.ok).toBe(true);
    expect(await rapprocherSiteSiDu(new Date(base.getTime() + heure), site.fn), "moins de 24 h après un rapprochement réussi").toBeNull();
    const t1 = new Date(base.getTime() + 25 * heure);
    expect(noter(await rapprocherSiteSiDu(t1, panne.fn))?.ok).toBe(false);
    expect(await rapprocherSiteSiDu(new Date(t1.getTime() + 30 * 60_000), site.fn), "moins d'une heure après un échec").toBeNull();
    expect(noter(await rapprocherSiteSiDu(new Date(t1.getTime() + 61 * 60_000), site.fn))?.ok).toBe(true);
    process.env.SITE_WEB_RECONCILIATION = "off";
    expect(await rapprocherSiteSiDu(new Date(base.getTime() + 5 * 86_400_000), site.fn)).toBeNull();
  });

  // ───────────────────────────── Vérifier la connexion ─────────────────────────────

  it("vérifier la connexion : le site dit s'il a une clé et s'il reconnaît la nôtre — chaque cas nommé", async () => {
    const sante = (corps: unknown, statut = 200) => verifierSante(script(() => rep(statut, corps)).fn);
    expect(await sante({ status: "ok", configured: true, authenticated: true, capabilities: ["jobs", "posts"] })).toMatchObject({ ok: true, authentifie: true });
    expect((await sante({ configured: false, authenticated: false })).message).toMatch(/ERP_API_KEY/);
    expect((await sante({ configured: true, authenticated: false })).message).toMatch(/ne reconnaît pas/);
    expect((await sante({ error: "unauthorized" }, 401)).authentifie).toBe(false);
    expect((await sante({ configured: true, authenticated: true, capabilities: ["jobs"] })).message).toMatch(/n'annonce pas : posts/);
  });
});
