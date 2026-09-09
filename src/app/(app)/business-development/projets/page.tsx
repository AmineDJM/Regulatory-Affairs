import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, scopeBdProject } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { regulatoryVisibleWhere } from "@/lib/queries/regulatory-rows";
import { createBdProject } from "@/lib/actions/bd-project-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { PartagerButton } from "@/components/shared/partager-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BD_PROJECT_STATUS, REGULATORY_STATUS, PRIORITY, MANUFACTURING_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PROJETS — un TABLEAU PAR PROJET, et chaque ligne est un dossier réglementaire.
 *
 * Le tableau stratégique de Business Development répond à « où en est ce projet ? » (gammes,
 * marché, investissement). Cet écran-ci répond à l'autre question, celle qu'on pose en réunion :
 * « qu'est-ce que ce projet CONTIENT, dossier par dossier, et où en est chacun ? »
 *
 * ── LE MÊME REGISTRE DE PROJETS, PAS UN SECOND ────────────────────────────────────────────
 *
 * On lit `BdProject`, celui-là même que le tableau stratégique édite. Ouvrir un second registre
 * « projets Regulatory » aurait donné deux listes qui divergent au premier renommage, et la
 * question « ce dossier appartient-il au projet Oncologie 2027 ? » n'aurait plus eu une seule
 * réponse (§118.5). Le classement, lui, se POSE dans Regulatory (colonne « Projet », des deux
 * sous-modules) et se LIT ici : un même geste, un seul endroit où l'écrire.
 *
 * ── DEUX PORTES, ET ELLES NE SE REMPLACENT PAS ────────────────────────────────────────────
 *
 * `scopeBdProject` décide des projets qu'on voit ; `regulatoryVisibleWhere` décide des dossiers
 * qu'on voit DEDANS — la même clause que le tableau Regulatory, verrou du pipeline et périmètre
 * société compris. Un projet peut donc s'afficher avec MOINS de dossiers que ce qu'il contient,
 * et c'est le comportement juste : le compte affiché est celui de ce qu'on a le droit de voir,
 * jamais un total qui révélerait l'existence de dossiers fermés.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export default async function BdProjetsPage() {
  const user = await requireModule("BUSINESS_DEVELOPMENT");
  const canCreate = userCan(user, "BUSINESS_DEVELOPMENT", "CREATE");

  const [projects, dossiers] = await Promise.all([
    prisma.bdProject.findMany({
      where: scopeBdProject(user),
      select: { id: true, name: true, status: true, description: true, owner: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    // LA MÊME PORTE QUE LE TABLEAU REGULATORY. Charger les dossiers « du projet » sans elle
    // ferait de cet écran un contournement du verrou du pipeline : un dossier confidentiel
    // apparaîtrait ici sous son nom, pour qui a Business Development.
    prisma.regulatoryProduct.findMany({
      where: { AND: [await regulatoryVisibleWhere(user), { bdProjectId: { not: null } }] },
      select: {
        id: true, reference: true, dci: true, brandName: true, bdProjectId: true,
        status: true, priority: true, manufacturingStatus: true, targetDate: true,
        company: { select: { shortName: true, name: true } },
        responsible: { select: { name: true } },
      },
      orderBy: [{ priority: "desc" }, { reference: "asc" }],
    }),
  ]);

  const parProjet = new Map<string, typeof dossiers>();
  for (const d of dossiers) {
    if (!d.bdProjectId) continue;
    const lot = parProjet.get(d.bdProjectId);
    if (lot) lot.push(d); else parProjet.set(d.bdProjectId, [d]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projets"
        description="Un tableau par projet : les dossiers réglementaires qui y sont classés, et où en est chacun. Le classement se pose dans Regulatory, colonne « Projet »."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouveau projet"
            title="Nouveau projet"
            description="Nommez le projet. Les dossiers s'y rangent ensuite depuis Regulatory, colonne « Projet »."
            action={createBdProject}
            redirectBase="/business-development"
            fields={[
              { type: "text", name: "name", label: "Nom du projet", required: true, full: true },
              { type: "select", name: "status", label: "Statut", options: optionsFromMap(BD_PROJECT_STATUS), defaultValue: "IDEA" },
              { type: "textarea", name: "description", label: "Description / objectif" },
            ]}
          />
        )}
      </PageHeader>

      {projects.length === 0 ? (
        <EmptyState
          icon="FolderKanban"
          title="Aucun projet"
          description={canCreate
            ? "Créez un projet, puis classez-y vos dossiers depuis Regulatory (colonne « Projet »)."
            : "Les projets nommés par la direction apparaîtront ici."}
        />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const lignes = parProjet.get(p.id) ?? [];
            const st = BD_PROJECT_STATUS[p.status];
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      <FolderKanban className="h-4 w-4 shrink-0 text-primary/80" />
                      {p.name}
                      {st && <StatusBadge map={BD_PROJECT_STATUS} value={p.status} dot={false} />}
                      <span className="text-xs font-normal text-muted-foreground">
                        {lignes.length} dossier{lignes.length > 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                    {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                    {p.owner?.name && <p className="text-xs text-muted-foreground">Porté par {p.owner.name}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <PartagerButton
                      refType="BD_PROJECT" refId={p.id} refLabel={p.name}
                      href="/business-development/projets"
                    />
                    <Link
                      href={`/business-development/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Fiche du projet <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {lignes.length === 0 ? (
                    // ON LE DIT, plutôt que de masquer le projet : un projet nommé et vide est une
                    // information — c'est le moment d'y ranger des dossiers.
                    <p className="text-sm text-muted-foreground">
                      Aucun dossier classé dans ce projet. Depuis <Link href="/regulatory" className="text-primary hover:underline">Regulatory</Link>,
                      colonne « Projet », rangez-y les dossiers concernés.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[52rem] text-left text-sm">
                        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 pb-2 font-medium">Référence</th>
                            <th className="px-3 pb-2 font-medium">DCI / Marque</th>
                            <th className="px-3 pb-2 font-medium">Entité</th>
                            <th className="px-3 pb-2 font-medium">Statut</th>
                            <th className="px-3 pb-2 font-medium">Niveau de process</th>
                            <th className="px-3 pb-2 font-medium">Priorité</th>
                            <th className="px-3 pb-2 font-medium">Chargé du dossier</th>
                            <th className="px-3 pb-2 font-medium">Date cible enreg.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {lignes.map((d) => (
                            <tr key={d.id} className="hover:bg-secondary/30">
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                <Link href={`/regulatory/${d.id}`} className="hover:underline">{d.reference}</Link>
                              </td>
                              <td className="px-3 py-2">
                                <Link href={`/regulatory/${d.id}`} className="font-medium hover:underline">{d.dci}</Link>
                                {d.brandName && <span className="block text-xs text-muted-foreground">{d.brandName}</span>}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {d.company?.shortName || d.company?.name || "—"}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {MANUFACTURING_STATUS[d.manufacturingStatus] ?? d.manufacturingStatus}
                              </td>
                              <td className="px-3 py-2"><StatusBadge map={REGULATORY_STATUS} value={d.status} /></td>
                              <td className="px-3 py-2"><StatusBadge map={PRIORITY} value={d.priority} /></td>
                              <td className="px-3 py-2 text-muted-foreground">{d.responsible?.name ?? "—"}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {d.targetDate ? formatDate(d.targetDate.toISOString()) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
