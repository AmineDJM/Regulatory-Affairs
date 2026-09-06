import { describe, expect, it } from "vitest";
// ⚠ ORDRE D'IMPORT IMPORTANT — même contrainte que `capability-audit.test.ts` : `ops` et
// `lib/assistant.ts` forment un cycle d'INITIALISATION. Charger `assistant` d'abord donne
// l'ordre qui résout ; l'inverser fait échouer la suite entière.
import "@/lib/assistant";
import { assistantToolsFor } from "@/lib/assistant";
import { DOMAIN_TOOL_DEFS } from "./ops";
import { fitToolBudget } from "./context/tool-shortlist";
import { MAX_TOOLS_PER_CALL, capTools, buildBody } from "@/lib/models/openai";
import type { CurrentUser } from "@/lib/session";
import { MODULES, ACTIONS, type Module, type Action } from "@/lib/rbac";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLAFOND D'OUTILS — le garde-fou qui n'existait pas, et ce qu'il a coûté.
 *
 * ── L'INCIDENT ───────────────────────────────────────────────────────────────────────────
 *
 * En production, « Hello » a répondu :
 *
 *     Erreur IA (HTTP 400) : Invalid 'tools': array too long.
 *     Expected an array with maximum length 128, but got an array with length 161 instead.
 *
 * 161 = 11 lecture + 79 pouvoirs + 1 export + 2 + 9 super-admin + 29 écriture + 30 domaines.
 *
 * Ce n'était PAS un cas limite. La liste courte est un canary à 20 % ; le chemin LEGACY, qui
 * reçoit les 80 % de lectures restantes ET la totalité des mutations, envoyait la liste
 * complète. Adam était donc cassé pour le Super Admin sur la majorité de ses tours — et rien,
 * dans 4 150 tests, ne mesurait le nombre d'outils réellement envoyé.
 *
 * ── CE QUE CE FICHIER GARANTIT ───────────────────────────────────────────────────────────
 *
 * Deux verrous indépendants, parce qu'un seul se contourne :
 *
 *   1. L'ASSEMBLAGE tient dans le plafond après `fitToolBudget` — le correctif utile, qui
 *      réduit de façon RÉVERSIBLE (la découverte rouvre un domaine en cours de boucle).
 *   2. LA FRONTIÈRE ne laisse jamais passer plus que le plafond — le filet, qui protège même
 *      un appelant futur qui aurait oublié le premier verrou.
 *
 * Le premier verrou peut redevenir faux en ajoutant des outils ; c'est exactement ce qu'on veut
 * qu'un test dise, plutôt qu'un utilisateur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un compte aux droits GRANDS OUVERTS — le pire cas, celui qui a cassé en production. */
function superAdminTousDroits(): CurrentUser {
  const modules = new Map<Module, { actions: Set<Action> }>();
  for (const m of MODULES) modules.set(m, { actions: new Set<Action>(ACTIONS) });
  return {
    id: "test-super-admin",
    name: "Essai",
    email: "essai@example.invalid",
    role: "SUPER_ADMIN",
    access: { modules, rowGrants: [], secondaryRole: null, role: "SUPER_ADMIN", pipelineView: true, pipelineManage: true },
  } as unknown as CurrentUser;
}

/** La route la plus large : le raisonnement profond voit le plus d'outils par construction. */
const ROUTE_LARGE = { route: "DEEP_REASONING", domain: "GENERAL" } as const;

describe("plafond d'outils — l'incident HTTP 400 ne doit pas revenir", () => {
  it("la liste complète d'un Super Admin dépasse VRAIMENT le plafond", () => {
    // Ce test n'est pas une formalité : il fixe le fait mesuré. S'il devenait faux parce que la
    // liste a maigri, le repli ci-dessous cesserait d'être exercé sans que personne ne le voie.
    const tous = assistantToolsFor(superAdminTousDroits());
    expect(tous.length).toBeGreaterThan(MAX_TOOLS_PER_CALL);
    expect(DOMAIN_TOOL_DEFS.length).toBeGreaterThan(0);
  });

  it("après ajustement au budget, la liste tient dans le plafond", () => {
    // LE CORRECTIF UTILE. Sans lui, l'appel part à 161 et revient en 400.
    const tous = assistantToolsFor(superAdminTousDroits());
    const ajustee = fitToolBudget(tous, ROUTE_LARGE);
    expect(ajustee.length).toBeLessThanOrEqual(MAX_TOOLS_PER_CALL);
  });

  it("même si la LISTE COURTE dépasse, l'ajustement tient le plafond — socle et découverte intacts", () => {
    // Le défaut mesuré le 2026-09-06 : le catalogue a grossi (§44 à §49), la liste courte d'un
    // Super Admin en raisonnement profond est passée à 129 pour un plafond de 128, et
    // `fitToolBudget` rendait 129. Une fonction qui « fait entrer dans le plafond » et qui
    // dépasse ne protège de rien : elle déplace le 400 là où plus aucun test ne le regarde.
    //
    // On force le cas en abaissant le plafond, ce qui l'exerce quelle que soit la taille
    // future du catalogue — sans quoi ce test redeviendrait muet dès la prochaine coupe.
    const tous = assistantToolsFor(superAdminTousDroits());
    for (const plafond of [128, 60, 30, 12]) {
      const ajustee = fitToolBudget(tous, ROUTE_LARGE, plafond);
      expect(ajustee.length, `plafond ${plafond}`).toBeLessThanOrEqual(plafond);
      // LA DÉCOUVERTE SURVIT À TOUTES LES COUPES : c'est ce qui les rend réversibles.
      expect(ajustee.some((t) => t.name === "list_more_tools"), `plafond ${plafond}`).toBe(true);
      // ET LE SOCLE AUSSI, tant qu'il tient dans le plafond : amputer `search_everything`
      // casserait la recherche elle-même, pas seulement un domaine.
      if (plafond >= 30) {
        expect(ajustee.some((t) => t.name === "search_everything"), `plafond ${plafond}`).toBe(true);
      }
    }
  });

  it("l'ajustement est STABLE : deux appels identiques rendent la même liste", () => {
    // Sans quoi une régression de production deviendrait irreproductible en test.
    const tous = assistantToolsFor(superAdminTousDroits());
    const a = fitToolBudget(tous, ROUTE_LARGE, 40).map((t) => t.name);
    const b = fitToolBudget(tous, ROUTE_LARGE, 40).map((t) => t.name);
    expect(a).toEqual(b);
  });

  it("l'ajustement reste RÉVERSIBLE : la découverte survit à la réduction", () => {
    // Une coupe aveugle rendrait les outils écartés inatteignables pour le tour entier. La
    // liste courte, elle, laisse `list_more_tools` rouvrir un domaine — c'est ce qui rend la
    // réduction acceptable plutôt qu'amputante.
    const tous = assistantToolsFor(superAdminTousDroits());
    const ajustee = fitToolBudget(tous, ROUTE_LARGE);
    expect(ajustee.some((t) => t.name === "list_more_tools")).toBe(true);
  });

  it("une liste déjà courte n'est pas touchée", () => {
    // Le budget ne doit rien coûter quand il n'y a rien à corriger : un appelant sobre garde
    // exactement sa liste, dans son ordre.
    const petite = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(fitToolBudget(petite, ROUTE_LARGE)).toEqual(petite);
  });

  it("la frontière du fournisseur ne laisse JAMAIS passer plus que le plafond", () => {
    // LE FILET. Il protège un appelant futur qui n'appellerait pas `fitToolBudget`.
    const trop = Array.from({ length: MAX_TOOLS_PER_CALL + 40 }, (_, i) => ({
      name: `outil_${i}`, description: "x", parameters: { type: "object" as const },
    }));
    expect(capTools(trop).length).toBe(MAX_TOOLS_PER_CALL);
    // L'ordre est préservé : le modèle y est sensible, et les outils utiles sont assemblés d'abord.
    expect(capTools(trop)[0]?.name).toBe("outil_0");
  });

  it("le corps de requête envoyé à OpenAI respecte le plafond", () => {
    // La preuve de bout en bout : ce qui part sur le réseau, pas ce qu'on croit assembler.
    const trop = Array.from({ length: MAX_TOOLS_PER_CALL + 40 }, (_, i) => ({
      name: `outil_${i}`, description: "x", parameters: { type: "object" as const },
    }));
    const body = buildBody(
      { model: "gpt-5.6-terra", reasoning: "none" } as never,
      [{ role: "user", content: [{ type: "text", text: "Hello" }] }] as never,
      { tools: trop } as never,
    );
    expect((body.tools as unknown[]).length).toBe(MAX_TOOLS_PER_CALL);
  });
});

describe("mesure consignée — le plafond d'outils", () => {
  it("l'ajustement tient le plafond à toutes les tailles", () => {
    const tous = assistantToolsFor(superAdminTousDroits());
    const plafonds = [128, 60, 30, 12];
    const ok = plafonds.filter((p) => {
      const a = fitToolBudget(tous, ROUTE_LARGE, p);
      return a.length <= p && a.some((t) => t.name === "list_more_tools");
    }).length;
    consignerMesure("plafond_outils_garanti", { n: plafonds.length, ok },
      "lib/assistant/tool-budget.test.ts",
      `${tous.length} outils réduits sous 4 plafonds, découverte préservée à chaque fois`);
  });
});
