import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * LA PAGE QUI N'EXISTE PAS — dite en français, avec un chemin de retour.
 *
 * Sans ce fichier, Next affiche « 404 | This page could not be found » : une page blanche, en
 * anglais, sans menu ni lien. Pour quelqu'un qui vient de cliquer « Traiter » dans une
 * notification, cela se lit comme une panne de l'outil — et l'on ferme l'onglet.
 *
 * Celle-ci vaut pour les ADRESSES qui ne correspondent à aucune route (une URL tapée, un vieux
 * favori). Une fiche introuvable dans un module (`notFound()` depuis une page) tombe, elle, sur
 * `(app)/not-found.tsx`, DANS la coque — avec le menu, pour repartir sans tout recharger.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <SearchX className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette adresse ne correspond à aucun écran. Elle a peut-être été déplacée, ou le lien
          que vous avez suivi n&apos;est plus à jour.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Revenir à l&apos;accueil
          </Link>
          <Link
            href="/search"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
          >
            Rechercher
          </Link>
        </div>
      </div>
    </main>
  );
}
