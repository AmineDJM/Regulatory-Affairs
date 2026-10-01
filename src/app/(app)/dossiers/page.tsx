import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDossiers } from "@/lib/queries/dossiers";
import { getMyCompanies, companyOptions, companyIdForNew, companyLabel } from "@/lib/company";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createDossier } from "@/lib/actions/dossier-actions";
import { DOSSIER_STATUS, PRIORITY } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_SUGGESTIONS = "Recherche, Hôtels, Billets, Analyse IQVIA, Veille, Étude de marché, Autre";

export default async function DossiersPage() {
  const user = await requireModule("DOSSIERS");
  const canCreate = userCan(user, "DOSSIERS", "CREATE");

  const [dossiers, users, entites, entiteParDefaut] = await Promise.all([
    getDossiers(user),
    canCreate ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canCreate ? getMyCompanies(user.id) : Promise.resolve([]),
    canCreate ? companyIdForNew(user.id) : Promise.resolve(null),
  ]);

  const userOptions = [{ value: "", label: "— Personne (à assigner plus tard) —" }, ...users.map((u) => ({ value: u.id, label: u.name }))];
  const active = dossiers.filter((d) => d.status !== "ARCHIVED" && d.status !== "DONE");
  const mine = dossiers.filter((d) => d.assignedToId === user.id && d.status !== "DONE" && d.status !== "ARCHIVED");

  return (
    <div className="space-y-5">
      {/* « SUJETS » — Pilotage, anciennement « Projets » (décision de la Direction, 30/09/2026) :
          « Projets » ne nomme plus que le registre de Business Development (§118.163). */}
      <PageHeader
        title="Sujets"
        description="Déléguez une recherche, une analyse ou une tâche, et suivez tout au même endroit (description, fichiers, discussion)."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouveau sujet"
            title="Ouvrir un sujet"
            description="Décrivez le sujet et, si besoin, désignez un responsable. Vous pourrez ensuite y joindre des fichiers (PPT/Excel/PDF), discuter et ajouter des participants."
            action={createDossier}
            redirectBase="/dossiers"
            fields={[
              { type: "text", name: "title", label: "Intitulé du sujet", required: true, full: true, placeholder: "ex. Recherche prix hôtels — Congrès Paris" },
              // L'ENTITÉ (§118.163) : chaque sujet appartient à une société du groupe — c'est elle qui
              // décide dans quelle vue il apparaît. Proposée d'office : celle sur laquelle on travaille.
              { type: "select", name: "companyId", label: "Entité", options: companyOptions(entites), required: true, defaultValue: entiteParDefaut ?? undefined, placeholder: "Choisir l'entité…" },
              { type: "textarea", name: "description", label: "Description / brief", placeholder: "Ce que vous attendez, le contexte, l'échéance souhaitée…" },
              { type: "text", name: "category", label: "Catégorie", placeholder: CATEGORY_SUGGESTIONS },
              { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
              { type: "select", name: "assignedToId", label: "Responsable", options: userOptions },
              { type: "date", name: "dueDate", label: "Échéance (optionnel)" },
            ]}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Sujets" value={dossiers.length} icon="ClipboardList" />
        <KpiCard label="Actifs" value={active.length} icon="Loader" tone={active.length > 0 ? "info" : "default"} />
        <KpiCard label="Qui me sont confiés" value={mine.length} icon="UserCheck" tone={mine.length > 0 ? "warning" : "default"} />
        <KpiCard label="Aboutis" value={dossiers.filter((d) => d.status === "DONE").length} icon="CheckCircle2" tone="success" />
      </div>

      {dossiers.length === 0 ? (
        <EmptyState icon="ClipboardList" title="Aucun sujet" description={canCreate ? "Ouvrez un sujet pour suivre une recherche, une analyse, une demande…" : "Les sujets qui vous concernent apparaîtront ici."} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Échanges</TableHead>
                  <TableHead>Échéance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossiers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/dossiers/${d.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <span>{d.title}</span>
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{d.reference}</span>
                        {d.category && <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium">{d.category}</span>}
                      </div>
                    </TableCell>
                    {/* L'entité se voit — et son absence aussi : un sujet sans société reste listé pour
                        qu'on le rattache (Administration › Entités), jamais caché (§118.163). */}
                    <TableCell>
                      {d.company ? (
                        <Badge tone="neutral" dot={false}>{companyLabel(d.company)}</Badge>
                      ) : (
                        <Badge tone="warning" dot={false} title="Le Super Admin le rattache depuis Administration › Entités">Entité à renseigner</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.assignedTo?.name ?? "—"}</TableCell>
                    <TableCell><StatusBadge map={DOSSIER_STATUS} value={d.status} /></TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{d._count.messages}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.dueDate ? formatDate(d.dueDate.toISOString()) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
