import Link from "next/link";
import { requireUser } from "@/lib/session";
import { can, scopeRegulatory, scopeBusinessDevelopment } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { accessibleDocumentWhere } from "@/lib/queries/documents";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const q = (searchParams.q ?? "").trim();

  if (!q) {
    return (
      <div className="space-y-5">
        <PageHeader title="Recherche" />
        <EmptyState icon="Search" title="Saisissez un terme de recherche" description="DCI, dossier, institution, document…" />
      </div>
    );
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [regulatory, sponsoring, logistics, bd, documents] = await Promise.all([
    can(user.role, "REGULATORY", "VIEW")
      ? prisma.regulatoryProduct.findMany({
          where: { AND: [scopeRegulatory(user), { OR: [{ dci: contains }, { reference: contains }, { brandName: contains }] }] },
          take: 8,
        })
      : [],
    can(user.role, "SPONSORING", "VIEW")
      ? prisma.sponsoringRequest.findMany({
          where: { OR: [{ institution: contains }, { reference: contains }, { doctor: contains }] },
          take: 8,
        })
      : [],
    can(user.role, "LOGISTICS", "VIEW")
      ? prisma.logisticsOrder.findMany({
          where: { OR: [{ product: contains }, { reference: contains }, { supplier: contains }] },
          take: 8,
        })
      : [],
    can(user.role, "BUSINESS_DEVELOPMENT", "VIEW")
      ? prisma.businessDevelopmentOpportunity.findMany({
          where: { AND: [scopeBusinessDevelopment(user), { OR: [{ name: contains }, { dci: contains }] }] },
          take: 8,
        })
      : [],
    can(user.role, "DOCUMENTS", "VIEW")
      ? prisma.document.findMany({ where: { AND: [await accessibleDocumentWhere(user), { name: contains }] }, take: 8 })
      : [],
  ]);

  const total = regulatory.length + sponsoring.length + logistics.length + bd.length + documents.length;

  return (
    <div className="space-y-5">
      <PageHeader title="Recherche" description={`${total} résultat${total > 1 ? "s" : ""} pour « ${q} »`} />

      {total === 0 ? (
        <EmptyState icon="SearchX" title="Aucun résultat" description="Essayez un autre terme." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ResultGroup title="Regulatory" count={regulatory.length}>
            {regulatory.map((r) => (
              <ResultLink key={r.id} href={`/regulatory/${r.id}`} title={r.dci} subtitle={`${r.reference} · ${r.brandName ?? ""}`} />
            ))}
          </ResultGroup>
          <ResultGroup title="Sponsoring" count={sponsoring.length}>
            {sponsoring.map((r) => (
              <ResultLink key={r.id} href={`/sponsoring/${r.id}`} title={r.institution} subtitle={`${r.reference} · ${r.doctor ?? ""}`} />
            ))}
          </ResultGroup>
          <ResultGroup title="Logistique PCH" count={logistics.length}>
            {logistics.map((r) => (
              <ResultLink key={r.id} href={`/logistics/${r.id}`} title={r.product} subtitle={`${r.reference} · ${r.supplier ?? ""}`} />
            ))}
          </ResultGroup>
          <ResultGroup title="Business Development" count={bd.length}>
            {bd.map((r) => (
              <ResultLink key={r.id} href={`/business-development`} title={r.name} subtitle={r.dci ?? ""} />
            ))}
          </ResultGroup>
          <ResultGroup title="Documents" count={documents.length}>
            {documents.map((d) => (
              <ResultLink key={d.id} href={`/api/documents/${d.id}`} title={d.name} subtitle="Télécharger" />
            ))}
          </ResultGroup>
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Badge tone="neutral">{count}</Badge>
      </CardHeader>
      <CardContent className="divide-y divide-border">{children}</CardContent>
    </Card>
  );
}

function ResultLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="block py-2 hover:bg-secondary/40">
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </Link>
  );
}
