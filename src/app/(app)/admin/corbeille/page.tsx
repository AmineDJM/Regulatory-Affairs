import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TrashList, type TrashItem } from "./trash-list";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

/** Corbeille des suppressions définitives — Super Admin uniquement. */
export default async function CorbeillePage() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const rows = await prisma.deletedRecord.findMany({
    where: { purgedAt: null },
    orderBy: { deletedAt: "desc" },
    take: 200,
  });
  const actorIds = [...new Set(rows.map((r) => r.deletedById).filter((v): v is string => Boolean(v)))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(actors.map((a) => [a.id, a.name]));

  const items: TrashItem[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    name: r.name,
    deletedAt: r.deletedAt.toISOString(),
    deletedBy: r.deletedById ? nameById.get(r.deletedById) ?? null : null,
    restoredAt: r.restoredAt?.toISOString() ?? null,
    documents: Array.isArray(r.documents) ? (r.documents as unknown[]).length : 0,
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Corbeille des suppressions définitives"
        description="Chaque suppression « définitive » est réversible ici (ligne principale + pièces + commentaires), jusqu'à destruction réelle. Les éléments liés supprimés en cascade ne sont pas restaurés."
      />
      {items.length === 0 ? (
        <EmptyState icon="Trash2" title="Corbeille vide" description="Les suppressions définitives apparaîtront ici, restaurables." />
      ) : (
        <TrashList items={items} />
      )}
    </div>
  );
}
