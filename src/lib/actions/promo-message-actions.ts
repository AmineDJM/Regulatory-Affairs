"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getAppSettings } from "@/lib/settings";
import { peutEcrireMessagesPromo } from "@/lib/sfe/tournee";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LES MESSAGES PRÉ-DÉFINIS DE LA DIRECTION MARKETING — ce que le KAM doit dire au médecin.
 *
 * Le rapport terrain les EXIGE (menu déroulant) : sans référentiel, un message porté sur le
 * terrain n'existait qu'en texte libre, donc personne ne pouvait mesurer lequel passe.
 *
 * ── LA PORTE N'EST PAS UN DROIT DE MODULE ───────────────────────────────────────────────────
 *
 * Elle est une LISTE DE RÔLES posée par le Super Admin (`promoMessageAuthorRoles`) : Direction
 * Marketing n'a que la LECTURE sur `MEDICAL`, et lui donner l'écriture du module lui ouvrirait
 * aussi les praticiens et les visites (§118.16). Le refus NOMME l'écran qui accorde le droit —
 * un refus qui ne dit pas le remède fait payer un aller-retour (§118.30).
 */

const PATH = "/planning/messages";

async function porte(): Promise<{ ok: true; user: Awaited<ReturnType<typeof requireUser>> } | { ok: false; error: string }> {
  const user = await requireUser();
  const { promoMessageAuthorRoles } = await getAppSettings();
  if (!peutEcrireMessagesPromo(user, promoMessageAuthorRoles)) {
    return {
      ok: false,
      error: "L'écriture des messages pré-définis est réservée au Super Admin et aux rôles qu'il a désignés. "
        + "Le droit s'accorde dans Administration › Réglages (« Messages Direction Marketing »).",
    };
  }
  return { ok: true, user };
}

export async function createPromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte();
  if (!p.ok) return { ok: false, error: p.error };
  const title = fdStr(formData, "title");
  if (!title) return { ok: false, error: "Le message a besoin d'un intitulé — c'est lui que le KAM lit dans son menu déroulant." };
  // LA PORTÉE SUIT LA CONVENTION DU DÉPÔT : vide = ouvert à toutes les gammes / tous les
  // produits. En inventer une autre ici ferait deux façons de dire « pour tout le monde ».
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
  const cree = await prisma.promoMessage.create({
    data: {
      title, body: fdStr(formData, "body"), businessUnitId, productId,
      sortOrder: Number(fdStr(formData, "sortOrder") ?? "0") || 0,
      createdById: p.user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: p.user.id, action: "CREATE", module: "Force de vente",
    summary: `Message Direction Marketing « ${title} »`,
  });
  revalidatePath(PATH);
  return { ok: true, id: cree.id };
}

export async function updatePromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte();
  if (!p.ok) return { ok: false, error: p.error };
  const id = fdStr(formData, "id");
  const title = fdStr(formData, "title");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!title) return { ok: false, error: "Le message a besoin d'un intitulé." };
  const existant = await prisma.promoMessage.findUnique({ where: { id }, select: { id: true } });
  if (!existant) return { ok: false, error: "Message introuvable." };
  await prisma.promoMessage.update({
    where: { id },
    data: {
      title, body: fdStr(formData, "body"),
      businessUnitId: fdStr(formData, "businessUnitId") || null,
      productId: fdStr(formData, "productId") || null,
      sortOrder: Number(fdStr(formData, "sortOrder") ?? "0") || 0,
      // Le champ ABSENT laisse l'état inchangé ; « off » désactive. C'est la convention des
      // cases à cocher du dépôt, et elle exige le témoin caché côté écran.
      isActive: formData.get("isActive") === "on" ? true : formData.get("isActive") === "off" ? false : undefined,
    },
  });
  await recordAudit({
    actorId: p.user.id, action: "UPDATE", module: "Force de vente",
    summary: `Message Direction Marketing « ${title} »`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * RETIRER UN MESSAGE.
 *
 * Les liens vers les visites qui l'ont porté partent en cascade — mais les VISITES restent, et
 * leur compte rendu aussi. On retire une consigne du catalogue, pas l'historique de ce qui a été
 * dit sur le terrain. Le compte des visites concernées est écrit à l'audit : c'est la
 * conséquence, pas la ligne supprimée.
 */
export async function deletePromoMessage(formData: FormData): Promise<ActionResult> {
  const p = await porte();
  if (!p.ok) return { ok: false, error: p.error };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const msg = await prisma.promoMessage.findUnique({
    where: { id },
    select: { title: true, _count: { select: { visitLinks: true } } },
  });
  if (!msg) return { ok: false, error: "Message introuvable." };
  await prisma.promoMessage.delete({ where: { id } });
  await recordAudit({
    actorId: p.user.id, action: "DELETE", module: "Force de vente",
    summary: `Message « ${msg.title} » retiré — il figurait sur ${msg._count.visitLinks} rapport(s) terrain, qui restent intacts`,
  });
  revalidatePath(PATH);
  return { ok: true };
}
