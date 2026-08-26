import { describe, it, expect, beforeEach } from "vitest";
import { publish, subscribe, busStats, resetBus } from "./event-bus";
import { emit, DOMAIN_EVENTS } from "./events";
import type { DomainEvent } from "./contract";

/**
 * LE BUS DOIT ÊTRE INOFFENSIF POUR L'ERP.
 *
 * Le fond de ces cas n'est pas « le message arrive » — c'est « publier ne peut RIEN casser ».
 * Un bus d'événements greffé sur des actions Finance et RH n'a le droit d'ajouter aucune
 * nouvelle façon d'échouer : c'est la condition pour qu'on accepte d'en poser un partout.
 */

const evt = (type = "hr.employee-added", id = "e1") => ({
  type, subject: { type: "employee", id }, actorId: "u1", data: {},
});

beforeEach(() => resetBus());

describe("un abonné en échec ne fait échouer personne", () => {
  it("l'exception d'un abonné est avalée — la publication réussit", () => {
    subscribe(() => { throw new Error("abonné cassé"); });
    expect(() => publish(evt())).not.toThrow();
    expect(busStats().handlerFailures).toBe(1);
  });

  it("…et les AUTRES abonnés sont quand même servis", () => {
    // Le point : un abonné défaillant ne doit pas priver les suivants. Sans isolation par
    // abonné, le premier qui casse coupe la chaîne — et le défaut est invisible.
    const vus: string[] = [];
    subscribe(() => { throw new Error("cassé"); });
    subscribe((e) => vus.push(e.type));
    publish(evt("regulatory.owner-changed"));
    expect(vus).toEqual(["regulatory.owner-changed"]);
  });

  it("`emit` ne lève jamais, même sur un type inconnu", () => {
    expect(() => emit({ type: "n.importe.quoi" as never, subject: { type: "x", id: "1" } })).not.toThrow();
    // …et il ne publie pas non plus : un type non déclaré n'entre pas dans le flux.
    expect(busStats().published).toBe(0);
  });
});

describe("l'ordonnancement et le rattrapage", () => {
  it("chaque fait reçoit un numéro monotone — un trou se voit", () => {
    const seqs: number[] = [];
    subscribe((e) => seqs.push(e.seq));
    publish(evt()); publish(evt()); publish(evt());
    expect(seqs).toEqual([1, 2, 3]);
  });

  it("un abonné tardif peut rattraper ce qu'il a manqué", () => {
    publish(evt("hr.employee-added", "a"));
    publish(evt("hr.employee-added", "b"));
    const vus: DomainEvent[] = [];
    subscribe((e) => vus.push(e), { replayFrom: 0 });
    expect(vus.map((e) => e.subject.id)).toEqual(["a", "b"]);
  });

  it("le rattrapage part d'où on le demande", () => {
    publish(evt("hr.employee-added", "a"));
    publish(evt("hr.employee-added", "b"));
    const vus: string[] = [];
    subscribe((e) => vus.push(e.subject.id), { replayFrom: 1 });
    expect(vus).toEqual(["b"]);
  });

  it("sans rattrapage demandé, on ne reçoit que la suite", () => {
    publish(evt("hr.employee-added", "avant"));
    const vus: string[] = [];
    subscribe((e) => vus.push(e.subject.id));
    publish(evt("hr.employee-added", "apres"));
    expect(vus).toEqual(["apres"]);
  });

  it("se désabonner arrête vraiment la réception", () => {
    const vus: string[] = [];
    const off = subscribe((e) => vus.push(e.subject.id));
    publish(evt("hr.employee-added", "un"));
    off();
    publish(evt("hr.employee-added", "deux"));
    expect(vus).toEqual(["un"]);
    expect(busStats().subscribers).toBe(0);
  });
});

describe("la mémoire du bus est bornée — pas de fuite", () => {
  it("au-delà de la capacité, les plus anciens sortent", () => {
    for (let i = 0; i < 700; i += 1) publish(evt("hr.employee-added", String(i)));
    const s = busStats();
    expect(s.published).toBe(700);
    // Le tampon plafonne ; le compteur, lui, dit la vérité sur le volume total.
    expect(s.buffered).toBeLessThanOrEqual(500);
  });
});

describe("le catalogue est fermé, et c'est ce qui le rend lisible", () => {
  it("tous les types sont des verbes au PASSÉ, préfixés par leur domaine", () => {
    // Un « fait » se nomme au passé. « refresh-cache » serait un ORDRE, et rendrait l'ERP
    // responsable du fonctionnement interne d'Adam.
    for (const t of DOMAIN_EVENTS) {
      const parts = t.split(".");
      expect(parts, `« ${t} » doit être « domaine.verbe-au-passé »`).toHaveLength(2);
      expect(parts[0]).toMatch(/^[a-z]+$/);
      // Le dernier mot du verbe porte le passé : « stage-changed » → « changed », « sent » → « sent ».
      const verbe = parts[1].split("-").pop() ?? "";
      expect(verbe, `« ${t} » : « ${verbe} » n'est pas un participe passé`).toMatch(/(ed|sent)$/);
    }
  });

  it("aucun doublon dans le catalogue", () => {
    expect(new Set(DOMAIN_EVENTS).size).toBe(DOMAIN_EVENTS.length);
  });

  it("`emit` horodate et numérote — l'appelant n'a pas à le faire", () => {
    const e = emit({ type: "mail.sent", subject: { type: "outbound_mail", id: "m1" } });
    expect(e).not.toBeNull();
    expect(e?.seq).toBe(1);
    expect(Number.isNaN(Date.parse(e?.at ?? ""))).toBe(false);
    expect(e?.actorId).toBeNull(); // omis = système, et c'est explicite
  });
});
