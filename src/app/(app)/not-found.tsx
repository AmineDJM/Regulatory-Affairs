import Link from "next/link";
import { SearchX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";

/**
 * UNE FICHE INTROUVABLE — dans la coque, avec le menu, et le chemin d'où l'on vient.
 *
 * C'est ce que rend `notFound()` quand une page ne trouve pas son enregistrement : un dossier
 * supprimé dont une notification garde le lien, une fiche d'une autre entité, un identifiant
 * tronqué dans un courriel. Ce n'est pas une panne de l'outil, et l'écran ne doit pas y
 * ressembler : le menu reste là, on revient d'un geste.
 */
export default function NotFoundInApp() {
  return (
    <div className="space-y-5">
      <PageHeader title="Introuvable" description="Ce que vous cherchez n'est plus là — ou ne vous est pas visible." />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <SearchX className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-foreground">Cette fiche n&apos;existe pas, ou plus.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Elle a pu être supprimée, appartenir à une autre entité, ou le lien suivi est incomplet.
          Si elle devrait vous être visible, demandez l&apos;accès à l&apos;administrateur.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <BackLink href="/" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Revenir
          </BackLink>
          <Link href="/search" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary">
            Rechercher
          </Link>
        </div>
      </div>
    </div>
  );
}
