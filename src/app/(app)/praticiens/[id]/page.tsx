import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { praticienVisible, segmentationDuPraticien } from "@/lib/queries/vue-360";
import { STATUT_LABELS, ETAT_LABELS, pct } from "@/lib/segmentation/regles";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

/**
 * PRATICIEN 360° (cahier des charges §13, §94) — le praticien de l'annuaire, et tout ce qui s'y rattache : son
 * établissement, sa spécialité, sa place dans chaque stratégie (segments PAR produit, H à part, priorité, visites
 * requises et faites dans le cycle ouvert, le pourquoi), son potentiel historisé, ses visites. En tête, la carte
 * simple du KAM : qui il est pour nous, ce qu'il faut faire ce cycle.
 */
export default async function Praticien360Page({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!(await praticienVisible(user, params.id))) notFound();
  const d = await prisma.medicalDoctor.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, title: true, phone: true, email: true, wilaya: true, region: true, archivedAt: true,
      institutionRef: { select: { name: true, type: true, wilaya: true } }, institution: true,
      serviceRef: { select: { name: true } },
      specialtyRef: { select: { name: true } }, specialty: true,
      segmentationObservations: { orderBy: { observeLe: "desc" }, take: 12, select: { potentiel: true, prescriptionsSur10: true, source: true, observeLe: true, commentaire: true } },
      visits: { orderBy: { date: "desc" }, take: 10, select: { id: true, date: true, status: true, objective: true, delegate: { select: { name: true } }, productLinks: { select: { product: { select: { canonicalName: true } } } } } },
    },
  });
  if (!d) notFound();
  const strategies = await segmentationDuPraticien(d.id);
  const cycles = await prisma.segmentationCycle.findMany({ where: { strategieId: { in: strategies.map((s) => s.strategieId) }, statut: "OUVERT" }, select: { strategieId: true, debut: true, fin: true, libelle: true, instantane: true } });
  const visitesDuCycle = async (debut: Date, fin: Date) => prisma.medicalVisit.count({ where: { doctorId: d.id, status: "COMPLETED", date: { gte: debut, lt: new Date(fin.getTime() + 86_400_000) } } });

  return (
    <div className="space-y-5">
      <PageHeader title={d.name} description={[d.title !== "AUTRE" ? d.title : null, d.specialtyRef?.name ?? d.specialty, d.institutionRef?.name ?? d.institution, d.serviceRef?.name, d.wilaya ?? d.region].filter(Boolean).join(" · ")}>
        <Link href="/medical/annuaire" className="text-sm text-primary underline">Annuaire</Link>
      </PageHeader>
      {d.archivedAt && <p className="text-sm text-warning">Fiche archivée dans l&apos;annuaire.</p>}

      {await Promise.all(strategies.map(async (s) => {
        const r = s.ligne?.resultat;
        const cycle = cycles.find((c) => c.strategieId === s.strategieId);
        const fige = cycle ? (cycle.instantane as { praticiens?: { doctorId: string; visites: number; priorite: string | null; affichage: string }[] }).praticiens?.find((p) => p.doctorId === d.id) : undefined;
        const faites = cycle ? await visitesDuCycle(cycle.debut, cycle.fin) : null;
        return (
          <section key={s.strategieId} className="surface space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/segmentation?s=${s.strategieId}`} className="text-sm font-semibold text-primary hover:underline">{s.strategie}</Link>
              <span className="text-xs text-muted-foreground">BU {s.businessUnit}</span>
              {s.ligne?.statut && <Badge>{STATUT_LABELS[s.ligne.statut]}</Badge>}
              {r?.h && <Badge tone="purple">H — décideur</Badge>}
            </div>
            {!r ? <p className="text-sm text-muted-foreground">{s.regles ? "Hors du panel de cette stratégie." : "Règles non publiées."}</p> : (
              <>
                <p className="text-lg font-semibold">{r.cible ? (r.priorite ? `Priorité ${r.priorite.replace(/^P/, "")}` : "Ciblé — priorité en attente de données") : "Non ciblé"}</p>
                <div className="flex flex-wrap gap-3 text-sm">{r.produits.map((p) => <span key={p.productId}>{s.produits.find((x) => x.productId === p.productId)?.nom} — <b>{ETAT_LABELS[p.etat]}</b>{p.derogation ? " (dérogation)" : ""}</span>)}</div>
                <p className="text-sm">Visites requises ce cycle : <b>{fige?.visites ?? r.visites}</b>{faites !== null ? ` · réalisées : ${faites}` : ""}{cycle ? ` (${cycle.libelle})` : ""} · objectif principal : {s.produits[0]?.nom ?? "—"}</p>
                <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Pourquoi ?</summary>
                  {r.produits.map((p) => <p key={p.productId}>{s.produits.find((x) => x.productId === p.productId)?.nom} : {p.pourquoi.join(" ")}{p.affinite !== null ? ` (affinité ${pct(p.affinite)})` : ""}</p>)}
                  <p>{r.pourquoiPriorite}</p><p>{r.pourquoiVisites}</p>
                </details>
              </>
            )}
          </section>
        );
      }))}

      <section className="surface space-y-1 p-4 text-sm">
        <h2 className="font-semibold">Potentiel (historique)</h2>
        {d.segmentationObservations.length === 0 && <p className="text-muted-foreground">Aucune donnée terrain.</p>}
        {d.segmentationObservations.map((o, i) => <p key={i} className="text-xs">{o.observeLe.toLocaleDateString("fr-FR")} · {o.potentiel === null ? "—" : Number(o.potentiel)} patients · {o.prescriptionsSur10 === null ? "—" : Number(o.prescriptionsSur10)}/10 · {o.source.toLowerCase()}{o.commentaire ? ` · ${o.commentaire}` : ""}</p>)}
      </section>

      <section className="surface space-y-1 p-4 text-sm">
        <h2 className="font-semibold">Visites</h2>
        {d.visits.length === 0 && <p className="text-muted-foreground">Aucune visite.</p>}
        {d.visits.map((v) => <p key={v.id} className="text-xs">{v.date.toLocaleDateString("fr-FR")} · {v.status} · {v.delegate?.name ?? "—"}{v.productLinks.length ? ` · ${v.productLinks.map((l) => l.product.canonicalName).join(", ")}` : ""}{v.objective ? ` · ${v.objective}` : ""}</p>)}
      </section>
    </div>
  );
}
