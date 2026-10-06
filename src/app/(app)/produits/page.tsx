import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sections360 } from "@/lib/queries/vue-360";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits — AMD Internal OS" };

/**
 * LES PRODUITS CANONIQUES — un produit, une identité, retrouvable par son nom, sa DCI, sa référence ou un alias, et
 * ouvert sur sa vue 360°. Ouvert à quiconque voit au moins une des facettes d'un produit.
 */
export default async function ProduitsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const user = await requireUser();
  if (!Object.values(sections360(user)).some(Boolean)) redirect("/dashboard?denied=PRODUITS");
  const q = (searchParams?.q ?? "").trim();
  const produits = await prisma.product.findMany({
    where: q ? { OR: [{ canonicalName: { contains: q, mode: "insensitive" } }, { dci: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { aliases: { some: { label: { contains: q, mode: "insensitive" } } } }] } : {},
    orderBy: [{ isActive: "desc" }, { canonicalName: "asc" }], take: 200,
    select: { id: true, code: true, canonicalName: true, dci: true, lifecycle: true, isActive: true, promoProfiles: { select: { businessUnit: { select: { name: true } } } } },
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Produits" description="Chaque produit une seule fois — réglementaire, marchés, ventes, segmentation, consommation et coûts réunis dans sa vue 360°." />
      <form className="flex gap-2"><Input name="q" defaultValue={q} placeholder="Nom, DCI, référence ou alias…" className="w-80" /></form>
      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Référence</th><th className="px-3 py-2">DCI</th><th className="px-3 py-2">Business Units</th><th className="px-3 py-2">Cycle de vie</th></tr></thead>
          <tbody>
            {produits.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Aucun produit{q ? ` pour « ${q} »` : ""}.</td></tr>}
            {produits.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="px-3 py-2"><Link href={`/produits/${p.id}`} className="font-medium text-primary hover:underline">{p.canonicalName}</Link>{!p.isActive && <span className="ml-1 text-xs text-muted-foreground">(inactif)</span>}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.code}</td>
                <td className="px-3 py-2">{p.dci}</td>
                <td className="px-3 py-2">{[...new Set(p.promoProfiles.map((x) => x.businessUnit?.name).filter(Boolean))].join(", ") || "—"}</td>
                <td className="px-3 py-2">{p.lifecycle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
