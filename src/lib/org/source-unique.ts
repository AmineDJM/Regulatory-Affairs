import { prisma } from "@/lib/prisma";

/**
 * L'ORGANIGRAMME, SEULE SOURCE — L'ÉCRITURE QUI SUIT (Direction, 10/2026).
 *
 * Le département d'une personne se règle sur sa FICHE SALARIÉ (`Employee.departmentId`). Deux copies en dérivent et ne
 * se saisissent plus : le libellé texte de la fiche (`Employee.department`) et le département du compte applicatif
 * (`User.departmentId`, colonne gardée pour compatibilité). Chaque geste qui change un rattachement passe par ici.
 */

/** Aligne le libellé texte ET le compte lié sur le département structuré de la fiche. Ne lève jamais. */
export async function alignerSurLaFiche(employeeId: string, ancienUserId?: string | null): Promise<void> {
  try {
    const e = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true, departmentId: true, department: true, departmentRef: { select: { name: true } }, user: { select: { departmentId: true } } },
    });
    if (!e) return;
    const libelle = e.departmentRef?.name ?? null;
    if (e.departmentId && e.department !== libelle) {
      await prisma.employee.update({ where: { id: employeeId }, data: { department: libelle } });
    }
    if (e.userId && e.user && e.user.departmentId !== e.departmentId) {
      await prisma.user.update({ where: { id: e.userId }, data: { departmentId: e.departmentId } });
    }
    // Un compte DÉLIÉ de la fiche ne garde pas un département qu'il ne tient plus de personne.
    if (ancienUserId && ancienUserId !== e.userId) {
      await prisma.user.updateMany({ where: { id: ancienUserId }, data: { departmentId: null } });
    }
  } catch (err) {
    console.error("[org] alignement sur la fiche impossible", employeeId, err);
  }
}

/** Le libellé de tous les membres d'un département renommé. */
export async function alignerLibellesDuDepartement(departmentId: string): Promise<void> {
  const d = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  if (!d) return;
  await prisma.employee.updateMany({ where: { departmentId, NOT: { department: d.name } }, data: { department: d.name } });
  await prisma.employee.updateMany({ where: { departmentId, department: null }, data: { department: d.name } });
}

/** Tous les comptes alignés sur leur fiche — le rattrapage d'un clic du contrôle de cohérence. Rend le nombre corrigé. */
export async function alignerTousLesComptes(): Promise<number> {
  const fiches = await prisma.employee.findMany({
    where: { userId: { not: null } },
    select: { userId: true, departmentId: true, user: { select: { departmentId: true } } },
  });
  let n = 0;
  for (const f of fiches) {
    if (!f.userId || f.user?.departmentId === f.departmentId) continue;
    await prisma.user.update({ where: { id: f.userId }, data: { departmentId: f.departmentId } });
    n++;
  }
  return n;
}
