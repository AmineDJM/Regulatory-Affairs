import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lireSante, recoitLesCandidatures } from "./liaison";

/**
 * LE SITE RESTÉ SUR L'ANCIENNE VERSION (§118.159g). Render sait redémarrer la version DÉJÀ construite
 * avec la nouvelle clé (« Save and deploy ») : le site reconnaît alors la clé, publie les offres, et
 * l'écran de l'ERP dirait « Relié » — mais sans formulaire ni route de retour, aucune candidature
 * n'arrivera jamais, et rien ne le dirait.
 *
 * Les corps ci-dessous sont ceux que les deux versions RENDENT, recopiés de leur code
 * (`app/api/v1/health/route.ts` du dépôt du site, commits b276b75 et 1d28000) — pas une forme
 * plausible écrite pour faire passer le test.
 */
const maintenant = new Date("2026-09-30T15:00:00Z");
const reponse = (statut: number | null, corps: unknown) => ({
  statut,
  texte: corps === undefined ? null : JSON.stringify(corps),
  erreur: statut === null ? "site injoignable" : null,
});

const ANCIENNE = {
  status: "ok", service: "adventum-content-api", version: "1", configured: true, authenticated: true,
  capabilities: ["jobs", "posts"], serverTime: "2026-09-30T15:00:00.000Z",
};
const RELIEE = {
  status: "ok", service: "adventum-content-api", version: "1", configured: true, authenticated: true,
  capabilities: ["jobs", "posts", "applications"], serverTime: "2026-09-30T15:00:00.000Z",
  bootId: "b-1", startedAt: "2026-09-30T14:58:00.000Z",
  erp: { linked: true, signing: true, reason: null, lastError: null, lastRestore: null },
  applications: { pending: 0, rejected: 0, oldestAt: null, lastDeliveredAt: null },
  storage: { fallback: true },
};
const ANONYME = { status: "ok", service: "adventum-content-api", version: "1", configured: true, authenticated: false };

const carte = () => readFileSync(join(process.cwd(), "src/app/(app)/admin/site-web/carte-liaison.tsx"), "utf8");

describe("Le site tourne-t-il sur la version qui reçoit les candidatures ?", () => {
  it("l'ANCIENNE version reconnaît la clé mais ne reçoit rien : NON — et c'est bien la clé qui est reconnue", () => {
    const s = lireSante(reponse(200, ANCIENNE), maintenant);
    // Prémisse : sans elle, « non » pourrait venir d'une clé refusée et le cas ne mesurerait rien.
    expect(s.authentifie).toBe(true);
    expect(recoitLesCandidatures(s)).toBe(false);
  });

  it("la version RELIÉE : OUI", () => {
    expect(recoitLesCandidatures(lireSante(reponse(200, RELIEE), maintenant))).toBe(true);
  });

  it("sans clé reconnue, sur un refus ou un site injoignable : on ne sait pas (null) — jamais « non »", () => {
    expect(recoitLesCandidatures(lireSante(reponse(200, ANONYME), maintenant))).toBeNull();
    expect(recoitLesCandidatures(lireSante(reponse(401, { status: "error", error: "Invalid API key." }), maintenant))).toBeNull();
    expect(recoitLesCandidatures(lireSante(reponse(null, undefined), maintenant))).toBeNull();
  });

  it("l'écran APPELLE la détection et donne le geste qui reconstruit (§118.49 : le point d'appel, pas le corps)", () => {
    const c = carte();
    expect(c).toMatch(/recoitLesCandidatures\(sante\)\s*===\s*false/);
    expect(c).toContain("Manual Deploy → Deploy latest commit");
  });

  it("la consigne nomme le bouton qui RECONSTRUIT — « Save and deploy » ne redéploie que la version déjà construite", () => {
    const c = carte();
    expect(c).toContain("Save, rebuild, and deploy");
    // « Save and deploy » ne peut figurer que dans la phrase qui l'ÉCARTE.
    const occurrences = [...c.matchAll(/Save and deploy/g)];
    expect(occurrences.length, "la phrase qui écarte « Save and deploy » a disparu").toBeGreaterThan(0);
    for (const m of occurrences) {
      expect(c.slice(Math.max(0, (m.index ?? 0) - 6), m.index), "« Save and deploy » présenté comme le geste à faire").toMatch(/Ni « $/);
    }
  });
});
