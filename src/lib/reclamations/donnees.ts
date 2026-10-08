import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { clauseReclamationsVisibles, lecteurReclamation } from "./acces";
import { estStatutReclamation, estTypeReclamation, lecteurDeLaReclamation } from "./regles";

/** RETOURS & RÉCLAMATIONS — les lectures de l'écran (liste filtrée, fiche). La règle de lecture est celle de `acces.ts`. */

export interface FiltresReclamations { bu: string; type: string; statut: string; produit: string }

export interface LigneReclamation {
  id: string;
  reference: string;
  type: string;
  status: string;
  productLabel: string;
  buNom: string | null;
  lot: string | null;
  quantity: number | null;
  lieu: string;
  declarant: string;
  responsable: string | null;
  createdAt: string;
}

export async function listerReclamations(user: SessionUser, f: FiltresReclamations): Promise<LigneReclamation[]> {
  const et: Prisma.ReclamationWhereInput[] = [clauseReclamationsVisibles(user)];
  if (f.bu) et.push({ businessUnitId: f.bu });
  if (estTypeReclamation(f.type)) et.push({ type: f.type });
  if (estStatutReclamation(f.statut)) et.push({ status: f.statut });
  if (f.produit) et.push({ productLabel: { contains: f.produit, mode: "insensitive" } });
  const rows = await prisma.reclamation.findMany({ where: { AND: et }, orderBy: { createdAt: "desc" }, take: 300 });
  const ids = [...new Set(rows.flatMap((r) => [r.declaredById, r.ownerId]).filter((x): x is string => Boolean(x)))];
  const buIds = [...new Set(rows.map((r) => r.businessUnitId).filter((x): x is string => Boolean(x)))];
  const [users, bus] = await Promise.all([
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [],
    buIds.length ? prisma.businessUnit.findMany({ where: { id: { in: buIds } }, select: { id: true, name: true } }) : [],
  ]);
  const nom = new Map(users.map((u) => [u.id, u.name]));
  const buNom = new Map(bus.map((b) => [b.id, b.name]));
  return rows.map((r) => ({
    id: r.id, reference: r.reference, type: r.type, status: r.status, productLabel: r.productLabel,
    buNom: r.businessUnitId ? buNom.get(r.businessUnitId) ?? null : null, lot: r.lot, quantity: r.quantity,
    lieu: [r.institutionName, r.pchSite].filter(Boolean).join(" · ") || "—",
    declarant: nom.get(r.declaredById) ?? "—", responsable: r.ownerId ? nom.get(r.ownerId) ?? null : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Les compteurs par statut, dans la portée de la personne. */
export async function compteursReclamations(user: SessionUser): Promise<Record<string, number>> {
  const g = await prisma.reclamation.groupBy({ by: ["status"], where: clauseReclamationsVisibles(user), _count: { _all: true } });
  return Object.fromEntries(g.map((x) => [x.status, x._count._all]));
}

/** La fiche — `null` si elle n'existe pas OU que la personne ne la lit pas. */
export async function lireReclamation(user: SessionUser, id: string) {
  const r = await prisma.reclamation.findUnique({ where: { id } });
  if (!r || !lecteurDeLaReclamation(lecteurReclamation(user), r)) return null;
  const ids = [r.declaredById, r.ownerId, r.closedById].filter((x): x is string => Boolean(x));
  const [personnes, bu, pv, docs, fil] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    r.businessUnitId ? prisma.businessUnit.findUnique({ where: { id: r.businessUnitId }, select: { name: true } }) : null,
    r.pvCaseId ? prisma.pharmacovigilanceCase.findUnique({ where: { id: r.pvCaseId }, select: { id: true, reference: true } }) : null,
    prisma.document.findMany({ where: { entityType: "RECLAMATION", entityId: r.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.comment.findMany({ where: { entityType: "RECLAMATION", entityId: r.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const nom = (uid: string | null) => (uid ? personnes.find((p) => p.id === uid)?.name ?? "—" : null);
  return { r, bu: bu?.name ?? null, pv, docs, fil, nom };
}
