import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess } from "@/lib/rbac";
import { POWER_TOOLS } from "./power-tools";
import { parseSince } from "./what-changed";

/**
 * WHAT CHANGED — « qu'est-ce qui a changé depuis lundi ? » : seuls les changements TRACÉS
 * depuis la date remontent (pas ceux d'avant), avec QUI a agi et l'état actuel en face ;
 * « aucun changement tracé » est une réponse honnête et complète.
 */

const exec = (id: string): CurrentUser => ({
  id, name: "PDG", email: `${id}@t.dz`, role: "DIRECTION",
  access: { modules: new Map(), rowGrants: new Map() } as unknown as EffectiveAccess,
  mustChangePassword: false,
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__wc__${Date.now()}`;
const REF = `${TAG}-PAY`;
let ceoId = "";
let payId = "";

const tool = POWER_TOOLS.find((t) => t.def.name === "what_changed")!;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

suite("what_changed — le diff tracé depuis une date, l'état actuel en face", () => {
  beforeAll(async () => {
    const ceo = await prisma.user.create({ data: { name: `${TAG} Nadia`, email: `${TAG}c@t.dz`, passwordHash: "x", role: "DIRECTION" } });
    ceoId = ceo.id;
    const pay = await prisma.paymentRequest.create({
      data: { reference: REF, title: `${TAG} achat imprimerie`, amount: 300_000, payee: "Imprimerie", requesterId: ceoId, status: "SUBMITTED", createdAt: ago(30) },
    });
    payId = pay.id;
    await prisma.auditLog.createMany({
      data: [
        // AVANT la date de référence — ne doit PAS remonter.
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "UPDATE", module: "Finances", field: "status", oldValue: "DRAFT", newValue: "SUBMITTED", summary: "Demande soumise", actorId: ceoId, createdAt: ago(20) },
        // DEPUIS la date — doivent remonter.
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "UPDATE", module: "Finances", field: "amount", oldValue: "300000", newValue: "320000", summary: "Montant corrigé", actorId: ceoId, createdAt: ago(3) },
        { entityType: "PAYMENT_REQUEST", entityId: payId, action: "VALIDATE", module: "Finances", summary: "Première validation rendue", actorId: ceoId, createdAt: ago(2) },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: payId } }).catch(() => {});
    await prisma.paymentRequest.deleteMany({ where: { reference: REF } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("est réservé au siège exécutif, comme time_travel", () => {
    expect(tool.allowed(exec(ceoId))).toBe(true);
    expect(tool.allowed({ ...exec(ceoId), role: "DELEGATE" as CurrentUser["role"] })).toBe(false);
  });

  it("parseSince : AAAA-MM-JJ (début de journée Alger) ou N jours en arrière ; illisible → null", () => {
    expect(parseSince("2026-06-01")?.toISOString()).toBe("2026-05-31T23:00:00.000Z");
    const seven = parseSince("7", new Date("2026-08-25T12:00:00Z"));
    expect(seven?.toISOString()).toBe("2026-08-18T12:00:00.000Z");
    expect(parseSince("n'importe quoi")).toBeNull();
  });

  it("« depuis 7 jours » : SEULS les changements de la fenêtre remontent, avec qui a agi et l'état actuel", async () => {
    const out = JSON.parse(await tool.run({ reference: REF, since: "7" }, exec(ceoId)));
    const events = JSON.stringify(out.changements);
    expect(events).toContain("Montant corrigé");
    expect(events).toContain("Première validation rendue");
    expect(events).not.toContain("Demande soumise"); // antérieur à la fenêtre
    expect(out.changements).toHaveLength(2);
    expect(out.quiAAgi[0]).toMatchObject({ nom: `${TAG} Nadia`, actions: 2 });
    expect(out.etatActuel.statut).toBe("SUBMITTED");
    expect(out.lien).toBe(`/validations/paiements/${payId}`);
    expect(out.borne, "le journal n'a pas buté sur sa borne").toBeNull();
  });

  it("aucun changement dans la fenêtre → réponse honnête, jamais un diff inventé", async () => {
    const out = JSON.parse(await tool.run({ reference: REF, since: "1" }, exec(ceoId)));
    expect(out.changements).toEqual([]);
    expect(out.precision).toMatch(/Aucun changement SIGNIFICATIF tracé/);
    expect(out.precision).toMatch(/journal ne capture/);
    expect(out.etatActuel).toBeTruthy();
  });

  it("référence inconnue → un refus, oui, mais dans la MÊME forme", async () => {
    const out = JSON.parse(await tool.run({ reference: `${TAG}-fantome`, since: "7" }, exec(ceoId)));
    expect(out.precision).toMatch(/Aucun dossier/);
    expect(out.precision, "l'absence de sujet ne doit pas se lire « rien n'a changé »").toMatch(/SUJET est introuvable/);
    expect(out.changements).toEqual([]);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════════════════
   * LE CONTRAT : LES MÊMES CLÉS, TOUJOURS (§118.20).
   *
   * CE QUI FERAIT TOMBER CE TEST : rendre une phrase au lieu d'un objet sur un refus, omettre
   * `etapesFranchies` quand la liste est vide, ou remplacer `changements` par un compteur. Ce
   * sont les trois formes que cet outil rendait vraiment, et le planificateur — qui écrit ses
   * références AVANT de savoir ce que la lecture rendra — ne pouvait pas les deviner : une
   * référence sur `faits` mourait le jour où le flux était vide, une sur
   * `changements.significatifs` le jour où il ne l'était pas.
   *
   * On compare les JEUX DE CLÉS de cinq situations qui n'ont rien en commun — le flux, un
   * dossier plein, un dossier vide, une date illisible, un sujet inconnu — et on exige qu'ils
   * soient IDENTIQUES.
   * ═══════════════════════════════════════════════════════════════════════════════════════
   */
  it("cinq situations, un seul jeu de clés — la forme ne dépend jamais de la donnée", async () => {
    const situations: [string, Record<string, unknown>][] = [
      ["flux", {}],
      ["dossier plein", { reference: REF, since: "7" }],
      ["dossier vide", { reference: REF, since: "1" }],
      ["date illisible", { reference: REF, since: "avant-hier peut-être" }],
      ["sujet inconnu", { reference: `${TAG}-fantome`, since: "7" }],
    ];
    const vues: [string, string[]][] = [];
    for (const [nom, args] of situations) {
      const brut = await tool.run(args, exec(ceoId));
      let objet: Record<string, unknown>;
      try { objet = JSON.parse(brut) as Record<string, unknown>; } catch {
        throw new Error(`« ${nom} » ne rend pas de JSON : ${brut.slice(0, 120)}`);
      }
      vues.push([nom, Object.keys(objet).sort()]);
    }
    const [, reference] = vues[0]!;
    for (const [nom, cles] of vues) {
      expect(cles, `« ${nom} » ne rend pas les mêmes clés que « ${vues[0]![0]} »`).toEqual(reference);
    }
    // Et la forme est bien celle qu'on a annoncée, pas un jeu de clés vide qui coïnciderait.
    expect(reference).toContain("changements");
    expect(reference).toContain("precision");
    expect(reference).toContain("etapesFranchies");
  });
});
