import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, userCan, type SessionUser } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { demanderPieceSecretariat, requestAdProItemOrder, approveAdProItemOrder } from "@/lib/actions/ad-pro-item-actions";
import { PIECE_SECRETARIAT } from "./pieces-secretariat";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__adproposte__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE POSTE, PAR SES VRAIS POINTS D'ENTRÉE.
 *
 * Deux propriétés, et chacune a été un défaut MESURÉ avant d'être un test :
 *
 *  1. l'accès à un poste vient de SON OPÉRATION, pas d'un module écrit à la main ;
 *  2. le message du demandeur et la note de la Direction sont deux paroles, et la seconde
 *     n'efface plus la première.
 *
 * Le banc est joué avec un DÉLÉGUÉ MÉDICAL, pas avec un Super Admin : un acteur à vue globale
 * rendrait les deux gardes vraies quoi qu'il arrive (§118.104). C'est aussi l'acteur du défaut
 * réel — mesuré, `MEDICAL_DELEGATE` et `MEDICAL_PROMOTION_MANAGER` sont les DEUX seuls rôles
 * qui portent `EVENTS` et `CONGRESS_NATIONAL` sans porter `SPONSORING`, donc les auteurs
 * typiques d'un événement étaient ceux à qui leur propre poste se fermait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Ad & Pro — un poste, ses droits et ses deux paroles", () => {
  let kamId = "", dirId = "", eventId = "", posteId = "", catId = "";

  beforeAll(async () => {
    const mk = (n: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${n}`, email: `${TAG}${n}@t.dz`, role, passwordHash: "x" } });
    kamId = (await mk("kam", "MEDICAL_DELEGATE")).id;
    dirId = (await mk("dir", "DIRECTION")).id;
    eventId = (await prisma.event.create({
      data: { name: `${TAG}Journée oncologie`, requesterId: kamId, startDate: new Date("2026-11-02") },
      select: { id: true },
    })).id;
    posteId = (await prisma.adProItem.create({
      data: {
        eventId, kind: "CATERING", label: `${TAG}Traiteur`, supplier: "Les Oliviers",
        amountEstimated: 120000, createdById: kamId,
      },
      select: { id: true },
    })).id;
    const env = await prisma.budgetEnvelope.create({
      data: {
        name: `${TAG}Enveloppe`, modules: ["EVENTS"], totalAmount: 5_000_000,
        periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-12-31"),
      },
      select: { id: true },
    });
    catId = (await prisma.budgetCategoryLine.create({
      data: { envelopeId: env.id, name: `${TAG}Traiteurs`, allocated: 1_000_000 },
      select: { id: true },
    })).id;
  });

  afterAll(async () => {
    const comptes = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { userId: { in: comptes.map((c) => c.id) } } }).catch(() => {});
    await prisma.administrativeRequest.deleteMany({ where: { linkedEntityType: "AD_PRO_ITEM", linkedEntityId: posteId } }).catch(() => {});
    await prisma.adProItem.deleteMany({ where: { label: { startsWith: TAG } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.budgetCategoryLine.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.budgetEnvelope.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it("LA PRÉMISSE : le délégué a EVENTS et n'a PAS SPONSORING", async () => {
    // Sans cette vérification, le jour où ce rôle gagnerait `SPONSORING`, les deux cas suivants
    // passeraient au vert sans plus rien garder (§118.104).
    const u = await actorFor(kamId, "MEDICAL_DELEGATE");
    expect(userCan(u, "EVENTS", "UPLOAD"), "l'auteur d'un événement peut y joindre une pièce").toBe(true);
    expect(userCan(u, "SPONSORING", "UPLOAD"), "et il n'a AUCUN droit sur le sponsoring").toBe(false);
  });

  it("le poste d'un ÉVÉNEMENT s'ouvre à qui l'événement s'ouvre — pas au module SPONSORING", async () => {
    const u = await actorFor(kamId, "MEDICAL_DELEGATE");
    expect(await canAccessEntity(u, "EVENT", eventId, "UPLOAD"), "prémisse : l'opération lui est ouverte").toBe(true);
    // Le défaut mesuré : `ENTITY_MODULE.AD_PRO_ITEM = "SPONSORING"` fermait ceci. Le demandeur
    // ne pouvait ni joindre une pièce ni commenter le poste de SA propre demande.
    expect(await canAccessEntity(u, "AD_PRO_ITEM", posteId, "UPLOAD"), "le poste suit son opération").toBe(true);
  });

  it("…et il se FERME à qui l'opération se ferme — la délégation n'ouvre rien de plus", async () => {
    // L'autre sens, sans lequel la garde serait désarmée en ayant l'air armée (§118.17) : un
    // rôle sans aucun module du pôle ne doit pas atteindre le poste par cette porte.
    const etranger = await prisma.user.create({
      data: { name: `${TAG}etr`, email: `${TAG}etr@t.dz`, role: "LOGISTICS_MANAGER", passwordHash: "x" },
      select: { id: true },
    });
    const u = await actorFor(etranger.id, "LOGISTICS_MANAGER");
    expect(await canAccessEntity(u, "EVENT", eventId, "VIEW")).toBe(false);
    expect(await canAccessEntity(u, "AD_PRO_ITEM", posteId, "VIEW")).toBe(false);
  });

  it("une demande de DEVIS porte le lien CANONIQUE — sans quoi la dépense est imputable deux fois", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const fd = new FormData();
    fd.set("id", posteId);
    fd.set("nature", "DEVIS");
    fd.set("note", `${TAG}Cocktail 80 personnes, réf. marché 2026-14.`);
    const r = await demanderPieceSecretariat(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);

    const dem = await prisma.administrativeRequest.findFirstOrThrow({
      where: { linkedEntityType: "AD_PRO_ITEM", linkedEntityId: posteId },
      select: { type: true, description: true, title: true, requesterId: true },
    });
    expect(dem.type).toBe(PIECE_SECRETARIAT.DEVIS.type);
    // LE MESSAGE DE LA PERSONNE EN TÊTE : c'est ce que l'assistante lit d'abord.
    expect((dem.description ?? "").startsWith(`${TAG}Cocktail 80 personnes`), dem.description ?? "").toBe(true);
    expect(dem.requesterId).toBe(kamId);
  });

  it("la FACTURE est refusée tant que le bon de commande n'est pas demandé — et RIEN n'est écrit", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const avant = await prisma.administrativeRequest.count({ where: { linkedEntityId: posteId } });
    const fd = new FormData();
    fd.set("id", posteId);
    fd.set("nature", "FACTURE");
    const r = await demanderPieceSecretariat(undefined, fd);
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("bon de commande");
    expect(await prisma.administrativeRequest.count({ where: { linkedEntityId: posteId } })).toBe(avant);
  });

  it("le visa de la Direction n'EFFACE plus le message du demandeur", async () => {
    // Le décor mène le poste jusqu'à la demande d'émission : accordé, chiffré, imputé.
    await prisma.adProItem.update({
      where: { id: posteId },
      data: { status: "APPROVED", amountGranted: 120000, budgetCategoryId: catId },
    });
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const fdBc = new FormData();
    fdBc.set("id", posteId);
    fdBc.set("note", `${TAG}BC au nom des Oliviers, 80 couverts, réf. devis DV-77.`);
    const bc = await requestAdProItemOrder(undefined, fdBc);
    expect(bc.ok, bc.ok === false ? bc.error : "").toBe(true);

    ACTOR = await actorFor(dirId, "DIRECTION");
    const fdVisa = new FormData();
    fdVisa.set("id", posteId);
    fdVisa.set("decision", "APPROVE");
    fdVisa.set("note", `${TAG}Visé, à régler sur l'enveloppe événements.`);
    const visa = await approveAdProItemOrder(undefined, fdVisa);
    expect(visa.ok, visa.ok === false ? visa.error : "").toBe(true);

    const apres = await prisma.adProItem.findUniqueOrThrow({
      where: { id: posteId },
      select: { orderStage: true, orderNote: true, orderDecisionNote: true },
    });
    expect(apres.orderStage).toBe("DIRECTION_OK");
    // LE DÉFAUT QU'ON FERME : les deux paroles vivaient dans `orderNote`, donc le visa écrasait
    // le contenu du bon de commande — et l'assistante devait rappeler le demandeur.
    expect(apres.orderNote, "le message du demandeur survit au visa").toContain("80 couverts");
    expect(apres.orderDecisionNote, "la note de la Direction a son propre champ").toContain("enveloppe événements");
  });

  it("l'ASSISTANTE DE DIRECTION est prévenue de la demande d'émission — c'est elle qui l'établit", async () => {
    /*
     * « Demander l'établissement d'un BC qui arrivera à l'assistante de direction pour chaque
     * poste. » Elle n'était prévenue de RIEN : la demande partait à la Direction pour son visa,
     * et l'assistante apprenait après coup qu'il fallait rédiger la pièce.
     *
     * On juge par le LIEN CAUSAL — les notifications écrites APRÈS le décor — et non par
     * ressemblance de libellés : la base est partagée, et un compte étranger portant le même
     * rôle ferait compter les notifications d'un autre banc (§118.36, §118.119d).
     */
    const assistante = await prisma.user.create({
      data: { name: `${TAG}assist`, email: `${TAG}assist@t.dz`, role: "DIRECTION_ASSISTANT", passwordHash: "x" },
      select: { id: true },
    });
    // Un SECOND poste, pour que la demande d'émission soit neuve (le premier est déjà visé).
    const autre = await prisma.adProItem.create({
      data: {
        eventId, kind: "VENUE", label: `${TAG}Salle`, status: "APPROVED",
        amountGranted: 90000, budgetCategoryId: catId, createdById: kamId,
      },
      select: { id: true },
    });
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const fd = new FormData();
    fd.set("id", autre.id);
    fd.set("note", `${TAG}Salle plénière, 2 jours.`);
    const r = await requestAdProItemOrder(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);

    const pourElle = await prisma.notification.findMany({
      where: { userId: assistante.id },
      select: { title: true, type: true },
    });
    expect(pourElle.length, "l'assistante reçoit la demande d'établissement").toBeGreaterThanOrEqual(1);
    expect(pourElle.map((n) => n.title).join(" | ")).toContain("à établir");
    // Et le VISA de la Direction reste un geste DISTINCT : on ajoute un destinataire, on ne
    // retire aucune garde. La Direction est prévenue elle aussi.
    const pourDirection = await prisma.notification.findMany({
      where: { userId: dirId, title: "Bon de commande à viser" },
      select: { id: true },
    });
    expect(pourDirection.length, "le visa reste demandé à la Direction").toBeGreaterThanOrEqual(1);
  });

  it("une nature INCONNUE est refusée en nommant celles qui existent", async () => {
    // Le défaut silencieux qu'on ferme : retomber sur « DEVIS » par défaut ferait ouvrir un
    // devis quand la personne a dit autre chose, et la carte annoncerait l'autre pièce.
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const fd = new FormData();
    fd.set("id", posteId);
    fd.set("nature", "BON_DE_COMMANDE");
    const r = await demanderPieceSecretariat(undefined, fd);
    expect(r.ok).toBe(false);
    expect(r.ok === false ? r.error : "").toContain("DEVIS");
  });
});
