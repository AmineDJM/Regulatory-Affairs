import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { visibleTabs } from "@/lib/nav-tabs";
import { SITE_WEB_TABS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { STAGE_LABEL, STAGE_TONE, type RecruitmentStage } from "@/lib/recruitment/request-flow";
import { etatAffiche, publicationsDe, suspensionEnVigueur } from "@/lib/site-web/etat";
import { posteOuvert } from "@/lib/site-web/contenus";
import { peutPublierOffres, peutVoirOffres } from "@/lib/site-web/acces";
import { EtatPublicationBadge } from "@/components/site-web/etat-badge";
import { RepriseBadge } from "@/components/site-web/reprise";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offres d'emploi du site — AMD Internal OS" };

/**
 * LES OFFRES D'EMPLOI DU SITE (§118.158) — publiées par les RH, le plus souvent depuis un
 * recrutement ouvert. La page s'ouvre à qui publie les offres (RH en écriture, direction) et à qui
 * tient le module « Site web » en lecture ; ce qu'on y FAIT vient de `lib/site-web/acces.ts`.
 */
export default async function OffresPage() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  if (!peutVoirOffres(user)) notFound();
  const publie = peutPublierOffres(user);

  const [offres, postesSansOffre, suspendu] = await Promise.all([
    prisma.jobPosting.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, department: true, location: true, contractLabel: true, published: true, updatedAt: true,
        recruitmentRequest: { select: { id: true, reference: true, stage: true } },
        reprise: { select: { origine: true } },
      },
    }),
    publie
      ? prisma.recruitmentRequest.findMany({
          where: { stage: "SOURCING", jobPosting: null },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, reference: true, position: true, department: { select: { name: true } } },
        })
      : Promise.resolve([]),
    suspensionEnVigueur(),
  ]);
  const publications = await publicationsDe("JOB", offres.map((o) => o.id));
  const vueSiteWeb = userCan(user, "SITE_WEB", "VIEW");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {!vueSiteWeb && <BackLink href="/recrutement"><ArrowLeft className="h-4 w-4" /> Recrutement</BackLink>}
      <PageHeader
        title="Offres d'emploi du site"
        description="Les postes publiés sur adventumdz.com/carrieres. Une offre rattachée à un recrutement n'est visible que tant que le poste est ouvert."
      >
        {publie && <Link href="/site-web/offres/nouvelle"><Button size="sm"><Plus className="h-4 w-4" /> Nouvelle offre</Button></Link>}
      </PageHeader>
      <ModuleTabs tabs={await visibleTabs(user, SITE_WEB_TABS)} />

      {postesSansOffre.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Postes ouverts sans offre sur le site ({postesSansOffre.length})</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {postesSansOffre.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                <span className="font-medium">{r.position}</span>
                {r.department && <span className="text-muted-foreground">· {r.department.name}</span>}
                <Link href={`/site-web/offres/nouvelle?demande=${r.id}`} className="ml-auto inline-flex min-h-9 items-center gap-1 text-primary hover:underline sm:min-h-0">
                  Préparer l&apos;offre <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offres.length === 0 ? (
        <EmptyState
          icon="Briefcase"
          title="Aucune offre d'emploi pour l'instant"
          description={publie
            ? "Préparez une offre depuis un recrutement ouvert (elle reprend l'intitulé, le contrat, les missions et les compétences), ou créez-en une libre."
            : "Les offres publiées par les RH apparaîtront ici."}
        />
      ) : (
        <div className="sm:surface sm:overflow-hidden">
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead>Poste</TableHead>
                <TableHead>Contrat · lieu</TableHead>
                <TableHead>Recrutement</TableHead>
                <TableHead>Sur le site</TableHead>
                <TableHead>Modifiée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offres.map((o) => {
                const e = etatAffiche(publications.get(o.id) ?? null, o.published, suspendu);
                const etape = o.recruitmentRequest?.stage as RecruitmentStage | undefined;
                return (
                  <TableRow key={o.id}>
                    <TableCell data-sans-etiquette className="font-medium max-sm:!justify-start sm:max-w-[24rem]">
                      <span className="min-w-0">
                        <Link href={`/site-web/offres/${o.id}`} className="break-words hover:underline">{o.title}</Link>
                        <RepriseBadge origine={o.reprise?.origine} />
                        {o.department && <span className="block text-xs font-normal text-muted-foreground">{o.department}</span>}
                      </span>
                    </TableCell>
                    <TableCell label="Contrat · lieu" className="text-sm">
                      {[o.contractLabel, o.location].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell label="Recrutement">
                      {o.recruitmentRequest && etape ? (
                        <span className="inline-flex flex-col gap-0.5">
                          <Link href={`/recrutement/${o.recruitmentRequest.id}`} className="font-mono text-xs hover:underline">{o.recruitmentRequest.reference}</Link>
                          <Badge tone={STAGE_TONE[etape]} dot={false}>{STAGE_LABEL[etape]}</Badge>
                          {o.published && !posteOuvert(etape) && <span className="text-xs text-warning">Poste non ouvert : invisible sur le site</span>}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Offre libre</span>}
                    </TableCell>
                    <TableCell label="Sur le site"><EtatPublicationBadge etat={e} /></TableCell>
                    <TableCell label="Modifiée" className="text-xs text-muted-foreground">{formatDate(o.updatedAt)}</TableCell>
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
