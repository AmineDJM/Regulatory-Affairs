import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPromoMaterials } from "@/lib/queries/promo-material";
import { createPromoMaterial } from "@/lib/actions/promo-material-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { promoMaterialCreateFields } from "@/lib/ad-pro/create-fields";
import { PROMO_MATERIAL_STATUS, EVENTS_TABS, MATERIAL_TYPE } from "@/lib/labels";
import { libelleEtape, type PromoState } from "@/lib/promo-material/circuit";
import { CompanyBadge } from "@/components/shared/company-badge";
import { getMyCompanies, companyOptions } from "@/lib/company";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PromoMaterialPage() {
  const user = await requireModule("PROMO_MATERIAL");
  const canCreate = userCan(user, "PROMO_MATERIAL", "CREATE");
  const [items, companies] = await Promise.all([getPromoMaterials(user), getMyCompanies(user.id)]);

  // LES ASSISTANTES DE DIRECTION (§118.152) — et elles seules. Ce menu proposait tout compte
  // actif : le demandeur pouvait nommer un collègue pour recopier les prix qu'il retiendra
  // ensuite. L'action refuse aussi tout autre choix — le menu n'est pas la garde.
  const assistants = canCreate
    ? await prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(["DIRECTION_ASSISTANT"]) }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  // Mêmes champs qu'au panneau commun d'Ad & Pro : une seule définition, deux portes d'entrée.
  // LES GAMMES ACTIVES — c'est le budget Ad&Pro de l'une d'elles que la demande engage.
  const businessUnits = await prisma.businessUnit.findMany({
    where: { isActive: true }, select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const createFields = promoMaterialCreateFields({ companies: companyOptions(companies), assistants, businessUnits });

  // Un dossier au circuit court se juge sur SON état ; un ancien dossier sur l'ancien statut.
  const isClosed = (i: { status: string; circuitState: string | null }) =>
    i.circuitState ? i.circuitState === "COMPLETED" || i.circuitState === "REFUSED" : i.status === "SETTLED" || i.status === "CANCELLED";
  const active = items.filter((i) => !isClosed(i)).length;
  const settled = items.filter((i) => (i.circuitState ? i.circuitState === "COMPLETED" : i.status === "SETTLED")).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Matériel promotionnel" description="Demande validée (N+1 ou directrice marketing) → devis retranscrits par l'assistante → choix des lignes → Direction Marketing (et Directeur Général au-dessus du seuil) → bons de commande générés, factures et paiements, visa publicitaire ou déclaration à chaque paiement.">
        {canCreate && (
          <CreateRecordButton
            autoOpenParam="new" label="Nouvelle demande" title="Demande de matériel promotionnel" description="Votre demande est d'abord validée (N+1, ou directrice marketing) ; vous demanderez ensuite les devis au secrétariat." width="md" action={createPromoMaterial} redirectBase="/promo-material" fields={createFields} />
        )}
      </PageHeader>

      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Dossiers" value={items.length} icon="Megaphone" />
        <KpiCard label="En cours" value={active} icon="Loader" tone={active > 0 ? "info" : "default"} />
        <KpiCard label="Réglés" value={settled} icon="CheckCircle2" tone="success" />
      </div>

      {items.length === 0 ? (
        <EmptyState icon="Megaphone" title="Aucun dossier" description={canCreate ? "Créez une demande de matériel promotionnel pour démarrer." : "Les dossiers de matériel promotionnel apparaîtront ici."} />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead><TableHead>Campagne</TableHead><TableHead>Type</TableHead><TableHead>Agence</TableHead>
                <TableHead className="text-right">Montant</TableHead><TableHead>Statut</TableHead><TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs"><Link href={`/promo-material/${i.id}`} className="hover:underline">{i.reference}</Link></TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/promo-material/${i.id}`} className="hover:underline">{i.title}</Link>
                    {i.company && <div className="mt-0.5"><CompanyBadge company={i.company} /></div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.materialType ? MATERIAL_TYPE[i.materialType] : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{i.chosenAgency || "—"}</TableCell>
                  <TableCell className="text-right">{i.amount != null ? formatCurrency(i.amount) : "—"}</TableCell>
                  <TableCell>
                    {/* Un dossier au circuit court affiche l'état du circuit ; un dossier
                        d'avant la réforme garde son ancien statut. */}
                    {/* LE LIBELLÉ D'UNE ÉTAPE VIENT DU CIRCUIT (`libelleEtape`), comme sur la fiche : une
                        table recopiée ici disait encore « Validation du N+1 » pour l'étape de la
                        Direction Marketing, et ne connaissait pas celle du Directeur Général. Un
                        dossier annulé se lit « Annulé », pas « Refusé ». */}
                    {i.circuitState && i.status !== "CANCELLED"
                      ? <StatusBadge map={{ [i.circuitState]: { label: libelleEtape(i.circuitState as PromoState, i.circuitVersion === 2 ? 2 : 1), tone: i.circuitState === "REFUSED" ? "danger" : i.circuitState === "COMPLETED" ? "success" : "info" } }} value={i.circuitState} dot={false} />
                      : <StatusBadge map={PROMO_MATERIAL_STATUS} value={i.status} dot={false} />}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
