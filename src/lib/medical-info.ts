import type { EntityType } from "@prisma/client";
import { prisma } from "./prisma";
import { anyRoleFilter } from "./rbac";
import { notifyRoles } from "./notify";

export async function nextDeclarationRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.medicalInfoDeclaration.count({ where: { reference: { startsWith: `DIM-${year}-` } } });
  return `DIM-${year}-${String(count + 1).padStart(3, "0")}`;
}

interface CreateDeclarationInput {
  sourceType: EntityType; // SPONSORING | CONGRESS_INTERNATIONAL | CONGRESS_NATIONAL
  sourceId: string;
  label: string;
  beneficiary?: string | null;
  amount?: number | null;
  requesterId?: string | null;
  /** (Sous-)catégorie budgétaire choisie par la Direction à la validation définitive. */
  budgetCategoryId?: string | null;
}

/**
 * Intercale l'étape « information médicale » juste après la validation définitive de
 * la Direction. Crée (idempotent) la déclaration et notifie le pharmacien responsable.
 * L'ordre de dépense ne sera émis qu'une fois la déclaration validée par le pharmacien
 * (voir `validateDeclaration`).
 */
export async function createMedicalInfoDeclaration(input: CreateDeclarationInput) {
  // Une seule déclaration par événement source (clé unique sourceType+sourceId).
  const existing = await prisma.medicalInfoDeclaration.findUnique({
    where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
  });
  if (existing) return existing;

  // Assignation par défaut au premier pharmacien responsable actif (le cas échéant),
  // que le rôle soit porté en principal OU en secondaire.
  const pharmacist = await prisma.user.findFirst({
    where: { ...anyRoleFilter(["MEDICAL_INFO_PHARMACIST"]), isActive: true },
    select: { id: true },
  });

  const decl = await prisma.medicalInfoDeclaration.create({
    data: {
      reference: await nextDeclarationRef(),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      label: input.label,
      beneficiary: input.beneficiary ?? null,
      amount: input.amount ?? null,
      requesterId: input.requesterId ?? null,
      budgetCategoryId: input.budgetCategoryId ?? null,
      pharmacistId: pharmacist?.id ?? null,
    },
  });

  await notifyRoles(["MEDICAL_INFO_PHARMACIST", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: "Information médicale — événement à déclarer",
    body: `${decl.reference} — ${input.label}`,
    link: `/information-medicale/${decl.id}`,
  });
  return decl;
}
