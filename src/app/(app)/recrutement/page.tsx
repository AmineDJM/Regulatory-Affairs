import Link from "next/link";
import { UserPlus, Info } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, isTopManagement } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor, getMyCompanies } from "@/lib/company";
import { getDepartmentOptions } from "@/lib/departments";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { recruitmentScope } from "@/lib/recruitment/access";
import { STAGE_LABEL, STAGE_TONE, summarize, type RecruitmentStage } from "@/lib/recruitment/request-flow";
import { NewRecruitmentButton } from "./new-request";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recrutement — AMD Internal OS" };

/**
 * RECRUTEMENT — le registre des postes demandés, et où chacun en est.
 *
 * Trois publics sur le même écran, et c'est voulu : le DIRECTEUR y suit ses demandes, le
 * VALIDATEUR y voit ce qui l'attend, les RH y trouvent leur file d'instruction. Trois écrans
 * séparés auraient obligé chacun à savoir lequel ouvrir — et personne n'aurait su où en était
 * une demande sans demander à quelqu'un.
 *
 * Ce que chacun voit est en revanche cloisonné : une fourchette de rémunération et un CV sont
 * des données sensibles. `recruitmentScope` limite la liste à ce dont on est partie.
 */
export default async function RecrutementPage() {
  const user = await requireModule("RECRUITMENT");
  const canCreate = userCan(user, "RECRUITMENT", "CREATE");
  const isHr = userCan(user, "RH", "UPDATE");
  const isTop = isTopManagement(user);

  const [requests, departments, companies] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where: { AND: [recruitmentScope(user), await currentCompanyWhereFor(user.id)] },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: {
        requester: { select: { name: true } },
        department: { select: { name: true } },
        approvals: { select: { order: true, status: true, approverId: true, approver: { select: { name: true } } } },
        _count: { select: { candidates: true } },
      },
    }),
    canCreate ? getDepartmentOptions() : Promise.resolve([]),
    getMyCompanies(user.id),
  ]);

  const rows = requests.map((r) => {
    const waiting = [...r.approvals].sort((a, b) => a.order - b.order).find((a) => a.status === "PENDING");
    return {
      id: r.id,
      reference: r.reference,
      position: r.position,
      stage: r.stage as RecruitmentStage,
      requester: r.requester?.name ?? "—",
      department: r.department?.name ?? "",
      createdAt: r.createdAt,
      candidates: r._count.candidates,
      summary: summarize({
        contractType: r.contractType,
        headcount: r.headcount,
        salaryMin: r.salaryMin != null ? Number(r.salaryMin) : null,
        salaryMax: r.salaryMax != null ? Number(r.salaryMax) : null,
      }),
      // Ce qui rend la liste utile : « qui attend-on ? », lisible sans ouvrir la fiche.
      waitingOn: r.stage === "CHAIN" ? (waiting?.approver?.name ?? null) : null,
      /** Est-ce MOI qu'on attend ? La seule question qui fasse revenir sur cet écran. */
      mine: waiting?.approverId === user.id && r.stage === "CHAIN",
    };
  });

  const open = rows.filter((r) => !["CLOSED", "REJECTED", "CANCELLED"].includes(r.stage));
  const toDecide = rows.filter((r) => r.mine).length;
  const atHr = rows.filter((r) => r.stage === "HR_REVIEW").length;
  const sourcing = rows.filter((r) => r.stage === "SOURCING").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recrutement"
        description="Les postes demandés, leur validation hiérarchique, leur instruction par les RH, puis les CV reçus jusqu'à l'intégration."
      >
        {canCreate && (
          <NewRecruitmentButton
            departments={departments.map((d) => ({ value: d.id, label: d.label }))}
            hasCompany={companies.length > 0}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Demandes ouvertes" value={open.length} icon="UserPlus" />
        <KpiCard label="À valider par vous" value={toDecide} icon="Stamp" tone={toDecide > 0 ? "warning" : "default"} />
        <KpiCard label="Chez les RH" value={atHr} icon="Inbox" tone="info" />
        <KpiCard label="Postes ouverts" value={sourcing} icon="Users" tone="info" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aucune demande de recrutement.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {canCreate
                ? "Formulez le besoin : poste, missions, type de contrat, fourchette de rémunération et dates. Votre hiérarchie le validera, puis les RH l'instruiront."
                : "Vous verrez ici les demandes que vous avez formulées et celles que vous devez valider."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[54rem] border-collapse text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Référence</th>
                <th className="px-3 py-2 text-left font-medium">Poste</th>
                <th className="px-3 py-2 text-left font-medium">Direction</th>
                <th className="px-3 py-2 text-left font-medium">Demandeur</th>
                <th className="px-3 py-2 text-left font-medium">Étape</th>
                <th className="px-3 py-2 text-left font-medium">CV</th>
                <th className="px-3 py-2 text-left font-medium">Déposée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.reference}</td>
                  <td className="px-3 py-2">
                    <Link href={`/recrutement/${r.id}`} className="font-medium hover:underline">{r.position}</Link>
                    <p className="text-xs text-muted-foreground">{r.summary}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.department || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.requester}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={STAGE_TONE[r.stage]} dot={false}>{STAGE_LABEL[r.stage]}</Badge>
                      {r.mine && <Badge tone="warning" dot={false}>à vous</Badge>}
                    </div>
                    {r.waitingOn && !r.mine && (
                      <p className="mt-0.5 text-xs text-muted-foreground">en attente de {r.waitingOn}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.candidates || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Qui fait quoi — dit une fois, pour que personne n'ait à deviner son rôle dans le circuit. */}
      {(isHr || isTop) && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {isHr && "Vous instruisez les demandes validées : demander des précisions, ouvrir le poste, déposer les CV reçus, puis créer la fiche employé. "}
            {isTop && "Vous tranchez en dernier ressort : validation de la chaîne à n'importe quelle marche, choix du candidat (présélectionné ou non) et prononcé du recrutement."}
          </span>
        </p>
      )}
    </div>
  );
}
