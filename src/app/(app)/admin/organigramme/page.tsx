import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Network, UserPlus } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { OrgNode } from "./org-chart-editor";
import { OrgWorkspace } from "./org-workspace";
import { BackLink } from "@/components/shared/back-link";

export const metadata = { title: "Organigramme — AMD Internal OS" };
export const dynamic = "force-dynamic";

export default async function OrganigrammePage() {
  const user = await requireModule("ADMIN", "UPDATE");
  if (user.role !== "SUPER_ADMIN") redirect("/admin");

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true, fullName: true, position: true, department: true, managerId: true, orgX: true, orgY: true,
      // Département STRUCTURÉ (source de vérité) ; le champ texte n'est qu'un cache de secours.
      departmentRef: { select: { name: true } },
      company: { select: { name: true, shortName: true, color: true } },
    },
    orderBy: { fullName: "asc" },
  });
  const nodes: OrgNode[] = employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    position: e.position,
    department: e.departmentRef?.name ?? e.department,
    managerId: e.managerId,
    entity: e.company?.shortName ?? e.company?.name ?? null,
    color: e.company?.color ?? null,
    orgX: e.orgX,
    orgY: e.orgY,
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Retour à l&apos;administration
      </BackLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Network className="h-6 w-6" /> Organigramme</h1>
          <p className="text-sm text-muted-foreground">Hiérarchie de l&apos;entreprise — branchée sur Ressources humaines. Réarrangez qui rapporte à qui et ajustez les postes ; les personnes se créent dans RH.</p>
        </div>
        <Link href="/rh"><Button variant="outline"><UserPlus className="h-4 w-4" /> Ajouter / gérer les employés (RH)</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Structure hiérarchique</CardTitle></CardHeader>
        <CardContent>
          <OrgWorkspace nodes={nodes} />
        </CardContent>
      </Card>
    </div>
  );
}
