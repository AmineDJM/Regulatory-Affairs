import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { SortieInterdite } from "@/lib/sortie/garde";

/**
 * LA CLÉ EN VIGUEUR, lue dans l'environnement SEUL. En production, `configurationEnVigueur` préfère
 * la clé qu'un Super Admin a fait fabriquer par l'ERP (`cles.ts`, en base) : ce fichier-ci ne
 * touche aucune base, et une clé ACTIVE posée au même instant par le banc de la publication (un
 * autre fichier, en parallèle) changerait l'en-tête que ces cas vérifient. Le choix entre la clé de
 * l'ERP et celle de l'environnement est éprouvé là-bas, par les vraies lignes.
 */
vi.mock("./cles", async () => {
  const { lireConfiguration } = await vi.importActual<typeof import("./config")>("./config");
  return { configurationEnVigueur: async () => lireConfiguration(process.env) };
});

import { envoyerAuSite, lireRetryAfter, signer } from "./transport";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRANSPORT VERS LE SITE (§118.158) — la seule fonction du dépôt qui l'appelle.
 *
 * Aucune socket n'est ouverte ici : `global.fetch` est BOUCHÉ, et la clé de sortie
 * (`ADAM_SORTIE_AUTORISEE`) n'est posée que dans les cas qui éprouvent le chemin de production
 * contre ce bouchon — puis retirée. Le premier cas, lui, la laisse absente : c'est la garde qui
 * doit parler, AVANT le moindre `fetch`, et sans rien dire de la clé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const CLE = "cle-de-transport-0123456789abcdef";
const SECRET = "secret-de-signature-banc";
const vraiFetch = global.fetch;
const envAvant = { base: process.env.ADVENTUM_BASE_URL, cle: process.env.ADVENTUM_API_KEY, secret: process.env.ADVENTUM_WEBHOOK_SECRET };

interface Appel { url: string; init: RequestInit }
let appels: Appel[] = [];

function boucher(reponse: (a: Appel) => Promise<Response> | Response) {
  appels = [];
  global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const a = { url: String(url), init: init ?? {} };
    appels.push(a);
    return reponse(a);
  }) as typeof fetch;
}

const entete = (a: Appel, nom: string): string | undefined => {
  const h = a.init.headers as Record<string, string> | undefined;
  if (!h) return undefined;
  const k = Object.keys(h).find((x) => x.toLowerCase() === nom.toLowerCase());
  return k ? h[k] : undefined;
};

beforeEach(() => {
  process.env.ADVENTUM_BASE_URL = "https://site.banc.test";
  process.env.ADVENTUM_API_KEY = CLE;
  delete process.env.ADVENTUM_WEBHOOK_SECRET;
});

afterEach(() => {
  delete process.env.ADAM_SORTIE_AUTORISEE;
  global.fetch = vraiFetch;
  for (const [k, v] of [["ADVENTUM_BASE_URL", envAvant.base], ["ADVENTUM_API_KEY", envAvant.cle], ["ADVENTUM_WEBHOOK_SECRET", envAvant.secret]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("La garde de sortie parle AVANT le réseau", () => {
  it("en test, la requête lève SortieInterdite sans appeler fetch, et le refus ne dit rien de la clé", async () => {
    boucher(() => new Response("{}", { status: 200 }));
    const e = await envoyerAuSite({ methode: "PUT", chemin: "/posts/abc", corps: '{"title":"x"}' }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SortieInterdite);
    expect((e as SortieInterdite).acte).toBe("ECRITURE_EXTERNE");
    expect(appels).toHaveLength(0);
    expect(String((e as Error).message)).not.toContain(CLE);
  });

  it("un GET aussi : toute requête vers le site porte la clé qui donne le droit de publier", async () => {
    boucher(() => new Response("{}", { status: 200 }));
    await expect(envoyerAuSite({ methode: "GET", chemin: "/jobs" })).rejects.toBeInstanceOf(SortieInterdite);
    expect(appels).toHaveLength(0);
  });
});

describe("Le chemin de production, contre un fetch bouché", () => {
  beforeEach(() => { process.env.ADAM_SORTIE_AUTORISEE = "1"; });

  it("PUT : la clé dans l'en-tête (jamais dans l'URL), le corps EXACT, JSON, aucune redirection suivie", async () => {
    boucher(() => new Response(JSON.stringify({ ok: true, post: { url: "/blog/x" } }), { status: 201 }));
    const corps = '{"title":"Traçabilité","body":"## Contexte\\n…","published":true}';
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck123", corps });
    expect(r.statut).toBe(201);
    expect(r.erreur).toBeNull();
    expect(appels).toHaveLength(1);
    const a = appels[0]!;
    expect(a.url).toBe("https://site.banc.test/api/v1/posts/ck123");
    expect(a.url).not.toContain(CLE);
    expect(a.init.method).toBe("PUT");
    expect(a.init.body).toBe(corps);
    expect(a.init.redirect).toBe("manual");
    expect(entete(a, "Authorization")).toBe(`Bearer ${CLE}`);
    expect(entete(a, "Content-Type")).toBe("application/json");
    // Sans secret déclaré, AUCUNE signature : une signature vide ferait refuser un site qui en attend une.
    expect(entete(a, "X-Adventum-Signature")).toBeUndefined();
  });

  it("avec un secret, la signature est l'HMAC-SHA256 des octets EXACTS du corps", async () => {
    process.env.ADVENTUM_WEBHOOK_SECRET = SECRET;
    boucher(() => new Response("{}", { status: 200 }));
    const corps = '{"title":"Été — « guillemets » et accents","published":true}';
    await envoyerAuSite({ methode: "PUT", chemin: "/jobs/ck1", corps });
    const attendu = `sha256=${createHmac("sha256", SECRET).update(corps, "utf8").digest("hex")}`;
    expect(entete(appels[0]!, "X-Adventum-Signature")).toBe(attendu);
    expect(signer(corps, SECRET)).toBe(attendu);
  });

  it("GET (même avec un corps donné) et DELETE ordinaire : ni corps ni type de contenu — mais SIGNÉS (la chaîne vide) dès qu'un secret est connu", async () => {
    // Le site vérifie la signature sur TOUTE requête authentifiée quand il a son secret
    // (`lib/api-auth.ts` : `authenticate(request, rawBody = "")`) — sa doc disait « PUT seulement »,
    // son code fait foi. Sans cette signature, une lecture ou une suppression seraient refusées.
    process.env.ADVENTUM_WEBHOOK_SECRET = SECRET;
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "GET", chemin: "/posts", corps: "ignoré : une lecture n'a jamais de corps" });
    await envoyerAuSite({ methode: "DELETE", chemin: "/posts/ck9" });
    const vide = `sha256=${createHmac("sha256", SECRET).update("", "utf8").digest("hex")}`;
    for (const a of appels) {
      expect(a.init.body).toBeUndefined();
      expect(entete(a, "Content-Type")).toBeUndefined();
      expect(entete(a, "X-Adventum-Signature")).toBe(vide);
      expect(entete(a, "Authorization")).toBe(`Bearer ${CLE}`);
    }
  });

  it("le DELETE d'un contenu REPRIS du site porte ce qu'il remplaçait (§118.160) — envoyé tel quel, typé, et SIGNÉ sur ces octets-là", async () => {
    // Sans ce corps, supprimer un article repris ferait revenir le fichier du dépôt du site.
    process.env.ADVENTUM_WEBHOOK_SECRET = SECRET;
    boucher(() => new Response("{}", { status: 200 }));
    const corps = JSON.stringify({ replacesFile: "enregistrement-medicament-algerie-etapes" });
    await envoyerAuSite({ methode: "DELETE", chemin: "/posts/ck9", corps });
    const [a] = appels;
    expect(a!.init.body).toBe(corps);
    expect(entete(a!, "Content-Type")).toBe("application/json");
    expect(entete(a!, "X-Adventum-Signature")).toBe(`sha256=${createHmac("sha256", SECRET).update(corps, "utf8").digest("hex")}`);
  });

  it("sans secret, AUCUNE signature, quel que soit le verbe : une signature vide ferait refuser un site qui en attend une", async () => {
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "GET", chemin: "/posts" });
    await envoyerAuSite({ methode: "DELETE", chemin: "/posts/ck9" });
    for (const a of appels) expect(entete(a, "X-Adventum-Signature")).toBeUndefined();
  });

  it("l'adresse configurée à l'API (…/api/v1/) ne double pas le préfixe", async () => {
    process.env.ADVENTUM_BASE_URL = "https://site.banc.test/api/v1/";
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "GET", chemin: "/health" });
    expect(appels[0]!.url).toBe("https://site.banc.test/api/v1/health");
  });

  it("une redirection est RENDUE, avec sa cible, jamais suivie", async () => {
    boucher(() => new Response(null, { status: 301, headers: { location: "https://ailleurs.test/api/v1/posts" } }));
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}" });
    expect(r.statut).toBe(301);
    expect(r.location).toBe("https://ailleurs.test/api/v1/posts");
    expect(appels).toHaveLength(1);
  });

  it("Retry-After est lu sur un 429 ou un 503", async () => {
    boucher(() => new Response('{"error":"unavailable"}', { status: 503, headers: { "retry-after": "120" } }));
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}" });
    expect(r.statut).toBe(503);
    expect(r.retryAfterS).toBe(120);
    expect(r.texte).toContain("unavailable");
  });

  it("une panne réseau est RENDUE (statut nul, cause nommée), jamais levée", async () => {
    boucher(() => { throw new TypeError("fetch failed"); });
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}" });
    expect(r.statut).toBeNull();
    expect(r.erreur).toMatch(/site injoignable : fetch failed/);
  });

  it("un délai dépassé se dit « délai dépassé » — pas « le site a refusé »", async () => {
    appels = [];
    global.fetch = vi.fn((_u: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")));
    })) as typeof fetch;
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}", delaiMs: 40 });
    expect(r.statut).toBeNull();
    expect(r.erreur).toBe("délai dépassé (40 ms)");
  });

  it("sans clé, rien ne part et la cause est nommée — avec le geste qui relie, pas un nom de variable", async () => {
    delete process.env.ADVENTUM_API_KEY;
    boucher(() => new Response("{}", { status: 200 }));
    const r = await envoyerAuSite({ methode: "GET", chemin: "/jobs" });
    expect(appels).toHaveLength(0);
    expect(r.statut).toBeNull();
    expect(r.erreur).toMatch(/pas encore relié/);
    expect(r.erreur).toMatch(/Générer|génère/i);
  });

  it("sans adresse fixée, l'adresse MESURÉE du site : l'apex, jamais le www qui redirige", async () => {
    delete process.env.ADVENTUM_BASE_URL;
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "GET", chemin: "/health" });
    expect(appels[0]!.url).toBe("https://adventumdz.com/api/v1/health");
  });
});

describe("Présenter une clé EN ATTENTE (§118.159) — une lecture, jamais une écriture", () => {
  beforeEach(() => { process.env.ADAM_SORTIE_AUTORISEE = "1"; });

  const presentes = { cle: "cle-en-attente", secret: "secret-en-attente" };

  it("un GET porte la clé présentée ET signe avec SON secret, à la place de ceux en vigueur", async () => {
    process.env.ADVENTUM_WEBHOOK_SECRET = SECRET;
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "GET", chemin: "/health", identifiants: presentes });
    expect(entete(appels[0]!, "Authorization")).toBe("Bearer cle-en-attente");
    // Le site qui vient de recevoir le bloc a le NOUVEAU secret : signer avec l'ancien le ferait
    // refuser la clé qu'il détient bel et bien.
    expect(entete(appels[0]!, "X-Adventum-Signature")).toBe(signer("", "secret-en-attente"));
  });

  it("même sans clé en vigueur : c'est ainsi que se fait la toute première liaison", async () => {
    delete process.env.ADVENTUM_API_KEY;
    boucher(() => new Response("{}", { status: 200 }));
    const r = await envoyerAuSite({ methode: "GET", chemin: "/health", identifiants: { cle: "premiere-cle", secret: null } });
    expect(r.statut).toBe(200);
    expect(entete(appels[0]!, "Authorization")).toBe("Bearer premiere-cle");
    expect(entete(appels[0]!, "X-Adventum-Signature")).toBeUndefined();
  });

  it("une ÉCRITURE ignore les identifiants présentés : on ne publie qu'avec la clé que le site a reconnue", async () => {
    boucher(() => new Response("{}", { status: 200 }));
    await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}", identifiants: presentes });
    await envoyerAuSite({ methode: "DELETE", chemin: "/posts/ck1", identifiants: presentes });
    for (const a of appels) {
      expect(entete(a, "Authorization")).toBe(`Bearer ${CLE}`);
      expect(entete(a, "X-Adventum-Signature")).toBeUndefined();
    }
  });

  it("une écriture sans clé en vigueur ne part pas, même si une clé est présentée", async () => {
    delete process.env.ADVENTUM_API_KEY;
    boucher(() => new Response("{}", { status: 200 }));
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}", identifiants: presentes });
    expect(appels).toHaveLength(0);
    expect(r.statut).toBeNull();
  });
});

describe("La machine elle-même n'est pas une sortie (§118.159)", () => {
  // AUCUNE clé de sortie posée ici : c'est l'exemption qui doit laisser passer, ou rien.
  it.each(["http://localhost:3999", "http://127.0.0.1:3999", "http://[::1]:3999"])("%s : la requête part sans ADAM_SORTIE_AUTORISEE", async (base) => {
    process.env.ADVENTUM_BASE_URL = base;
    boucher(() => new Response("{}", { status: 200 }));
    const r = await envoyerAuSite({ methode: "PUT", chemin: "/posts/ck1", corps: "{}" });
    expect(r.statut).toBe(200);
    expect(appels).toHaveLength(1);
  });

  it("un NOM qui désigne la machine ne compte pas : seule l'adresse littérale est exemptée", async () => {
    // `localtest.me` se résout en 127.0.0.1 — mais la garde ne résout rien, et c'est voulu : un
    // nom peut changer de cible entre la garde et la requête.
    process.env.ADVENTUM_BASE_URL = "https://localtest.me";
    boucher(() => new Response("{}", { status: 200 }));
    await expect(envoyerAuSite({ methode: "GET", chemin: "/health" })).rejects.toBeInstanceOf(SortieInterdite);
    expect(appels).toHaveLength(0);
  });

  it("http:// hors de la machine est refusé avant tout : la clé ne circule jamais en clair", async () => {
    process.env.ADAM_SORTIE_AUTORISEE = "1";
    process.env.ADVENTUM_BASE_URL = "http://adventumdz.com";
    boucher(() => new Response("{}", { status: 200 }));
    const r = await envoyerAuSite({ methode: "GET", chemin: "/health" });
    expect(appels).toHaveLength(0);
    expect(r.erreur).toMatch(/https/);
  });
});

describe("Retry-After", () => {
  it("des secondes, une date HTTP, ou rien", () => {
    const t0 = Date.parse("2026-09-28T10:00:00Z");
    expect(lireRetryAfter("30", t0)).toBe(30);
    expect(lireRetryAfter("Mon, 28 Sep 2026 10:02:00 GMT", t0)).toBe(120);
    expect(lireRetryAfter("Mon, 28 Sep 2026 09:00:00 GMT", t0)).toBe(0);
    expect(lireRetryAfter("bientôt", t0)).toBeNull();
    expect(lireRetryAfter(null, t0)).toBeNull();
  });
});
