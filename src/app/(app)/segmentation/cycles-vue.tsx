import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { DUREE_LABELS, type Duree } from "@/lib/segmentation/cycle";
import type { CycleCharge } from "@/lib/segmentation/cycle-service";
import { OuvrirCycle, CloreCycle } from "./cycles-gestes";

/**
 * LES CYCLES — la liste, l'ouverture, et l'avancement du cycle choisi : par KAM (requis, réalisé, restant, capacité,
 * utilisation, H sous-visités, P1), par praticien (ce que le cycle demande, ce qui est fait). Un KAM ne voit que
 * SON panel, dans une vue simple : le praticien, sa priorité, ses segments, les visites requises et faites.
 */
export function CyclesVue({ strategieId, cycles, cycle, peutGerer, moi }: {
  strategieId: string;
  cycles: { id: string; libelle: string; statut: string; debut: Date; fin: Date }[];
  cycle: CycleCharge | null;
  peutGerer: boolean;
  /** Portée « ses lignes » : l'identifiant du KAM, dont on ne montre que le panel. */
  moi: string | null;
}) {
  const praticiens = cycle ? cycle.instantane.praticiens.filter((p) => p.cible && (!moi || p.kamIds.includes(moi))) : [];
  const parKam = cycle ? cycle.parKam.filter((k) => !moi || k.repId === moi) : [];
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
  return (
    <div className="space-y-4">
      {peutGerer && <OuvrirCycle strategieId={strategieId} />}
      {cycles.length === 0 && <p className="surface p-4 text-sm text-muted-foreground">Aucun cycle ouvert pour cette stratégie.</p>}
      <div className="flex flex-wrap gap-1 text-xs">
        {cycles.map((c) => (
          <Link key={c.id} href={`/segmentation?s=${strategieId}&vue=cycles&cycle=${c.id}`} className={`rounded-md border px-2 py-1 ${cycle?.id === c.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            {c.libelle} · {c.statut === "CLOS" ? "clos" : "ouvert"}
          </Link>
        ))}
      </div>
      {cycle && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{cycle.libelle}</span>
            <span className="text-muted-foreground">{fmt(cycle.debut)} → {fmt(cycle.fin)} · {DUREE_LABELS[cycle.duree as Duree] ?? cycle.duree} · règles v{cycle.regleVersion} figées</span>
            <Badge tone={cycle.statut === "CLOS" ? "neutral" : "success"}>{cycle.statut === "CLOS" ? "Clos" : "Ouvert"}</Badge>
            {peutGerer && cycle.statut !== "CLOS" && <CloreCycle cycleId={cycle.id} />}
          </div>
          {!moi && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Visites requises" value={Math.round(cycle.total.requis * 10) / 10} icon="CalendarCheck" />
              <KpiCard label="Réalisées" value={cycle.total.realise} icon="CircleCheck" tone="success" />
              <KpiCard label="Restantes" value={Math.round(cycle.total.restant * 10) / 10} icon="Clock" tone="warning" />
              <KpiCard label="Couverture" value={cycle.total.requis ? `${Math.round((cycle.total.realise / cycle.total.requis) * 100)} %` : "—"} icon="Target" tone="info" />
            </div>
          )}
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">KAM</th><th className="px-3 py-2">Praticiens</th><th className="px-3 py-2">P1</th><th className="px-3 py-2">Requis</th><th className="px-3 py-2">Réalisé</th><th className="px-3 py-2">Restant</th><th className="px-3 py-2">Capacité</th><th className="px-3 py-2">Utilisation</th><th className="px-3 py-2">H sous-visités</th></tr>
              </thead>
              <tbody>
                {parKam.length === 0 && <tr><td colSpan={9} className="px-3 py-3 text-muted-foreground">Aucun KAM de la BU ne couvre ces praticiens (secteurs à affecter dans Force de vente).</td></tr>}
                {parKam.map((k) => (
                  <tr key={k.repId} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{k.nom}</td>
                    <td className="px-3 py-2">{k.praticiens}</td>
                    <td className="px-3 py-2">{k.p1}</td>
                    <td className="px-3 py-2">{Math.round(k.requis * 10) / 10}</td>
                    <td className="px-3 py-2">{k.realise}</td>
                    <td className="px-3 py-2">{Math.round(k.restant * 10) / 10}</td>
                    <td className="px-3 py-2" title={k.explicationCapacite ?? undefined}>{k.capacite ?? "—"}</td>
                    <td className={`px-3 py-2 ${k.utilisation !== null && k.utilisation > 1 ? "text-destructive" : ""}`}>{k.utilisation === null ? "—" : `${Math.round(k.utilisation * 100)} %`}</td>
                    <td className={`px-3 py-2 ${k.hSousVisites ? "text-warning" : ""}`}>{k.hSousVisites}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Praticien</th><th className="px-3 py-2">Priorité</th><th className="px-3 py-2">Segments</th><th className="px-3 py-2">Visites requises</th><th className="px-3 py-2">Réalisées</th></tr>
              </thead>
              <tbody>
                {praticiens.map((p) => {
                  const faites = cycle.realisees[p.doctorId] ?? 0;
                  return (
                    <tr key={p.doctorId} className="border-b border-border/60">
                      <td className="px-3 py-2">{p.h && <Badge tone="purple" className="mr-1">H</Badge>}{p.nom}</td>
                      <td className="px-3 py-2">{p.priorite ?? "—"}</td>
                      <td className="px-3 py-2">{p.affichage}</td>
                      <td className="px-3 py-2" title={p.pourquoiVisites}>{p.visites}</td>
                      <td className={`px-3 py-2 ${faites >= p.visites ? "text-success" : ""}`}>{faites}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
