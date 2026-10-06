import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { DOSAGE_UNIT, PHARMA_FORM, PRODUCT_CHANNEL, PRODUCT_LIFECYCLE, REGULATORY_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { chargerProduitCanonique } from "@/lib/queries/produits-canoniques";
import { AliasProduit, RenommerProduit } from "./fiche-gestes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Produit canonique — AMD Internal OS" };

/**
 * LA FICHE D'UN PRODUIT CANONIQUE (§118.178) — son identité, et tout ce qui le RÉFÉRENCE.
 *
 * L'identité (DCI, dosage, forme, conditionnement) ne se modifie pas ici : elle se corrige sur le
 * DOSSIER, et le produit suit (`products/canonique.ts`). Deux endroits pour écrire la même
 * identité finiraient par en porter deux. Ce qui se modifie ici, c'est ce que le produit n'a qu'à
 * lui : son nom et ses alias.
 *
 * Une fiche qu'on n'a pas le droit de voir rend la même page qu'une fiche qui n'existe pas : un
 * produit se voit par ses dossiers, et dire « il existe » révélerait un projet du pipeline.
 */
export default async function ProduitCanoniquePage({ params }: { params: { id: string } }) {
  const user = await requireModule("REGULATORY");
  const p = await chargerProduitCanonique(user, params.id);
  if (!p) notFound();
  const peutEcrire = userCan(user, "REGULATORY", "UPDATE");

  const dosage = [p.dosage, p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : null].filter(Boolean).join(" ") || "—";
  const forme = p.form ? PHARMA_FORM[p.form] ?? p.form : "—";

  return (
    <div className="space-y-6">
      <BackLink href="/regulatory/catalogue">
        <ArrowLeft className="h-4 w-4" /> Catalogue produits
      </BackLink>

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
          <StatusBadge map={PRODUCT_LIFECYCLE} value={p.lifecycle} dot={false} />
          <StatusBadge map={PRODUCT_CHANNEL} value={p.channel} dot={false} />
          {!p.isActive && <span className="text-xs text-muted-foreground">Inactif</span>}
        </div>
        <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{p.canonicalName}</h1>
      </header>

      <section className="surface space-y-3 p-4">
        <h2 className="text-sm font-semibold">Identité</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">DCI</dt><dd className="font-medium">{p.dci}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Dosage</dt><dd>{dosage}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Forme</dt><dd>{forme}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Conditionnement</dt><dd>{p.packaging || "—"}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">
          L&apos;identité se corrige sur le dossier Regulatory : le produit suit. Deux produits qui la partagent sont le même produit.
        </p>
        {peutEcrire && <RenommerProduit id={p.id} nom={p.canonicalName} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Dossiers Regulatory <span className="font-normal text-muted-foreground">({p.dossiers.length + p.dossiersMasques})</span>
        </h2>
        {p.dossiers.length === 0 ? (
          <p className="surface px-3 py-4 text-sm text-muted-foreground">Aucun dossier visible.</p>
        ) : (
          <ul className="surface divide-y divide-border">
            {p.dossiers.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <Link href={`/regulatory/${d.id}`} className="font-mono text-xs hover:underline">{d.reference}</Link>
                  {d.brandName && <span className="ml-2 font-medium">{d.brandName}</span>}
                  {d.companyName && <span className="ml-2 text-xs text-muted-foreground">{d.companyName}</span>}
                </span>
                <StatusBadge map={REGULATORY_STATUS} value={d.status} />
              </li>
            ))}
          </ul>
        )}
        {p.dossiersMasques > 0 && (
          <p className="text-xs text-muted-foreground">{p.dossiersMasques} autre(s) dossier(s) hors de votre portée.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Business Units <span className="font-normal text-muted-foreground">({p.produitsBu.length})</span>
        </h2>
        {p.produitsBu.length === 0 ? (
          <p className="surface px-3 py-4 text-sm text-muted-foreground">
            Aucune Business Unit ne promeut ce produit. Un produit s&apos;ajoute à une BU depuis son dossier, dans Planning › Business Units.
          </p>
        ) : (
          <ul className="surface divide-y divide-border">
            {p.produitsBu.map((b) => (
              <li key={b.id} className="px-3 py-2 text-sm">
                <span className="font-medium">{b.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{b.bu ?? "Sans BU"}{b.isActive ? "" : " · inactif"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(p.produitsBd.length > 0 || p.produitsBdMasques > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Business Development <span className="font-normal text-muted-foreground">({p.produitsBd.length + p.produitsBdMasques})</span>
          </h2>
          {p.produitsBd.length > 0 && (
            <ul className="surface divide-y divide-border">
              {p.produitsBd.map((b) => (
                <li key={b.id} className="px-3 py-2 text-sm">
                  <span className="font-medium">{b.dci}</span>
                  {b.brandName && <span className="ml-2 text-xs text-muted-foreground">{b.brandName}</span>}
                </li>
              ))}
            </ul>
          )}
          {p.produitsBdMasques > 0 && (
            <p className="text-xs text-muted-foreground">{p.produitsBdMasques} produit(s) à l&apos;étude au registre des projets BD, que vous ne voyez pas.</p>
          )}
        </section>
      )}

      <section className="surface space-y-2 p-4">
        <h2 className="text-sm font-semibold">Alias</h2>
        <p className="text-xs text-muted-foreground">
          Les autres noms du produit — nom commercial, nom du marché, abréviation du terrain. Un alias retrouve le produit juste après sa référence.
        </p>
        {peutEcrire ? (
          <AliasProduit id={p.id} aliases={p.aliases.map((a) => ({ id: a.id, label: a.label }))} />
        ) : p.aliases.length > 0 ? (
          <p className="text-sm">{p.aliases.map((a) => a.label).join(", ")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun alias.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Historique</h2>
        {p.historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
        ) : (
          <ul className="surface divide-y divide-border text-sm">
            {p.historique.map((h) => (
              <li key={h.id} className="px-3 py-2">
                <span className="block">{h.summary}</span>
                <span className="text-xs text-muted-foreground">{formatDate(h.createdAt)}{h.acteur ? ` · ${h.acteur}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
