import { requireModule } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { createSponsoring } from "@/lib/actions/sponsoring-actions";
import { canChooseAnalysisAtCreation, canDesignateProductManagerAtCreation, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { sponsoringCreateFields } from "@/lib/ad-pro/create-fields";
import { AVAILABLE_PRODUCT_STATUSES } from "@/lib/ad-pro/pickers";
import { EVENTS_TABS } from "@/lib/labels";
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
  // LES RÉFÉRENTIELS DU FORMULAIRE — produits promouvables et médecins de l'annuaire. Les deux
  // portes d'entrée (cet écran et le panneau commun d'Ad & Pro) les chargent de la même façon :
  // un menu peuplé d'un côté et vide de l'autre ferait douter de la liste, pas de la porte.
  const [produits, medecins] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: { status: { in: AVAILABLE_PRODUCT_STATUSES as never } },
      select: { id: true, brandName: true, dci: true, status: true },
      orderBy: [{ brandName: "asc" }, { dci: "asc" }],
    }),
    prisma.medicalDoctor.findMany({
      select: { id: true, name: true, specialty: true, city: true },
      orderBy: [{ specialty: "asc" }, { name: "asc" }],
    }),
  ]);
  // Mêmes champs qu'au panneau commun d'Ad & Pro : une seule définition, deux portes d'entrée.
  const fields = sponsoringCreateFields({
    productManagers: pmCandidates, canDesignatePM, canChooseAnalysis,
    products: produits.map((p) => ({ id: p.id, brandName: p.brandName, dci: p.dci, status: String(p.status) })),
    doctors: medecins,
  });

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
            autoOpenParam="new"
            label="Nouvelle demande"
            title="Nouvelle demande de sponsoring"
            description="Joignez dès maintenant la ou les demandes du médecin — c'est la pièce que tout le circuit va lire. Au-delà de 100 000 DZD, la demande est routée vers la Direction."
            action={createSponsoring}
            redirectBase="/sponsoring"
            fields={fields}
          />
        )}
      </PageHeader>
      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <SponsoringTable rows={rows} />
    </div>
  );
}
