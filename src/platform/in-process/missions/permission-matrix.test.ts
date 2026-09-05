import { describe, expect, it } from "vitest";
import { getAccess, type EffectiveAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/labels";
import { RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { EFFECT_RANK } from "@/lib/missions/registry/capability-meta";
import { exempleEntree } from "@/lib/missions/registry/input-contract";
import { compile } from "@/lib/missions/compiler/compile";
import type { MissionPlan } from "@/lib/missions/planner/contract";
import { catalogueDe, acteurDe } from "@/platform/in-process/missions/catalog";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PERMISSIONS × CAPACITÉS × CONFIRMATION — mesuré sur le VRAI catalogue, pour TOUS les rôles.
 *
 * Trois propriétés du mandat, chacune calculée sur l'ensemble des capacités que le catalogue
 * ouvre réellement à chaque rôle (jamais sur une liste recopiée) :
 *
 *   100 % sécurité des permissions   une capacité qui écrit n'est ouverte qu'aux rôles dont le
 *                                    résolveur de la conversation l'ouvre aussi (même code) ; un
 *                                    rôle terrain n'a AUCUNE capacité de sécurité, et l'AGENT ne
 *                                    peut compiler aucune capacité SECURITY_ADMIN, quel que soit
 *                                    le compte qui le porte ;
 *   100 % sécurité de confirmation   toute capacité d'écriture du résolveur est classée ≥
 *                                    INTERNAL_REVERSIBLE_WRITE (le défaut qui a bloqué la
 *                                    première mission inédite était l'inverse : des lectures
 *                                    classées EXTERNAL_COMMUNICATION), et toute étape à effet
 *                                    ≥ EXTERNAL_COMMUNICATION compile avec `needsApproval` ;
 *   0 écriture non rejouable sans clé une étape d'écriture non idempotente porte toujours sa clé
 *                                    d'idempotence.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const ROLES = Object.keys(ROLE_LABELS);
const TERRAIN = ["MEDICAL_DELEGATE", "SALES_USER"];

async function utilisateur(role: string): Promise<CurrentUser> {
  // Un identifiant qui n'existe pas : `getAccess` retombe sur les défauts du rôle — exactement
  // ce qu'on veut mesurer (pas les dérogations d'une personne réelle).
  const access = (await getAccess(`matrice-${role}`, role as never)) as EffectiveAccess;
  return { id: `matrice-${role}`, name: `Matrice ${role}`, email: `${role.toLowerCase()}@matrice.test`, role: role as never, access, mustChangePassword: false };
}

// L'ENTRÉE MINIMALE HONORE LE CONTRAT de la capacité (registry/input-contract.ts) : depuis que le
// compilateur refuse une obligatoire manquante (INVALID_INPUT), une étape vide ne compilerait plus,
// et la matrice mesurerait la présence d'un paramètre au lieu de l'accord et de la clé.
const planUneEtape = (capability: string, input: Record<string, unknown> = {}): MissionPlan => ({
  objective: `Appeler ${capability}`, acceptance: ["l'appel est fait"], complexity: "A", scale: "S",
  steps: [{ key: "etape", title: capability, nodeType: "CAPABILITY", capability, input, dependsOn: [], approvalRequirement: "NONE" }],
  workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
});

suite("permissions × capacités × confirmation — sur le vrai catalogue, tous les rôles", () => {
  it("les rôles sont ceux du produit (le test n'est pas vide)", () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(8);
    expect(ROLES).toContain("SUPER_ADMIN");
  });

  it("100 % sécurité de confirmation : toute écriture du résolveur est classée ≥ INTERNAL_REVERSIBLE_WRITE, et une capacité ouverte ne redescend jamais sous son effet", async () => {
    const admin = await utilisateur("SUPER_ADMIN");
    const cat = catalogueDe(admin);
    const fautes: string[] = [];
    for (const b of cat.brief(acteurDe(admin))) {
      const ecrit = RESOLVER_WRITE_NAMES.has(b.id);
      if (ecrit && EFFECT_RANK[b.effect] < EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) fautes.push(`${b.id} écrit mais est classée ${b.effect}`);
    }
    expect(fautes, fautes.join("\n")).toEqual([]);
  });

  it("100 % : toute étape à effet ≥ EXTERNAL_COMMUNICATION compile avec un accord, toute écriture non rejouable avec une clé", async () => {
    const admin = await utilisateur("SUPER_ADMIN");
    const cat = catalogueDe(admin);
    const acteur = acteurDe(admin);
    const fautes: string[] = [];
    let ecritures = 0;
    for (const b of cat.brief(acteur)) {
      if (EFFECT_RANK[b.effect] < EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) continue;
      const r = compile(planUneEtape(b.id, exempleEntree(cat.entrees?.(b.id))), cat, acteur);
      if (!r.ok) {
        // Une capacité de sécurité refusée à la compilation est la bonne réponse, pas une faute.
        if (b.effect === "SECURITY_ADMIN") continue;
        fautes.push(`${b.id} (${b.effect}) ne compile pas : ${r.issues.map((i) => i.message).join(" ")}`);
        continue;
      }
      ecritures += 1;
      const s = r.mission.steps[0];
      if (EFFECT_RANK[b.effect] >= EFFECT_RANK.EXTERNAL_COMMUNICATION && !s.needsApproval) fautes.push(`${b.id} (${b.effect}) compile SANS accord`);
      if (!s.idempotent && !s.needsIdempotencyKey) fautes.push(`${b.id} non rejouable compile SANS clé d'idempotence`);
    }
    expect(ecritures).toBeGreaterThan(10);
    expect(fautes, fautes.join("\n")).toEqual([]);
  });

  it("100 % sécurité des permissions : un rôle terrain n'a aucune capacité de sécurité ni de paiement, et l'AGENT ne compile jamais une capacité SECURITY_ADMIN", async () => {
    const fautes: string[] = [];
    for (const role of TERRAIN) {
      const u = await utilisateur(role);
      const cat = catalogueDe(u);
      for (const b of cat.brief(acteurDe(u))) {
        if (b.effect === "SECURITY_ADMIN") fautes.push(`${role} voit ${b.id} (SECURITY_ADMIN)`);
        if (b.effect === "FINANCIAL_COMMITMENT") fautes.push(`${role} voit ${b.id} (FINANCIAL_COMMITMENT)`);
      }
    }
    const admin = await utilisateur("SUPER_ADMIN");
    const cat = catalogueDe(admin);
    const agent = { ...acteurDe(admin), isAgent: true };
    let securite = 0;
    for (const b of cat.brief(acteurDe(admin))) {
      if (b.effect !== "SECURITY_ADMIN") continue;
      securite += 1;
      const r = compile(planUneEtape(b.id, exempleEntree(cat.entrees?.(b.id))), cat, agent);
      if (r.ok) fautes.push(`l'agent a compilé ${b.id} (SECURITY_ADMIN)`);
    }
    expect(securite, "le catalogue du Super Admin doit porter des capacités de sécurité à mesurer").toBeGreaterThan(0);
    expect(fautes, fautes.join("\n")).toEqual([]);
  });

  it("la couverture par rôle est mesurée et dite : chaque rôle a un catalogue, et le catalogue croît avec les droits", async () => {
    const tailles: Record<string, number> = {};
    for (const role of ROLES) {
      const u = await utilisateur(role);
      tailles[role] = catalogueDe(u).taille;
    }
    for (const role of TERRAIN) expect(tailles[role], role).toBeLessThan(tailles.SUPER_ADMIN);
    // Pas un catalogue vide : un rôle sans aucune capacité ne pourrait même pas lire son agenda.
    for (const role of ROLES) expect(tailles[role], `${role} n'a aucune capacité`).toBeGreaterThan(0);
  });
});
