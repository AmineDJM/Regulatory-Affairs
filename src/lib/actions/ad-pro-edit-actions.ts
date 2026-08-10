"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type Module } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  canEditAdProRequest, isAdProDecided, editableField, describeChanges,
  type AdProKind,
} from "@/lib/ad-pro-edit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * MODIFICATION D'UNE DEMANDE AD & PRO (sponsoring, prise en charge nationale/internationale).
 *
 * Le point d'entrée est unique pour les trois modules : la règle « ce qui a fondé une décision
 * ne se réécrit pas » ne doit exister qu'à un seul endroit. Ce qui varie d'un module à l'autre
 * (table, module RBAC, chemin, statut) tient dans la table `TARGETS` ci-dessous — ajouter un
 * type de demande, c'est ajouter une ligne, pas dupliquer la garde.
 *
 * Les décisions (montant accordé, statut, chef de produit, avis, motifs) ne passent JAMAIS par
 * ici : elles appartiennent au circuit, et la liste blanche de `ad-pro-edit.ts` les exclut.
 */

interface Target {
  module: Module;
  path: string;
  /** Colonne portant le statut de la demande (pour décider si elle est tranchée). */
  statusField: "status" | "requestStatus";
  load: (id: string) => Promise<Record<string, unknown> | null>;
  save: (id: string, data: Record<string, unknown>) => Promise<unknown>;
}

const TARGETS: Record<AdProKind, Target> = {
  SPONSORING: {
    module: "SPONSORING",
    path: "/sponsoring",
    statusField: "status",
    load: (id) => prisma.sponsoringRequest.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>,
    save: (id, data) => prisma.sponsoringRequest.update({ where: { id }, data }),
  },
  CONGRESS_NATIONAL: {
    module: "CONGRESS_NATIONAL",
    path: "/congress-national",
    statusField: "requestStatus",
    load: (id) => prisma.congressNational.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>,
    save: (id, data) => prisma.congressNational.update({ where: { id }, data }),
  },
  CONGRESS_INTERNATIONAL: {
    module: "CONGRESS_INTERNATIONAL",
    path: "/congress-international",
    statusField: "requestStatus",
    load: (id) => prisma.congressInternational.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>,
    save: (id, data) => prisma.congressInternational.update({ where: { id }, data }),
  },
  PROMO_MATERIAL: {
    module: "PROMO_MATERIAL",
    path: "/promo-material",
    statusField: "status",
    load: (id) => prisma.promoMaterial.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>,
    save: (id, data) => prisma.promoMaterial.update({ where: { id }, data }),
  },
  EVENT: {
    module: "EVENTS",
    path: "/events",
    // Un événement peut vivre SANS demande de financement : son statut de demande est alors
    // nul, et c'est le demandeur/la Direction qui gouverne la correction.
    statusField: "requestStatus",
    load: (id) => prisma.event.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>,
    save: (id, data) => prisma.event.update({ where: { id }, data }),
  },
};

function isKind(v: string | null): v is AdProKind {
  return v === "SPONSORING" || v === "CONGRESS_NATIONAL" || v === "CONGRESS_INTERNATIONAL" || v === "PROMO_MATERIAL" || v === "EVENT";
}

export async function updateAdProRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const kind = fdStr(formData, "kind");
  const id = fdStr(formData, "id");
  if (!isKind(kind) || !id) return { ok: false, error: "Paramètres manquants." };

  const target = TARGETS[kind];
  if (!userCan(user, target.module, "VIEW")) return { ok: false, error: "Non autorisé." };

  const before = await target.load(id);
  if (!before) return { ok: false, error: "Demande introuvable." };

  const decided = isAdProDecided(kind, String(before[target.statusField] ?? ""));
  const allowed = canEditAdProRequest(
    { id: user.id, hasGlobalView: hasGlobalView(user), canUpdate: userCan(user, target.module, "UPDATE") },
    { requesterId: (before.requesterId as string | null) ?? null, decided },
  );
  if (!allowed) {
    return {
      ok: false,
      error: decided
        ? "La décision est rendue : seule la Direction peut encore corriger cette demande."
        : "Vous n'avez pas le droit de modifier cette demande.",
    };
  }

  // On ne lit QUE les champs de la liste blanche, et seulement ceux réellement soumis : un
  // champ absent du formulaire n'est pas un effacement.
  const data: Record<string, unknown> = {};
  for (const [key, raw] of formData.entries()) {
    const field = editableField(kind, key);
    if (!field || typeof raw !== "string") continue;
    const v = raw.trim();
    if (field.type === "number") {
      if (!v) { data[key] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: `« ${field.label} » doit être un montant positif.` };
      data[key] = n;
    } else if (field.type === "date") {
      if (!v) { data[key] = null; continue; }
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `« ${field.label} » n'est pas une date valide.` };
      data[key] = d;
    } else {
      data[key] = v || null;
    }
  }
  if (Object.keys(data).length === 0) return { ok: false, error: "Aucune modification." };

  // Un champ obligatoire ne se vide pas par une modification : le premier champ de chaque
  // liste blanche est l'intitulé de la demande, et une demande sans intitulé n'est plus
  // consultable nulle part.
  const titleKey = kind === "SPONSORING" ? "institution" : "name";
  if (titleKey in data && !data[titleKey]) {
    return { ok: false, error: kind === "SPONSORING" ? "L'institution est obligatoire." : "Le nom de l'événement est obligatoire." };
  }

  const changes = describeChanges(kind, before, data);
  if (changes.length === 0) return { ok: true, id }; // rien n'a bougé — inutile d'écrire ni de tracer

  await target.save(id, { ...data, updatedById: user.id });
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Ad & Pro",
    entityType: kind,
    entityId: id,
    summary: `Demande modifiée${decided ? " APRÈS DÉCISION" : ""} — ${changes.join(" · ")}`,
  });

  revalidatePath(target.path);
  revalidatePath(`${target.path}/${id}`);
  return { ok: true, id };
}
