import { requireModule } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createCongressInternational } from "@/lib/actions/congress-actions";
import { CONGRESS_STATUS } from "@/lib/labels";
import { CongressIntlTable, type CongressIntlRow } from "./congress-intl-table";

export default async function CongressInternationalPage() {
  const user = await requireModule("CONGRESS_INTERNATIONAL");
  const canCreate = can(user.role, "CONGRESS_INTERNATIONAL", "CREATE");

  const items = await prisma.congressInternational.findMany({ orderBy: { startDate: "desc" } });
  const rows: CongressIntlRow[] = items.map((c) => ({
    id: c.id, name: c.name, country: c.country ?? "", city: c.city ?? "",
    startDate: c.startDate?.toISOString() ?? null, endDate: c.endDate?.toISOString() ?? null,
    specialty: c.specialty ?? "", plannedBudget: c.plannedBudget ? toNumber(c.plannedBudget) : null, status: c.status,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Congrès internationaux" description="Organisation et suivi des congrès internationaux Adventum.">
        {canCreate && (
          <CreateRecordButton
            label="Nouveau congrès"
            title="Nouveau congrès international"
            action={createCongressInternational}
            fields={[
              { type: "text", name: "name", label: "Nom du congrès", required: true, full: true },
              { type: "text", name: "country", label: "Pays" },
              { type: "text", name: "city", label: "Ville" },
              { type: "date", name: "startDate", label: "Date début" },
              { type: "date", name: "endDate", label: "Date fin" },
              { type: "text", name: "specialty", label: "Spécialité" },
              { type: "text", name: "participants", label: "Participants Adventum" },
              { type: "text", name: "invitedDoctors", label: "Médecins invités" },
              { type: "text", name: "products", label: "Produits concernés" },
              { type: "number", name: "plannedBudget", label: "Budget prévu (DZD)" },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(CONGRESS_STATUS), defaultValue: "CONSIDERED" },
            ]}
          />
        )}
      </PageHeader>
      <CongressIntlTable rows={rows} />
    </div>
  );
}
