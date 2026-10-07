import Link from "next/link";
import { Link2 } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, regulatoryLockWhere } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listeProduits360, type OngletListe } from "@/lib/queries/produits-360";
import { montantCourt } from "@/lib/products/fiche-360";
import { REGULATORY_STATUS } from "@/lib/labels";
import { Input } from "@/components/ui/input";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Onglets, Pastille, Tendance } from "@/components/produits/ui-360";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produits 360 — AMD Internal OS" };

const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

/**
 * PRODUITS 360 — LE catalogue (Direction, 07/10 : « Produit = dossier réglementaire »). Un produit une fois, ouvert sur sa
 * fiche 360 : les commercialisés (dossier terminé) avec ventes, tendance, part de marché, mois de stock et UN signal ; le
 * pipeline (dossier en cours) dans son onglet. Chaque colonne n'apparaît qu'à qui a son module.
 */
export default async function ProduitsPage({ searchParams }: { searchParams?: { q?: string; onglet?: string } }) {
  const user = await requireModule("PRODUCTS");
  const q = (searchParams?.q ?? "").trim();
  const onglet: OngletListe = searchParams?.onglet === "enregistrement" ? "enregistrement" : "commercialises";
  const { lignes, compte, colonnes } = await listeProduits360(user, { q, onglet });
  const lien = (o: OngletListe) => `/produits?onglet=${o}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const commerce = onglet === "commercialises";
  // LES DOSSIERS QUI NE SONT PAS (ENCORE) AU CATALOGUE — dits à qui peut les y rattacher (le réglementaire).
  const dossiersHorsCatalogue = !commerce && userCan(user, "REGULATORY", "VIEW")
    ? await prisma.regulatoryProduct.count({ where: { productId: null, ...regulatoryLockWhere(user) } })
    : 0;
  const nbColonnes = commerce ? 3 + (colonnes.ventes ? 2 : 0) + (colonnes.marche ? 1 : 0) + (colonnes.stock ? 1 : 0) : 5;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            Produits 360
            <InfoBulle label="D'où viennent ces produits ?">
              Un produit = son dossier réglementaire : il naît d&apos;un dossier à l&apos;identité complète (DCI, dosage, forme, conditionnement). Commercialisé = décision d&apos;enregistrement obtenue ou dossier clôturé. Le stock, les ventes, les marchés et la segmentation s&apos;y rattachent par la même clé.
            </InfoBulle>
          </h1>
          <p className="text-sm text-muted-foreground">{compte.commercialises} commercialisé{compte.commercialises > 1 ? "s" : ""} · {compte.enregistrement} en enregistrement</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form className="w-full sm:w-72">
            <input type="hidden" name="onglet" value={onglet} />
            <Input name="q" type="search" defaultValue={q} placeholder="Nom, DCI, code, alias…" aria-label="Rechercher un produit" />
          </form>
          {userCan(user, "REGULATORY", "VIEW") && (
            <Link href="/regulatory/catalogue" title="Rattacher les dossiers au catalogue" aria-label="Rattacher les dossiers au catalogue"
              className="inline-flex h-10 items-center rounded-[var(--radius)] border border-border bg-card px-3 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Link2 className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <Onglets label="Catalogue" actif={onglet} items={[
        { cle: "commercialises", label: "Commercialisés", href: lien("commercialises"), n: compte.commercialises },
        { cle: "enregistrement", label: "En enregistrement", href: lien("enregistrement"), n: compte.enregistrement },
      ]} />

      {/* Un tableau reste un tableau au téléphone : la première colonne reste visible, le reste défile. */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-[1] bg-card px-3 py-2 font-medium">Produit</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">BU</th>
                {commerce ? (
                  <>
                    {colonnes.ventes && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Ventes 12 mois</th>}
                    {colonnes.ventes && <th className="whitespace-nowrap px-3 py-2 font-medium">Tendance</th>}
                    {colonnes.marche && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Part de marché</th>}
                    {colonnes.stock && <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Stock</th>}
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Signal</th>
                  </>
                ) : (
                  <>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Dossier</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Statut</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Cible d&apos;enregistrement</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && (
                <tr><td colSpan={nbColonnes} className="px-3 py-6 text-center text-muted-foreground">Aucun produit{q ? ` pour « ${q} »` : ""}.</td></tr>
              )}
              {lignes.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                  <td className="sticky left-0 z-[1] bg-card px-3 py-2">
                    <Link href={`/produits/${p.id}`} className="block min-w-[10rem] max-w-[18rem]">
                      <b className="block truncate font-medium text-foreground hover:underline">{p.nom}</b>
                      <small className="block truncate text-xs text-muted-foreground">{p.sousTitre}</small>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{p.bu ?? <span className="text-muted-foreground">—</span>}</td>
                  {commerce ? (
                    <>
                      {colonnes.ventes && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.ventes12m ? montantCourt(p.ventes12m) : <span className="text-muted-foreground">—</span>}</td>}
                      {colonnes.ventes && <td className="px-3 py-2">{p.tendance ? <Tendance valeurs={p.tendance} /> : null}</td>}
                      {colonnes.marche && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.partPct !== null ? `${nombre(p.partPct)} %` : <span className="text-muted-foreground">—</span>}</td>}
                      {colonnes.stock && (
                        <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${p.signal?.code === "STOCK_BAS" ? "text-warning" : ""}`}>
                          {p.couvertureMois !== null ? `${nombre(p.couvertureMois)} mois` : p.stockUnites !== null ? `${p.stockUnites.toLocaleString("fr-FR")} bt` : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2">{p.signal ? <Pastille ton={p.signal.ton}>{p.signal.label}</Pastille> : <Pastille ton="success">—</Pastille>}</td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{p.dossier?.reference ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{p.dossier ? <Pastille ton="info">{REGULATORY_STATUS[p.dossier.statut]?.label ?? p.dossier.statut}</Pastille> : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{p.dossier?.cible ? new Date(p.dossier.cible).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : <span className="text-muted-foreground">—</span>}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {lignes.length >= 200 && <p className="text-xs text-muted-foreground">Les 200 premiers produits sont affichés : précisez la recherche.</p>}
      {!commerce && dossiersHorsCatalogue > 0 && (
        <p className="text-xs text-muted-foreground">
          {dossiersHorsCatalogue} dossier{dossiersHorsCatalogue > 1 ? "s" : ""} pas encore au catalogue (identité incomplète ou non rattachée) —{" "}
          <Link href="/regulatory/catalogue" className="text-primary underline">les rattacher</Link>.
        </p>
      )}
    </div>
  );
}
