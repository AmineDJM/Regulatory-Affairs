import Link from "next/link";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { calculerAffinites, PERIODE_LABELS } from "@/lib/consommation/affinite";
import { lireConfig, lignesDuMarche } from "@/lib/consommation/affinite-service";
import { pct } from "@/lib/segmentation/regles";
import { ConfigAffiniteForm } from "./config-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affinité par établissement — AMD Internal OS" };

/**
 * L'AFFINITÉ PAR ÉTABLISSEMENT — pour chaque produit réglé : sa consommation ÷ celle du marché choisi (panier de
 * produits et/ou de molécules), sur la période choisie, établissement par établissement. C'est une affinité
 * d'HÔPITAL : l'utiliser pour un médecin est un proxy que la stratégie de segmentation choisit explicitement.
 */
export default async function AffinitePage({ searchParams }: { searchParams?: { p?: string } }) {
  const user = await requireModule("CONSUMPTION");
  const peutRegler = userCan(user, "CONSUMPTION", "VALIDATE");
  const [produits, configs] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, canonicalName: true, dci: true }, orderBy: { canonicalName: "asc" } }),
    prisma.affiniteConfig.findMany({ select: { productId: true, panier: true, periode: true, debut: true, fin: true } }),
  ]);
  const choisi = produits.find((p) => p.id === searchParams?.p) ?? produits.find((p) => configs.some((c) => c.productId === p.id)) ?? produits[0] ?? null;
  const row = choisi ? configs.find((c) => c.productId === choisi.id) : undefined;
  const cfg = row ? lireConfig(row) : null;
  const resultat = cfg ? calculerAffinites(await lignesDuMarche(cfg), cfg) : null;
  const noms = resultat?.parEtablissement.length
    ? new Map((await prisma.medicalInstitution.findMany({ where: { id: { in: resultat.parEtablissement.map((a) => a.institutionId) } }, select: { id: true, name: true } })).map((n) => [n.id, n.name]))
    : new Map<string, string>();

  return (
    <div className="space-y-5">
      <PageHeader title="Affinité par établissement" description="Consommation du produit ÷ consommation du marché choisi, établissement par établissement.">
        <Link href="/consommation" className="text-sm text-primary underline">Imports</Link>
      </PageHeader>
      <div className="flex flex-wrap gap-1 text-xs">
        {produits.filter((p) => configs.some((c) => c.productId === p.id) || p.id === choisi?.id).map((p) => (
          <Link key={p.id} href={`/consommation/affinite?p=${p.id}`} className={`rounded-md border px-2 py-1 ${p.id === choisi?.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{p.canonicalName}</Link>
        ))}
      </div>
      {choisi && peutRegler && (
        <ConfigAffiniteForm
          produits={produits.map((p) => ({ id: p.id, nom: p.canonicalName }))}
          productId={choisi.id}
          initial={cfg ? { productIds: cfg.panier.productIds, molecules: cfg.panier.molecules.join(", "), periode: cfg.periode, debut: cfg.debut ?? "", fin: cfg.fin ?? "" } : null}
        />
      )}
      {!cfg && <p className="surface p-4 text-sm text-muted-foreground">Aucune affinité n&apos;est réglée pour ce produit : aucun marché ni aucune période n&apos;est supposé.</p>}
      {cfg && resultat && (
        <section className="surface overflow-x-auto p-4">
          <p className="mb-2 text-sm">{PERIODE_LABELS[cfg.periode]}{resultat.fenetre ? ` — ${resultat.fenetre.libelle}` : " — aucune donnée validée dans le marché"}</p>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="px-2 py-2">Établissement</th><th className="px-2 py-2">Affinité</th><th className="px-2 py-2">Produit</th><th className="px-2 py-2">Marché</th><th className="px-2 py-2">Unité</th><th className="px-2 py-2">Lignes exclues (autre unité)</th></tr>
            </thead>
            <tbody>
              {resultat.parEtablissement.map((a) => (
                <tr key={a.institutionId} className="border-b border-border/60">
                  <td className="px-2 py-1">{noms.get(a.institutionId) ?? a.institutionId}</td>
                  <td className="px-2 py-1 font-medium">{pct(a.valeur)}</td>
                  <td className="px-2 py-1">{a.numerateur}</td>
                  <td className="px-2 py-1">{a.denominateur}</td>
                  <td className="px-2 py-1">{a.unite ?? "—"}</td>
                  <td className="px-2 py-1">{a.exclues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
