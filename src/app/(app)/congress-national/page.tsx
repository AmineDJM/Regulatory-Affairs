import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createCongressNational } from "@/lib/actions/congress-actions";
import { CONGRESS_STATUS } from "@/lib/labels";
import { CongressNationalTable, type CongressNationalRow } from "./congress-national-table";

export default async function CongressNationalPage() {
  const user = await requireModule("CONGRESS_NATIONAL");
  const canCreate = userCan(user, "CONGRESS_NATIONAL", "CREATE");

  const items = await prisma.congressNational.findMany({ orderBy: { date: "desc" } });
  const rows: CongressNationalRow[] = items.map((c) => ({
    id: c.id, name: c.name, city: c.city ?? "", hostInstitution: c.hostInstitution ?? "",
    date: c.date?.toISOString() ?? null, specialty: c.specialty ?? "",
    budget: c.budget ? toNumber(c.budget) : null, hasBooth: c.hasBooth, hasSymposium: c.hasSymposium, status: c.status,
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Congrès nationaux" description="Événements locaux : stands, symposiums, délégués présents.">
        {canCreate && (
          <CreateRecordButton
            label="Nouvel événement"
            title="Nouvel événement national"
            action={createCongressNational}
            fields={[
              { type: "text", name: "name", label: "Nom de l'événement", required: true, full: true },
              { type: "text", name: "city", label: "Ville" },
              { type: "text", name: "hostInstitution", label: "Hôpital / Association" },
              { type: "date", name: "date", label: "Date" },
              { type: "text", name: "specialty", label: "Spécialité" },
              { type: "text", name: "promotedProducts", label: "Produits promus" },
              { type: "number", name: "budget", label: "Budget (DZD)" },
              { type: "text", name: "presentDelegates", label: "Délégués présents" },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(CONGRESS_STATUS), defaultValue: "CONSIDERED" },
              { type: "checkbox", name: "hasBooth", label: "Stand" },
              { type: "checkbox", name: "hasSymposium", label: "Symposium" },
            ]}
          />
        )}
      </PageHeader>
      <CongressNationalTable rows={rows} />
    </div>
  );
}
