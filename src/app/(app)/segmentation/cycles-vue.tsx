import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Link key={c.id} href={`/segmentation?s=${strategieId}&vue=cycles&cycle=${c.id}`} className={`rounded-md border px-3 py-2 sm:px-2 sm:py-1 ${cycle?.id === c.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
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
          {/* Une ligne = un KAM, puis un praticien : des cartes au téléphone, des tableaux au-delà. */}
          <div className="surface max-sm:border-0 max-sm:bg-transparent">
            <Table mobileCards>
              <TableHeader className="bg-transparent">
                <TableRow><TableHead>KAM</TableHead><TableHead>Praticiens</TableHead><TableHead>P1</TableHead><TableHead>Requis</TableHead><TableHead>Réalisé</TableHead><TableHead>Restant</TableHead><TableHead>Capacité</TableHead><TableHead>Utilisation</TableHead><TableHead>H sous-visités</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {parKam.length === 0 && <TableRow><TableCell colSpan={9} data-sans-etiquette className="!justify-start text-muted-foreground">Aucun KAM de la BU ne couvre ces praticiens (secteurs à affecter dans Force de vente).</TableCell></TableRow>}
                {parKam.map((k) => (
                  <TableRow key={k.repId} className="border-border/60">
                    <TableCell data-sans-etiquette className="!justify-start font-medium sm:py-2">{k.nom}</TableCell>
                    <TableCell className="sm:py-2">{k.praticiens}</TableCell>
                    <TableCell className="sm:py-2">{k.p1}</TableCell>
                    <TableCell className="sm:py-2">{Math.round(k.requis * 10) / 10}</TableCell>
                    <TableCell className="sm:py-2">{k.realise}</TableCell>
                    <TableCell className="sm:py-2">{Math.round(k.restant * 10) / 10}</TableCell>
                    <TableCell className="sm:py-2" title={k.explicationCapacite ?? undefined}>{k.capacite ?? "—"}</TableCell>
                    <TableCell className={`sm:py-2 ${k.utilisation !== null && k.utilisation > 1 ? "text-destructive" : ""}`}>{k.utilisation === null ? "—" : `${Math.round(k.utilisation * 100)} %`}</TableCell>
                    <TableCell className={`sm:py-2 ${k.hSousVisites ? "text-warning" : ""}`}>{k.hSousVisites}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="surface max-sm:border-0 max-sm:bg-transparent">
            <Table mobileCards>
              <TableHeader className="bg-transparent">
                <TableRow><TableHead>Praticien</TableHead><TableHead>Priorité</TableHead><TableHead>Segments</TableHead><TableHead>Visites requises</TableHead><TableHead>Réalisées</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {praticiens.map((p) => {
                  const faites = cycle.realisees[p.doctorId] ?? 0;
                  return (
                    <TableRow key={p.doctorId} className="border-border/60">
                      <TableCell data-sans-etiquette className="!justify-start font-medium sm:py-2 sm:font-normal"><span className="min-w-0 [overflow-wrap:anywhere]">{p.h && <Badge tone="purple" className="mr-1">H</Badge>}{p.nom}</span></TableCell>
                      <TableCell className="sm:py-2">{p.priorite ?? "—"}</TableCell>
                      <TableCell className="sm:py-2">{p.affichage}</TableCell>
                      <TableCell className="sm:py-2" title={p.pourquoiVisites}>{p.visites}</TableCell>
                      <TableCell className={`sm:py-2 ${faites >= p.visites ? "text-success" : ""}`}>{faites}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
