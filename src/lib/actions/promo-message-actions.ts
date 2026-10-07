"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getAppSettings } from "@/lib/settings";
import { peutEcrireMessagesCockpit } from "@/lib/marketing-cockpit/acces";
import { retraitDuMessage } from "@/lib/marketing-cockpit/calculs";
import { fdStr, fdCase, type ActionResult } from "@/lib/actions/types";

/**
 * LES MESSAGES PRÉ-DÉFINIS DE LA DIRECTION MARKETING — ce que le KAM doit dire au médecin.
 *
 * Le rapport terrain les EXIGE (menu déroulant) : sans référentiel, un message porté sur le
 * terrain n'existait qu'en texte libre, donc personne ne pouvait mesurer lequel passe.
 *
 * ── DEUX CLÉS ───────────────────────────────────────────────────────────────────────────────
 *
 * La LISTE DE RÔLES posée par le Super Admin (`promoMessageAuthorRoles`, par défaut la Direction
 * Marketing — 07/10) ET le geste sur le module du Marketing cockpit, réglable personne par personne
 * (`peutEcrireMessagesCockpit`). Le refus NOMME les deux écrans qui accordent le droit (§118.30).
 */

const PATH = "/marketing-cockpit";

type Geste = "CREATE" | "UPDATE" | "DELETE";

async function porte(geste: Geste): Promise<{ ok: true; user: Awaited<ReturnType<typeof requireUser>> } | { ok: false; error: string }> {
  const user = await requireUser();
  const { promoMessageAuthorRoles } = await getAppSettings();
  if (!peutEcrireMessagesCockpit(user, promoMessageAuthorRoles, geste)) {
    return {
      ok: false,
      error: "L'écriture des messages est réservée aux rôles désignés (Administration › Réglages, « Messages Direction Marketing ») "
        + "qui ont ce geste sur le Marketing cockpit (Administration › Accès).",
    };
  }
  return { ok: true, user };
}

/** Le produit doit exister ; sans produit, le message vaut pour toute la gamme (convention du dépôt : vide = tout). */
async function lirePortee(formData: FormData): Promise<{ ok: true; businessUnitId: string | null; productId: string | null } | { ok: false; error: string }> {
  const businessUnitId = fdStr(formData, "businessUnitId") || null;
  const productId = fdStr(formData, "productId") || null;
  if (businessUnitId) {
    const bu = await prisma.businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true } });
    if (!bu) return { ok: false, error: "Business Unit introuvable." };
  }
  if (productId) {
    const prod = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!prod) return { ok: false, error: "Produit introuvable." };
  }
  return { ok: true, businessUnitId, productId };
}

export async function createPromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte("CREATE");
  if (!p.ok) return { ok: false, error: p.error };
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le message a besoin d'un intitulé — c'est lui que le KAM lit dans son menu déroulant." };
  const portee = await lirePortee(formData);
  if (!portee.ok) return portee;
  const cree = await prisma.promoMessage.create({
    data: {
      title, body: fdStr(formData, "body"), businessUnitId: portee.businessUnitId, productId: portee.productId,
      sortOrder: Number(fdStr(formData, "sortOrder") ?? "0") || 0,
      createdById: p.user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: p.user.id, action: "CREATE", module: "Marketing cockpit",
    summary: `Message Direction Marketing « ${title} »`,
  });
  revalidatePath(PATH);
  return { ok: true, id: cree.id };
}

export async function updatePromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte("UPDATE");
  if (!p.ok) return { ok: false, error: p.error };
  const id = fdStr(formData, "id");
  const title = fdStr(formData, "title");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!title) return { ok: false, error: "Le message a besoin d'un intitulé." };
  const existant = await prisma.promoMessage.findUnique({ where: { id }, select: { id: true } });
  if (!existant) return { ok: false, error: "Message introuvable." };
  const portee = await lirePortee(formData);
  if (!portee.ok) return portee;
  await prisma.promoMessage.update({
    where: { id },
    data: {
      title, body: fdStr(formData, "body"),
      businessUnitId: portee.businessUnitId,
      productId: portee.productId,
      sortOrder: Number(fdStr(formData, "sortOrder") ?? "0") || 0,
      // Le champ ABSENT laisse l'état inchangé ; le témoin caché seul (« off ») désactive ; la case
      // cochée (« off » PUIS « on ») active. `formData.get` rendait le témoin, donc chaque
      // enregistrement désactivait le message — et un message inactif ne se propose plus aux KAM
      // (§118.172). `fdCase` lit TOUTES les valeurs.
      isActive: fdCase(formData, "isActive"),
    },
  });
  await recordAudit({
    actorId: p.user.id, action: "UPDATE", module: "Marketing cockpit",
    summary: `Message Direction Marketing « ${title} »`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * RETIRER UN MESSAGE — ARCHIVER s'il a déjà été porté, supprimer seulement s'il ne l'a jamais été.
 *
 * Les liens message ↔ visite partent en CASCADE à la suppression : effacer un message porté effacerait
 * aussi la trace de ce qui a été dit sur le terrain, et l'efficacité du message disparaîtrait du cockpit.
 * Un message porté s'archive donc (il quitte le menu des KAM, son historique reste) ; un message jamais
 * porté n'a rien à garder et se supprime.
 */
export async function deletePromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte("DELETE");
  if (!p.ok) return { ok: false, error: p.error };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const msg = await prisma.promoMessage.findUnique({
    where: { id },
    select: { title: true, _count: { select: { visitLinks: true } } },
  });
  if (!msg) return { ok: false, error: "Message introuvable." };
  if (retraitDuMessage(msg._count.visitLinks) === "ARCHIVER") {
    await prisma.promoMessage.update({ where: { id }, data: { isActive: false } });
    await recordAudit({
      actorId: p.user.id, action: "UPDATE", module: "Marketing cockpit",
      summary: `Message « ${msg.title} » archivé — porté sur ${msg._count.visitLinks} visite(s), son historique reste`,
    });
  } else {
    await prisma.promoMessage.delete({ where: { id } });
    await recordAudit({
      actorId: p.user.id, action: "DELETE", module: "Marketing cockpit",
      summary: `Message « ${msg.title} » supprimé — jamais porté`,
    });
  }
  revalidatePath(PATH);
  return { ok: true };
}
