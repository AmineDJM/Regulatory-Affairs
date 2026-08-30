"use server";

import { revalidatePath } from "next/cache";
import type { RegulatoryDossierStepKind } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import {
  planInsertion, validateStep, canRemove, describeStep, defaultLabel,
  type DossierStepKind,
} from "@/lib/regulatory/dossier-timeline";

/**
 * LA FRISE DU DOSSIER — écritures.
 *
 * Les RÈGLES vivent dans `lib/regulatory/dossier-timeline.ts` (module pur, testé) ; ce fichier
 * ne fait que les servir et **journaliser**. Chaque geste laisse une trace nommée : dans un
 * dossier réglementaire, « qui a ajouté cette version, et quand » est exactement ce qu'on vient
 * chercher deux ans plus tard, quand l'agence pose une question sur un cycle oublié.
 */

const PATH = (id: string) => `/regulatory/${id}`;

/** Droit d'écrire dans la frise : celui de mettre à jour le dossier, revérifié sur la ligne. */
async function guard(productId: string, action: "UPDATE" | "VIEW" = "UPDATE") {
  const user = await requireUser();
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, action))) {
    return { user: null, error: "Dossier introuvable ou hors de votre périmètre." } as const;
  }
  if (action === "UPDATE" && !userCan(user, "REGULATORY", "UPDATE")) {
    return { user: null, error: "Vous n'êtes pas autorisé à modifier ce dossier." } as const;
  }
  return { user, error: null } as const;
}

/**
 * LE POINT DE DÉPART — le CTD initial, créé une seule fois.
 *
 * La frise commence toujours par lui : « version 3 » ne veut rien dire si l'on ignore de quoi
 * elle est la troisième. L'unicité est tenue par un index unique PARTIEL en base (voir la
 * migration) — deux onglets ouverts ne peuvent pas créer deux origines ; si la course a lieu,
 * on relit celle qui a gagné plutôt que d'échouer.
 */
async function ensureInitialStep(productId: string, actorId: string) {
  const existing = await prisma.regulatoryDossierStep.findFirst({
    where: { productId, kind: "CTD_INITIAL" },
  });
  if (existing) return existing;
  try {
    const created = await prisma.regulatoryDossierStep.create({
      data: {
        productId, kind: "CTD_INITIAL", label: defaultLabel("CTD_INITIAL"),
        order: 0, createdById: actorId,
      },
    });
    await recordAudit({
      actorId, action: "CREATE", module: "Regulatory",
      entityType: "REGULATORY_PRODUCT", entityId: productId,
      summary: "Frise du dossier ouverte — CTD initial",
    });
    return created;
  } catch {
    // L'index unique a tranché : une autre requête vient de créer l'origine.
    return prisma.regulatoryDossierStep.findFirst({ where: { productId, kind: "CTD_INITIAL" } });
  }
}

/** Ouvre la frise d'un dossier (bouton « Démarrer la frise »). Idempotent. */
export async function startDossierTimeline(formData: FormData): Promise<ActionResult> {
  const productId = fdStr(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  const g = await guard(productId);
  if (!g.user) return { ok: false, error: g.error };

  const step = await ensureInitialStep(productId, g.user.id);
  revalidatePath(PATH(productId));
  return { ok: true, id: step?.id };
}

/**
 * AJOUTER UNE ÉTAPE, juste après celle sous laquelle on a cliqué.
 *
 * `afterId` porte la place exacte : c'est ce qui distingue « une réponse à CES réserves-là » de
 * « une réponse, quelque part ». Sans lui, l'étape rejoint la fin — le cas courant.
 */
export async function addDossierStep(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const productId = fdStr(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  const g = await guard(productId);
  if (!g.user) return { ok: false, error: g.error };

  const kind = (fdStr(formData, "kind") ?? "") as DossierStepKind;
  const version = fdNum(formData, "version");
  const label = (fdStr(formData, "label") ?? defaultLabel(kind, version)).trim();

  const manque = validateStep({ kind, label, version });
  if (manque) return { ok: false, error: manque };

  // L'origine existe toujours AVANT toute autre étape — même si personne ne l'a créée
  // explicitement : on ouvre la frise plutôt que de refuser un ajout légitime.
  await ensureInitialStep(productId, g.user.id);

  const steps = await prisma.regulatoryDossierStep.findMany({
    where: { productId },
    select: { id: true, kind: true, label: true, version: true, order: true },
  });
  const { order, shift } = planInsertion(
    steps.map((s) => ({ ...s, kind: s.kind as DossierStepKind })),
    fdStr(formData, "afterId"),
  );

  const created = await prisma.$transaction(async (tx) => {
    // On décale du PLUS GRAND rang au plus petit : l'inverse ferait passer deux étapes par le
    // même rang au milieu de la transaction, ce qu'un index unique refuserait un jour.
    for (const s of [...shift].sort((a, b) => b.order - a.order)) {
      await tx.regulatoryDossierStep.update({ where: { id: s.id }, data: { order: s.order } });
    }
    return tx.regulatoryDossierStep.create({
      data: {
        productId,
        kind: kind as RegulatoryDossierStepKind,
        label,
        version: kind === "CTD_VERSION" ? version : null,
        order,
        occurredAt: fdDate(formData, "occurredAt"),
        note: fdStr(formData, "note"),
        createdById: g.user!.id,
      },
    });
  });

  await recordAudit({
    actorId: g.user.id, action: "CREATE", module: "Regulatory",
    entityType: "REGULATORY_PRODUCT", entityId: productId,
    summary: `Frise — étape ajoutée : ${describeStep({ kind, label, version })}`,
  });
  revalidatePath(PATH(productId));
  return { ok: true, id: created.id };
}

/** RENOMMER une étape (et corriger sa date ou sa note). Le type, lui, ne change pas :
 *  transformer des réserves en version du CTD réécrirait l'histoire plutôt que la corriger. */
export async function updateDossierStep(formData: FormData): Promise<ActionResult> {
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Étape introuvable." };
  const step = await prisma.regulatoryDossierStep.findUnique({ where: { id } });
  if (!step) return { ok: false, error: "Étape introuvable." };
  const g = await guard(step.productId);
  if (!g.user) return { ok: false, error: g.error };

  const label = (fdStr(formData, "label") ?? "").trim();
  if (!label) return { ok: false, error: "Le nom de l'étape ne peut pas être vide." };

  await prisma.regulatoryDossierStep.update({
    where: { id },
    data: {
      label,
      occurredAt: fdDate(formData, "occurredAt"),
      note: fdStr(formData, "note"),
    },
  });
  await recordAudit({
    actorId: g.user.id, action: "UPDATE", module: "Regulatory",
    entityType: "REGULATORY_PRODUCT", entityId: step.productId,
    field: "frise", oldValue: step.label, newValue: label,
    summary: `Frise — étape renommée : « ${step.label} » → « ${label} »`,
  });
  revalidatePath(PATH(step.productId));
  return { ok: true };
}

/**
 * SUPPRIMER une étape. Refusée sur l'origine, et refusée tant qu'elle porte des pièces :
 * effacer des documents depuis un bouton « supprimer l'étape » ferait disparaître en silence
 * des fichiers que personne ne cherchait à jeter.
 */
export async function deleteDossierStep(formData: FormData): Promise<ActionResult> {
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Étape introuvable." };
  const step = await prisma.regulatoryDossierStep.findUnique({ where: { id } });
  if (!step) return { ok: false, error: "Étape introuvable." };
  const g = await guard(step.productId);
  if (!g.user) return { ok: false, error: g.error };

  const pieces = await prisma.document.count({
    where: { entityType: "REGULATORY_PRODUCT", entityId: step.productId, stepKey: id },
  });
  const verdict = canRemove({ kind: step.kind as DossierStepKind }, pieces);
  if (!verdict.ok) return { ok: false, error: verdict.reason };

  await prisma.regulatoryDossierStep.delete({ where: { id } });
  await recordAudit({
    actorId: g.user.id, action: "DELETE", module: "Regulatory",
    entityType: "REGULATORY_PRODUCT", entityId: step.productId,
    summary: `Frise — étape supprimée : ${describeStep({ kind: step.kind as DossierStepKind, label: step.label, version: step.version })}`,
  });
  revalidatePath(PATH(step.productId));
  return { ok: true };
}
