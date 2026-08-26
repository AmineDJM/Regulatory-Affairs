import { describe, it, expect } from "vitest";
import {
  emptyWorkingSet, observe, switchBranch, resolveReferent, latest, currentBranch,
  toRouterContext, renderWorkingSet, detectBranchResume, compact,
  MAX_BRANCHES, MAX_REFERENTS_PER_BRANCH, type WorkingSet, type Referent,
} from "./working-set";
import { routeQuery } from "./router";
import { estimateTokens } from "./tokens";

/**
 * LE BANC DU JEU DE TRAVAIL.
 *
 * Il vérifie deux choses opposées, et c'est la tension entre elles qui fait la valeur du module :
 *
 *   • QUE LE CONTEXTE SURVIT — « Relance-la » doit savoir qui est « la », sans quoi la
 *     conversation redémarre à zéro à chaque tour.
 *   • QU'IL RESTE MINUSCULE — un jeu de travail qui grossit redevient le gros bloc générique
 *     qu'on cherchait à supprimer. §16 : « Do not carry every prior branch into every prompt. »
 *
 * Le second est le plus facile à perdre de vue, donc il est testé explicitement, en tokens.
 */

const now = 1_000_000;
const p = (label: string, over: Partial<Referent> = {}): Referent =>
  ({ kind: "person", label, at: now, ...over });

const scenario = (): WorkingSet => {
  let ws = emptyWorkingSet(now);
  ws = observe(ws, { utterance: "Deepak a répondu ?", referents: [p("Deepak")], lastKind: "GMAIL_FROM" }, now);
  return ws;
};

describe("le contexte survit d'un tour à l'autre (§15)", () => {
  it("« Relance-la. » sait de qui il s'agit", () => {
    const ws = observe(scenario(), { utterance: "Et Raihana ?", referents: [p("Raihana")] }, now + 1);
    const cible = resolveReferent(ws, "Relance-la.");
    expect(cible?.label).toBe("Raihana");
  });

  it("le plus RÉCEMMENT nommé l'emporte — c'est lui que « la » désigne", () => {
    let ws = scenario();
    ws = observe(ws, { utterance: "Et Raihana ?", referents: [p("Raihana")] }, now + 10);
    expect(resolveReferent(ws, "Écris-lui.")?.label).toBe("Raihana");
  });

  it("sans personne nommée, on n'invente pas de destinataire", () => {
    expect(resolveReferent(emptyWorkingSet(now), "Relance-la.")).toBeNull();
  });

  it("une mention répétée ne se duplique pas, elle se rafraîchit", () => {
    let ws = scenario();
    ws = observe(ws, { utterance: "Deepak encore.", referents: [p("Deepak")] }, now + 50);
    const deepaks = currentBranch(ws).referents.filter((r) => r.label === "Deepak");
    expect(deepaks).toHaveLength(1);
    expect(deepaks[0].at).toBe(now + 50);
  });

  it("le dossier et la personne se retiennent séparément", () => {
    const ws = observe(scenario(), {
      utterance: "Où en est Raltegravir ?",
      referents: [{ kind: "record", label: "Raltegravir", domain: "REGULATORY", at: now }],
      lastKind: "RECORD_STATUS",
    }, now + 5);
    expect(latest(ws, "person")?.label).toBe("Deepak");
    expect(latest(ws, "record")?.label).toBe("Raltegravir");
  });
});

describe("les branches de conversation (§16)", () => {
  it("« Revenons à Deepak. » est reconnu comme une reprise", () => {
    expect(detectBranchResume("Revenons à Deepak.")).toBe("deepak");
    expect(detectBranchResume("Reprenons sur le Nintedanib.")).toBe("nintedanib");
    expect(detectBranchResume("Des mails aujourd'hui ?")).toBeNull();
  });

  it("un fil suspendu RETROUVE ce qu'il savait", () => {
    // C'est tout l'objet : le PDG parle de Deepak, bifurque sur la trésorerie, revient — et
    // n'a pas à redire qui est Deepak.
    let ws = emptyWorkingSet(now);
    ws = observe(ws, { utterance: "Deepak a répondu ?", referents: [p("Deepak")], topic: "deepak" }, now);
    ws = observe(ws, { utterance: "Le solde de trésorerie ?", referents: [], topic: "tresorerie" }, now + 100);
    expect(latest(ws, "person")).toBeNull();

    ws = observe(ws, { utterance: "Revenons à Deepak." }, now + 200);
    expect(ws.current).toBe("deepak");
    expect(latest(ws, "person")?.label).toBe("Deepak");
  });

  it("les fils suspendus NE SONT PAS versés au contexte du routeur", () => {
    let ws = emptyWorkingSet(now);
    ws = observe(ws, { utterance: "Deepak ?", referents: [p("Deepak")], topic: "deepak" }, now);
    ws = observe(ws, { utterance: "Raihana ?", referents: [p("Raihana")], topic: "raihana" }, now + 10);
    // On est sur « raihana » : « la » ne doit pas désigner Deepak.
    expect(toRouterContext(ws).lastPerson).toBe("Raihana");
  });

  it("le nombre de fils est borné, et l'actif survit toujours", () => {
    let ws = emptyWorkingSet(now);
    for (let i = 0; i < MAX_BRANCHES + 4; i += 1) {
      ws = observe(ws, { utterance: `sujet ${i}`, referents: [p(`P${i}`)], topic: `sujet${i}` }, now + i);
    }
    expect(ws.branches.length).toBeLessThanOrEqual(MAX_BRANCHES + 2); // + l'actif et « general »
    expect(ws.branches.some((b) => b.topic === ws.current)).toBe(true);
  });

  it("le fil actif n'est jamais évincé, même s'il est le plus ancien", () => {
    let ws = emptyWorkingSet(now);
    ws = switchBranch(ws, "vieux", now);
    for (let i = 0; i < 10; i += 1) {
      ws = { ...ws, branches: [...ws.branches, { topic: `t${i}`, referents: [], openedAt: now + 500 + i, touchedAt: now + 500 + i }] };
    }
    const serre = compact(ws, now + 1_000, 3);
    expect(serre.branches.some((b) => b.topic === "vieux")).toBe(true);
  });
});

describe("il reste MINUSCULE — c'est une propriété, pas une limite", () => {
  it("le rendu tient en quelques dizaines de tokens", () => {
    let ws = emptyWorkingSet(now);
    for (let i = 0; i < 20; i += 1) {
      ws = observe(ws, { utterance: `tour ${i}`, referents: [p(`Personne numéro ${i}`)], topic: `fil${i}` }, now + i);
    }
    const rendu = renderWorkingSet(ws);
    // Un jeu de travail de 2 000 tokens serait exactement le gros bloc qu'on veut supprimer.
    expect(estimateTokens(rendu)).toBeLessThan(80);
  });

  it("le nombre de référents par fil est borné", () => {
    let ws = emptyWorkingSet(now);
    for (let i = 0; i < 20; i += 1) {
      ws = observe(ws, { utterance: "x", referents: [p(`P${i}`)] }, now + i);
    }
    expect(currentBranch(ws).referents.length).toBeLessThanOrEqual(MAX_REFERENTS_PER_BRANCH);
  });

  it("un jeu de travail vide ne rend rien du tout", () => {
    expect(renderWorkingSet(emptyWorkingSet(now))).toBe("");
  });
});

describe("il alimente le routeur, et le routeur s'en sert", () => {
  it("« Et Raihana ? » reprend l'intention du fil actif", () => {
    const ws = observe(emptyWorkingSet(now), {
      utterance: "Deepak a répondu ?", referents: [p("Deepak")], lastKind: "GMAIL_FROM",
    }, now);
    const r = routeQuery("Et Raihana ?", toRouterContext(ws));
    expect(r.route).toBe("FAST_DETERMINISTIC");
    expect(r.args.from).toBe("raihana");
  });

  it("une intention d'envoi en attente transforme « Envoie. » en approbation", () => {
    const ws: WorkingSet = { ...emptyWorkingSet(now), pendingMailIntentId: "intent-1" };
    expect(routeQuery("Envoie.", toRouterContext(ws)).fastKind).toBe("APPROVE_PENDING");
    const sans = routeQuery("Envoie.", toRouterContext(emptyWorkingSet(now)));
    expect(sans.route).toBe("ACTION");
  });

  it("« Alors ? » ne réclame que s'il y a vraiment quelque chose en cours", () => {
    const avec: WorkingSet = { ...emptyWorkingSet(now), openDeliveryId: "job-1" };
    expect(routeQuery("Alors ?", toRouterContext(avec)).fastKind).toBe("RESUME_DELIVERY");
    expect(routeQuery("Alors ?", toRouterContext(emptyWorkingSet(now))).fastKind).toBeNull();
  });

  it("les entités du fil orientent le domaine (§14)", () => {
    const ws = observe(emptyWorkingSet(now), {
      utterance: "Où en est ASARI ?",
      referents: [{ kind: "record", label: "ASARI", domain: "FINANCE", at: now }],
    }, now);
    expect(routeQuery("Où en est ASARI ?", toRouterContext(ws)).domain).toBe("FINANCE");
  });
});
