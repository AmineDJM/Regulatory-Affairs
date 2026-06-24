import { requireModule } from "@/lib/session";
import { can, scopeMedicalDoctors, scopeMedicalVisits } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createDoctor, createVisit } from "@/lib/actions/medical-actions";
import { INFLUENCE_LEVEL, PRIORITY, VISIT_STATUS } from "@/lib/labels";
import { DoctorsTable, type DoctorRow } from "./doctors-table";
import { VisitsTable, type VisitRow } from "./visits-table";

export default async function MedicalPage() {
  const user = await requireModule("MEDICAL");
  const canCreate = can(user.role, "MEDICAL", "CREATE");
  const isManager = user.role === "MEDICAL_PROMOTION_MANAGER" || user.role === "SUPER_ADMIN" || user.role === "DIRECTION";

  const [doctors, visits, delegates] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: scopeMedicalDoctors(user),
      orderBy: { name: "asc" },
      include: { delegate: { select: { name: true } } },
    }),
    prisma.medicalVisit.findMany({
      where: scopeMedicalVisits(user),
      orderBy: { date: "desc" },
      include: { doctor: { select: { name: true } }, delegate: { select: { name: true } } },
    }),
    isManager
      ? prisma.user.findMany({ where: { role: "MEDICAL_DELEGATE", isActive: true }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const doctorRows: DoctorRow[] = doctors.map((d) => ({
    id: d.id, name: d.name, specialty: d.specialty ?? "", institution: d.institution ?? "",
    city: d.city ?? "", region: d.region ?? "", influenceLevel: d.influenceLevel,
    prescriptionPotential: d.prescriptionPotential, lastVisit: d.lastVisit?.toISOString() ?? null,
    nextVisit: d.nextVisit?.toISOString() ?? null, delegate: d.delegate?.name ?? "",
  }));

  const visitRows: VisitRow[] = visits.map((v) => ({
    id: v.id, date: v.date.toISOString(), doctor: v.doctor?.name ?? "—", delegate: v.delegate?.name ?? "",
    region: v.region ?? "", objective: v.objective ?? "", presentedProducts: v.presentedProducts ?? "", status: v.status,
  }));

  const delegateOptions = delegates.map((d) => ({ value: d.id, label: d.name }));
  const completedThisMonth = visits.filter(
    (v) => v.status === "COMPLETED" && v.date >= new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  ).length;

  const doctorFields: FieldDef[] = [
    { type: "text", name: "name", label: "Nom du médecin", required: true },
    { type: "text", name: "specialty", label: "Spécialité" },
    { type: "text", name: "institution", label: "Hôpital / Clinique" },
    { type: "text", name: "city", label: "Ville" },
    { type: "text", name: "region", label: "Région" },
    { type: "text", name: "phone", label: "Téléphone" },
    { type: "text", name: "email", label: "Email" },
    { type: "select", name: "influenceLevel", label: "Niveau d'influence", options: optionsFromMap(INFLUENCE_LEVEL), defaultValue: "MEDIUM" },
    { type: "select", name: "prescriptionPotential", label: "Potentiel prescription", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "text", name: "targetProducts", label: "Produits ciblés" },
    ...(isManager ? [{ type: "select", name: "delegateId", label: "Délégué", options: delegateOptions, placeholder: "—" } as FieldDef] : []),
  ];

  const visitFields: FieldDef[] = [
    { type: "date", name: "date", label: "Date", required: true },
    { type: "select", name: "doctorId", label: "Médecin", options: doctors.map((d) => ({ value: d.id, label: d.name })), placeholder: "—" },
    { type: "text", name: "region", label: "Région" },
    { type: "text", name: "objective", label: "Objectif de visite" },
    { type: "text", name: "presentedProducts", label: "Produits à présenter" },
    { type: "select", name: "status", label: "Statut", options: optionsFromMap(VISIT_STATUS), defaultValue: "PLANNED" },
    ...(isManager ? [{ type: "select", name: "delegateId", label: "Délégué", options: delegateOptions, placeholder: "—" } as FieldDef] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Promotion médicale" description="Médecins, plans de tournée et suivi des visites des délégués." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Médecins" value={doctorRows.length} icon="Stethoscope" />
        <KpiCard label="Visites totales" value={visitRows.length} icon="ClipboardList" />
        <KpiCard label="Réalisées (mois)" value={completedThisMonth} icon="CheckCircle2" tone="success" />
        <KpiCard label="Prévues" value={visitRows.filter((v) => v.status === "PLANNED").length} icon="CalendarClock" tone="info" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Médecins</h2>
          {canCreate && <CreateRecordButton label="Nouveau médecin" title="Ajouter un médecin" action={createDoctor} fields={doctorFields} />}
        </div>
        <DoctorsTable rows={doctorRows} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visites & tournées</h2>
          {canCreate && <CreateRecordButton label="Nouvelle visite" title="Planifier une visite" action={createVisit} fields={visitFields} />}
        </div>
        <VisitsTable rows={visitRows} />
      </section>
    </div>
  );
}
