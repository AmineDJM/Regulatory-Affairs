"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { generateDocument, type GenerateResult } from "./generate";

/**
 * Génération documentaire (G10) — à la demande, données du jumeau APPROUVÉ. Vérifie rôle +
 * appartenance du dossier au périmètre de l'organisation.
 */

const str = (fd: FormData, k: string) => { const v = fd.get(k); return v ? String(v).trim() : null; };

async function scopeCompanyId(): Promise<string | null> {
  return resolveRegCompanyId(getCompanyScope());
}

export async function generateDocumentAction(formData: FormData): Promise<GenerateResult> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.dossier.analyse") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const dossierId = str(formData, "dossierId");
  const templateCode = str(formData, "templateCode");
  if (!dossierId || !templateCode) return { ok: false, error: "Paramètres manquants." };

  const companyId = await scopeCompanyId();
  if (!companyId) return { ok: false, error: "Module non activé." };
  const version = await prisma.regulatoryDossierVersion.findFirst({
    where: { dossierId, dossier: { companyId } }, orderBy: { versionNo: "desc" }, select: { id: true },
  });
  if (!version) return { ok: false, error: "Aucune version." };

  const r = await generateDocument({ dossierVersionId: version.id, templateCode, actorId: user.id });
  if (r.ok) revalidatePath(`/regulatory/enregistrement/analyse/${dossierId}`);
  return r;
}
