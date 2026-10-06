import Link from "next/link";
import { UserPlus, Info, Globe, Inbox } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, isTopManagement } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere, getMyCompanies } from "@/lib/company";
import { getDepartmentOptions } from "@/lib/departments";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { recruitmentScope } from "@/lib/recruitment/access";
import { STAGE_LABEL, STAGE_TONE, summarize, type RecruitmentStage } from "@/lib/recruitment/request-flow";
import { NewRecruitmentButton } from "./new-request";
import { Button } from "@/components/ui/button";
import { peutPublierOffres } from "@/lib/site-web/acces";
import { peutTraiterCandidaturesSite } from "@/lib/site-web/candidatures";

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
  // LES CANDIDATURES DU SITE (§118.159) : celles qui attendent un tri, comptées ici pour qu'on
  // n'ait pas à penser à aller les chercher. La porte est celle du tri — RH et direction.
  const trieur = peutTraiterCandidaturesSite(user);

  const [requests, departments, companies, aTrier] = await Promise.all([
    prisma.recruitmentRequest.findMany({
      where: await companyScopedWhere(user.id, { AND: [recruitmentScope(user)] }),
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
    trieur ? prisma.siteCandidature.count({ where: { etat: "NOUVELLE" } }) : Promise.resolve(0),
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
      /** Est-ce MOI qu'on attend ? La seule question qui fasse revenir sur cet écran — la marche que je
       *  dois trancher, ou MA demande qu'on m'a renvoyée pour correction (§118.192). */
      mine: (waiting?.approverId === user.id && r.stage === "CHAIN") || (r.stage === "RETURNED" && r.requesterId === user.id),
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
        {/* Les OFFRES DU SITE (§118.158) : un poste ouvert se publie sur adventumdz.com/carrieres. La
            porte est celle qui instruit un recrutement (RH en écriture, direction). */}
        {trieur && (
          <Link href="/recrutement/candidatures">
            <Button size="sm" variant={aTrier > 0 ? "primary" : "outline"}>
              <Inbox className="h-4 w-4" /> Candidatures du site{aTrier > 0 ? ` (${aTrier} à trier)` : ""}
            </Button>
          </Link>
        )}
        {peutPublierOffres(user) && (
          <Link href="/site-web/offres">
            <Button size="sm" variant="outline"><Globe className="h-4 w-4" /> Offres sur le site</Button>
          </Link>
        )}
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
        // Au téléphone, chaque demande devient une carte (intitulés repris de l'en-tête) ; au bureau,
        // le tableau garde sa largeur et défile dans son cadre.
        <div className="surface p-2 sm:p-0">
          <Table className="border-collapse min-w-[54rem]">
            <TableHeader className="bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableHead>Référence</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead>CV</TableHead>
                <TableHead>Déposée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-secondary/30">
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.reference}</TableCell>
                  <TableCell data-sans-etiquette className="min-w-0">
                    <div className="w-full min-w-0">
                      <Link href={`/recrutement/${r.id}`} className="font-medium break-words hover:underline">{r.position}</Link>
                      <p className="text-xs text-muted-foreground">{r.summary}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.department || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.requester}</TableCell>
                  <TableCell>
                    <div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:justify-start">
                        <Badge tone={STAGE_TONE[r.stage]} dot={false}>{STAGE_LABEL[r.stage]}</Badge>
                        {r.mine && <Badge tone="warning" dot={false}>à vous</Badge>}
                      </div>
                      {r.waitingOn && !r.mine && (
                        <p className="mt-0.5 text-xs text-muted-foreground">en attente de {r.waitingOn}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.candidates || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
