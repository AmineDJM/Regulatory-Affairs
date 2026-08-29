import { describe, expect, it } from "vitest";
import { MISSION_PLAN_SCHEMA, VARIANTES_ETAPE, tailleSchemaJetons } from "@/lib/missions/planner/schema";
import { verifierSchema } from "@/lib/missions/planner/validate";
import { NODE_TYPES } from "@/lib/missions/planner/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SCHÉMA EN VARIANTES — ce qu'il fait gagner, et ce qu'il ne doit surtout pas perdre.
 *
 * ── LA MESURE QUI A PRODUIT CE FICHIER ───────────────────────────────────────────────────
 *
 * 265 jetons de sortie visible par étape sur un run réel, pour un planificateur qui pesait
 * 79 % du temps total. Le schéma imposait 21 champs obligatoires à CHAQUE étape — le mode
 * strict exige que tous soient écrits — dont huit valaient `null` sur une CAPABILITY : les cinq
 * `wait*` et les trois `forEach*`.
 *
 * ── LE RISQUE, ET C'EST LUI QUE CE FICHIER GARDE ─────────────────────────────────────────
 *
 * Découper un schéma en variantes est facile ; ne rien PERDRE au passage ne l'est pas. Un champ
 * oublié dans une variante devient un champ que le planificateur ne peut plus exprimer — une
 * attente qu'il ne sait plus déclarer, un éventail qu'il ne sait plus demander — et le manque
 * ne se verrait qu'en production, sur une mission qui ne fait pas ce qu'on lui a demandé.
 *
 * Le test central compare donc l'UNION des variantes au vocabulaire complet, champ par champ.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const requisDe = (v: Record<string, unknown>): string[] => (v.required as string[]) ?? [];
const proprietes = (v: Record<string, unknown>): string[] =>
  Object.keys((v.properties ?? {}) as Record<string, unknown>);

/** Tout ce qu'une étape peut exprimer, toutes variantes confondues. */
const VOCABULAIRE = new Set(Object.values(VARIANTES_ETAPE).flatMap(proprietes));

describe("le schéma d'étape, en variantes", () => {
  it("AUCUN CHAMP N'A ÉTÉ PERDU au découpage", () => {
    // La liste est écrite à la main À DESSEIN : la dériver du schéma la rendrait vraie par
    // construction, et ce test ne garderait plus rien. C'est le vocabulaire que le runtime
    // sait lire — `reconstruirePlan` et le compilateur en dépendent.
    const ATTENDUS = [
      "key", "title", "workstream", "nodeType", "dependsOn", "completionCondition",
      "capability", "inputs", "forEach", "outputFields",
      "waitEvent", "waitFrom", "waitEntity", "waitAsk", "waitWithinDays",
      "reasoningRequirement", "approvalRequirement", "maxAttempts",
    ];
    for (const champ of ATTENDUS) {
      expect(VOCABULAIRE.has(champ), `« ${champ} » n'existe dans AUCUNE variante`).toBe(true);
    }
  });

  it("CHAQUE nodeType du contrat a une variante qui l'accepte", () => {
    // Un type déclaré sans forme est un type que le planificateur ne peut plus produire.
    for (const t of NODE_TYPES) {
      const porte = Object.values(VARIANTES_ETAPE).some((v) => {
        const nt = ((v.properties as Record<string, Record<string, unknown>>).nodeType.enum ?? []) as string[];
        return nt.includes(t);
      });
      expect(porte, `aucune variante n'accepte nodeType « ${t} »`).toBe(true);
    }
  });

  it("chaque variante reste STRICTE : tout est requis, rien n'est libre", () => {
    // Les trois contraintes du mode strict, vérifiées sur chaque forme. Une seule qui manque et
    // le fournisseur refuse le schéma entier — donc toutes les missions, d'un coup.
    for (const [nom, v] of Object.entries(VARIANTES_ETAPE)) {
      expect(v.additionalProperties, nom).toBe(false);
      expect(requisDe(v).sort(), nom).toEqual(proprietes(v).sort());
    }
  });

  it("le discriminant est un ENUM FERMÉ sur chaque variante — sinon rien ne les départage", () => {
    for (const [nom, v] of Object.entries(VARIANTES_ETAPE)) {
      const nt = (v.properties as Record<string, Record<string, unknown>>).nodeType;
      expect(Array.isArray(nt.enum), nom).toBe(true);
      expect((nt.enum as string[]).length, nom).toBeGreaterThan(0);
      for (const t of nt.enum as string[]) {
        expect(NODE_TYPES as readonly string[], nom).toContain(t);
      }
    }
  });

  it("LA RÉDUCTION EST RÉELLE : une CAPABILITY n'écrit plus les champs d'attente", () => {
    // Le cœur du gain. Avant, 21 champs dont 8 nuls ; maintenant, 11 dont aucun ne concerne
    // une attente ou un travail de modèle.
    const cap = requisDe(VARIANTES_ETAPE.CAPABILITY);
    expect(cap.length).toBeLessThanOrEqual(12);
    for (const absent of ["waitEvent", "waitFrom", "waitEntity", "waitAsk", "waitWithinDays", "outputFields"]) {
      expect(cap, `une CAPABILITY ne devrait pas écrire « ${absent} »`).not.toContain(absent);
    }
    // Et un nœud de structure n'écrit QUE le tronc commun.
    expect(requisDe(VARIANTES_ETAPE.STRUCTURE)).toHaveLength(6);
  });

  it("l'éventail est UN champ, pas trois — et il ne peut plus être à moitié rempli", () => {
    const cap = VARIANTES_ETAPE.CAPABILITY.properties as Record<string, Record<string, unknown>>;
    expect(cap.forEach).toBeDefined();
    expect(cap.forEachFrom).toBeUndefined();
    // Les trois membres sont obligatoires DANS l'objet : « from sans path » n'est plus
    // représentable, alors que trois chaînes nullables le permettaient.
    expect(cap.forEach.required).toEqual(["from", "path", "as"]);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE VALIDATEUR SUIT LES VARIANTES — sinon le banc accepterait ce que le fournisseur refuse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("la vérification d'une étape en variantes", () => {
  const capability = {
    key: "lire:dossier", title: "Lire le dossier", workstream: null,
    dependsOn: [], completionCondition: "le dossier est lu",
    nodeType: "CAPABILITY", capability: "inspect_record",
    inputs: [{ key: "reference", kind: "TEXT", value: "REG-1" }],
    forEach: null, approvalRequirement: "NONE", maxAttempts: null,
  };

  const etape = (v: unknown) => verifierSchema(
    v, (MISSION_PLAN_SCHEMA.properties as Record<string, Record<string, unknown>>).steps.items as Record<string, unknown>,
  );

  it("une CAPABILITY bien formée passe", () => {
    expect(etape(capability)).toEqual([]);
  });

  it("une CAPABILITY qui écrit un champ d'ATTENTE est REFUSÉE", () => {
    // C'est tout l'intérêt du découpage : le mode strict interdit les champs en trop, donc le
    // modèle ne PEUT plus écrire huit nuls « au cas où ».
    const ecarts = etape({ ...capability, waitEvent: "EMAIL_RECEIVED" });
    expect(ecarts.length).toBeGreaterThan(0);
    expect(ecarts.some((e) => e.probleme.includes("waitEvent"))).toBe(true);
  });

  it("une CAPABILITY sans sa capacité est REFUSÉE — le champ est obligatoire dans SA variante", () => {
    const { capability: _, ...sansCapacite } = capability;
    const ecarts = etape(sansCapacite);
    expect(ecarts.some((e) => e.probleme.includes("capability"))).toBe(true);
  });

  it("une WAIT_EVENT bien formée passe, et n'a pas à parler de capacité", () => {
    // Le mode strict rend TOUS les champs : les attentes v2 (échéance, fil, objet, pièce,
    // compositions) voyagent à `null` quand elles ne servent pas — jamais absentes.
    expect(etape({
      key: "attente:reponse", title: "Attendre la réponse", workstream: null,
      dependsOn: ["envoi"], completionCondition: "une réponse est arrivée",
      nodeType: "WAIT_EVENT", waitEvent: "EMAIL_RECEIVED",
      waitFrom: "anpp@sante.dz", waitEntity: null, waitWithinDays: 15,
      waitUntil: null, waitThreadId: null, waitSubject: null, waitAttachment: null,
      waitAnyOf: null, waitAllOf: null,
    })).toEqual([]);
  });

  it("une WAIT_EVENT v2 — échéance, pièce exigée et composition ET — passe aussi", () => {
    expect(etape({
      key: "attente:contrat-et-devis", title: "Attendre le contrat ET le devis", workstream: null,
      dependsOn: ["relance"], completionCondition: "les deux pièces sont arrivées",
      nodeType: "WAIT_EVENT", waitEvent: "EMAIL_RECEIVED",
      waitFrom: null, waitEntity: null, waitWithinDays: 7,
      waitUntil: "2026-09-05T08:00:00.000Z", waitThreadId: "thr_9", waitSubject: null, waitAttachment: "*.pdf",
      waitAnyOf: null,
      waitAllOf: [
        { event: "EMAIL_RECEIVED", from: "sarah@ex.dz", entity: null, until: null, threadId: null, subject: "contrat", attachment: true },
        { event: "EMAIL_RECEIVED", from: "sarah@ex.dz", entity: null, until: null, threadId: null, subject: "devis", attachment: true },
      ],
    })).toEqual([]);
  });

  it("un nœud de STRUCTURE ne porte que le tronc commun", () => {
    expect(etape({
      key: "jonction", title: "Attendre les branches", workstream: null,
      dependsOn: ["a", "b"], completionCondition: "les deux branches sont finies",
      nodeType: "JOIN",
    })).toEqual([]);
  });

  it("LE MESSAGE DÉSIGNE LA VARIANTE LA PLUS PROCHE, pas le cumul des sept", () => {
    // Sans ce choix, un plan refusé rendrait « il manque capability, waitEvent, waitAsk,
    // outputFields… » — une liste qui ne désigne rien et qu'un planificateur ne sait pas
    // corriger. On veut « il manque capability », et rien d'autre.
    const { capability: _, ...sansCapacite } = capability;
    const ecarts = etape(sansCapacite);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0].probleme).toContain("capability");
  });

  it("un nodeType INCONNU est refusé par toutes les variantes", () => {
    const ecarts = etape({ ...capability, nodeType: "MAGIE" });
    expect(ecarts.length).toBeGreaterThan(0);
  });
});

describe("le poids du schéma", () => {
  it("il est MESURÉ, et le chiffre est celui qu'on envoie", () => {
    // `tailleSchemaJetons` sert au relevé du diagnostic : s'il divergeait du schéma réel, on
    // optimiserait sur un chiffre faux — le défaut exact qu'un lot précédent a corrigé ailleurs.
    const reel = Math.ceil(JSON.stringify(MISSION_PLAN_SCHEMA).length / 3.6);
    expect(tailleSchemaJetons()).toBe(reel);
  });
});
