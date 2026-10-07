import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  adresseClient, empreinteVisiteur, oublierDebits, originesAutorisees, porteAudience, prendreDebit, DEBIT_PAR_MINUTE,
} from "./audience-collecte";
import { OPTIONS, POST } from "@/app/api/site-web/v1/audience/route";
import { GET as scriptDuSite } from "@/app/api/site-web/v1/audience.js/route";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1 FROM "SiteAnalyticsEvent" LIMIT 1`; dbOk = true; } catch { dbOk = false; }

const ENV = { ADVENTUM_BASE_URL: "https://adventumdz.com", AUTH_SECRET: "secret-de-banc" } as unknown as NodeJS.ProcessEnv;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("La porte de la collecte : l'origine du site, rien d'autre", () => {
  it("l'origine du site, avec et sans www", () => {
    expect(originesAutorisees(ENV).sort()).toEqual(["https://adventumdz.com", "https://www.adventumdz.com"]);
    expect(originesAutorisees({ ADVENTUM_BASE_URL: "https://www.adventumdz.com/api/v1" } as unknown as NodeJS.ProcessEnv).sort())
      .toEqual(["https://adventumdz.com", "https://www.adventumdz.com"]);
  });
  it("refuse une autre origine, ou aucune", () => {
    const h = (o?: string) => new Headers(o ? { origin: o } : {});
    expect(porteAudience(h("https://adventumdz.com"), ENV)).toEqual({ ok: true, origine: "https://adventumdz.com" });
    expect(porteAudience(h("https://www.adventumdz.com"), ENV).ok).toBe(true);
    for (const o of ["https://evil.test", "http://adventumdz.com", "https://adventumdz.com.evil.test", undefined]) {
      expect(porteAudience(h(o), ENV).ok, String(o)).toBe(false);
    }
  });
});

describe("Ce qui n'est jamais gardé", () => {
  it("l'empreinte du visiteur : stable dans la journée, autre le lendemain, sans l'IP en clair", () => {
    const matin = new Date("2026-10-07T07:00:00Z").getTime();
    const soir = new Date("2026-10-07T21:00:00Z").getTime();
    const demain = new Date("2026-10-08T07:00:00Z").getTime();
    const a = empreinteVisiteur("41.100.1.2", IPHONE, matin, ENV);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("41.100");
    expect(empreinteVisiteur("41.100.1.2", IPHONE, soir, ENV)).toBe(a);
    expect(empreinteVisiteur("41.100.1.2", IPHONE, demain, ENV)).not.toBe(a);
    expect(empreinteVisiteur("41.100.1.3", IPHONE, matin, ENV)).not.toBe(a);
  });
  it("l'adresse du client est lue dans l'en-tête du mandataire (la première)", () => {
    const h = new Headers({ "x-forwarded-for": "41.100.1.2, 10.0.0.1" });
    expect(adresseClient((n) => h.get(n))).toBe("41.100.1.2");
  });
  it("le débit : 120 événements par minute et par adresse", () => {
    oublierDebits();
    const t = 1_000_000;
    expect(prendreDebit("ip", 50, t)).toBe(50);
    expect(prendreDebit("ip", 50, t + 1)).toBe(50);
    expect(prendreDebit("ip", 50, t + 2)).toBe(DEBIT_PAR_MINUTE - 100);
    expect(prendreDebit("ip", 5, t + 3)).toBe(0);
    expect(prendreDebit("autre", 5, t + 3)).toBe(5);
    expect(prendreDebit("ip", 5, t + 60_001)).toBe(5);
  });
});

describe("Le script servi au site", () => {
  it("du JavaScript, mis en cache une heure", async () => {
    const r = await scriptDuSite(new Request("https://erp.test/api/site-web/v1/audience.js"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/application\/javascript/);
    expect(r.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await r.text()).toContain("https://erp.test/api/site-web/v1/audience");
  });
});

describe.skipIf(!dbOk)("POST /api/site-web/v1/audience — de bout en bout", () => {
  const avant = { base: process.env.ADVENTUM_BASE_URL };
  const MARQUE = "/banc-audience-collecte";

  beforeEach(async () => {
    process.env.ADVENTUM_BASE_URL = "https://adventumdz.com";
    oublierDebits();
    await prisma.siteAnalyticsEvent.deleteMany({ where: { path: { startsWith: MARQUE } } });
  });
  afterAll(async () => {
    if (avant.base === undefined) delete process.env.ADVENTUM_BASE_URL; else process.env.ADVENTUM_BASE_URL = avant.base;
    await prisma.siteAnalyticsEvent.deleteMany({ where: { path: { startsWith: MARQUE } } });
  });

  const envoyer = (corps: unknown, entetes: Record<string, string> = {}) => POST(new Request("https://erp.test/api/site-web/v1/audience", {
    method: "POST",
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
    headers: { origin: "https://adventumdz.com", "content-type": "text/plain", "user-agent": IPHONE, "x-forwarded-for": "41.100.9.9", ...entetes },
  }));

  it("204 et les événements écrits — sans IP ni agent utilisateur, avec la source déduite", async () => {
    const r = await envoyer({ events: [
      { type: "PAGEVIEW", path: `${MARQUE}/carrieres/x?email=a@b.c`, title: "Offre", referrer: "https://www.linkedin.com/feed/", session: "abcdef0123456789" },
      { type: "CLICK", path: `${MARQUE}/carrieres/x`, label: "postuler", target: "/carrieres/x/postuler", session: "abcdef0123456789" },
      { type: "LEAVE", path: `${MARQUE}/carrieres/x`, durationMs: 15_000, session: "abcdef0123456789" },
      { type: "BOGUS", path: MARQUE },
    ] }, { "cf-ipcountry": "DZ" });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("https://adventumdz.com");
    const lignes = await prisma.siteAnalyticsEvent.findMany({ where: { path: { startsWith: MARQUE } }, orderBy: { type: "asc" } });
    expect(lignes.map((l) => l.type).sort()).toEqual(["CLICK", "LEAVE", "PAGEVIEW"]);
    const vue = lignes.find((l) => l.type === "PAGEVIEW")!;
    expect(vue).toMatchObject({ path: `${MARQUE}/carrieres/x`, referrer: "linkedin.com", source: "LinkedIn", device: "Mobile", browser: "Safari", os: "iOS", country: "DZ" });
    expect(vue.session).not.toBe("abcdef0123456789");
    const tout = JSON.stringify(lignes);
    expect(tout).not.toContain("41.100.9.9");
    expect(tout).not.toContain("iPhone OS");
    expect(tout).not.toContain("a@b.c");
  });

  it("403 d'une autre origine ; rien n'est écrit pour un robot ni pour « ne pas me suivre » ; 400 illisible ; 429 au-delà du débit", async () => {
    const lot = { events: [{ type: "PAGEVIEW", path: MARQUE }] };
    expect((await envoyer(lot, { origin: "https://evil.test" })).status).toBe(403);
    expect((await envoyer(lot, { "user-agent": "Googlebot/2.1" })).status).toBe(204);
    expect((await envoyer(lot, { dnt: "1" })).status).toBe(204);
    expect(await prisma.siteAnalyticsEvent.count({ where: { path: { startsWith: MARQUE } } })).toBe(0);
    expect((await envoyer("{pas du json")).status).toBe(400);
    const plein = { events: Array.from({ length: 50 }, () => ({ type: "PAGEVIEW", path: MARQUE })) };
    for (let i = 0; i < 2; i++) expect((await envoyer(plein)).status).toBe(204);
    expect((await envoyer(plein)).status).toBe(204); // 20 encore admis
    expect((await envoyer(plein)).status).toBe(429);
    expect(await prisma.siteAnalyticsEvent.count({ where: { path: { startsWith: MARQUE } } })).toBe(DEBIT_PAR_MINUTE);
  });

  it("OPTIONS : la pré-vérification n'est accordée qu'au site", async () => {
    const pre = (o: string) => OPTIONS(new Request("https://erp.test/api/site-web/v1/audience", { method: "OPTIONS", headers: { origin: o } }));
    expect((await pre("https://www.adventumdz.com")).status).toBe(204);
    expect((await pre("https://evil.test")).status).toBe(403);
  });
});
