import Link from "next/link";
import { Users, ClipboardCheck, Car, Route, Trash2 } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getRequestList } from "@/lib/queries/admin-requests";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_REQUEST_TYPE, ADMIN_REQUEST_STATUS, PRIORITY } from "@/lib/labels";
import { formatDate, cn } from "@/lib/utils";
import { toNumber } from "@/lib/utils";
import { NewRequestButton } from "./new-request";
import { MultiRequestButton } from "./multi-request";
import { SuppliesManager } from "./supplies-manager";

export default async function DemandesPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  const user = await requireModule("ADMIN_REQUESTS");
  const isManager = hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE");

  const [list, users, departments, activeArticles, supplyCatalog] = await Promise.all([
    getRequestList(user, { status: searchParams.status, type: searchParams.type }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.officeSupplyArticle.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    isManager
      ? prisma.officeSupplyArticle.findMany({ select: { id: true, name: true, category: true, unit: true, reference: true, estimatedPrice: true, supplierHint: true, active: true, notes: true }, orderBy: [{ active: "desc" }, { name: "asc" }] })
      : Promise.resolve([] as { id: string; name: string; category: string | null; unit: string | null; reference: string | null; estimatedPrice: unknown; supplierHint: string | null; active: boolean; notes: string | null }[]),
  ]);

  const catalogRows = supplyCatalog.map((a) => ({ ...a, estimatedPrice: a.estimatedPrice != null ? toNumber(a.estimatedPrice) : null }));

  return (
    <div className="space-y-5">
      <PageHeader title="Bureau du secrétariat" description="Centre de traitement des demandes transverses de l'entreprise.">
        {isManager && <Link href="/demandes/assistant"><Button variant="outline"><Users className="h-4 w-4" /> Bureau de Donna</Button></Link>}
        {isManager && <SuppliesManager articles={catalogRows} />}
        <Link href="/demandes/approvals"><Button variant="outline"><ClipboardCheck className="h-4 w-4" /> Validations</Button></Link>
        {isManager && <Link href="/demandes/courses"><Button variant="outline"><Route className="h-4 w-4" /> Courses</Button></Link>}
        <Link href="/demandes/driver"><Button variant="outline"><Car className="h-4 w-4" /> Missions</Button></Link>
        {isManager && <Link href="/demandes/corbeille"><Button variant="outline"><Trash2 className="h-4 w-4" /> Corbeille</Button></Link>}
        <MultiRequestButton users={users} departments={departments} articles={activeArticles} />
        <NewRequestButton users={users} departments={departments} articles={activeArticles} />
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        <Chip label="Toutes" href="/demandes" active={!searchParams.status} />
        {Object.entries(ADMIN_REQUEST_STATUS).map(([k, v]) => (
          <Chip key={k} label={v.label} href={`/demandes?status=${k}`} active={searchParams.status === k} />
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="ClipboardList" title="Aucune demande" description="Créez une nouvelle demande administrative." />
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/demandes/${r.id}`} className="hover:underline">{r.title}</Link>
                    {r.batchId && <Badge tone="info" dot={false} className="ml-2 align-middle">Lot</Badge>}
                  </TableCell>
                  <TableCell>{ADMIN_REQUEST_TYPE[r.type] ?? r.type}</TableCell>
                  <TableCell><StatusBadge map={PRIORITY} value={r.priority} dot={false} /></TableCell>
                  <TableCell><StatusBadge map={ADMIN_REQUEST_STATUS} value={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{r.deadline ? formatDate(r.deadline) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.assignedTo?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary")}>
      {label}
    </Link>
  );
}
