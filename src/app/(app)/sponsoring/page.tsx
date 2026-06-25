import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { createSponsoring } from "@/lib/actions/sponsoring-actions";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PRIORITY } from "@/lib/labels";
import { SponsoringTable, type SponsoringRow } from "./sponsoring-table";

export default async function SponsoringPage() {
  const user = await requireModule("SPONSORING");
  const canCreate = userCan(user, "SPONSORING", "CREATE");

  const requests = await prisma.sponsoringRequest.findMany({
    orderBy: { requestDate: "desc" },
    include: { requester: { select: { name: true } } },
  });

  const rows: SponsoringRow[] = requests.map((r) => ({
    id: r.id,
    reference: r.reference,
    requestDate: r.requestDate.toISOString(),
    institution: r.institution,
    doctor: r.doctor ?? "",
    type: r.type,
    city: r.city ?? "",
    amountRequested: r.amountRequested ? toNumber(r.amountRequested) : null,
    amountGranted: r.amountGranted ? toNumber(r.amountGranted) : null,
    strategicImportance: r.strategicImportance,
    status: r.status,
    requester: r.requester?.name ?? "",
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Sponsoring" description="Gestion des demandes de sponsoring et de leur validation.">
        {canCreate && (
          <CreateRecordButton
            label="Nouvelle demande"
            title="Nouvelle demande de sponsoring"
            description="Renseignez le budget demandé et votre budget suggéré. Vous pourrez joindre un justificatif (optionnel) sur l'écran suivant. Au-delà de 100 000 DZD, la demande est routée vers la Direction."
            action={createSponsoring}
            redirectBase="/sponsoring"
            fields={[
              { type: "text", name: "institution", label: "Institution / Association", required: true },
              { type: "text", name: "doctor", label: "Médecin concerné" },
              { type: "text", name: "specialty", label: "Spécialité" },
              { type: "text", name: "city", label: "Ville" },
              { type: "text", name: "type", label: "Type (congrès, table ronde…)", placeholder: "Congrès, formation…" },
              { type: "text", name: "product", label: "Produit concerné" },
              { type: "number", name: "amountRequested", label: "Budget demandé par l'intéressé (DZD)" },
              { type: "number", name: "amountProposed", label: "Budget suggéré par le délégué (DZD)" },
              { type: "select", name: "strategicImportance", label: "Importance stratégique", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
              { type: "textarea", name: "description", label: "Description de la demande" },
              { type: "textarea", name: "comments", label: "Appréciation personnelle / recommandation" },
            ]}
          />
        )}
      </PageHeader>

      <SponsoringTable rows={rows} />
    </div>
  );
}
