import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Journal d'audit, **à la demande** et **paginé** (curseur). Évite de charger des
 * centaines de lignes au rendu de la page d'administration (UI plus légère/rapide).
 * Réservé à qui peut voir l'administration (ADMIN/VIEW).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "ADMIN", "VIEW")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const TAKE = 50;
  const logs = await prisma.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: TAKE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { name: true } } },
  });

  const hasMore = logs.length > TAKE;
  const page = logs.slice(0, TAKE);
  const rows = page.map((l) => ({
    id: l.id, createdAt: l.createdAt.toISOString(), actor: l.actor?.name ?? "Système",
    action: l.action, module: l.module, summary: l.summary ?? "",
    field: l.field ?? "", oldValue: l.oldValue ?? "", newValue: l.newValue ?? "",
  }));
  return NextResponse.json({ rows, nextCursor: hasMore ? page[page.length - 1].id : null });
}
