import { describe, expect, it } from "vitest";
import { empreinteEtape, nonCouvertes, perimetre } from "./scope";
import { compile, type CompiledMission } from "@/lib/missions/compiler/compile";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";

const pdg: MissionActor = { userId: "u1", label: "le PDG", isAgent: false };

const CONNUES = [
  "directory_list", "employee_360", "inspect_record", "gmail_prepare_mail",
  "send_email", "send_message", "create_admin_request",
];
const catalogue: CapabilityCatalog = {
  has: (n) => CONNUES.includes(n),
  allowed: () => true,
  meta: (n) => capabilityMeta(n),
  brief: () => [],
};

function compiler(steps: PlannedStep[], objectif = "objectif"): CompiledMission {
  const plan: MissionPlan = {
    objective: objectif, acceptance: ["fait"], complexity: "B", scale: "M", steps,
  };
  const r = compile(plan, catalogue, pdg);
  if (!r.ok) throw new Error(r.issues.map((i) => `${i.code} ${i.message}`).join(" | "));
  return r.mission;
}

describe("§32 — un seul accord pour toute une mission", () => {
  it("une mission de pure lecture n'a AUCUN périmètre à approuver", () => {
    expect(perimetre(compiler([
      { key: "a", title: "A", capability: "directory_list" },
      { key: "b", title: "B", capability: "employee_360" },
    ]))).toBeNull();
  });

  it("seules les étapes qui en ont besoin entrent dans le périmètre", () => {
    const p = perimetre(compiler([
      { key: "l1", title: "L1", capability: "directory_list" },
      { key: "l2", title: "L2", capability: "employee_360" },
      { key: "l3", title: "L3", capability: "inspect_record" },
      { key: "envoi", title: "Envoi", capability: "send_email", input: { to: "a@x.dz" } },
    ]))!;
    // Trois lectures et un envoi : on ne fait approuver QUE l'envoi. Gonfler le périmètre avec
    // les lectures ne protégerait rien et rendrait le résumé illisible.
    expect(p.stepKeys).toEqual(["envoi"]);
    expect(p.niveau).toBe("SENSITIVE");
    expect(p.resume).toMatch(/1 étape\(s\) à autoriser/);
  });

  it("un éventail de 33 envois ne demande QU'UN accord (« ne me demande pas 99 confirmations »)", () => {
    const p = perimetre(compiler([
      { key: "liste", title: "Lister", capability: "directory_list" },
      {
        key: "voeux", title: "Vœux", capability: "send_message",
        forEach: { from: "liste", path: "employes", as: "e" }, input: { to: "{{e.id}}" },
      },
    ]))!;
    expect(p.stepKeys).toEqual(["voeux"]);
    // Le résumé DIT que le nombre exact n'est pas connu — le taire laisserait croire à un envoi.
    expect(p.resume).toMatch(/déployée\(s\) sur une liste/);
  });

  it("le niveau vient de la PIRE étape, pas de la plus courante", () => {
    const steps: PlannedStep[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        key: `m${i}`, title: `M${i}`, capability: "send_message", input: { to: `p${i}` },
      })),
      { key: "mail", title: "Mail", capability: "send_email", input: { to: "x@y.dz" } },
    ];
    // Vingt écritures internes et un seul envoi externe : c'est une mission d'envoi externe.
    expect(perimetre(compiler(steps))!.niveau).toBe("SENSITIVE");
  });

  it("l'échantillon montre au plus cinq étapes — inspecter sans tout dérouler", () => {
    const steps: PlannedStep[] = Array.from({ length: 12 }, (_, i) => ({
      key: `m${i}`, title: `M${i}`, capability: "send_message", input: { to: `p${i}` },
    }));
    const p = perimetre(compiler(steps))!;
    expect(p.stepKeys).toHaveLength(12);
    expect(p.echantillon).toHaveLength(5);
    expect(p.echantillon[0].apercu.to).toBe("p0");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §33 — L'EMPREINTE : ce qui empêche l'accord unique de devenir un chèque en blanc.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("§33 — l'empreinte du périmètre", () => {
  const base: PlannedStep[] = [
    { key: "envoi", title: "Envoi", capability: "send_email", input: { to: "alla@x.dz", corps: "Bonjour" } },
  ];

  it("est STABLE : recompiler le même plan donne la même empreinte", () => {
    expect(perimetre(compiler(base))!.scopeHash).toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("ne bouge PAS quand on corrige un titre — sinon on entraîne à approuver sans lire", () => {
    const avec = perimetre(compiler([{ ...base[0], title: "Envoi des vœux (corrigé)" }]))!;
    expect(avec.scopeHash).toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("ne bouge PAS quand l'ordre des clés de l'entrée change", () => {
    const inverse: PlannedStep[] = [
      { key: "envoi", title: "Envoi", capability: "send_email", input: { corps: "Bonjour", to: "alla@x.dz" } },
    ];
    expect(perimetre(compiler(inverse))!.scopeHash).toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("ne bouge PAS quand l'ordre des ÉTAPES change", () => {
    const a: PlannedStep[] = [
      { key: "e1", title: "E1", capability: "send_message", input: { to: "p1" } },
      { key: "e2", title: "E2", capability: "send_message", input: { to: "p2" } },
    ];
    expect(perimetre(compiler([a[1], a[0]]))!.scopeHash).toBe(perimetre(compiler(a))!.scopeHash);
  });

  it("ne bouge pas quand un champ matériel IMBRIQUÉ est reconstruit dans un autre ordre", () => {
    // Le tri des clés dans la sérialisation ne sert pas au premier niveau — la projection le
    // fixe déjà — mais aux VALEURS structurées : un montant en { valeur, devise } reconstruit
    // dans l'autre sens redemanderait un accord sans qu'aucune conséquence ait changé.
    const a = compiler([{
      key: "p", title: "P", capability: "send_message",
      input: { to: "compta", montant: { valeur: 100000, devise: "DZD", ligne: { tva: 19, ht: 84034 } } },
    }]);
    const b = compiler([{
      key: "p", title: "P", capability: "send_message",
      input: { to: "compta", montant: { ligne: { ht: 84034, tva: 19 }, devise: "DZD", valeur: 100000 } },
    }]);
    expect(perimetre(a)!.scopeHash).toBe(perimetre(b)!.scopeHash);
  });

  it("BOUGE quand le destinataire change — c'est une autre conséquence", () => {
    const autre = [{ ...base[0], input: { to: "khaled@x.dz", corps: "Bonjour" } }];
    expect(perimetre(compiler(autre))!.scopeHash).not.toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("BOUGE quand le CORPS change — « une prime » et « un gel des salaires » ne sont pas la même mission", () => {
    const autre = [{ ...base[0], input: { to: "alla@x.dz", corps: "Gel des salaires" } }];
    expect(perimetre(compiler(autre))!.scopeHash).not.toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("BOUGE quand un montant change", () => {
    const a = perimetre(compiler([
      { key: "p", title: "P", capability: "send_message", input: { to: "compta", montant: 100000 } },
    ]))!;
    const b = perimetre(compiler([
      { key: "p", title: "P", capability: "send_message", input: { to: "compta", montant: 900000 } },
    ]))!;
    expect(a.scopeHash).not.toBe(b.scopeHash);
  });

  it("BOUGE quand une action externe est AJOUTÉE", () => {
    const plus = [...base, { key: "b", title: "B", capability: "send_message", input: { to: "x" } }];
    expect(perimetre(compiler(plus))!.scopeHash).not.toBe(perimetre(compiler(base))!.scopeHash);
  });

  it("BOUGE quand la source d'un éventail change : ce n'est plus la même liste de gens", () => {
    const a = compiler([
      { key: "l", title: "L", capability: "directory_list" },
      { key: "m", title: "M", capability: "send_message", forEach: { from: "l", path: "employes", as: "e" }, input: { to: "{{e.id}}" } },
    ]);
    const b = compiler([
      { key: "l", title: "L", capability: "directory_list" },
      { key: "m", title: "M", capability: "send_message", forEach: { from: "l", path: "prestataires", as: "e" }, input: { to: "{{e.id}}" } },
    ]);
    expect(perimetre(a)!.scopeHash).not.toBe(perimetre(b)!.scopeHash);
  });

  it("BOUGE quand l'objectif change, à plan identique", () => {
    expect(perimetre(compiler(base, "envoyer les vœux"))!.scopeHash)
      .not.toBe(perimetre(compiler(base, "annoncer un licenciement"))!.scopeHash);
  });
});

describe("§33 — un changement ne réouvre QUE la partie modifiée", () => {
  const initial: PlannedStep[] = [
    { key: "e1", title: "E1", capability: "send_message", input: { to: "p1" } },
    { key: "e2", title: "E2", capability: "send_message", input: { to: "p2" } },
  ];

  it("un accord qui couvre le périmètre exact ne laisse rien à redemander", () => {
    const m = compiler(initial);
    const p = perimetre(m)!;
    expect(nonCouvertes(m, { scopeHash: p.scopeHash, stepKeys: p.stepKeys })).toEqual([]);
  });

  it("une étape AJOUTÉE est la seule à redemander son accord", () => {
    const p0 = perimetre(compiler(initial))!;
    const augmente = compiler([...initial, { key: "e3", title: "E3", capability: "send_message", input: { to: "p3" } }]);
    expect(nonCouvertes(augmente, { scopeHash: p0.scopeHash, stepKeys: p0.stepKeys })).toEqual(["e3"]);
  });

  it("supprimer une étape ne redemande RIEN : on ne fait pas approuver ce qu'on ne fera plus", () => {
    const p0 = perimetre(compiler(initial))!;
    const reduit = compiler([initial[0]]);
    expect(nonCouvertes(reduit, { scopeHash: p0.scopeHash, stepKeys: p0.stepKeys })).toEqual([]);
  });

  it("une empreinte inconnue ne rouvre pas TOUT — seules les étapes non nommées reviennent", () => {
    const m = compiler(initial);
    // Un accord ancien qui nommait `e1` seule : `e2` seule redemande.
    expect(nonCouvertes(m, { scopeHash: "empreinte-perimee", stepKeys: ["e1"] })).toEqual(["e2"]);
  });

  it("une mission sans périmètre n'a jamais rien à redemander", () => {
    const lecture = compiler([{ key: "a", title: "A", capability: "directory_list" }]);
    expect(nonCouvertes(lecture, { scopeHash: "x", stepKeys: [] })).toEqual([]);
  });
});

describe("l'empreinte d'une SEULE étape — pour dire laquelle a changé", () => {
  it("distingue deux étapes différentes et reconnaît la même", () => {
    const m = compiler([
      { key: "a", title: "A", capability: "send_message", input: { to: "p1" } },
      { key: "b", title: "B", capability: "send_message", input: { to: "p2" } },
    ]);
    const [a, b] = m.steps;
    expect(empreinteEtape(a)).not.toBe(empreinteEtape(b));
    expect(empreinteEtape(a)).toBe(empreinteEtape(compiler([
      { key: "a", title: "titre tout autre", capability: "send_message", input: { to: "p1" } },
    ]).steps[0]));
  });
});
