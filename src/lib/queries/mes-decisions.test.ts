import { describe, expect, it } from "vitest";
import {
  dedoublonner, trierParAnciennete, trierConges, sectionsMonEspace, PREFIXE_CONGE, PREFIXE_RESTE, type LigneAttente,
} from "./mes-decisions";
import { arriveeALaMarche } from "@/lib/approval-chain";
import { depuisEtapeValidation, instantDeReprise } from "@/lib/validations/decision";
import { depuisLisible, joursCivilsDepuis } from "@/lib/calendar-tz";
import { clausePlansADecider } from "@/lib/sfe/tournee";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « MON ESPACE » EST LE LIEU OÙ L'ON DÉCIDE — les règles PURES de la file (lot E2 — audit 360°, N2, M09, 07-05).
 *
 * Une ligne par objet (la première gagne), l'attente la plus ancienne d'abord, un compteur égal aux lignes qu'il
 * annonce (§118.51), et une ancienneté qu'on lit à coup sûr ou qu'on ne dit pas (§118.16). Le banc de bout en bout
 * (`mon-espace-decisions-flow.test.ts`) joue les mêmes règles par les vrais points d'entrée.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ligne = (o: Partial<LigneAttente> & { objet: string }): LigneAttente => ({
  kind: "validation", depuis: null, deadline: null, title: o.objet, ...o,
});
const conge = (id: string, depuis: string | null, startDate: string, employee = id) => ({ id, depuis, startDate, employee });
const J = (iso: string) => new Date(iso);

describe("une ligne par objet", () => {
  it("dedoublonner garde la PREMIÈRE ligne d'un objet, et l'ordre de toutes les autres", () => {
    const a1 = ligne({ objet: "ADMIN_REQUEST:a", kind: "validation", title: "à valider" });
    const b = ligne({ objet: "TOUR_PLAN:b" });
    const a2 = ligne({ objet: "ADMIN_REQUEST:a", kind: "request", title: "à traiter" });
    const c = ligne({ objet: "LEAVE_REQUEST:c" });
    const out = dedoublonner([a1, b, a2, c]);
    expect(out.map((l) => l.objet)).toEqual(["ADMIN_REQUEST:a", "TOUR_PLAN:b", "LEAVE_REQUEST:c"]);
    // C'est le geste qui passe devant qui reste : la validation, pas le traitement.
    expect(out[0]).toBe(a1);
  });
});

describe("l'attente la plus ancienne d'abord", () => {
  it("l'attente la plus ancienne d'abord ; une ligne non datée APRÈS les datées ; la ligne « reste » ferme la section", () => {
    const recente = ligne({ objet: "X:recente", depuis: "2026-10-03T09:00:00.000Z" });
    const ancienne = ligne({ objet: "X:ancienne", depuis: "2026-09-20T09:00:00.000Z" });
    const nonDatee = ligne({ objet: "X:sans-date", depuis: null });
    // Même datée de janvier, une ligne « et d'autres… » ne passe jamais devant ce qu'elle résume.
    const reste = ligne({ objet: `${PREFIXE_RESTE}x`, depuis: "2026-01-01T09:00:00.000Z" });
    expect(trierParAnciennete([recente, reste, nonDatee, ancienne]).map((l) => l.objet))
      .toEqual(["X:ancienne", "X:recente", "X:sans-date", `${PREFIXE_RESTE}x`]);
  });

  it("à ancienneté égale : l'échéance la plus proche, puis le titre", () => {
    const d = "2026-10-01T09:00:00.000Z";
    const tard = ligne({ objet: "X:tard", depuis: d, deadline: "2026-12-01T00:00:00.000Z", title: "A" });
    const tot = ligne({ objet: "X:tot", depuis: d, deadline: "2026-10-10T00:00:00.000Z", title: "Z" });
    const b = ligne({ objet: "X:b", depuis: d, title: "Béatrice" });
    const a = ligne({ objet: "X:a", depuis: d, title: "Amel" });
    expect(trierParAnciennete([tard, b, a, tot]).map((l) => l.objet)).toEqual(["X:tot", "X:tard", "X:a", "X:b"]);
  });

  it("les congés : l'attente la plus ancienne d'abord, puis le départ le plus proche, puis le nom", () => {
    const out = trierConges([
      conge("tard", "2026-10-02T09:00:00.000Z", "2026-10-20"),
      conge("loin", "2026-09-28T09:00:00.000Z", "2026-11-30"),
      conge("proche", "2026-09-28T09:00:00.000Z", "2026-10-06"),
    ]);
    expect(out.map((c) => c.id)).toEqual(["proche", "loin", "tard"]);
  });
});

describe("les trois blocs de « Mon espace » et le compteur", () => {
  it("les congés vivent dans leur bloc, jamais dans la liste — et « À valider » compte exactement les lignes des deux blocs", () => {
    const lignes: LigneAttente[] = [
      ligne({ objet: "VALIDATION_REQUEST:v1", kind: "validation", depuis: "2026-10-02T09:00:00.000Z" }),
      ligne({ objet: "EXPENSE_ORDER:p1", kind: "payment", depuis: "2026-09-30T09:00:00.000Z" }),
      // La ligne d'un congé, et la ligne « et d'autres congés… » : le bloc des signatures les montre déjà.
      ligne({ objet: `${PREFIXE_CONGE}c1`, kind: "validation", depuis: "2026-09-01T09:00:00.000Z" }),
      ligne({ objet: `${PREFIXE_CONGE}${PREFIXE_RESTE}`, kind: "validation" }),
      ligne({ objet: "ADMIN_REQUEST:r1", kind: "request" }),
      ligne({ objet: "REGULATORY_PRODUCT:g1", kind: "regulatory" }),
      ligne({ objet: "TASK:t1", kind: "task", depuis: "2026-08-01T09:00:00.000Z" }),
    ];
    const conges = [conge("c1", "2026-09-01T09:00:00.000Z", "2026-10-15"), conge("c2", null, "2026-10-20"), conge("c3", "2026-09-10T09:00:00.000Z", "2026-10-25")];
    const s = sectionsMonEspace(lignes, conges);
    expect(s.decisions.map((l) => l.objet), "les validations, l'ancienne d'abord, sans aucun congé").toEqual(["EXPENSE_ORDER:p1", "VALIDATION_REQUEST:v1"]);
    expect(s.aTraiter.map((l) => l.objet), "les demandes et dossiers — jamais les tâches").toEqual(["ADMIN_REQUEST:r1", "REGULATORY_PRODUCT:g1"]);
    expect(s.conges.map((c) => c.id)).toEqual(["c1", "c3", "c2"]);
    // DEUX termes au compteur : 2 validations + 3 congés. Sans les congés il dirait 2 ; avec les congés aussi dans la liste, 7.
    expect(s.aValider).toBe(5);
    expect(s.aValider).toBe(s.decisions.length + s.conges.length);
  });
});

describe("depuis quand — l'arrivée à la marche d'un congé", () => {
  const creeLe = J("2026-09-20T08:00:00.000Z");
  const n1 = J("2026-09-22T10:00:00.000Z");
  const rh = J("2026-09-25T15:00:00.000Z");
  it("la marche du N+1 attend depuis le dépôt ; celle des RH depuis l'accord du N+1 ; la dernière depuis celui des RH", () => {
    expect(arriveeALaMarche("MANAGER", { creeLe, n1DecideLe: null, rhDecideLe: null })).toEqual(creeLe);
    expect(arriveeALaMarche("HR", { creeLe, n1DecideLe: n1, rhDecideLe: null })).toEqual(n1);
    expect(arriveeALaMarche("DG", { creeLe, n1DecideLe: n1, rhDecideLe: rh })).toEqual(rh);
  });
  it("une marche sautée se replie sur la précédente, jamais sur une date inventée", () => {
    expect(arriveeALaMarche("HR", { creeLe, n1DecideLe: null, rhDecideLe: null }), "entrée directement aux RH").toEqual(creeLe);
    expect(arriveeALaMarche("DG", { creeLe, n1DecideLe: n1, rhDecideLe: null })).toEqual(n1);
    expect(arriveeALaMarche("DG", { creeLe, n1DecideLe: null, rhDecideLe: null })).toEqual(creeLe);
  });
});

describe("depuis quand — l'étape d'une demande de validation", () => {
  const t0 = J("2026-09-01T08:00:00.000Z");
  const t1 = J("2026-09-03T08:00:00.000Z");
  const t2 = J("2026-09-05T08:00:00.000Z");
  const t4 = J("2026-09-09T08:00:00.000Z");
  const tR = J("2026-09-12T08:00:00.000Z");

  it("une trace d'une autre version ne date pas la reprise ; la plus récente trace de la version courante, si", () => {
    expect(instantDeReprise([{ newValue: "1", createdAt: t1 }], 1), "jamais resoumise").toBeNull();
    const traces = [{ newValue: "2", createdAt: t1 }, { newValue: "2", createdAt: t2 }, { newValue: "3", createdAt: t4 }];
    expect(instantDeReprise(traces, 2)).toEqual(t2);
    expect(instantDeReprise([{ newValue: "2", createdAt: t2 }], 3), "la trace de la version 3 manque").toBeNull();
  });

  it("en parallèle, à son tour dès le dépôt ; en séquentiel, depuis la décision des rangs INFÉRIEURS seulement", () => {
    const etapes = [{ ordre: 1, decideeLe: t1 }, { ordre: 2, decideeLe: t2 }, { ordre: 4, decideeLe: t4 }];
    expect(depuisEtapeValidation({ mode: "PARALLEL", ordre: 3, creeLe: t0, version: 1, etapes, reprise: null })).toEqual(t0);
    expect(depuisEtapeValidation({ mode: "SEQUENTIAL", ordre: 3, creeLe: t0, version: 1, etapes, reprise: null })).toEqual(t2);
    expect(depuisEtapeValidation({ mode: "SEQUENTIAL", ordre: 1, creeLe: t0, version: 1, etapes, reprise: null })).toEqual(t0);
  });

  it("resoumise, elle repart à la resoumission ; sans trace de reprise, elle n'est pas datée", () => {
    const etapes = [{ ordre: 1, decideeLe: t1 }];
    expect(depuisEtapeValidation({ mode: "SEQUENTIAL", ordre: 2, creeLe: t0, version: 2, etapes, reprise: tR })).toEqual(tR);
    expect(depuisEtapeValidation({ mode: "PARALLEL", ordre: 1, creeLe: t0, version: 2, etapes: [], reprise: tR })).toEqual(tR);
    expect(depuisEtapeValidation({ mode: "SEQUENTIAL", ordre: 2, creeLe: t0, version: 2, etapes, reprise: null })).toBeNull();
  });
});

describe("depuisLisible — en jours civils d'Alger", () => {
  it("rien à lire, rien à dire", () => {
    expect(depuisLisible(null)).toBeNull();
    expect(depuisLisible(undefined)).toBeNull();
    expect(depuisLisible("pas une date")).toBeNull();
  });
  it("en jours civils d'Alger, pas en tranches de 24 h ni en jours UTC", () => {
    expect(depuisLisible("2026-10-04T07:00:00.000Z", J("2026-10-04T18:00:00.000Z"))).toBe("depuis aujourd'hui");
    // 22 h 30 UTC le 3 = 23 h 30 à Alger le 3 ; 23 h 30 UTC le 3 = 0 h 30 à Alger le 4 : une heure, mais « hier ».
    expect(depuisLisible("2026-10-03T22:30:00.000Z", J("2026-10-03T23:30:00.000Z"))).toBe("depuis hier");
    expect(joursCivilsDepuis(J("2026-10-03T22:30:00.000Z"), J("2026-10-03T23:30:00.000Z"))).toBe(1);
    expect(depuisLisible(J("2026-10-01T09:00:00.000Z"), J("2026-10-04T08:00:00.000Z"))).toBe("depuis 3 j");
    // Une date à venir (une horloge en avance) ne fait pas une ancienneté négative.
    expect(depuisLisible("2026-10-05T09:00:00.000Z", J("2026-10-04T09:00:00.000Z"))).toBe("depuis aujourd'hui");
  });
});

describe("la file « à décider » des plans", () => {
  it("le réviseur tant que le plan est soumis, le N+2 dès qu'il est escaladé, pour moi et pour l'absent — jamais mon plan", () => {
    expect(clausePlansADecider("moi", ["absent"])).toEqual({
      repId: { not: "moi" },
      OR: [
        { status: "SUBMITTED", reviewerId: { in: ["moi", "absent"] } },
        { status: "ESCALATED", escalatedToId: { in: ["moi", "absent"] } },
      ],
    });
  });
});
