import { requireModule } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { createSponsoring } from "@/lib/actions/sponsoring-actions";
import { canDesignateProductManagerAtCreation, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PRIORITY, SPONSORING_TYPES, EVENTS_TABS } from "@/lib/labels";
import { SponsoringTable, type SponsoringRow } from "./sponsoring-table";

export default async function SponsoringPage() {
  const user = await requireModule("SPONSORING");
  const canCreate = userCan(user, "SPONSORING", "CREATE");

  // Le National Sales, en créant lui-même une demande, désigne directement le chef de
  // produit (l'analyse lui est confiée) : il n'a pas à approuver préliminairement.
  const canDesignatePM = canDesignateProductManagerAtCreation(user);
  const pmCandidates = canDesignatePM
    ? await prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const pmField: FieldDef[] = canDesignatePM && pmCandidates.length > 0
    ? [{ type: "select", name: "productManagerId", label: "Chef de produit (analyse)", required: true, placeholder: "— Sélectionner le chef de produit —", full: true, options: pmCandidates.map((u) => ({ value: u.id, label: u.name })) }]
    : [];

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
              ...pmField,
              { type: "text", name: "institution", label: "Institution / Association", required: true },
              { type: "text", name: "doctor", label: "Médecin concerné" },
              { type: "text", name: "specialty", label: "Spécialité" },
              { type: "text", name: "city", label: "Ville" },
              { type: "select", name: "type", label: "Type", options: SPONSORING_TYPES.map((t) => ({ value: t, label: t })), defaultValue: "Congrès" },
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
      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <SponsoringTable rows={rows} />
    </div>
  );
}
