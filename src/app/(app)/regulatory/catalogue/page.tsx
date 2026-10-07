import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PRODUCT_LIFECYCLE } from "@/lib/labels";
import { phraseManques } from "@/lib/products/identity";
import { getCatalogReconciliation } from "@/lib/queries/product-catalog";
import { chargerCatalogueCanonique } from "@/lib/queries/produits-canoniques";
import { ReconcileTable } from "./reconcile-table";
import { RattacherDossierBouton } from "./rattacher-dossier";
import { RattachementGlobal } from "./rattachement-global";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catalogue produits — AMD Internal OS" };

/**
 * LE CATALOGUE PRODUITS — le produit canonique, et le rapprochement des catalogues.
 *
 * ── LE PRODUIT CANONIQUE (§118.178) ──────────────────────────────────────────────────────
 *
 * Une seule identité par médicament — DCI, dosage, forme, conditionnement — que les dossiers
 * Regulatory, les produits des Business Units et ceux du Business Development RÉFÉRENCENT au
 * lieu de la recopier. Un dossier à l'identité complète rejoint son produit à son enregistrement ;
 * ceux d'avant se rattachent d'un clic, un par un ou tous ensemble (Super Admin, avec aperçu).
 * Ce qui ne s'identifie pas encore est LISTÉ avec ce qui manque : un dossier sans produit qu'on
 * ne voit nulle part est un dossier qu'aucune BU ne pourra jamais promouvoir.
 *
 * ── LE RAPPROCHEMENT DES CATALOGUES ──────────────────────────────────────────────────────
 *
 * Les produits du BD et du planning promotionnel qui ne pointent sur aucun dossier : la machine
 * propose et explique, une personne tranche — un 500 mg et un 1 g partagent molécule, forme et
 * souvent nom commercial. Rattaché à son dossier, un produit de BU reçoit le produit canonique du
 * dossier.
 */
export default async function ProductCatalogPage() {
  const user = await requireModule("REGULATORY");
  // Déclarer qu'un dossier ou un produit en est un autre est une décision réglementaire.
  const canLink = userCan(user, "REGULATORY", "UPDATE");
  const estSuperAdmin = user.role === "SUPER_ADMIN";
  // UN SEUL CATALOGUE (Direction, 07/10) : la fiche d'un produit est sa fiche Produits 360 ; cet écran garde le
  // RATTACHEMENT (dossiers à rattacher, à compléter, rapprochement des catalogues), qui est un travail réglementaire.
  const voitProduits360 = userCan(user, "PRODUCTS", "VIEW");

  const [canon, data] = await Promise.all([chargerCatalogueCanonique(user), getCatalogReconciliation(user)]);
  const confident = data.orphans.filter((o) => o.proposals[0]?.confident).length;

  return (
    <div className="space-y-6">
      <BackLink href="/regulatory">
        <ArrowLeft className="h-4 w-4" /> Suivi des dossiers
      </BackLink>

      <PageHeader
        title="Rattachement au catalogue"
        description="Les dossiers Regulatory, les produits des Business Units et ceux du Business Development rattachés à leur produit — et ce qui reste à rattacher."
      >
        {voitProduits360 && (
          <Link href="/produits" className="inline-flex h-10 items-center rounded-[var(--radius)] border border-border bg-card px-4 text-sm font-medium hover:bg-secondary">Produits 360</Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Produits canoniques" value={canon.total} icon="Package" />
        <KpiCard label="Dossiers à rattacher" value={canon.rattachables.length} icon="Link2" tone={canon.rattachables.length > 0 ? "info" : "default"} />
        <KpiCard label="Dossiers à compléter" value={canon.incomplets.length} icon="FilePen" tone={canon.incomplets.length > 0 ? "warning" : "default"} />
        <KpiCard label="Produits de BU sans produit" value={canon.produitsBuSansProduit.length} icon="Unlink" tone={canon.produitsBuSansProduit.length > 0 ? "warning" : "default"} />
      </div>

      {estSuperAdmin && <RattachementGlobal />}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Produits canoniques <span className="font-normal text-muted-foreground">({canon.total})</span>
        </h2>
        {canon.produits.length === 0 ? (
          <p className="surface px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun produit canonique visible pour l&apos;instant. Un dossier à l&apos;identité complète en reçoit un à son enregistrement.
          </p>
        ) : (
          <ul className="surface divide-y divide-border">
            {canon.produits.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between">
                <span className="min-w-0 space-y-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <Link href={voitProduits360 ? `/produits/${p.id}` : `/regulatory/catalogue/${p.id}`} className="font-medium hover:underline">{p.canonicalName}</Link>
                    <StatusBadge map={PRODUCT_LIFECYCLE} value={p.lifecycle} dot={false} />
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.dossiers.length > 0 ? `Dossiers : ${p.dossiers.map((d) => d.reference).join(", ")}` : "Aucun dossier visible"}
                    {p.dossiersMasques > 0 && ` · ${p.dossiersMasques} dossier(s) hors de votre portée`}
                  </span>
                  {p.produitsBu.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      Business Units : {p.produitsBu.map((b) => (b.bu ? `${b.name} (${b.bu})` : b.name)).join(", ")}
                    </span>
                  )}
                  {p.aliases.length > 0 && (
                    <span className="block text-xs text-muted-foreground">Alias : {p.aliases.join(", ")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canon.total > canon.produits.length && (
          <p className="text-xs text-muted-foreground">
            {canon.produits.length} premiers produits affichés sur {canon.total}.
          </p>
        )}
      </section>

      {canon.rattachables.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Dossiers à rattacher <span className="font-normal text-muted-foreground">({canon.rattachables.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">Leur identité est complète : un clic les rattache à leur produit (créé s&apos;il n&apos;existe pas encore).</p>
          <ul className="surface divide-y divide-border">
            {canon.rattachables.map((d) => (
              <li key={d.id} className="flex flex-col gap-1.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <Link href={`/regulatory/${d.id}`} className="font-mono text-xs text-muted-foreground hover:underline">{d.reference}</Link>{" "}
                  <span className="font-medium">{d.dci}</span>
                </span>
                {canLink && <RattacherDossierBouton dossierId={d.id} compact />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canon.incomplets.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Dossiers à compléter <span className="font-normal text-muted-foreground">({canon.incomplets.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Sans ces informations, le dossier ne s&apos;identifie pas sans risque de le confondre avec un autre : il ne rejoint aucun produit, donc aucune Business Unit.
          </p>
          <ul className="surface divide-y divide-border">
            {canon.incomplets.map((d) => (
              <li key={d.id} className="px-3 py-2 text-sm">
                <Link href={`/regulatory/${d.id}`} className="font-mono text-xs text-muted-foreground hover:underline">{d.reference}</Link>{" "}
                <span className="font-medium">{d.dci}</span>
                <span className="block text-xs text-warning">Il manque {phraseManques(d.manques)}.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canon.produitsBuSansProduit.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Produits de BU sans produit canonique <span className="font-normal text-muted-foreground">({canon.produitsBuSansProduit.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground">Tant qu&apos;il n&apos;a pas de produit canonique, un produit de BU ne peut pas être rapporté dans une visite.</p>
          <ul className="surface divide-y divide-border">
            {canon.produitsBuSansProduit.map((p) => (
              <li key={p.id} className="px-3 py-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.raison}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h2 className="text-base font-semibold">Rapprochement des catalogues</h2>
          <p className="text-xs text-muted-foreground">
            Les produits du Business Development et du planning promotionnel, rattachés au dossier réglementaire qui fait référence. Le rapprochement propose et explique ; c&apos;est vous qui tranchez — un dosage différent est un produit différent.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Dossiers de référence" value={data.dossiers.length} icon="FileCheck2" />
          <KpiCard label="Déjà rapprochés" value={data.linked.length} icon="Link2" tone="success" />
          <KpiCard label="À rapprocher" value={data.orphans.length} icon="Unlink" tone={data.orphans.length > 0 ? "warning" : "default"} />
          <KpiCard label="Proposition sûre" value={confident} icon="CheckCircle2" tone={confident > 0 ? "info" : "default"} />
        </div>
        <ReconcileTable data={data} canLink={canLink} />
      </section>
    </div>
  );
}
