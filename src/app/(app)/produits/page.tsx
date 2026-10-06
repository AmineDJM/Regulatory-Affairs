import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { clauseProduitTermine, PHRASE_PRODUITS_TERMINES } from "@/lib/products/termines";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits — AMD Internal OS" };

/**
 * LES PRODUITS CANONIQUES — un produit, une identité, retrouvable par son nom, sa DCI, sa référence ou un alias, et
 * ouvert sur sa vue 360°. Module à part (PRODUCTS), réglé dans la console ; chaque section de la fiche suit son module.
 */
export default async function ProduitsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const user = await requireModule("PRODUCTS");
  const q = (searchParams?.q ?? "").trim();
  // LES DOSSIERS QUI NE SONT PAS (ENCORE) DES PRODUITS : identité incomplète, donc pas de produit canonique.
  const dossiersSansProduit = userCan(user, "REGULATORY", "VIEW") ? await prisma.regulatoryProduct.count({ where: { productId: null } }) : null;
  const produits = await prisma.product.findMany({
    // SEULEMENT LES PRODUITS TERMINÉS DANS REGULATORY (Direction, 06/10).
    where: { AND: [clauseProduitTermine, q ? { OR: [{ canonicalName: { contains: q, mode: "insensitive" } }, { dci: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { aliases: { some: { label: { contains: q, mode: "insensitive" } } } }] } : {}] },
    orderBy: [{ isActive: "desc" }, { canonicalName: "asc" }], take: 200,
    select: { id: true, code: true, canonicalName: true, dci: true, lifecycle: true, isActive: true, promoProfiles: { select: { businessUnit: { select: { name: true } } } } },
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Produits" description="Chaque produit une seule fois — réglementaire, marchés, ventes, segmentation, consommation et coûts réunis dans sa vue 360°." />
      <div className="surface space-y-1 p-3 text-xs text-muted-foreground">
        <p><b className="text-foreground">{PHRASE_PRODUITS_TERMINES}</b></p>
        <p><b className="text-foreground">D'où viennent ces produits ?</b> Du référentiel canonique : un produit naît d'un dossier réglementaire dont l'identité est complète (DCI, dosage, unité, forme, conditionnement), à la création du dossier ou depuis Regulatory › Catalogue produits. La Force de vente, les appels d'offres, la segmentation et la consommation s'y rattachent — jamais une copie.</p>
        {dossiersSansProduit !== null && dossiersSansProduit > 0 && <p>{dossiersSansProduit} dossier(s) réglementaire(s) ne sont pas encore des produits (identité incomplète ou non rattachée) : <Link href="/regulatory/catalogue" className="text-primary underline">les compléter dans le Catalogue produits</Link>.</p>}
      </div>
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
