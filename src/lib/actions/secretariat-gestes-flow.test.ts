import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, hasGlobalView, userCan, type SessionUser } from "@/lib/rbac";
import {
  createRequest, updateRequestStatus, startRequestProcessing, finishRequest, rouvrirDemande,
  annulerDemandeAuSecretariat, deleteRequests, restoreRequest, deleteOwnRequest,
} from "./admin-request-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__secgestes__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const err = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error ?? "");

/**
 * LE SECRÉTARIAT — PLUS DE MENU DE STATUT LIBRE, DES GESTES NOMMÉS (§118.191, audit 360° R12). Par les
 * VRAIS points d'entrée, avec une assistante qui gère SANS la vue globale (§118.104).
 */
suite("Demande au secrétariat — gestes nommés, fin gardée, réouverture motivée", () => {
  const u: Record<string, string> = {};
  const roles: Record<string, SessionUser["role"]> = { req: "MEDICAL_DELEGATE", asst: "DIRECTION_ASSISTANT", coll: "MEDICAL_DELEGATE" };
  const created: string[] = [];
  const comme = async (k: string) => { ACTOR = await actorFor(u[k]!, roles[k]!); };

  beforeAll(async () => {
    for (const [k, role] of Object.entries(roles)) {
      const x = await prisma.user.create({ data: { name: `${TAG}${k}`, email: `${TAG}${k}@t.dz`, role, passwordHash: "x" } });
      u[k] = x.id;
    }
  });

  afterAll(async () => {
    const ids = Object.values(u);
    await prisma.validationRequest.deleteMany({ where: { entityType: "ADMIN_REQUEST", entityId: { in: created } } }).catch(() => {});
    await prisma.comment.deleteMany({ where: { entityType: "ADMIN_REQUEST", entityId: { in: created } } }).catch(() => {});
    await prisma.administrativeRequest.deleteMany({ where: { id: { in: created } } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids }, type: "FILE" } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  async function nouvelle(titre: string, assignee = true): Promise<string> {
    await comme("req");
    const r = await createRequest(undefined, form({ type: "OTHER", title: `${TAG}${titre}`, ...(assignee ? { assignedToId: u.asst! } : {}) }));
    expect(r.ok, err(r) ?? "").toBe(true);
    created.push(r.id!);
    return r.id!;
  }
  async function enCours(titre: string): Promise<string> {
    const id = await nouvelle(titre);
    await comme("asst");
    expect(err(await startRequestProcessing(form({ id })))).toBeNull();
    return id;
  }
  const statut = (id: string) => prisma.administrativeRequest.findUniqueOrThrow({ where: { id }, select: { status: true, blockedReason: true, completedAt: true, archivedNodeId: true, deletedAt: true } });
  const changer = async (k: string, id: string, status: string, motif?: string) => {
    await comme(k);
    return updateRequestStatus(form({ id, status, ...(motif !== undefined ? { blockedReason: motif } : {}) }));
  };
  const notifs = (userId: string, title: string) => prisma.notification.findMany({ where: { userId, title }, orderBy: { createdAt: "desc" }, select: { body: true } });

  async function pendantLaLecture<T>(lancer: () => Promise<T>, concurrent: (tx: Prisma.TransactionClient) => Promise<unknown>): Promise<T> {
    let geste!: Promise<T>;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`LOCK TABLE "AdministrativeRequest" IN SHARE MODE`);
      geste = lancer();
      geste.catch(() => undefined);
      const debut = Date.now();
      for (;;) {
        await tx.$executeRawUnsafe("SELECT pg_stat_clear_snapshot()");
        const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock' AND query ILIKE ${'%"AdministrativeRequest"%'}`;
        if (n >= 1) break;
        if (Date.now() - debut > 10_000) throw new Error("le geste n'a pas atteint la barrière");
        await new Promise((r) => setTimeout(r, 25));
      }
      await concurrent(tx);
    }, { timeout: 20_000 });
    return geste;
  }

  it("PRÉMISSES : l'assistante gère sans la vue globale ; le collègue crée sans gérer", async () => {
    const a = await actorFor(u.asst!, roles.asst!);
    expect(hasGlobalView(a.role), "une garde éprouvée avec la vue globale ne peut pas tomber (§118.104)").toBe(false);
    expect(userCan(a, "ADMIN_REQUESTS", "UPDATE")).toBe(true);
    const c = await actorFor(u.coll!, roles.coll!);
    expect(userCan(c, "ADMIN_REQUESTS", "UPDATE")).toBe(false);
  });

  it("le statut libre ne TERMINE ni n'ANNULE plus — chacun a sa porte, et le refus la nomme", async () => {
    const id = await enCours("Menu");
    expect(err(await changer("asst", id, "DONE"))).toMatch(/passe par « Fin de la demande »/);
    expect(err(await changer("asst", id, "CANCELLED"))).toMatch(/passe par « Annuler la demande »/);
    expect(err(await changer("asst", id, "AWAITING_VALIDATION"))).toMatch(/découle d'un geste/);
    expect(err(await changer("asst", id, "NEW"))).toMatch(/découle d'un geste/);
    expect((await statut(id)).status).toBe("IN_PROGRESS");
  });

  it("une demande neuve se PREND en charge — elle ne passe pas « en cours » par le menu", async () => {
    const id = await nouvelle("Neuve");
    expect(err(await changer("asst", id, "IN_PROGRESS"))).toMatch(/Commencer le traitement/);
  });

  it("BLOQUER exige son motif ; le demandeur lit le motif, jamais l'énumération brute", async () => {
    const id = await enCours("Bloquée");
    expect(err(await changer("asst", id, "BLOCKED"))).toBe("Dites ce qui bloque : c'est ce que lira le demandeur.");
    expect(err(await changer("asst", id, "BLOCKED", "le fournisseur ne répond plus"))).toBeNull();
    expect(await statut(id)).toMatchObject({ status: "BLOCKED", blockedReason: "le fournisseur ne répond plus" });
    const [n] = await notifs(u.req!, "Demande bloquée");
    expect(n?.body).toMatch(/— le fournisseur ne répond plus$/);
    const fil = await prisma.comment.findFirst({ where: { entityType: "ADMIN_REQUEST", entityId: id } });
    expect(fil?.body).toBe("Demande bloquée — le fournisseur ne répond plus");
  });

  it("REPRENDRE efface le motif de blocage ; la notification dit le statut par son nom", async () => {
    const id = await enCours("Reprise");
    expect(err(await changer("asst", id, "BLOCKED", "pièce manquante"))).toBeNull();
    expect(err(await changer("asst", id, "IN_PROGRESS"))).toBeNull();
    expect(await statut(id)).toMatchObject({ status: "IN_PROGRESS", blockedReason: null });
    const [n] = await notifs(u.req!, "Demande mise à jour");
    expect(n?.body).not.toMatch(/IN_PROGRESS/);
    expect(n?.body).toMatch(/Statut|En cours|cours/i);
    expect(err(await changer("asst", id, "AWAITING_EXTERNAL"))).toBeNull();
    expect(err(await changer("asst", id, "AWAITING_DOCUMENT"))).toBeNull();
    expect(err(await changer("asst", id, "AWAITING_DOCUMENT"))).toBe("La demande est déjà dans cet état.");
  });

  it("qui ne gère pas la demande ne change pas son statut — avant toute autre raison", async () => {
    const id = await enCours("Collègue");
    expect(err(await changer("coll", id, "DONE"))).toBe("Non autorisé.");
  });

  it("FIN DE LA DEMANDE par la porte gardée — et c'est elle qui archive maintenant", async () => {
    const id = await enCours("Archive");
    await comme("asst");
    expect(err(await finishRequest(form({ id })))).toBeNull();
    const s = await statut(id);
    expect(s.status).toBe("DONE");
    expect(s.archivedNodeId, "la fin gardée archive dans le Drive, comme le faisait le menu libre").not.toBeNull();
  });

  it("ROUVRIR : une demande terminée, avec son motif ; jamais une annulée ; jamais une en cours", async () => {
    const id = await enCours("Rouvrir");
    await comme("asst");
    expect(err(await rouvrirDemande(form({ id, motif: "x" })))).toBe("Seule une demande terminée se rouvre.");
    expect(err(await finishRequest(form({ id })))).toBeNull();
    expect(err(await rouvrirDemande(form({ id })))).toBe("Dites pourquoi vous la rouvrez : c'est ce que lira le demandeur.");
    await comme("coll");
    expect(err(await rouvrirDemande(form({ id, motif: "x" })))).toBe("Non autorisé.");
    await comme("asst");
    const r = await rouvrirDemande(form({ id, motif: "la livraison n'est jamais arrivée" }));
    expect(err(r)).toBeNull();
    expect(await statut(id)).toMatchObject({ status: "IN_PROGRESS", completedAt: null });
    expect((await notifs(u.req!, "Demande rouverte"))[0]?.body).toMatch(/la livraison n'est jamais arrivée/);
    // Le statut libre ne rouvre plus rien : ni une terminée, ni une annulée.
    expect(err(await finishRequest(form({ id })))).toBeNull();
    expect(err(await changer("asst", id, "IN_PROGRESS"))).toMatch(/se rouvre par « Rouvrir »/);
  });

  it("ANNULER, par le secrétariat : motif exigé ; ce qui en dépend est retiré ; le demandeur est prévenu", async () => {
    const id = await enCours("Annuler");
    const v = await prisma.validationRequest.create({
      data: { reference: `${TAG}VAL-${Date.now()}`, module: "Bureau du secrétariat", title: "validation liée", entityType: "ADMIN_REQUEST", entityId: id, requesterId: u.asst!, status: "PENDING" },
    });
    await comme("asst");
    expect(err(await annulerDemandeAuSecretariat(form({ id })))).toMatch(/Dites pourquoi vous annulez/);
    const r = await annulerDemandeAuSecretariat(form({ id, motif: "demande en double" }));
    expect(err(r)).toBeNull();
    expect((await statut(id)).status).toBe("CANCELLED");
    expect((await notifs(u.req!, "Demande annulée par le secrétariat"))[0]?.body).toMatch(/demande en double/);
    expect((await prisma.validationRequest.findUniqueOrThrow({ where: { id: v.id } })).status, "la validation liée part avec la demande").toBe("CANCELLED");
    // Une demande annulée ne se rouvre pas — ni par « Rouvrir », ni par le statut.
    expect(err(await rouvrirDemande(form({ id, motif: "x" })))).toMatch(/ne se rouvre pas/);
    expect(err(await changer("asst", id, "IN_PROGRESS"))).toMatch(/annulée : elle ne se rouvre pas/);
  });

  it("la demande de BC d'un POSTE ne s'annule pas d'ici — le refus nomme le poste, et rien ne bouge", async () => {
    const poste = await prisma.administrativeRequest.create({
      data: { reference: `${TAG}BC-${Date.now()}`, type: "OTHER", title: `Bon de commande à établir — ${TAG}poste`, status: "IN_PROGRESS", requesterId: u.req!, assignedToId: u.asst!, linkedEntityType: "AD_PRO_ITEM", linkedEntityId: `${TAG}poste` },
      select: { id: true },
    });
    created.push(poste.id);
    await comme("asst");
    expect(err(await annulerDemandeAuSecretariat(form({ id: poste.id, motif: "plus utile" })))).toMatch(/retirez-la depuis le poste/);
    expect((await statut(poste.id)).status).toBe("IN_PROGRESS");
  });

  it("RESTAURER N'EST PAS RESSUSCITER : une demande COMMENCÉE puis annulée par sa propre auteure revient annulée", async () => {
    // L'assistante dépose elle-même la demande : elle en est l'auteure ET la gestionnaire. Commencée puis
    // annulée, la demande a perdu ses validations ; supprimée puis restaurée, elle ne redevient pas
    // « nouvelle » — seule la suppression DISCRÈTE (jamais commencée) le peut.
    await comme("asst");
    const r = await createRequest(undefined, form({ type: "OTHER", title: `${TAG}Auteure gestionnaire`, assignedToId: u.asst! }));
    expect(r.ok, err(r) ?? "").toBe(true);
    created.push(r.id!);
    expect(err(await startRequestProcessing(form({ id: r.id! })))).toBeNull();
    expect(err(await annulerDemandeAuSecretariat(form({ id: r.id!, motif: "plus nécessaire" })))).toBeNull();
    expect(err(await deleteRequests(form({ ids: r.id!, reason: "rangement" })))).toBeNull();
    expect(err(await restoreRequest(form({ id: r.id! })))).toBeNull();
    expect((await statut(r.id!)).status, "commencée puis annulée, elle ne ressuscite pas").toBe("CANCELLED");
  });

  it("RESTAURER N'EST PAS RESSUSCITER : une demande JAMAIS commencée, annulée par le SECRÉTARIAT, revient annulée", async () => {
    // Jamais commencée, comme une suppression discrète — mais c'est le secrétariat qui l'a annulée, pas son
    // demandeur : le demandeur a été prévenu « annulée », la restaurer « nouvelle » la ressusciterait sans
    // que personne l'ait redemandée. Seul le demandeur qui retire SA demande la retrouve nouvelle.
    const id = await nouvelle("Jamais commencée");
    await comme("asst");
    expect(err(await annulerDemandeAuSecretariat(form({ id, motif: "hors périmètre" })))).toBeNull();
    expect(err(await deleteRequests(form({ ids: id, reason: "rangement" })))).toBeNull();
    expect(err(await restoreRequest(form({ id })))).toBeNull();
    expect(await statut(id), "annulée par le secrétariat, elle ne ressuscite pas").toMatchObject({ status: "CANCELLED", deletedAt: null });
  });

  it("RESTAURER N'EST PAS RESSUSCITER : une terminée supprimée revient terminée ; la suppression discrète, nouvelle", async () => {
    const id = await enCours("Restaurer");
    await comme("asst");
    expect(err(await finishRequest(form({ id })))).toBeNull();
    expect(err(await deleteRequests(form({ ids: id, reason: "rangement" })))).toBeNull();
    expect(err(await restoreRequest(form({ id })))).toBeNull();
    expect((await statut(id)).status, "la restauration ne remet pas « nouvelle » une demande terminée").toBe("DONE");

    const discrete = await nouvelle("Discrète", false);
    await comme("req");
    expect(err(await deleteOwnRequest(form({ id: discrete })))).toBeNull();
    expect(await statut(discrete)).toMatchObject({ status: "CANCELLED" });
    await comme("asst");
    expect(err(await restoreRequest(form({ id: discrete })))).toBeNull();
    expect(await statut(discrete)).toMatchObject({ status: "NEW", deletedAt: null });
  });

  it("TÉMOIN : la demande se termine PENDANT le changement de statut — le statut ne l'écrase pas", async () => {
    const id = await enCours("Course statut");
    const r = await pendantLaLecture(
      () => changer("asst", id, "BLOCKED", "en attente du transporteur"),
      (tx) => tx.administrativeRequest.update({ where: { id }, data: { status: "DONE", completedAt: new Date() } }));
    expect(err(r)).toBe("Cette demande vient de changer : rouvrez-la pour voir où elle en est.");
    expect((await statut(id)).status, "une demande terminée ne se retrouve pas « bloquée » en douce").toBe("DONE");
  });

  it("TÉMOIN : deux réouvertures à la même seconde — une seule rouvre, un seul message part", async () => {
    const id = await enCours("Course réouverture");
    await comme("asst");
    expect(err(await finishRequest(form({ id })))).toBeNull();
    const r = await pendantLaLecture(
      () => (async () => { await comme("asst"); return rouvrirDemande(form({ id, motif: "second clic" })); })(),
      (tx) => tx.administrativeRequest.update({ where: { id }, data: { status: "IN_PROGRESS", completedAt: null } }));
    expect(err(r)).toMatch(/vient de changer/);
    expect(await prisma.comment.count({ where: { entityType: "ADMIN_REQUEST", entityId: id, body: { startsWith: "Demande rouverte" } } })).toBe(0);
  });
});
