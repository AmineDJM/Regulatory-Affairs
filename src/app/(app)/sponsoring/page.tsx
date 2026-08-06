import { requireModule } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { createSponsoring } from "@/lib/actions/sponsoring-actions";
import { canChooseAnalysisAtCreation, canDesignateProductManagerAtCreation, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
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
  // La Direction CHOISIT : trancher tout de suite, ou demander d'abord l'avis d'un chef de
  // produit. Le National Sales, lui, n'a pas ce choix — l'analyse est son étape suivante.
  const canChooseAnalysis = canChooseAnalysisAtCreation(user);
  const pmField: FieldDef[] = canDesignatePM && pmCandidates.length > 0
    ? [
        ...(canChooseAnalysis
          ? [{
              type: "select" as const, name: "viaProductManager", label: "Circuit", full: true,
              defaultValue: "0",
              options: [
                { value: "0", label: "Décider maintenant (aucune analyse préalable)" },
                { value: "1", label: "Demander d'abord l'avis d'un chef de produit" },
              ],
            }]
          : []),
        {
          type: "select", name: "productManagerId",
          label: canChooseAnalysis ? "Chef de produit (si analyse demandée)" : "Chef de produit (analyse)",
          required: !canChooseAnalysis,
          placeholder: "— Sélectionner le chef de produit —", full: true,
          options: pmCandidates.map((u) => ({ value: u.id, label: u.name })),
        },
      ]
    : [];

  // Cloisonnement par entité : la vue « Adventum » ne montre que les demandes d'Adventum.
  const requests = await prisma.sponsoringRequest.findMany({
    where: await platformScope(user.id),
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
            description="Joignez dès maintenant la ou les demandes du médecin — c'est la pièce que tout le circuit va lire. Au-delà de 100 000 DZD, la demande est routée vers la Direction."
            action={createSponsoring}
            redirectBase="/sponsoring"
            fields={[
              ...pmField,
              { type: "text", name: "institution", label: "Institution / Association", required: true },
              { type: "file", name: "files", label: "Demande(s) du médecin", multiple: true, full: true, hint: "Courrier, invitation, programme… Plusieurs fichiers possibles." },
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
