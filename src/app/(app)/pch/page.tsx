import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getPchTenders, pchSummary } from "@/lib/queries/pch";
import { createTender } from "@/lib/actions/pch-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { PCH_TENDER_STATUS } from "@/lib/labels";
import { getCompanies, companyOptions } from "@/lib/company";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export default async function PchPage() {
  const user = await requireModule("PCH");
  const canCreate = userCan(user, "PCH", "CREATE");
  const [tenders, companies] = await Promise.all([getPchTenders(), getCompanies()]);
  const s = pchSummary(tenders);

  return (
    <div className="space-y-5">
      <PageHeader title="PCH — Marchés publics" description="Appels d'offres gagnés et bons de commande de la Pharmacie Centrale des Hôpitaux, avec suivi des cautions.">
        {canCreate && (
          <CreateRecordButton
            label="Nouvel appel d'offres"
            title="Appel d'offres gagné"
            description="Référence laissée vide = numérotation automatique (AO-année-n)."
            redirectBase="/pch"
            action={createTender}
            fields={[
              { type: "text", name: "reference", label: "Référence (optionnel)" },
              { type: "select", name: "companyId", label: "Entité", options: companyOptions(companies), placeholder: "— Entité —" },
              { type: "text", name: "title", label: "Intitulé", full: true },
              { type: "file", name: "tenderDoc", label: "Appel d'offres (fichiers, optionnel)", multiple: true, hint: "Cahier des charges, PV d'ouverture… — ajoutables aussi plus tard depuis le marché.", full: true },
              { type: "textarea", name: "products", label: "Produits concernés", full: true },
              { type: "text", name: "supplier", label: "Fournisseur" },
              { type: "text", name: "supplierCountry", label: "Pays du fournisseur" },
              { type: "number", name: "quantity", label: "Quantité totale" },
              { type: "number", name: "value", label: "Valeur (DZD)" },
              { type: "text", name: "client", label: "Client", defaultValue: "PCH" },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(PCH_TENDER_STATUS), defaultValue: "NOT_STARTED" },
              { type: "date", name: "awardDate", label: "Date d'attribution" },
              { type: "number", name: "cautionAmount", label: "Caution — montant (DZD)" },
              { type: "checkbox", name: "cautionDeposited", label: "Caution déposée" },
              { type: "date", name: "cautionStart", label: "Caution — début" },
              { type: "date", name: "cautionEnd", label: "Caution — fin" },
              { type: "textarea", name: "notes", label: "Notes", full: true },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Appels d'offres" value={s.count} icon="Gavel" />
        <KpiCard label="En cours" value={s.inProgress} icon="Activity" tone="info" />
        <KpiCard label="Valeur totale" value={formatCurrency(s.totalValue)} icon="Coins" tone="success" />
        <KpiCard label="Cautions à déposer" value={s.cautionsToDeposit} icon="ShieldAlert" tone={s.cautionsToDeposit > 0 ? "warning" : "default"} />
        <KpiCard label="Cautions < 30j" value={s.cautionsExpiringSoon} icon="AlarmClock" tone={s.cautionsExpiringSoon > 0 ? "danger" : "default"} />
      </div>

      {tenders.length === 0 ? (
        <EmptyState icon="Gavel" title="Aucun appel d'offres" description={canCreate ? "Créez un appel d'offres gagné, puis ajoutez les bons de commande reçus." : "Les marchés PCH apparaîtront ici."} />
      ) : (
        <div className="surface overflow-x-auto">
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead><TableHead>Intitulé / Produits</TableHead><TableHead>Fournisseur</TableHead>
                <TableHead className="text-right">Qté</TableHead><TableHead className="text-right">Valeur</TableHead>
                <TableHead>Caution</TableHead><TableHead>Bons</TableHead><TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenders.map((t) => {
                const cautionExpired = t.cautionEnd && new Date(t.cautionEnd) < new Date();
                return (
                  <TableRow key={t.id}>
                    <TableCell label="Référence" className="font-mono text-xs"><Link href={`/pch/${t.id}`} className="hover:underline">{t.reference}</Link></TableCell>
                    <TableCell label="Intitulé" className="font-medium">{t.title || "—"}{t.products && <p className="text-xs text-muted-foreground">{t.products}</p>}</TableCell>
                    <TableCell label="Fournisseur" className="text-muted-foreground">{[t.supplier, t.supplierCountry].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell label="Qté" className="text-right">{formatNumber(t.quantity)}</TableCell>
                    <TableCell label="Valeur" className="text-right">{t.value !== null ? formatCurrency(t.value) : "—"}</TableCell>
                    <TableCell label="Caution">
                      {(t.cautionAmount ?? 0) > 0 || t.cautionDeposited ? (
                        <Badge tone={t.cautionDeposited ? (cautionExpired ? "danger" : "success") : "warning"} dot={false}>
                          {t.cautionDeposited ? (cautionExpired ? "Expirée" : "Déposée") : "Non déposée"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell label="Bons" className="text-muted-foreground">{t.orderCount}</TableCell>
                    <TableCell label="Statut"><StatusBadge map={PCH_TENDER_STATUS} value={t.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
