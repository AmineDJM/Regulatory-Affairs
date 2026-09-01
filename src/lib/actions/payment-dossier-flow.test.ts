import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

// Mocks hissés avant l'import du module d'action.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

// Le dépôt de fichier passe par S3 en production. Ici on ne teste PAS le stockage : on teste la
// RÈGLE, et il n'y a que par cette porte qu'une pièce entre. Le faux rend un `documentId` réel.
vi.mock("@/lib/documents", () => ({
  persistUploadedDocument: async () => {
    const doc = await (await import("@/lib/prisma")).prisma.document.create({
      data: { name: "__paytest__piece.pdf", entityType: "PAYMENT_REQUEST", entityId: "x", fileKey: "k", mimeType: "application/pdf", sizeBytes: 10, category: "OTHER", confidentiality: "INTERNAL" },
    });
    return { ok: true, documentId: doc.id };
  },
}));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { createPaymentRequest, submitPaymentRequest, updatePaymentRequestDetails } from "./payment-request-actions";
import { deferExpenseOrder, resumeExpenseOrder, settleExpenseOrder } from "./expense-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__paytest__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/** Un formulaire de demande, avec les pièces qu'on veut lui donner. */
function form(fields: Record<string, string>, pieces: { kind: string }[] = []): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  pieces.forEach((p, i) => {
    fd.append("files", new File(["x"], `piece-${i}.pdf`, { type: "application/pdf" }));
    fd.set(`kind_${i}`, p.kind);
  });
  return fd;
}

/**
 * LA RÈGLE TENUE PAR LES VRAIES ACTIONS — pas par le module pur, qui a ses propres tests.
 *
 * Ce qui se vérifie ici et nulle part ailleurs : que le formulaire réel, l'action réelle et le
 * circuit réel appliquent bien la règle — qu'aucun chemin ne la contourne, et que l'exemption du
 * bon de versement fonctionne AU MOMENT DE LA CRÉATION, là où elle a failli être posée trop tard.
 */
suite("Demande de paiement — le dossier porte sa justification, et le règlement a trois états", () => {
  let requesterId = "", financeId = "";
  const created: string[] = [];

  beforeAll(async () => {
    const mk = (suffix: string, role: SessionUser["role"]) =>
      prisma.user.create({ data: { name: `${TAG}${suffix}`, email: `${TAG}${suffix}@t.dz`, role, passwordHash: "x" } });
    const [req, fin] = await Promise.all([mk("req", "DIRECTION"), mk("fin", "FINANCE_BUDGET_MANAGER")]);
    requesterId = req.id; financeId = fin.id;
  });

  afterAll(async () => {
    await prisma.expenseOrder.deleteMany({ where: { sourceType: "PAYMENT_REQUEST", sourceId: { in: created } } }).catch(() => {});
    await prisma.paymentRequest.deleteMany({ where: { id: { in: created } } }).catch(() => {});
    await prisma.document.deleteMany({ where: { name: `${TAG}piece.pdf` } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("une demande SANS bon de commande ni facture est refusée — un devis ne suffit pas", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form(
      { title: `${TAG} Devis seul`, payee: "Fournisseur X", amount: "120000", paymentMethodStated: "1" },
      [{ kind: "QUOTE" }],
    ));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/BON DE COMMANDE ou une FACTURE/);
  });

  it("une facture SANS la case du moyen de paiement est refusée", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form(
      { title: `${TAG} Sans moyen`, payee: "Fournisseur X", amount: "120000" },
      [{ kind: "INVOICE" }],
    ));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/moyen de paiement/i);
  });

  it("facture + case cochée : la demande part, avec son contact et la nature de son échéance", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form(
      {
        title: `${TAG} Facture agence`, payee: "Agence Y", amount: "300000",
        paymentMethodStated: "1", dueDate: "2027-03-15", deadlineNature: "FIXED",
        contactName: "Mme Belkacem", contactPhone: "0550 00 00 00",
      },
      [{ kind: "INVOICE" }, { kind: "DELIVERY_NOTE" }],
    ));
    expect(r.ok).toBe(true);
    if (!r.id) throw new Error("id manquant");
    created.push(r.id);

    const req = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(req.status).toBe("SUBMITTED");
    expect(req.paymentMethodStated).toBe(true);
    expect(req.deadlineNature).toBe("FIXED");
    expect(req.contactName).toBe("Mme Belkacem");

    // LA NATURE VOYAGE JUSQU'À L'ORDRE : le centre arbitre la date, les Finances classent leur
    // file, et aucun des deux n'a à rouvrir la demande pour l'apprendre.
    const order = await prisma.expenseOrder.findFirstOrThrow({ where: { sourceType: "PAYMENT_REQUEST", sourceId: r.id } });
    expect(order.deadlineNature).toBe("FIXED");
  });

  it("UN BROUILLON s'enregistre vide — il n'engage rien, c'est sa raison d'être", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form({ title: `${TAG} Brouillon`, payee: "Z", amount: "5000", submit: "0" }));
    expect(r.ok).toBe(true);
    if (!r.id) throw new Error("id manquant");
    created.push(r.id);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("DRAFT");

    // …mais il ne se TRANSMET pas tant qu'il lui manque sa pièce : la règle vaut à l'envoi.
    const envoi = await submitPaymentRequest(form({ id: r.id }));
    expect(envoi.ok).toBe(false);
    expect(envoi.error).toMatch(/bon de commande ou la facture/i);
  });

  it("le demandeur peut cocher le moyen de paiement APRÈS COUP — sinon le brouillon est un cul-de-sac", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form(
      { title: `${TAG} Complété ensuite`, payee: "W", amount: "9000", submit: "0" },
      [{ kind: "PURCHASE_ORDER" }],
    ));
    expect(r.ok).toBe(true);
    if (!r.id) throw new Error("id manquant");
    created.push(r.id);

    expect((await submitPaymentRequest(form({ id: r.id }))).ok).toBe(false);
    const maj = await updatePaymentRequestDetails(form({ id: r.id, paymentMethodStated: "1", contactName: "M. Saïd" }));
    expect(maj.ok).toBe(true);
    const envoi = await submitPaymentRequest(form({ id: r.id }));
    expect(envoi.ok).toBe(true);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id } })).contactName).toBe("M. Saïd");
  });

  it("UN BON DE VERSEMENT part SANS pièce — sa quittance n'existe qu'après le versement", async () => {
    // L'exemption tient au RATTACHEMENT, posé à la création. Le poser après coup ferait passer la
    // demande devant une règle qui ne sait pas encore ce qu'elle est, et elle serait refusée.
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form({
      title: `${TAG} Quittance BV`, payee: "Autorités sanitaires", amount: "45000",
      entityType: "MEDICAL_INFO_DECLARATION", entityId: "decl-inexistante-mais-typee",
    }));
    expect(r.ok).toBe(true);
    if (!r.id) throw new Error("id manquant");
    created.push(r.id);
    const req = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: r.id }, include: { pieces: true } });
    expect(req.status).toBe("SUBMITTED");
    expect(req.pieces).toHaveLength(0);
    expect(req.entityType).toBe("MEDICAL_INFO_DECLARATION");
  });

  it("un rattachement INVENTÉ n'ouvre pas l'exemption", async () => {
    ACTOR = await actorFor(requesterId, "DIRECTION");
    const r = await createPaymentRequest(undefined, form({
      title: `${TAG} Faux BV`, payee: "Fournisseur", amount: "45000", entityType: "BON_DE_VERSEMENT",
    }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/bon de commande ou la facture/i);
  });

  describe("au décaissement : payé, reporté à une date, non payé", () => {
    let orderId = "";

    beforeAll(async () => {
      ACTOR = await actorFor(requesterId, "DIRECTION");
      const r = await createPaymentRequest(undefined, form(
        { title: `${TAG} À reporter`, payee: "Fournisseur R", amount: "77000", paymentMethodStated: "1", dueDate: "2027-01-10", deadlineNature: "FIXED" },
        [{ kind: "INVOICE" }],
      ));
      if (!r.ok || !r.id) throw new Error(r.error);
      created.push(r.id);
      const order = await prisma.expenseOrder.findFirstOrThrow({ where: { sourceType: "PAYMENT_REQUEST", sourceId: r.id } });
      orderId = order.id;
    });

    it("reporter une échéance FIXE sans motif est refusé — la trace est le prix du report", async () => {
      ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
      const dans30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const sansMotif = await deferExpenseOrder(form({ id: orderId, until: dans30 }));
      expect(sansMotif.ok).toBe(false);
      expect(sansMotif.error).toMatch(/non négociable/i);
    });

    it("reporter au PASSÉ est refusé — un report au passé ne reporte rien", async () => {
      ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
      const r = await deferExpenseOrder(form({ id: orderId, until: "2020-01-01", reason: "Trésorerie" }));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/à venir/i);
    });

    it("reporté avec motif : la date est posée, l'ordre RESTE à régler (il est daté, pas classé)", async () => {
      ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
      const dans30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const r = await deferExpenseOrder(form({ id: orderId, until: dans30, reason: "Trésorerie insuffisante avant le 25." }));
      expect(r.ok).toBe(true);
      const o = await prisma.expenseOrder.findUniqueOrThrow({ where: { id: orderId } });
      expect(o.deferredUntil).not.toBeNull();
      expect(o.deferredReason).toMatch(/Trésorerie/);
      expect(o.status).toBe("PENDING"); // toujours dû
      expect(o.deferredById).toBe(financeId);
    });

    it("lever le report ramène à « non payé », l'état par défaut", async () => {
      ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
      const r = await resumeExpenseOrder(form({ id: orderId }));
      expect(r.ok).toBe(true);
      const o = await prisma.expenseOrder.findUniqueOrThrow({ where: { id: orderId } });
      expect(o.deferredUntil).toBeNull();
      expect(o.deferredReason).toBeNull();
    });

    it("le règlement reste barré par le CENTRE DE PAIEMENT — reporter n'a rien déverrouillé", async () => {
      // L'ordre naît « en attente d'autorisation » : les trois états du décaissement ne touchent
      // pas au verrou d'amont, et c'est la propriété qui rend la simplification sûre.
      ACTOR = await actorFor(financeId, "FINANCE_BUDGET_MANAGER");
      const r = await settleExpenseOrder(form({ id: orderId }));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/autoris/i);
    });
  });
});
