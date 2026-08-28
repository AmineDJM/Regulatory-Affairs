import { describe, expect, it } from "vitest";
import { compile } from "./compile";
import { layout, ancetres } from "./graph";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN CATALOGUE DE TEST — et surtout pas le vrai.
 *
 * Le compilateur ne connaît que le port. Le tester avec les cent soixante-cinq outils réels
 * exigerait une base, des droits, des fournisseurs — pour vérifier une question de FORME. Le
 * port existe précisément pour que ce test-là soit possible en trois millisecondes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
function catalogue(interdites: string[] = []): CapabilityCatalog {
  const connues = [
    "directory_list", "employee_360", "read_hr_overview", "gmail_prepare_mail",
    "send_email", "send_message", "create_admin_request", "inspect_record",
  ];
  return {
    has: (n) => connues.includes(n),
    allowed: (n) => !interdites.includes(n),
    meta: (n) => capabilityMeta(n),
    brief: () => connues.map((id) => {
      const m = capabilityMeta(id);
      return { id, domain: m.domain, effect: m.effect, batchable: m.batchable, summary: id };
    }),
  };
}

const pdg: MissionActor = { userId: "u1", label: "le PDG", isAgent: false };

const plan = (steps: PlannedStep[], extra: Partial<MissionPlan> = {}): MissionPlan => ({
  objective: "objectif",
  acceptance: ["chaque salarié a reçu son message"],
  complexity: "B",
  scale: "M",
  steps,
  ...extra,
});

const codes = (r: ReturnType<typeof compile>): string[] =>
  r.ok ? [] : r.issues.map((i) => i.code);

describe("compilateur — ce qu'un plan doit prouver avant de tourner", () => {
  it("compile un plan sain et calcule les vagues", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list" },
      { key: "fiche", title: "Fiches", capability: "employee_360", dependsOn: ["liste"] },
      { key: "rh", title: "RH", capability: "read_hr_overview" },
    ]), catalogue(), pdg);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mission.steps.map((s) => s.wave)).toEqual([0, 1, 0]);
    expect(r.mission.depth).toBe(2);
    expect(r.mission.maxEffect).toBe("READ");
    expect(r.mission.requiresApproval).toBe(false);
    expect(r.mission.capabilities).toEqual(["directory_list", "employee_360", "read_hr_overview"]);
  });

  it("§6 — REFUSE une capacité inventée, en la nommant", () => {
    const r = compile(plan([
      { key: "magie", title: "Magie", capability: "super_magic_send" },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("UNKNOWN_CAPABILITY");
    if (!r.ok) expect(r.issues[0].message).toMatch(/super_magic_send/);
  });

  it("§48 — REFUSE une capacité que l'acteur n'a pas le droit d'appeler", () => {
    const r = compile(plan([
      { key: "rh", title: "RH", capability: "read_hr_overview" },
    ]), catalogue(["read_hr_overview"]), pdg);
    expect(codes(r)).toEqual(["FORBIDDEN_CAPABILITY"]);
    if (!r.ok) expect(r.issues[0].message).toMatch(/le PDG/);
  });

  it("une mission n'est pas une porte dérobée : le refus tient même pour l'agent système", () => {
    const adam: MissionActor = { userId: "adam", label: "Adam", isAgent: true };
    const r = compile(plan([
      { key: "rh", title: "RH", capability: "read_hr_overview" },
    ]), catalogue(["read_hr_overview"]), adam);
    expect(codes(r)).toEqual(["FORBIDDEN_CAPABILITY"]);
  });

  it("refuse deux étapes de même clé", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list" },
      { key: "a", title: "A bis", capability: "read_hr_overview" },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("DUPLICATE_KEY");
  });

  it("refuse une dépendance vers une étape inexistante", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list", dependsOn: ["fantome"] },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("UNKNOWN_DEPENDENCY");
  });

  it("refuse un cycle, et dit lesquelles sont prises dedans", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list", dependsOn: ["b"] },
      { key: "b", title: "B", capability: "read_hr_overview", dependsOn: ["a"] },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CYCLE");
    if (!r.ok) expect(r.issues.find((i) => i.code === "CYCLE")!.message).toMatch(/a → b|b → a/);
  });

  it("§20 — refuse un plan sans critère d'acceptation", () => {
    const r = compile(plan([{ key: "a", title: "A", capability: "directory_list" }], { acceptance: [] }), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });

  it("refuse un plan vide", () => {
    expect(compile(plan([]), catalogue(), pdg).ok).toBe(false);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §26 — LA CARDINALITÉ. Le refus dont la conséquence est publique et irréversible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("compilateur — cardinalité (§26)", () => {
  it("REFUSE trente-trois destinataires dans une seule étape d'envoi", () => {
    const r = compile(plan([
      {
        key: "voeux", title: "Vœux", capability: "send_email",
        input: { to: Array.from({ length: 33 }, (_, i) => `p${i}@adventum.dz`) },
      },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CARDINALITY");
    if (!r.ok) expect(r.issues[0].message).toMatch(/33 destinataires/);
  });

  it("REFUSE aussi la liste déguisée en chaîne « a@x, b@x »", () => {
    const r = compile(plan([
      { key: "voeux", title: "Vœux", capability: "send_email", input: { to: "a@x.dz, b@x.dz" } },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CARDINALITY");
  });

  it("REFUSE une copie carbone même quand le destinataire principal est unique", () => {
    const r = compile(plan([
      {
        key: "voeux", title: "Vœux", capability: "send_email",
        input: { to: "a@x.dz", cc: ["b@x.dz", "c@x.dz"] },
      },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CARDINALITY");
  });

  it("ACCEPTE le même envoi déployé en éventail : un message par personne", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list" },
      {
        key: "voeux", title: "Vœux", capability: "send_email",
        forEach: { from: "liste", path: "employes", as: "employe" },
        input: { to: "{{employe.email}}" },
      },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
  });

  it("REFUSE un éventail qui porte QUAND MÊME une liste : chaque itération écrirait à tous", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list" },
      {
        key: "voeux", title: "Vœux", capability: "send_email",
        forEach: { from: "liste", path: "employes", as: "employe" },
        input: { to: ["a@x.dz", "b@x.dz"] },
      },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CARDINALITY");
  });

  it("ne dit rien d'une LECTURE à plusieurs identifiants : lire n'a pas de cardinalité publique", () => {
    const r = compile(plan([
      { key: "fiches", title: "Fiches", capability: "employee_360", input: { employeeIds: ["a", "b", "c"] } },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
  });

  it("laisse passer un envoi à UN seul destinataire", () => {
    const r = compile(plan([
      { key: "un", title: "Un", capability: "send_email", input: { to: "alla@adventum.dz" } },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
  });
});

describe("compilateur — éventail (§10)", () => {
  it("ajoute la dépendance implicite vers la source de l'éventail", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list" },
      {
        key: "msg", title: "Messages", capability: "send_message",
        forEach: { from: "liste", path: "employes", as: "e" },
      },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mission.steps[1].dependsOn).toEqual(["liste"]);
    expect(r.mission.steps[1].wave).toBe(1);
  });

  it("refuse un éventail dont la source n'existe pas", () => {
    const r = compile(plan([
      { key: "msg", title: "M", capability: "send_message", forEach: { from: "nulle-part", path: "x", as: "e" } },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("UNKNOWN_FANOUT_SOURCE");
  });

  it("une source d'éventail située EN AVAL ferme un cycle — et c'est le bon diagnostic", () => {
    // `msg` prétend lire la sortie de `apres`, qui dépend de `msg`. La dépendance implicite rend
    // l'impossibilité visible sous sa vraie forme : un cycle, pas une source manquante.
    const r = compile(plan([
      { key: "msg", title: "M", capability: "send_message", forEach: { from: "apres", path: "x", as: "e" } },
      { key: "apres", title: "A", capability: "directory_list", dependsOn: ["msg"] },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("CYCLE");
  });

  it("refuse un éventail sur une capacité non répétable", () => {
    const r = compile(plan([
      { key: "l", title: "L", capability: "directory_list" },
      // `read_hr_overview` est déclarée `batchable: false` : la vue d'ensemble RH n'a pas de sens
      // répétée par salarié.
      { key: "x", title: "X", capability: "read_hr_overview", forEach: { from: "l", path: "p", as: "e" } },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("NOT_BATCHABLE");
  });
});

describe("compilateur — forme des nœuds", () => {
  it("une attente d'événement doit dire QUEL événement", () => {
    const r = compile(plan([{ key: "w", title: "W", nodeType: "WAIT_EVENT" }]), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });

  it("une attente humaine doit dire ce qu'on demande", () => {
    const r = compile(plan([
      { key: "w", title: "W", nodeType: "WAIT_INPUT", waitFor: { withinDays: 3 } },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });

  it("accepte une attente correctement décrite", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list" },
      {
        key: "w", title: "Réponse de Redouane", nodeType: "WAIT_EVENT", dependsOn: ["a"],
        waitFor: { event: "EMAIL_RECEIVED", from: "redouane", withinDays: 5 },
      },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
  });

  it("un nœud qui n'appelle pas de capacité ne peut pas en nommer une", () => {
    const r = compile(plan([
      { key: "q", title: "Q", nodeType: "QA", capability: "directory_list" },
    ]), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });

  it("un nœud CAPABILITY sans capacité est refusé", () => {
    const r = compile(plan([{ key: "c", title: "C", nodeType: "CAPABILITY" }]), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });

  it("le type se déduit : avec capacité ⇒ CAPABILITY, sans ⇒ WORKER", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list" },
      { key: "b", title: "Rédiger", dependsOn: ["a"] },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mission.steps.map((s) => s.nodeType)).toEqual(["CAPABILITY", "WORKER"]);
    expect(r.mission.steps[1].modelRole).toBe("standard");
  });

  it("refuse une clé illisible", () => {
    const r = compile(plan([{ key: "clé avec espaces !", title: "X", capability: "directory_list" }]), catalogue(), pdg);
    expect(codes(r)).toContain("INVALID_SHAPE");
  });
});

describe("compilateur — effets, idempotence, approbation", () => {
  it("une mission de lecture pure n'exige aucune approbation", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list" },
      { key: "b", title: "B", capability: "inspect_record" },
    ]), catalogue(), pdg);
    expect(r.ok && r.mission.requiresApproval).toBe(false);
    expect(r.ok && r.mission.maxEffect).toBe("READ");
  });

  it("un envoi externe exige une approbation et une clé d'idempotence", () => {
    const r = compile(plan([
      { key: "m", title: "M", capability: "send_email", input: { to: "a@x.dz" } },
    ]), catalogue(), pdg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mission.requiresApproval).toBe(true);
    expect(r.mission.maxEffect).toBe("EXTERNAL_COMMUNICATION");
    expect(r.mission.steps[0].needsIdempotencyKey).toBe(true);
  });

  it("une lecture ne réclame jamais de clé d'idempotence : la relire est sans effet", () => {
    const r = compile(plan([{ key: "a", title: "A", capability: "directory_list" }]), catalogue(), pdg);
    expect(r.ok && r.mission.steps[0].needsIdempotencyKey).toBe(false);
  });

  it("l'effet maximal est celui de la pire étape, pas la moyenne", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list" },
      { key: "b", title: "B", capability: "send_message", dependsOn: ["a"], input: { to: "x" } },
      { key: "c", title: "C", capability: "send_email", dependsOn: ["a"], input: { to: "x@y.dz" } },
    ]), catalogue(), pdg);
    expect(r.ok && r.mission.maxEffect).toBe("EXTERNAL_COMMUNICATION");
  });

  it("le nombre de tentatives est borné, sans être imposé", () => {
    const r = compile(plan([
      { key: "a", title: "A", capability: "directory_list", maxAttempts: 999 },
      { key: "b", title: "B", capability: "inspect_record", maxAttempts: 0 },
    ]), catalogue(), pdg);
    expect(r.ok && r.mission.steps.map((s) => s.maxAttempts)).toEqual([10, 1]);
  });
});

describe("compilateur — limites opérationnelles (§4)", () => {
  it("refuse plus de 200 étapes écrites à la main, en expliquant l'alternative", () => {
    const steps: PlannedStep[] = Array.from({ length: 201 }, (_, i) => ({
      key: `s${i}`, title: `S${i}`, capability: "directory_list",
    }));
    const r = compile(plan(steps), catalogue(), pdg);
    expect(codes(r)).toContain("LIMIT_EXCEEDED");
    if (!r.ok) expect(r.issues[0].message).toMatch(/sous-missions/);
  });

  it("ACCEPTE 200 étapes : la limite est opérationnelle, pas architecturale", () => {
    const steps: PlannedStep[] = Array.from({ length: 200 }, (_, i) => ({
      key: `s${i}`, title: `S${i}`, capability: "directory_list",
    }));
    const r = compile(plan(steps), catalogue(), pdg);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mission.steps).toHaveLength(200);
  });

  it("refuse une chaîne plus profonde que la limite", () => {
    const steps: PlannedStep[] = Array.from({ length: 65 }, (_, i) => ({
      key: `s${i}`, title: `S${i}`, capability: "directory_list",
      dependsOn: i === 0 ? [] : [`s${i - 1}`],
    }));
    const r = compile(plan(steps), catalogue(), pdg);
    expect(codes(r)).toContain("LIMIT_EXCEEDED");
  });

  it("une étape à plus de 20 dépendances renvoie vers la jonction", () => {
    const steps: PlannedStep[] = Array.from({ length: 21 }, (_, i) => ({
      key: `s${i}`, title: `S${i}`, capability: "directory_list",
    }));
    steps.push({ key: "fin", title: "Fin", nodeType: "JOIN", dependsOn: steps.map((s) => s.key) });
    const r = compile(plan(steps), catalogue(), pdg);
    expect(codes(r)).toContain("LIMIT_EXCEEDED");
    if (!r.ok) expect(r.issues.find((i) => i.code === "LIMIT_EXCEEDED")!.message).toMatch(/JOIN/);
  });
});

describe("compilateur — avertissements sans refus", () => {
  it("une capacité non déclarée passe, mais l'avertissement dit qu'elle est traitée au plus prudent", () => {
    const cat: CapabilityCatalog = {
      ...catalogue(),
      has: (n) => n === "quelque_chose_de_neuf" || catalogue().has(n),
    };
    const r = compile(plan([
      { key: "x", title: "X", capability: "quelque_chose_de_neuf" },
    ]), cat, pdg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toMatch(/prudent/);
    // Le défaut prudent a bien mordu : effet externe, donc approbation.
    expect(r.mission.requiresApproval).toBe(true);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE GRAPHE, testé à part — parce que le moteur s'en servira aussi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("graphe", () => {
  it("met en vague 0 tout ce qui ne dépend de rien, et parallélise", () => {
    const g = layout([
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: [] },
      { key: "c", dependsOn: ["a", "b"] },
    ]);
    expect(g.wave.get("a")).toBe(0);
    expect(g.wave.get("b")).toBe(0);
    expect(g.wave.get("c")).toBe(1);
    expect(g.depth).toBe(2);
    expect(g.cycle).toEqual([]);
  });

  it("la vague est celle de la dépendance la PLUS TARDIVE, pas la première", () => {
    const g = layout([
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: ["b"] },
      { key: "d", dependsOn: ["a", "c"] },
    ]);
    expect(g.wave.get("d")).toBe(3);
  });

  it("détecte un cycle et rend un ordre VIDE plutôt qu'un ordre partiel trompeur", () => {
    const g = layout([
      { key: "a", dependsOn: ["c"] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: ["b"] },
      { key: "libre", dependsOn: [] },
    ]);
    expect(g.cycle).toEqual(["a", "b", "c"]);
    expect(g.order).toEqual([]);
  });

  it("une étape qui dépend d'elle-même est un cycle", () => {
    expect(layout([{ key: "a", dependsOn: ["a"] }]).cycle).toEqual(["a"]);
  });

  it("rapporte les dépendances inexistantes sans planter", () => {
    const g = layout([{ key: "a", dependsOn: ["absent"] }]);
    expect(g.missing).toEqual([{ key: "a", dependsOn: "absent" }]);
    expect(g.wave.get("a")).toBe(0);
  });

  it("un graphe vide a une profondeur nulle", () => {
    expect(layout([]).depth).toBe(0);
  });

  it("les ancêtres sont transitifs", () => {
    const n = [
      { key: "a", dependsOn: [] },
      { key: "b", dependsOn: ["a"] },
      { key: "c", dependsOn: ["b"] },
    ];
    expect([...ancetres(n, "c")].sort()).toEqual(["a", "b"]);
    expect([...ancetres(n, "a")]).toEqual([]);
  });
});
