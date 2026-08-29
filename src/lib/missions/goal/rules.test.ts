import { describe, expect, it } from "vitest";
import { partitionnerCriteres, argsSortieStructuree, reparerReglesDacceptation } from "@/lib/missions/goal/rules";
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

});

describe("reparerReglesDacceptation — réparer à candidat UNIQUE, déclasser au doute, ne JAMAIS refuser", () => {
  const contexte = (over: Partial<Parameters<typeof reparerReglesDacceptation>[1]> = {}) => ({
    clesEtapes: new Set(["recherche:dossiers", "analyse:priorisation", "controle:final"]),
    clesAvecRequete: new Set(["recherche:dossiers"]),
    sortiesStructurees: [{ cle: "analyse:priorisation", champs: ["trouve", "synthese"] }],
    ...over,
  });

  it("une règle citant « analyse » quand seule « analyse:priorisation » existe est RÉPARÉE — cible unique", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:SORTIE_STRUCTUREE:analyse:trouve,synthese] La synthèse est rendue."],
      contexte(),
    );
    expect(r.criteres).toEqual(["[REGLE:SORTIE_STRUCTUREE:analyse:priorisation:trouve,synthese] La synthèse est rendue."]);
    expect(r.notes[0]).toContain("réparée");
  });

  it("le cas EXACT du Run 3 : « synthese » absente, mais UNE SEULE étape porte les champs exigés → réparée sur elle", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:SORTIE_STRUCTUREE:synthese:trouve,synthese] La synthèse structurée est rendue."],
      contexte({ clesEtapes: new Set(["rechercher", "rediger", "controler"]),
        sortiesStructurees: [{ cle: "rediger", champs: ["trouve", "synthese", "sources"] }] }),
    );
    expect(r.criteres).toEqual(["[REGLE:SORTIE_STRUCTUREE:rediger:trouve,synthese] La synthèse structurée est rendue."]);
  });

  it("cible AMBIGUË (deux étapes plausibles) → DÉCLASSÉE en sémantique, jamais devinée", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:SORTIE_STRUCTUREE:analyse:trouve] La synthèse est rendue."],
      contexte({
        clesEtapes: new Set(["analyse:marche", "analyse:reglementaire"]),
        sortiesStructurees: [
          { cle: "analyse:marche", champs: ["trouve"] },
          { cle: "analyse:reglementaire", champs: ["trouve"] },
        ],
      }),
    );
    expect(r.criteres).toEqual(["La synthèse est rendue."]);
    expect(r.notes[0]).toContain("déclassée");
  });

  it("RECHERCHES : une clé fantôme parmi de vraies est ÉCARTÉE, la règle survit sur les vraies", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers,inventee] Interrogé avec « X »."],
      contexte(),
    );
    expect(r.criteres).toEqual(["[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers] Interrogé avec « X »."]);
    expect(r.notes[0]).toContain("écartée");
  });

  it("RECHERCHES sans terme cité NI requête au plan sur chaque étape → déclassée (le juge lira la phrase)", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:controle:final] Les recherches ont été faites."],
      contexte(),
    );
    expect(r.criteres).toEqual(["Les recherches ont été faites."]);
    expect(r.notes[0]).toContain("sémantique");
  });

  it("RECHERCHES sans terme mais requête PRÉVUE AU PLAN sur chaque étape citée → la règle reste arithmétique", () => {
    const r = reparerReglesDacceptation(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers] Les recherches prévues sont parties."],
      contexte(),
    );
    expect(r.criteres).toEqual(["[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers] Les recherches prévues sont parties."]);
    expect(r.notes).toEqual([]);
  });

  it("références JUSTES, code INCONNU, critère nu : RIEN ne bouge, aucune note", () => {
    const criteres = [
      "[REGLE:SORTIE_STRUCTUREE:analyse:priorisation:trouve,synthese] ok.",
      "[REGLE:RECHERCHES_AVEC_REQUETE:recherche:dossiers] Interrogée avec « X ».",
      "[REGLE:UN_CODE_INVENTE:nimporte] va au juge.",
      "un critère sémantique ordinaire.",
    ];
    const r = reparerReglesDacceptation(criteres, contexte());
    expect(r.criteres).toEqual(criteres);
    expect(r.notes).toEqual([]);
  });
});

describe("le COMPILATEUR ne meurt plus d'une faute de FORME du modèle — les deux échecs de lancement du Run 3", () => {
  const catalogue: CapabilityCatalog = {
    has: (n) => n === "search_everything", allowed: () => true,
    meta: (n) => ({ ...capabilityMeta(n), effect: "READ" }), brief: () => [],
  };
  const acteur: MissionActor = { userId: "u1", label: "Testeur", isAgent: false };

  it("clé « recherche:federée » (accent) : ASSAINIE, références réécrites, mission CRÉÉE — plus jamais un refus", () => {
    const r = compile({
      objective: "objectif de test",
      acceptance: ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche:federée] Interrogé avec « Zorbamyxine »."],
      complexity: "A", scale: "S",
      steps: [
        { key: "recherche:federée", title: "Recherche fédérée", nodeType: "CAPABILITY",
          capability: "search_everything", input: { query: "Zorbamyxine" }, dependsOn: [] },
        { key: "synthese", title: "Synthèse", nodeType: "WORKER", dependsOn: ["recherche:federée"],
          reasoningRequirement: "LIGHT" },
      ],
      workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
    }, catalogue, acteur);
    expect(r.ok, r.ok ? "" : JSON.stringify((r as { issues: unknown }).issues)).toBe(true);
    if (!r.ok) return;
    const cles = r.mission.steps.map((s) => s.key);
    expect(cles).toContain("recherche:federee");
    expect(r.mission.steps.find((s) => s.key === "synthese")?.dependsOn).toEqual(["recherche:federee"]);
    expect(r.mission.acceptance[0]).toContain("recherche:federee");
    expect(r.warnings.some((w) => w.message.includes("assainie"))).toBe(true);
  });

  it("règle citant une étape FANTÔME : la mission est CRÉÉE, la règle réparée ou déclassée — dit en warning", () => {
    const r = compile({
      objective: "objectif de test",
      acceptance: ["[REGLE:SORTIE_STRUCTUREE:fantome:trouve] La sortie est rendue."],
      complexity: "A", scale: "S",
      steps: [{ key: "vraie-etape", title: "Travailler", nodeType: "WORKER", dependsOn: [],
        approvalRequirement: "NONE", reasoningRequirement: "LIGHT",
        expectedOutputSchema: { type: "object", properties: { trouve: { type: "boolean" } } } }],
      workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
    }, catalogue, acteur);
    expect(r.ok, r.ok ? "" : JSON.stringify((r as { issues: unknown }).issues)).toBe(true);
    if (!r.ok) return;
    // UNE SEULE étape du plan peut porter le champ exigé : la règle est réparée sur elle.
    expect(r.mission.acceptance[0]).toContain("vraie-etape");
    expect(r.warnings.some((w) => w.message.includes("réparée"))).toBe(true);
  });

  it("SABOTAGE inverse — deux clés IDENTIQUES restent un refus DUPLICATE_KEY : l'assainissement ne blanchit pas une vraie faute", () => {
    const r = compile({
      objective: "objectif de test",
      acceptance: ["critère sémantique."],
      complexity: "A", scale: "S",
      steps: [
        { key: "étape dupliquée", title: "A", nodeType: "WORKER", dependsOn: [], reasoningRequirement: "LIGHT" },
        { key: "étape dupliquée", title: "B", nodeType: "WORKER", dependsOn: [], reasoningRequirement: "LIGHT" },
      ],
      workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
    }, catalogue, acteur);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === "DUPLICATE_KEY")).toBe(true);
  });

  it("deux clés DISTINCTES qui se normalisent pareil se suffixent — aucune étape n'est perdue", () => {
    const r = compile({
      objective: "objectif de test",
      acceptance: ["critère sémantique."],
      complexity: "A", scale: "S",
      steps: [
        { key: "recherche federée", title: "A", nodeType: "WORKER", dependsOn: [], reasoningRequirement: "LIGHT" },
        { key: "recherche fédérée", title: "B", nodeType: "WORKER", dependsOn: [], reasoningRequirement: "LIGHT" },
      ],
      workstreams: [], expectedArtifacts: [], approvalStrategy: "BUNDLE", gaps: [],
    }, catalogue, acteur);
    expect(r.ok, r.ok ? "" : JSON.stringify((r as { issues: unknown }).issues)).toBe(true);
    if (!r.ok) return;
    const cles = r.mission.steps.map((s) => s.key).sort();
    expect(cles).toHaveLength(2);
    expect(new Set(cles).size).toBe(2);
    expect(cles[0]).toBe("recherche-federee");
  });
});

describe("RECHERCHES_AVEC_REQUETE v2 — « exécuté = prévu », le Run 3 ne se reproduit pas", () => {
  it("comparaison A/B : la branche B cherche B — PASS, parce que la référence est la requête PRÉVUE, pas le terme cité", () => {
    const steps = [
      etape({ key: "branche-a", input: { query: "Zorbamyxine" }, recu: recu({ query: "recherche « Zorbamyxine »" }) }),
      etape({ key: "branche-b", input: { query: "Cortexal" }, recu: recu({ query: "recherche « Cortexal »" }) }),
    ];
    const p = partitionnerCriteres(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:branche-a,branche-b] Les deux produits comparés, dont « Zorbamyxine »."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("PASS");
  });

  it("SABOTAGE — le reçu ne porte PAS la requête prévue au plan : FAIL, même si le terme cité y est", () => {
    const steps = [
      etape({ key: "recherche-a", input: { query: "contrat Beker" }, recu: recu({ query: "recherche « Zorbamyxine-K7 »" }) }),
    ];
    const p = partitionnerCriteres(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:recherche-a] Interrogée avec « Zorbamyxine-K7 »."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("FAIL");
    expect(p.regles[0].preuve).toContain("contrat Beker");
  });

  it("un ÉVENTAIL déployé se prouve sur ses FILLES : chacune porte sa requête résolue", () => {
    const steps = [
      etape({ key: "lire", recu: null, result: { expanded: 2, keys: ["lire#a", "lire#b"], source: "cibler.items" } }),
      etape({ key: "lire#a", input: { query: "Produit A" }, recu: recu({ query: "recherche « Produit A »" }) }),
      etape({ key: "lire#b", input: { query: "Produit B" }, recu: recu({ query: "recherche « Produit B »" }) }),
    ];
    const p = partitionnerCriteres(
      ["[REGLE:RECHERCHES_AVEC_REQUETE:lire] Chaque produit du dossier recherché."],
      steps,
    );
    expect(p.regles[0].verdict).toBe("PASS");
  });

  it("AUCUNE_ECRITURE reconnaît le parent d'éventail ({expanded}) et l'étape DÉDUPLIQUÉE — plus de faux « sans reçu »", () => {
    const p = partitionnerCriteres(
      ["[REGLE:AUCUNE_ECRITURE] Rien n'a été écrit."],
      [
        etape({ key: "eventail", recu: null, result: { expanded: 3, keys: ["e#1", "e#2", "e#3"] } }),
        etape({ key: "doublon", recu: null, result: { deduplique: true } }),
        etape({ key: "reelle", recu: recu() }),
      ],
    );
    expect(p.regles[0].verdict).toBe("PASS");
  });
});
