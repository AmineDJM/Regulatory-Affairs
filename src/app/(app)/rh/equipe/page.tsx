import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getRhData } from "@/lib/queries/hr";
import { getHrPulse } from "@/lib/queries/hr-pulse";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { HR_TABS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Donut } from "@/components/charts/donut";
import { foldTail } from "@/components/charts/palette";
import { formatCurrency, toNumber } from "@/lib/utils";
import { TeamDirectory, type DirectoryRow } from "../team-directory";

export const dynamic = "force-dynamic";

/** RH — L'ANNUAIRE : qui travaille ici, où, et sous quel contrat. Cherchable. */
export default async function RhTeamPage() {
  const user = await requireModule("RH");
  const canSeeSalary = userCan(user, "RH", "VALIDATE");

  const [data, pulse, tabs] = await Promise.all([getRhData(user.id), getHrPulse(user.id), visibleTabs(user, HR_TABS)]);

  const rows: DirectoryRow[] = data.employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    position: e.position,
    department: e.department,
    contractType: e.contractType,
    contractEnd: e.contractEnd?.toISOString() ?? null,
    baseSalary: toNumber(e.baseSalary),
    leaveBalanceDays: toNumber(e.leaveBalanceDays),
    hasAccount: Boolean(e.user),
    isActive: e.isActive,
    email: e.email,
    phone: e.phone,
  }));

  // Répartition de l'effectif : le camembert répond d'un coup d'œil à « où sont les gens ? ».
  const slices = foldTail(pulse.headcount.map((h) => ({ label: h.label, value: h.count })));

  return (
    <div className="space-y-5">
      <PageHeader title="Équipe" description="L'annuaire complet : cherchez par nom, poste, département, e-mail ou téléphone.">
        {canSeeSalary && <Link href="/rh/paie"><Button variant="outline"><Banknote className="h-4 w-4" /> Paie</Button></Link>}
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      {rows.length === 0 ? (
        <EmptyState icon="Users" title="Aucun employé" description="Ajoutez les membres de l'équipe depuis l'onglet « À traiter »." />
      ) : (
        <>
          {slices.length > 1 && (
            <section className="surface space-y-3 p-4">
              <h2 className="text-sm font-semibold">Répartition de l&apos;effectif</h2>
              <Donut
                slices={slices}
                total={pulse.activeCount}
                centerLabel="actifs"
                centerValue={String(pulse.activeCount)}
                format={(n) => `${n} pers.`}
                size={148}
              />
              {canSeeSalary && (
                <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                  Masse salariale mensuelle :{" "}
                  <strong className="text-foreground tabular-nums">{formatCurrency(data.stats.masseSalariale)}</strong>
                  {/* La BASE et la COUVERTURE du chiffre sont dites : un indicateur dont on ignore
                      la base finit par ne plus être cru, et un mois de paie à moitié saisi affiche
                      la masse de quelques personnes sous un libellé qui promet celle de la société. */}
                  <span className="block text-xs">({data.stats.masseSalarialeSource})</span>
                  {data.stats.masseSalarialePartielle && (
                    <span className="mt-1 block text-xs text-warning">
                      Mois de paie incomplet : les salariés dont le mois n&apos;est pas encore marqué
                      « payé » ne sont pas comptés.
                    </span>
                  )}
                </p>
              )}
            </section>
          )}

          <TeamDirectory rows={rows} canSeeSalary={canSeeSalary} />
        </>
      )}
    </div>
  );
}
