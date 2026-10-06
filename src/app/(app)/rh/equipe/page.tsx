import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { voitLesSalaires } from "@/lib/hr/confidentialite";
import { prisma } from "@/lib/prisma";
import { getRhData } from "@/lib/queries/hr";
import { getHrPulse } from "@/lib/queries/hr-pulse";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { CONTRACT_TYPE, EMPLOYES_TABS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createEmployee, analyzeEmployeeContract } from "@/lib/actions/hr-actions";
import { aiConfigured, cleModeleRequise } from "@/lib/ai";
import { phraseIaNonConfiguree } from "@/lib/ia/cle-manquante";
import { getMyCompanies, companyOptions } from "@/lib/company";
import { getDepartmentOptions } from "@/lib/departments";
import { Donut } from "@/components/charts/donut";
import { foldTail } from "@/components/charts/palette";
import { formatCurrency, formatDate, daysUntil, toNumber } from "@/lib/utils";
import { TeamDirectory, type DirectoryRow } from "../team-directory";

export const dynamic = "force-dynamic";

/**
 * RH › EMPLOYÉS › ÉQUIPE — qui travaille ici, où, et sous quel contrat. Cherchable.
 *
 * Elle reçoit aussi la part « effectif » de l'ancien tableau de bord des RH (Direction, 06/10 : le menu Ressources humaines
 * n'est plus un écran, son tableau de bord est réparti dans les sous-modules) : effectif, actifs, contrats à échéance, la
 * masse salariale par entité pour qui voit les salaires, et la création d'un salarié.
 */
export default async function RhTeamPage() {
  const user = await requireModule("EMPLOYEES");
  // LA MÊME RÈGLE que la fiche et la paie (`hr/confidentialite.ts`) — et le salaire n'est pas SÉRIALISÉ quand la colonne
  // est masquée : il partirait dans les données de la page, lisibles dans le navigateur (audit 360°, S5).
  const canSeeSalary = voitLesSalaires(user);
  const canCreate = userCan(user, "EMPLOYEES", "CREATE");

  const [data, pulse, tabs, companies, departmentOptions, linkableUsers] = await Promise.all([
    getRhData(user.id), getHrPulse(user.id), visibleTabs(user, EMPLOYES_TABS),
    canCreate ? getMyCompanies(user.id) : Promise.resolve([]),
    canCreate ? getDepartmentOptions() : Promise.resolve([]),
    canCreate
      ? prisma.user.findMany({ where: { isActive: true, employee: { is: null } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const rows: DirectoryRow[] = data.employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    position: e.position,
    department: e.department,
    contractType: e.contractType,
    contractEnd: e.contractEnd?.toISOString() ?? null,
    baseSalary: canSeeSalary ? toNumber(e.baseSalary) : null,
    leaveBalanceDays: toNumber(e.leaveBalanceDays),
    hasAccount: Boolean(e.user),
    isActive: e.isActive,
    email: e.email,
    phone: e.phone,
  }));

  const employeeFields: FieldDef[] = [
    { type: "text", name: "fullName", label: "Nom complet", required: true, full: true },
    { type: "text", name: "position", label: "Poste" },
    // Rattachement STRUCTURÉ (département ou sous-département) — remplace l'ancien texte libre.
    { type: "select", name: "departmentId", label: "Département", options: departmentOptions.map((o) => ({ value: o.id, label: o.label })), placeholder: "— Non affecté —" },
    { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
    { type: "select", name: "contractType", label: "Type de contrat", options: optionsFromMap(CONTRACT_TYPE), placeholder: "—" },
    { type: "number", name: "baseSalary", label: "Salaire de base (DZD)" },
    { type: "number", name: "leaveBalanceDays", label: "Solde congés (jours)", defaultValue: 30 },
    { type: "date", name: "hireDate", label: "Date d'embauche" },
    { type: "date", name: "contractStart", label: "Début de contrat" },
    { type: "date", name: "contractEnd", label: "Fin de contrat (échéance)" },
    { type: "date", name: "birthDate", label: "Date de naissance" },
    { type: "text", name: "email", label: "Email" },
    { type: "text", name: "phone", label: "Téléphone" },
    { type: "text", name: "iban", label: "RIB / IBAN" },
    { type: "text", name: "nationalId", label: "NIN" },
    { type: "text", name: "cnasNumber", label: "N° CNAS" },
    { type: "text", name: "address", label: "Adresse", full: true },
    { type: "select", name: "managerId", label: "Manager (N+1)", options: data.employees.map((e) => ({ value: e.id, label: e.fullName })), placeholder: "—" },
    { type: "select", name: "userId", label: "Compte applicatif lié", options: linkableUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })), placeholder: "Aucun" },
  ];

  // Répartition de l'effectif : le camembert répond d'un coup d'œil à « où sont les gens ? ».
  const slices = foldTail(pulse.headcount.map((h) => ({ label: h.label, value: h.count })));

  return (
    <div className="space-y-5">
      <PageHeader title="Équipe" description="L'annuaire complet : cherchez par nom, poste, département, e-mail ou téléphone.">
        {canSeeSalary && userCan(user, "RH", "UPDATE") && <Link href="/rh/paie"><Button variant="outline"><Banknote className="h-4 w-4" /> Paie</Button></Link>}
        {canCreate && (
          <CreateRecordButton label="Nouvel employé" title="Ajouter un employé" redirectBase="/rh"
            description="Dossier complet : contrat, état civil, solde de congés et compte applicatif." action={createEmployee} fields={employeeFields}
            analyze={{
              action: analyzeEmployeeContract,
              buttonLabel: "Analyser le contrat",
              title: "Pré-remplir depuis un contrat de travail (IA)",
              hint: "Téléversez le contrat (PDF ou image) : l'OCR Mistral + l'IA extraient nom, poste, type de contrat, dates, salaire de base, NIN, CNAS… Tout reste modifiable avant l'enregistrement.",
              accept: ".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff",
              disabled: !aiConfigured(),
              disabledHint: phraseIaNonConfiguree(cleModeleRequise(), "l'analyse automatique d'un contrat de travail"),
            }} />
        )}
      </PageHeader>
      <ModuleTabs tabs={tabs} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard label="Effectif" value={data.stats.total} icon="Users" />
        <KpiCard label="Actifs" value={data.stats.active} icon="UserCheck" tone="success" />
        <KpiCard label="Contrats à échéance" value={data.stats.expiring} icon="CalendarClock" tone={data.stats.expiring > 0 ? "danger" : "default"} hint="≤ 60 jours" />
        {/* LA COUVERTURE EST DANS LE TON, pas seulement dans la note : un mois de paie partiellement saisi affiche une masse
            salariale qui n'est celle de personne — et se lit comme un effondrement des charges si rien ne le signale. */}
        {canSeeSalary && <KpiCard
          label="Masse salariale" value={formatCurrency(data.stats.masseSalariale)} icon="Wallet"
          tone={data.stats.masseSalarialePartielle ? "warning" : "info"}
          hint={data.stats.masseSalarialePartielle
            ? `${data.stats.masseSalarialeSource} — mois incomplet`
            : data.stats.masseSalarialeSource}
        />}
      </div>

      {/* LA MASSE SALARIALE, SOCIÉTÉ PAR SOCIÉTÉ — un total de groupe sous un effectif d'entité répond à une autre question
          que celle posée. */}
      {canSeeSalary && data.byCompany.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Masse salariale par entité</CardTitle>
            <p className="text-xs text-muted-foreground">
              Somme des <strong>coûts employeur</strong> de l&apos;effectif ACTIF ({data.stats.masseSalarialeSource}) —
              charges patronales comprises. Chaque salarié compte une fois : sa ligne de paie du
              mois si elle existe, sinon le coût employeur de sa fiche.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {data.byCompany.map((c) => (
              <div key={c.id ?? "sans"} className={`rounded-lg border px-3 py-2 ${c.id ? "border-border" : "border-warning/40 bg-warning/5"}`}>
                <p className="truncate text-xs text-muted-foreground" title={c.fullName ?? c.label}>{c.label}</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(c.masseSalariale)}</p>
                <p className="text-[0.6875rem] text-muted-foreground">{c.active} actif{c.active > 1 ? "s" : ""} sur {c.total}</p>
                {c.masseProvenance && (
                  <p className={`text-[0.6875rem] ${c.massePartielle ? "text-warning" : "text-muted-foreground"}`}>
                    {c.masseProvenance}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.contractsExpiring.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contrats arrivant à échéance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.contractsExpiring.map((e) => {
              const d = daysUntil(e.contractEnd);
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/rh/${e.id}`} className="font-medium hover:underline">{e.fullName}</Link>
                  <span className="text-muted-foreground">
                    {formatDate(e.contractEnd)} {d !== null && <span className={d <= 15 ? "text-destructive" : "text-warning"}>· dans {d} j</span>}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="Users" title="Aucun employé" description="Ajoutez les membres de l'équipe avec le bouton « Nouvel employé »." />
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
            </section>
          )}

          <TeamDirectory rows={rows} canSeeSalary={canSeeSalary} />
        </>
      )}
    </div>
  );
}
