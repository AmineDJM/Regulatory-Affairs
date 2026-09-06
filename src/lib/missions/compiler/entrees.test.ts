import { describe, expect, it } from "vitest";
import { compile } from "./compile";
import type { CapabilityCatalog, ContratEntree, MissionActor } from "@/lib/missions/ports";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import { contratDepuisSchema } from "@/lib/missions/registry/input-contract";

/**
 * LE CONTRAT D'ENTRÉE ET LA TUYAUTERIE, VUS DU COMPILATEUR.
 *
 * Chaque cas est un défaut MESURÉ sur le banc de missions inédites (run m5) : la clé `message`
 * pour une capacité qui lit `body`, `paymentReference` pour `reference`, une échéance d'attente
 * écrite comme une référence vers une date lue, une question de confort au dirigeant en fin de
 * mission. Aucun n'est inventé ; tous étaient acceptés puis échouaient à l'exécution.
 */
const SCHEMAS: Record<string, unknown> = {
  send_message: {
    type: "object",
    properties: { recipientName: { type: "string" }, body: { type: "string" } },
    required: ["recipientName", "body"],
  },
  decide_payment: {
    type: "object",
    properties: {
      reference: { type: "string" }, decision: { type: "string", enum: ["APPROVE", "REFUSE", "REQUEST_CHANGES", "REQUEST_INFO"] },
      note: { type: "string" }, proposedAmount: { type: "number" },
    },
    required: ["reference", "decision"],
  },
  inspect_record: { type: "object", properties: { reference: { type: "string" } }, required: ["reference"] },
  directory_list: { type: "object", properties: { department: { type: "string" }, limit: { type: "number" } } },
};

const CONNUES = ["send_message", "decide_payment", "inspect_record", "directory_list", "employee_360", "read_hr_overview"];

const catalogue: CapabilityCatalog = {
  has: (n) => CONNUES.includes(n),
  allowed: () => true,
  meta: (n) => capabilityMeta(n),
  brief: () => [],
  entrees: (n): ContratEntree | null => contratDepuisSchema(SCHEMAS[n]),
};

const pdg: MissionActor = { userId: "u1", label: "Yacine Benali", isAgent: false };

const plan = (steps: PlannedStep[], extra: Partial<MissionPlan> = {}): MissionPlan => ({
  objective: "objectif", acceptance: ["le travail est fait"], complexity: "B", scale: "S", steps, ...extra,
});

const messages = (r: ReturnType<typeof compile>): string[] =>
  r.ok ? r.warnings.map((w) => `${w.code} ${w.stepKey ?? ""} ${w.message}`) : r.issues.map((i) => `${i.code} ${i.stepKey ?? ""} ${i.message}`);

describe("le contrat d'entrée, refusé à la compilation", () => {
  it("une clé que la capacité ne lit pas est refusée, et le message nomme les clés admises", () => {
    const r = compile(plan([
      { key: "demande", title: "Demander", capability: "send_message", input: { to: "Raihana Cherif", message: "Bonjour" } },
    ]), catalogue, pdg);
    expect(r.ok).toBe(false);
    const m = messages(r);
    expect(m.some((x) => x.startsWith("INVALID_INPUT demande") && x.includes("« to »") && x.includes("« message »"))).toBe(true);
    expect(m.some((x) => x.includes("recipientName* (texte), body* (texte)"))).toBe(true);
    expect(m.some((x) => x.includes("exige « recipientName », « body »"))).toBe(true);
  });

  it("une obligatoire manquante est refusée ; une référence {{…}} compte comme présente", () => {
    const refus = compile(plan([
      { key: "lecture", title: "Lire", capability: "inspect_record", input: {} },
    ]), catalogue, pdg);
    expect(refus.ok).toBe(false);
    expect(messages(refus).some((x) => x.includes("INVALID_INPUT lecture") && x.includes("exige « reference »"))).toBe(true);

    const ok = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{liste.salaries.0.reference}}" } },
    ]), catalogue, pdg);
    expect(ok.ok, messages(ok).join(" | ")).toBe(true);
  });

  it("une faute de FORME se répare en code et se dit : « approve » devient APPROVE, « 50 » devient 50", () => {
    const r = compile(plan([
      { key: "decision", title: "Trancher", capability: "decide_payment", input: { reference: "PAY-1", decision: "approve", proposedAmount: "12 500" } },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
    if (!r.ok) return;
    const etape = r.mission.steps.find((s) => s.key === "decision")!;
    expect(etape.input).toMatchObject({ decision: "APPROVE", proposedAmount: 12500 });
    expect(r.warnings.filter((w) => w.stepKey === "decision" && /forme corrigée/.test(w.message))).toHaveLength(2);
  });

  it("une valeur hors énumération n'est pas devinée : refusée avec les valeurs admises", () => {
    const r = compile(plan([
      { key: "decision", title: "Trancher", capability: "decide_payment", input: { reference: "PAY-1", decision: "VALIDER" } },
    ]), catalogue, pdg);
    expect(r.ok).toBe(false);
    expect(messages(r).some((x) => x.includes("INVALID_INPUT decision") && x.includes("APPROVE|REFUSE"))).toBe(true);
  });

  it("un catalogue sans contrat ne vérifie rien — l'ignorance ne fait pas échouer à tort", () => {
    const sansContrat: CapabilityCatalog = { ...catalogue, entrees: () => null };
    const r = compile(plan([
      { key: "demande", title: "Demander", capability: "send_message", input: { to: "Raihana", message: "Bonjour" } },
    ]), sansContrat, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });
});

describe("la tuyauterie {{cle_etape.chemin}}, vue du compilateur", () => {
  it("lire une étape, c'est en dépendre : la dépendance est ajoutée, deux-points et indices compris", () => {
    const r = compile(plan([
      { key: "recherche:contrat", title: "Chercher", capability: "directory_list", input: {} },
      // Le worker DÉCLARE `verdict` : sans cette déclaration il rendrait les trois champs du
      // schéma minimal, et le compilateur refuserait `{{analyse:coherence.verdict}}` — à raison.
      {
        key: "analyse:coherence", title: "Analyser", nodeType: "WORKER", dependsOn: ["recherche:contrat"],
        expectedOutputSchema: {
          type: "object", properties: { verdict: { type: "string" } },
          required: ["verdict"], additionalProperties: false,
        },
      },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{recherche:contrat.salaries.0.reference}} / {{analyse:coherence.verdict}}" } },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
    if (!r.ok) return;
    const lecture = r.mission.steps.find((s) => s.key === "lecture")!;
    expect([...lecture.dependsOn].sort()).toEqual(["analyse:coherence", "recherche:contrat"]);
  });

  it("une référence vers une étape qui n'existe pas est refusée, avec les clés du plan", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "lecture", title: "Lire", capability: "inspect_record", input: { reference: "{{annuaire.salaries.0.reference}}" } },
    ]), catalogue, pdg);
    expect(r.ok).toBe(false);
    expect(messages(r).some((x) => x.includes("INVALID_INPUT lecture") && x.includes("« annuaire »") && x.includes("clés du plan : liste, lecture"))).toBe(true);
  });

  it("l'alias d'un éventail n'est pas une étape : {{salarie.nom}} passe", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      {
        key: "message", title: "Écrire", capability: "send_message",
        forEach: { from: "liste", path: "salaries", as: "salarie" },
        input: { recipientName: "{{salarie.nom}}", body: "Bonjour {{salarie.nom}}, au sujet de {{liste.total}} personnes" },
      },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("une échéance d'attente peut être une référence vers une date lue ; l'attente dépend alors de cette étape", () => {
    const r = compile(plan([
      {
        key: "analyse:renouvellement", title: "Analyser", nodeType: "WORKER",
        expectedOutputSchema: {
          type: "object", properties: { dateEcheance: { type: "string" } },
          required: ["dateEcheance"], additionalProperties: false,
        },
      },
      { key: "attente:renouvellement", title: "Attendre l'échéance", nodeType: "WAIT_EVENT", waitFor: { until: "{{analyse:renouvellement.dateEcheance}}" } },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
    if (!r.ok) return;
    expect(r.mission.steps.find((s) => s.key === "attente:renouvellement")!.dependsOn).toEqual(["analyse:renouvellement"]);

    const illisible = compile(plan([
      { key: "attente", title: "Attendre", nodeType: "WAIT_EVENT", waitFor: { until: "fin novembre" } },
    ]), catalogue, pdg);
    expect(illisible.ok).toBe(false);
    expect(messages(illisible).some((x) => x.includes("ISO 8601"))).toBe(true);
  });
});

describe("la question de confort au demandeur", () => {
  const base: PlannedStep[] = [
    { key: "lecture", title: "Lire", capability: "read_hr_overview", input: {} },
    { key: "note", title: "Note de position", nodeType: "WORKER", dependsOn: ["lecture"] },
  ];

  it("une attente humaine adressée au demandeur dont rien ne dépend est refusée — livrer et conclure", () => {
    for (const from of [undefined, "Yacine Benali", "yacine benali", "le dirigeant", "moi", "PDG"]) {
      const r = compile(plan([
        ...base,
        { key: "validation", title: "Validez-vous l'orientation ?", nodeType: "WAIT_INPUT", dependsOn: ["note"], waitFor: { ask: "Validez-vous l'orientation ?", ...(from ? { from } : {}) } },
      ]), catalogue, pdg);
      expect(r.ok, `from=${from}`).toBe(false);
      expect(messages(r).some((x) => x.includes("INVALID_SHAPE validation") && x.includes("validation de confort")), `from=${from}`).toBe(true);
    }
  });

  it("une question posée après des ACTIONS (pas une synthèse) reste une attente : « j'ai écrit à tous ; quelle est la référence ? »", () => {
    const r = compile(plan([
      { key: "liste", title: "Lister", capability: "directory_list", input: {} },
      { key: "message", title: "Écrire", capability: "send_message", forEach: { from: "liste", path: "salaries", as: "s" }, input: { recipientName: "{{s.nom}}", body: "Bonjour" } },
      { key: "piece", title: "La référence du marché", nodeType: "WAIT_INPUT", dependsOn: ["message"], waitFor: { ask: "Quelle est la référence du marché concerné ?" } },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("une jonction ne consomme rien : WORKER → question → JOIN reste une validation de confort", () => {
    const r = compile(plan([
      ...base,
      { key: "validation", title: "Validez-vous ?", nodeType: "WAIT_INPUT", dependsOn: ["note"], waitFor: { ask: "Validez-vous l'orientation ?" } },
      { key: "fin", title: "Fin", nodeType: "JOIN", dependsOn: ["validation"] },
    ]), catalogue, pdg);
    expect(r.ok).toBe(false);
    expect(messages(r).some((x) => x.includes("INVALID_SHAPE validation"))).toBe(true);
  });

  it("une attente humaine SANS amont n'est pas une validation : « remettez-moi le contrat signé » reste une attente", () => {
    const r = compile(plan([
      { key: "attendre", title: "Attendre la pièce", nodeType: "WAIT_INPUT", waitFor: { ask: "le contrat signé" } },
    ]), catalogue, pdg);
    expect(r.ok, messages(r).join(" | ")).toBe(true);
  });

  it("la même question passe quand une étape en dépend, ou quand elle s'adresse à quelqu'un d'autre", () => {
    const arbitrage = compile(plan([
      ...base,
      { key: "choix", title: "Quelle option ?", nodeType: "WAIT_INPUT", dependsOn: ["note"], waitFor: { ask: "Option A ou B ?" } },
      { key: "suite", title: "Appliquer", capability: "send_message", dependsOn: ["choix"], input: { recipientName: "Raihana Cherif", body: "Option retenue : {{choix.payload}}" } },
    ]), catalogue, pdg);
    expect(arbitrage.ok, messages(arbitrage).join(" | ")).toBe(true);

    const autre = compile(plan([
      ...base,
      { key: "retour", title: "Retour de Raihana", nodeType: "WAIT_INPUT", dependsOn: ["note"], waitFor: { ask: "Confirmez-vous le statut ?", from: "Raihana Cherif" } },
    ]), catalogue, pdg);
    expect(autre.ok, messages(autre).join(" | ")).toBe(true);
  });
});
