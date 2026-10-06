import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan, regulatoryLockWhere } from "@/lib/rbac";
import { produit360ParId } from "@/lib/queries/product-360";
import { sections360, segmentationDuProduit, consommationDuProduit } from "@/lib/queries/vue-360";
import { attributionProduit } from "@/lib/queries/attribution-produit";
import { pct, ETAT_LABELS } from "@/lib/segmentation/regles";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { RepartitionBu } from "./repartition-bu";

export const dynamic = "force-dynamic";

const dzd = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} DZD`;

function Section({ titre, children, lien }: { titre: string; children: React.ReactNode; lien?: { href: string; label: string } }) {
  return (
    <section className="surface space-y-2 p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{titre}</h2>{lien && <Link href={lien.href} className="text-xs text-primary underline">{lien.label}</Link>}</div>
      {children}
    </section>
  );
}

/**
 * PRODUIT 360° (cahier des charges §11, §76) — le même `productId` partout : BU et spécialités visées, dossier
 * réglementaire, appels d'offres et marchés, ventes, segmentation, consommation et affinité, coûts (direct, alloué,
 * non alloué), activité terrain. Chaque section n'apparaît qu'à qui a le droit de son module.
 */
export default async function Produit360Page({ params, searchParams }: { params: { id: string }; searchParams?: { annee?: string } }) {
  const user = await requireUser();
  const voit = sections360(user);
  if (!Object.values(voit).some(Boolean)) redirect("/dashboard?denied=PRODUITS");
  const p = await produit360ParId(params.id);
  if (!p) notFound();
  const annee = Number(searchParams?.annee) || new Date().getUTCFullYear();
  const [specialites, reglementaire, segmentation, consommation, attribution] = await Promise.all([
    prisma.promoProductSpecialite.findMany({ where: { promoProduct: { productId: p.produit.id } }, select: { specialty: { select: { name: true } }, promoProduct: { select: { businessUnit: { select: { name: true } } } } } }),
    voit.reglementaire ? prisma.regulatoryProduct.findMany({ where: { productId: p.produit.id, ...regulatoryLockWhere(user) }, select: { id: true, reference: true, brandName: true, status: true } }) : [],
    voit.segmentation ? segmentationDuProduit(p.produit.id) : [],
    voit.consommation ? consommationDuProduit(p.produit.id) : null,
    voit.finances ? attributionProduit(p.produit.id, annee) : null,
  ]);
  const buDe = await prisma.promoProduct.findMany({ where: { productId: p.produit.id, businessUnitId: { not: null } }, select: { businessUnitId: true, businessUnit: { select: { name: true } } } });
  const bus = [...new Map(buDe.map((b) => [b.businessUnitId!, b.businessUnit!.name])).entries()];
  const repartitions = voit.finances && userCan(user, "FINANCES", "VALIDATE") && bus.length
    ? await Promise.all(bus.map(async ([id, nom]) => ({
        id, nom,
        produits: (await prisma.promoProduct.findMany({ where: { businessUnitId: id, productId: { not: null } }, select: { productId: true, canonicalProduct: { select: { canonicalName: true } } } })).filter((x, i, a) => a.findIndex((y) => y.productId === x.productId) === i).map((x) => ({ productId: x.productId!, nom: x.canonicalProduct?.canonicalName ?? x.productId! })),
        parts: Object.fromEntries((await prisma.coutRepartitionBu.findMany({ where: { businessUnitId: id, annee }, select: { productId: true, pct: true } })).map((r) => [r.productId, String(Number(r.pct))])),
      })))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader title={p.produit.nom} description={`${p.produit.code} · ${p.produit.dci}${p.produit.dosage ? ` · ${p.produit.dosage}` : ""}${p.produit.forme ? ` · ${p.produit.forme}` : ""} · ${p.produit.cycleDeVie}${p.produit.alias.length ? ` · alias : ${p.produit.alias.join(", ")}` : ""}`}>
        <Link href="/produits" className="text-sm text-primary underline">Tous les produits</Link>
      </PageHeader>

      <Section titre="Business Units et spécialités visées">
        {bus.length === 0 ? <p className="text-sm text-muted-foreground">Rattaché à aucune BU.</p> : (
          <ul className="text-sm">{bus.map(([id, nom]) => (
            <li key={id}><Link href={`/business-units/${id}`} className="text-primary hover:underline">{nom}</Link>{" — "}{specialites.filter((s) => s.promoProduct.businessUnit?.name === nom).map((s) => s.specialty.name).join(", ") || "toutes les spécialités de la BU"}</li>
          ))}</ul>
        )}
      </Section>

      {voit.reglementaire && (
        <Section titre="Réglementaire">
          {reglementaire.length === 0 ? <p className="text-sm text-muted-foreground">Aucun dossier rattaché.</p> : reglementaire.map((r) => (
            <p key={r.id} className="text-sm"><Link href={`/regulatory/${r.id}`} className="text-primary hover:underline">{r.reference}</Link> · {r.brandName ?? "—"} · {r.status}</p>
          ))}
        </Section>
      )}

      {voit.marches && (
        <Section titre="Appels d'offres et marchés">
          {p.marches.length === 0 ? <p className="text-sm text-muted-foreground">Nommé dans aucun appel d&apos;offres.</p> : p.marches.slice(0, 15).map((m) => (
            <p key={m.ligneId} className="text-sm"><Link href={`/pch/${m.marcheId}`} className="text-primary hover:underline">{m.marche}</Link> · {m.designation} · {m.statut} · {m.quantiteUnites.toLocaleString("fr-FR")} u{m.prixAttributionDzd !== null ? ` · attribué ${dzd(m.prixAttributionDzd)}/u` : ""}</p>
          ))}
        </Section>
      )}

      {voit.ventes && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Chiffre d'affaires (ventes)" value={dzd(p.ventes.chiffreAffairesDzd)} icon="Banknote" />
          <KpiCard label="Quantité vendue" value={p.ventes.quantiteTotale.toLocaleString("fr-FR")} icon="Package" />
          <KpiCard label="Ventes" value={p.ventes.nombre} icon="Receipt" hint={p.ventes.derniere ? `dernière le ${p.ventes.derniere}` : undefined} />
        </div>
      )}

      {voit.segmentation && (
        <Section titre="Segmentation" lien={{ href: "/segmentation", label: "Segmentation Studio" }}>
          {segmentation.length === 0 ? <p className="text-sm text-muted-foreground">Classé dans aucune stratégie active.</p> : segmentation.map((s) => (
            <p key={s.strategieId} className="text-sm"><Link href={`/segmentation?s=${s.strategieId}`} className="text-primary hover:underline">{s.strategie}</Link> (BU {s.businessUnit}, produit #{s.rang}) : {(["A", "B", "C", "D", "EN_ATTENTE", "NON_CIBLE"] as const).map((k) => `${ETAT_LABELS[k]} ${s.repartition[k]}`).join(" · ")} · {s.h} décideur(s) H</p>
          ))}
        </Section>
      )}

      {voit.consommation && consommation && (
        <Section titre="Consommation hospitalière et affinité" lien={{ href: `/consommation/affinite?p=${p.produit.id}`, label: "Régler l'affinité" }}>
          {consommation.parEtablissement.length === 0 ? <p className="text-sm text-muted-foreground">Aucune consommation validée.</p> : (
            <>
              <p className="text-xs text-muted-foreground">{consommation.reglee ? `Affinité : ${consommation.periode ?? "aucune donnée dans la fenêtre"}.` : "Affinité non réglée pour ce produit."}</p>
              {consommation.parEtablissement.map((c) => <p key={`${c.institutionId}${c.unite}`} className="text-sm">{c.nom} · {c.quantite.toLocaleString("fr-FR")} {c.unite ?? ""}{c.affinite !== null ? ` · affinité ${pct(c.affinite)}` : ""}</p>)}
            </>
          )}
        </Section>
      )}

      {voit.finances && attribution && (
        <Section titre={`Coûts attribués — ${annee}`}>
          <div className="flex flex-wrap gap-1 text-xs">{[annee - 1, annee, annee + 1].map((a) => <Link key={a} href={`/produits/${p.produit.id}?annee=${a}`} className={`rounded-md border px-2 py-1 ${a === annee ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{a}</Link>)}</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Coûts directs" value={dzd(attribution.direct)} icon="Target" />
            <KpiCard label="Coûts alloués" value={dzd(attribution.alloue)} icon="Split" tone="info" />
            <KpiCard label="Total attribué" value={dzd(attribution.attribue)} icon="Sigma" hint="direct + alloué — jamais présenté comme direct" />
            <KpiCard label="Non alloué (BU)" value={dzd(attribution.nonAlloueBu)} icon="CircleHelp" tone="warning" hint="coûts de la BU que la règle ne répartit pas" />
          </div>
          {attribution.lignes.map((l) => <p key={`${l.itemId}${l.nature}`} className="text-xs">{l.nature === "DIRECT" ? "Direct" : "Alloué"} · {l.libelle} · {dzd(l.montant)} · {l.detail}</p>)}
          {attribution.limites.map((l, i) => <p key={i} className="text-xs text-warning">{l}</p>)}
          {repartitions.map((r) => <RepartitionBu key={r.id} businessUnitId={r.id} nom={r.nom} annee={annee} produits={r.produits} parts={r.parts} />)}
        </Section>
      )}

      {voit.terrain && (
        <Section titre="Activité terrain">
          <p className="text-sm">{p.terrain.nombreDeVisites} visite(s) où le produit a été présenté{p.terrain.derniereVisite ? `, la dernière le ${p.terrain.derniereVisite}` : ""}.</p>
          {p.terrain.parDelegue.slice(0, 10).map((d) => <p key={d.delegue} className="text-xs text-muted-foreground">{d.delegue} · {d.visites}</p>)}
        </Section>
      )}

      {p.limites.length > 0 && <ul className="list-disc pl-5 text-xs text-muted-foreground">{p.limites.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
