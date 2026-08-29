import { describe, expect, it } from "vitest";
import { partitionnerCriteres, argsSortieStructuree, validerReglesDacceptation } from "@/lib/missions/goal/rules";
import { evaluerObjectif, type EtapeObservee, type JugeObjectif } from "@/lib/missions/goal/evaluate";
import type { ExecutionReceipt } from "@/lib/missions/runtime/receipt";
import { cheminDirect } from "@/lib/missions/planner/direct";
import { trier } from "@/lib/missions/planner/triage";
import { compile } from "@/lib/missions/compiler/compile";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import type { CapabilityBrief, CapabilityCatalog, MissionActor } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÈGLES DU JUGE HYBRIDE — et la preuve que le juge LLM n'est PLUS appelé pour rien.
 *
 * Le test le plus important est l'ESPION : quand tous les critères sont des règles, le juge
 * injecté ne doit JAMAIS être appelé — c'est l'appel de 8,9 s que le chantier supprime. Si
 * quelqu'un débranche la partition dans `evaluerObjectif`, l'espion se déclenche et ce test
 * tombe : c'est le sabotage §22 (« remplacer le juge déterministe par LLM ») rendu structurel.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const recu = (over: Partial<ExecutionReceipt> = {}): ExecutionReceipt => ({
  capability: "search_products", effect: "READ", source: "regulatory",
  query: "recherche « Zorbamyxine-K7 » (search_products)",
  startedAt: "2026-08-29T10:00:00.000Z", completedAt: "2026-08-29T10:00:01.000Z",
  issue: "VIDE", resultCount: 0, resultHash: null,
  ...over,
});

const etape = (over: Partial<EtapeObservee> = {}): EtapeObservee => ({
  key: "recherche-a", title: "Recherche A", status: "DONE", nodeType: "CAPABILITY",
  receipt: "intent-1", attempt: 1, maxAttempts: 3, result: { count: 0 },
  recu: recu(),
  ...over,
});

describe("goal/rules — la grammaire est STRICTE, le décodeur ne devine jamais", () => {
  it("un code inconnu (même entre crochets) part au juge sémantique — jamais deviné", () => {
    const p = partitionnerCriteres(
      ["[REGLE:UNE_REGLE_INVENTEE] quelque chose", "un critère sémantique ordinaire"],
      [etape()],
    );
    expect(p.regles).toHaveLength(0);
    expect(p.semantiques).toHaveLength(2);
  });

  it("RECHERCHES_AVEC_REQUETE : PASS quand chaque étape citée est DONE avec le terme au reçu", () => {
    const steps = [
      etape({ key: "recherche-a" }),
      etape({ key: "recherche-b", recu: recu({ capability: "search_drive", query: "zorbamyxine-k7 dans le drive" }) }),
    ];
    const p = partitionnerCriteres(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche-a,recherche-b] Chaque source interrogée avec « Zorbamyxine-K7 »."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("PASS");
    expect(p.regles[0].preuve).toContain("recherche-a");
  });

  it("RECHERCHES_AVEC_REQUETE : FAIL nomme l'étape dont le reçu ne porte PAS le terme", () => {
    const steps = [etape({ key: "recherche-a", recu: recu({ query: "autre chose" }) })];
    const p = partitionnerCriteres(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche-a] Interrogée avec « Zorbamyxine-K7 »."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("FAIL");
    expect(p.regles[0].preuve).toContain("recherche-a");
  });

  it("AUCUNE_ECRITURE : un reçu d'effet supérieur fait FAIL ; une capacité DONE sans reçu aussi (§78)", () => {
    const ecrit = partitionnerCriteres(
      ["[REGLE:AUCUNE_ECRITURE] Rien n'a été écrit."],
      [etape(), etape({ key: "envoi", recu: recu({ effect: "EXTERNAL_COMMUNICATION" }) })],
    );
    expect(ecrit.regles[0].verdict).toBe("FAIL");
    expect(ecrit.regles[0].preuve).toContain("envoi");

    const sansRecu = partitionnerCriteres(
      ["[REGLE:AUCUNE_ECRITURE] Rien n'a été écrit."],
      [etape({ recu: null })],
    );
    expect(sansRecu.regles[0].verdict).toBe("FAIL");
    expect(sansRecu.regles[0].preuve).toContain("invérifiable");
  });

  it("SORTIE_STRUCTUREE : PASS sur l'objet complet, FAIL en nommant le champ vide", () => {
    const conclure = etape({
      key: "conclure", nodeType: "WORKER", recu: null,
      result: { trouve: false, conclusion: "Rien dans les quatre sources.", sources: ["a", "b"] },
    });
    const ok = partitionnerCriteres(
      ["[REGLE:SORTIE_STRUCTUREE:conclure:trouve,conclusion,sources] La conclusion tranche."],
      [conclure],
    );
    expect(ok.regles[0].verdict).toBe("PASS");

    const vide = partitionnerCriteres(
      ["[REGLE:SORTIE_STRUCTUREE:conclure:trouve,conclusion,sources] La conclusion tranche."],
      [etape({ key: "conclure", nodeType: "WORKER", recu: null, result: { trouve: false, conclusion: "", sources: [] } })],
    );
    expect(vide.regles[0].verdict).toBe("FAIL");
    expect(vide.regles[0].preuve).toContain("conclusion");
  });
});

/** Un juge ESPION : il compte, et rend ce qu'on lui dit. */
function espion(reponse = { satisfait: true, raison: "avis sémantique", sansPreuve: [] as string[] }) {
  const appels: { criteres: readonly string[] }[] = [];
  const juge: JugeObjectif = {
    juger: async (input) => { appels.push({ criteres: input.criteres }); return reponse; },
  };
  return { juge, appels };
}

const ETAPES_LECTURE: EtapeObservee[] = [
  etape({ key: "recherche-a" }),
  etape({ key: "recherche-b", recu: recu({ capability: "search_drive", query: "zorbamyxine-k7 (drive)" }) }),
  etape({ key: "jonction", nodeType: "JOIN", recu: null, receipt: null, result: null }),
  etape({
    key: "conclure", nodeType: "WORKER", recu: null,
    result: { trouve: false, conclusion: "Aucune trace dans les deux sources.", sources: ["regulatory", "drive"] },
  }),
];

const CRITERES_REGLES = [
  "[REGLE:RECHERCHES_AVEC_REQUETE:recherche-a,recherche-b] Chaque source interrogée avec « Zorbamyxine-K7 ».",
  "[REGLE:AUCUNE_ECRITURE] Aucun effet au-delà d'ANALYZE.",
  "[REGLE:SORTIE_STRUCTUREE:conclure:trouve,conclusion,sources] La conclusion structurée tranche.",
];

describe("evaluerObjectif — le juge hybride, prouvé par l'espion", () => {
  it("TOUS les critères sont des règles qui passent → mission SATISFAITE, juge JAMAIS appelé", async () => {
    const { juge, appels } = espion();
    const v = await evaluerObjectif({
      objectif: "Vérifie « Zorbamyxine-K7 » partout, ne modifie rien.",
      criteres: CRITERES_REGLES,
      steps: ETAPES_LECTURE,
      juge,
      plafondEffet: "ANALYZE",
    });
    expect(v.satisfait).toBe(true);
    // `avisModele: null` : AUCUN modèle n'a jugé — les règles ont vérifié, et la raison cite les preuves.
    expect(v.avisModele).toBeNull();
    expect(v.raison).toContain("[RECHERCHES_AVEC_REQUETE]");
    expect(appels, "le juge LLM ne doit pas être appelé quand tout est règle — c'est l'appel qu'on supprime").toHaveLength(0);
  });

  it("une règle en ÉCHEC refuse DÉTERMINISTIQUEMENT — sans appel de juge, étape nommée", async () => {
    const { juge, appels } = espion();
    const casse = ETAPES_LECTURE.map((s) =>
      s.key === "recherche-b" ? { ...s, recu: recu({ query: "autre molécule" }) } : s);
    const v = await evaluerObjectif({
      objectif: "Vérifie « Zorbamyxine-K7 » partout, ne modifie rien.",
      criteres: CRITERES_REGLES,
      steps: casse,
      juge,
      plafondEffet: "ANALYZE",
    });
    expect(v.satisfait).toBe(false);
    expect(v.raison).toContain("Refus DÉTERMINISTE");
    expect(v.raison).toContain("recherche-b");
    expect(appels).toHaveLength(0);
  });

  it("critères MIXTES : le juge ne reçoit QUE les sémantiques, et son avis se combine aux preuves", async () => {
    const { juge, appels } = espion();
    const v = await evaluerObjectif({
      objectif: "Vérifie « Zorbamyxine-K7 » partout et explique l'impact.",
      criteres: [...CRITERES_REGLES, "La synthèse explique l'impact métier."],
      steps: ETAPES_LECTURE,
      juge,
      plafondEffet: "ANALYZE",
    });
    expect(appels).toHaveLength(1);
    expect(appels[0].criteres).toEqual(["La synthèse explique l'impact métier."]);
    expect(v.satisfait).toBe(true);
    expect(v.raison).toContain("règle(s) vérifiée(s)");
  });

  it("tout-règles SANS juge injecté : la mission conclut quand même — le déterminisme n'attend personne", async () => {
    const v = await evaluerObjectif({
      objectif: "Vérifie « Zorbamyxine-K7 » partout, ne modifie rien.",
      criteres: CRITERES_REGLES,
      steps: ETAPES_LECTURE,
      plafondEffet: "ANALYZE",
    });
    expect(v.satisfait).toBe(true);
  });
});

describe("le plan DIRECT multi-sources passe le VRAI compilateur", () => {
  const RECHERCHES: CapabilityBrief[] = ["search_everything", "search_products", "search_drive", "find_documents"]
    .map((id) => {
      const m = capabilityMeta(id);
      return { id, domain: m.domain, effect: "READ" as const, batchable: m.batchable, summary: id };
    });
  const catalogue: CapabilityCatalog = {
    has: (n) => RECHERCHES.some((c) => c.id === n),
    allowed: () => true,
    meta: (n) => ({ ...capabilityMeta(n), effect: "READ" }),
    brief: () => RECHERCHES,
    plafondEffet: "ANALYZE",
  };
  const acteur: MissionActor = { userId: "u1", label: "le PDG", isAgent: false };

  it("compilé sans refus : mêmes règles que n'importe quel plan de modèle — le chemin direct PROPOSE, il ne contourne rien", () => {
    const demande =
      "Vérifie si nous avons quoi que ce soit sur la molécule « Zorbamyxine-K7 » : produit, "
      + "dossier réglementaire, marché, document. Ne contacte personne, ne modifie rien, et ne produis aucun fichier.";
    const v = cheminDirect(demande, trier(demande), {
      capacites: RECHERCHES, autorisee: () => true, plafondEffet: "ANALYZE",
    });
    expect(v.plan).not.toBeNull();
    const r = compile(v.plan!, catalogue, acteur, { effetMax: "ANALYZE" });
    expect(r.ok, r.ok ? "" : JSON.stringify((r as { issues: unknown }).issues)).toBe(true);
    if (!r.ok) return;
    expect(r.mission.steps).toHaveLength(6);
  });
});

describe("SABOTAGE §22 — couper le chemin direct fait remonter les appels de planification", () => {
  it("même demande : voie DIRECTE = 0 appel ; `sansCheminDirect` = l'espion est payé", async () => {
    const { planifier } = await import("@/lib/missions/planner/plan");
    const RECHERCHES: CapabilityBrief[] = ["search_everything", "search_products", "search_drive"]
      .map((id) => {
        const m = capabilityMeta(id);
        return { id, domain: m.domain, effect: "READ" as const, batchable: m.batchable, summary: `${id} : recherche.` };
      });
    const catalogue: CapabilityCatalog = {
      has: (n) => RECHERCHES.some((c) => c.id === n),
      allowed: () => true,
      meta: (n) => ({ ...capabilityMeta(n), effect: "READ" }),
      brief: () => RECHERCHES,
      plafondEffet: "ANALYZE",
    };
    const acteur: MissionActor = { userId: "u1", label: "le PDG", isAgent: false };
    let appels = 0;
    const espionR = {
      configured: () => true,
      reason: async () => { appels += 1; return { ok: false, data: null, error: "espion", usage: null, latencyMs: 1 }; },
    };
    const demande =
      "Vérifie si nous avons quoi que ce soit sur la molécule « Sabotage-X1 » : produit, dossier "
      + "réglementaire, marché, document. Ne contacte personne, ne modifie rien, et ne produis aucun fichier.";

    const direct = await planifier(demande, catalogue, acteur, espionR);
    expect(direct.ok).toBe(true);
    expect(direct.metriques.voie).toBe("DIRECTE");
    expect(appels, "la voie directe ne doit payer AUCUN appel").toBe(0);

    await planifier(demande, catalogue, acteur, espionR, { sansCheminDirect: true });
    expect(appels, "chemin direct coupé : le planificateur LLM est payé — c'est le sabotage mesuré").toBeGreaterThanOrEqual(1);
  });
});

describe("la grammaire face aux clés à deux-points — le FAUX refus déterministe du run Render", () => {
  // Le cas EXACT du run MTEFBM32COEC : le plan du modèle nomme son étape « analyse:priorisation »,
  // la règle la cite, et l'argument se découpait au PREMIER deux-points → « étape « analyse »
  // absente » → refus déterministe d'une mission dont le travail était FAIT.
  it("argsSortieStructuree découpe au DERNIER deux-points : une clé « analyse:priorisation » survit", () => {
    expect(argsSortieStructuree("analyse:priorisation:trouve,synthese,sources"))
      .toEqual({ cle: "analyse:priorisation", champs: ["trouve", "synthese", "sources"] });
    expect(argsSortieStructuree("repondre:trouve,synthese,sources"))
      .toEqual({ cle: "repondre", champs: ["trouve", "synthese", "sources"] });
    expect(argsSortieStructuree("sans-champs")).toEqual({ cle: "", champs: [] });
  });

  it("SORTIE_STRUCTUREE vérifie désormais une étape à clé deux-points — PASS sur le cas du run", () => {
    const steps = [etape({ key: "analyse:priorisation", result: { trouve: true, synthese: "s", sources: ["a"] }, recu: null, nodeType: "WORKER" })];
    const p = partitionnerCriteres(
      ["[REGLE:SORTIE_STRUCTUREE:analyse:priorisation:trouve,synthese,sources] La synthèse structurée est rendue."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("PASS");
  });

  it("validerReglesDacceptation refuse À LA COMPILATION une règle citant une étape absente, clés disponibles à l'appui", () => {
    const problemes = validerReglesDacceptation(
      ["[REGLE:SORTIE_STRUCTUREE:analyse:trouve,synthese] La synthèse est rendue."],
      new Set(["recherche:dossiers", "analyse:priorisation", "controle:final"]),
    );
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("« analyse »");
    expect(problemes[0]).toContain("analyse:priorisation");
  });

  it("une règle aux références JUSTES ne produit aucun problème ; un code INCONNU non plus (sémantique)", () => {
    expect(validerReglesDacceptation(
      [
        "[REGLE:SORTIE_STRUCTUREE:analyse:priorisation:trouve,synthese] ok.",
        "[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers] Interrogée avec « X ».",
        "[REGLE:UN_CODE_INVENTE:nimporte] va au juge.",
        "un critère sémantique ordinaire.",
      ],
      new Set(["recherche:dossiers", "analyse:priorisation"]),
    )).toEqual([]);
  });

  it("RECHERCHES_AVEC_REQUETE sans terme cité « » est refusée à la compilation — rien à vérifier sinon", () => {
    const problemes = validerReglesDacceptation(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche-a] Les recherches ont été faites."],
      new Set(["recherche-a"]),
    );
    expect(problemes).toHaveLength(1);
    expect(problemes[0]).toContain("« »");
  });

  it("le COMPILATEUR refuse un plan dont une règle cite une étape fantôme — le refus repart au planificateur", () => {
    const catalogue: CapabilityCatalog = {
      has: () => false, allowed: () => true, meta: (n) => capabilityMeta(n), brief: () => [],
    };
    const acteur: MissionActor = { userId: "u1", label: "Testeur", isAgent: false };
    const r = compile({
      objective: "objectif de test",
      acceptance: ["[REGLE:SORTIE_STRUCTUREE:fantome:trouve] La sortie est rendue."],
      complexity: "A", scale: "S",
      steps: [{ key: "vraie-etape", title: "Travailler", nodeType: "WORKER", dependsOn: [], approvalRequirement: "NONE", reasoningRequirement: "LIGHT" }],
      workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
    }, catalogue, acteur);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes("« fantome »"))).toBe(true);
    }
  });
});
