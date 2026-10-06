import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { visibleTabs } from "@/lib/nav-tabs";
import { SITE_WEB_TABS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { etatAffiche, publicationsDe, suspensionEnVigueur } from "@/lib/site-web/etat";
import { peutEcrireArticles } from "@/lib/site-web/acces";
import { EtatPublicationBadge } from "@/components/site-web/etat-badge";
import { RepriseBadge } from "@/components/site-web/reprise";

export const dynamic = "force-dynamic";
export const metadata = { title: "Articles du site — AMD Internal OS" };

/**
 * LES ARTICLES DU BLOG (§118.158) — rédigés ici, publiés sur adventumdz.com/blog. L'état affiché est
 * celui du SITE (confirmé par sa réponse), pas la case cochée dans l'ERP.
 */
export default async function ArticlesPage() {
  const user = await requireModule("SITE_WEB");
  const [articles, suspendu] = await Promise.all([
    prisma.blogArticle.findMany({
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true, title: true, category: true, published: true, featured: true, publishedOn: true, updatedAt: true,
        updatedBy: { select: { name: true } }, reprise: { select: { origine: true } },
      },
    }),
    suspensionEnVigueur(),
  ]);
  const publications = await publicationsDe("POST", articles.map((a) => a.id));
  const ecrit = peutEcrireArticles(user);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Articles du blog" description="Les articles publiés sur adventumdz.com/blog. Rédigés en Markdown, contrôlés avant l'envoi, en ligne dès que le site confirme.">
        {ecrit && <Link href="/site-web/articles/nouveau"><Button size="sm"><Plus className="h-4 w-4" /> Nouvel article</Button></Link>}
      </PageHeader>
      <ModuleTabs tabs={await visibleTabs(user, SITE_WEB_TABS)} />

      {articles.length === 0 ? (
        <EmptyState
          icon="FileText"
          title="Aucun article pour l'instant"
          description={ecrit ? "Rédigez le premier : il reste un brouillon, invisible du site, tant que vous ne le publiez pas." : "Les articles rédigés par l'équipe apparaîtront ici."}
        />
      ) : (
        <div className="sm:surface sm:overflow-hidden">
          <Table mobileCards>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Date affichée</TableHead>
                <TableHead>Sur le site</TableHead>
                <TableHead>Modifié</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((a) => {
                const e = etatAffiche(publications.get(a.id) ?? null, a.published, suspendu);
                return (
                  <TableRow key={a.id}>
                    <TableCell data-sans-etiquette className="font-medium max-sm:!justify-start sm:max-w-[26rem]">
                      <span className="min-w-0">
                        <Link href={`/site-web/articles/${a.id}`} className="break-words hover:underline">{a.title}</Link>
                        {a.featured && <Star className="ml-1.5 inline h-3.5 w-3.5 text-warning" aria-label="À la une" />}
                        <RepriseBadge origine={a.reprise?.origine} />
                      </span>
                    </TableCell>
                    <TableCell label="Catégorie">{a.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell label="Date affichée" className="tabular-nums">{a.publishedOn ? formatDate(a.publishedOn) : "—"}</TableCell>
                    <TableCell label="Sur le site"><EtatPublicationBadge etat={e} /></TableCell>
                    <TableCell label="Modifié" className="text-xs text-muted-foreground">
                      {formatDate(a.updatedAt)}{a.updatedBy ? ` · ${a.updatedBy.name}` : ""}
                    </TableCell>
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
