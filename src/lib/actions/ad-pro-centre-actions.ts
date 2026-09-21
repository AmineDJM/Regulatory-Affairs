"use server";

import type { EntityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { siegeAuCentreAdPro, REFUS_CENTRE_AD_PRO } from "@/lib/ad-pro/centre";
import { AD_PRO_ENTITY_TYPE, AD_PRO_KINDS, type AdProKind } from "@/lib/ad-pro/unified";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉCISION DU CENTRE DE VALIDATION AD & PRO — sur les natures qui passent par un VISA.
 *
 * Les cinq natures qui portent une étape de circuit se décident par l'action de LEUR circuit,
 * depuis leur fiche : le centre les liste et y renvoie. Ce n'est pas une facilité, c'est la
 * règle §104.7 — arbitrer 1,2 M DZD depuis une ligne de liste, sans les pièces, sans la
 * catégorie budgétaire, sans le fil des avis, c'est valider en regardant autre chose. Le centre
 * dit CE QUI attend et POURQUOI ; la décision se prend devant le dossier.
 *
 * Ici on tranche le VISA, et lui seul : pour le consulting et les « autres demandes », le visa
 * EST la porte — il n'y a pas d'étape de circuit à franchir ailleurs.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** entityType → nature, dérivé du registre canonique (une table à la main divergerait, §118.73). */
const NATURE_PAR_ENTITE = new Map<string, AdProKind>(
  (Object.entries(AD_PRO_ENTITY_TYPE) as [AdProKind, EntityType][]).map(([k, e]) => [e, k]),
);
const HREF = new Map<AdProKind, string>(AD_PRO_KINDS.map((k) => [k.kind, k.href]));

export async function deciderVisaCentreAdPro(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!siegeAuCentreAdPro(user)) return { ok: false, error: REFUS_CENTRE_AD_PRO };

    const entityType = fdStr(formData, "entityType") as EntityType | "";
    const entityId = fdStr(formData, "entityId");
    const approuve = fdStr(formData, "approve") === "1";
    const note = fdStr(formData, "note");
    if (!entityType || !entityId) return { ok: false, error: "Demande introuvable." };

    const visa = await prisma.adProGateVisa.findUnique({
      where: { entityType_entityId: { entityType: entityType as EntityType, entityId } },
    });
    if (!visa) return { ok: false, error: "Cette demande n'attend pas l'arbitrage du centre." };
    // Une décision déjà prise ne se rejoue pas : un second clic ne doit pas transformer un refus
    // en accord, et deux arbitrages sur le même dossier n'ont aucune façon de se départager.
    if (visa.status !== "PENDING") {
      return { ok: false, error: "Cette demande a déjà été tranchée par le centre." };
    }
    // UN REFUS SANS MOTIF EST UNE IMPASSE pour le demandeur : il apprend que c'est non et n'a
    // rien à corriger. L'accord, lui, n'a rien à expliquer.
    if (!approuve && !note) {
      return { ok: false, error: "Indiquez le motif du refus : sans lui, le demandeur ne sait pas quoi corriger." };
    }

    await prisma.adProGateVisa.update({
      where: { id: visa.id },
      data: { status: approuve ? "APPROVED" : "REFUSED", decidedById: user.id, decidedAt: new Date(), note },
    });

    const kind = NATURE_PAR_ENTITE.get(entityType);
    const lien = kind ? `${HREF.get(kind) ?? "/ad-pro"}/${entityId}` : "/ad-pro";
    const montant = visa.amount == null ? "montant non renseigné" : `${Number(visa.amount).toLocaleString("fr-FR")} DZD`;

    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Centre de validation Ad & Pro",
      entityType: entityType as EntityType, entityId,
      summary: approuve
        ? `Centre Ad & Pro : demande AUTORISÉE au-delà du seuil (${montant})`
        : `Centre Ad & Pro : demande REFUSÉE au-delà du seuil (${montant}) — ${note}`,
    });

    // LE DEMANDEUR EST PRÉVENU — sans quoi son dossier repart ou s'arrête sans qu'il sache
    // pourquoi. `requesterId` se relit sur la nature : le visa ne le porte pas, et l'y recopier
    // ferait une seconde vérité sur qui a demandé (§118.5).
    const demandeur = await lireDemandeur(entityType as EntityType, entityId);
    if (demandeur) {
      await notifyUser({
        userId: demandeur,
        // `SPONSORING_VALIDATION` est le type du vocabulaire canonique qui désigne une décision
        // Ad & Pro (l'enum ne porte pas d'APPROVED/REJECTED distincts, et en ajouter deux pour
        // une nuance que le TITRE porte déjà serait une migration d'enum pour rien).
        type: "SPONSORING_VALIDATION",
        title: approuve ? "Centre Ad & Pro : votre demande est autorisée" : "Centre Ad & Pro : votre demande est refusée",
        body: approuve
          ? "Le centre de validation a autorisé le dépassement du seuil. Le circuit reprend son cours."
          : `Motif : ${note}`,
        link: lien,
      });
    }

    revalidatePath("/centre-ad-pro");
    revalidatePath(lien);
    return { ok: true, id: entityId };
  } catch (err) {
    console.error("[centre-ad-pro] deciderVisaCentreAdPro failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

async function lireDemandeur(entityType: EntityType, entityId: string): Promise<string | null> {
  if (entityType === "CONSULTING_CONTRACT") {
    const c = await prisma.consultingContract
      .findUnique({ where: { id: entityId }, select: { requesterId: true } }).catch(() => null);
    return c?.requesterId ?? null;
  }
  if (entityType === "AD_PRO_OTHER") {
    const o = await prisma.adProOtherRequest
      .findUnique({ where: { id: entityId }, select: { requesterId: true } }).catch(() => null);
    return o?.requesterId ?? null;
  }
  // Une nature qui n'a PAS de visa n'a pas à passer par ici : on ne devine pas son porteur.
  return null;
}
