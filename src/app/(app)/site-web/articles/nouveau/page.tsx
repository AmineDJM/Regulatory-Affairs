import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { slugsDuDepotConnus } from "@/lib/site-web/etat";
import { peutEcrireArticles } from "@/lib/site-web/acces";
import { ArticleForm } from "@/components/site-web/article-form";
import { disponibiliteRedaction } from "@/lib/redaction-site-ia";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouvel article — AMD Internal OS" };

/** RÉDIGER UN ARTICLE — un brouillon tant qu'il n'est pas publié : rien ne part vers le site avant. */
export default async function NouvelArticlePage() {
  const user = await requireModule("SITE_WEB");
  if (!peutEcrireArticles(user)) redirect("/site-web/articles");
  const [depot, categories, ia] = await Promise.all([
    slugsDuDepotConnus(),
    prisma.blogArticle.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true }, take: 50 }),
    disponibiliteRedaction(),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackLink href="/site-web/articles"><ArrowLeft className="h-4 w-4" /> Articles</BackLink>
      <PageHeader title="Nouvel article" description="Structurez le corps en sections ## — le site en tire le sommaire. Il reste un brouillon invisible tant que vous ne le publiez pas." />
      <ArticleForm
        article={{ id: null, title: "", slug: "", description: "", body: "", category: "", tags: "", author: "", publishedOn: "", featured: false, published: false }}
        dejaEnvoye={false}
        etat={null}
        slugsDuDepot={depot.slugs}
        depotConnuAu={depot.au ? depot.au.toISOString() : null}
        peutEcrire
        peutSupprimer={false}
        categories={categories.flatMap((c) => (c.category ? [c.category] : []))}
        ia={ia}
      />
    </div>
  );
}
