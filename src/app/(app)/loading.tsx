/**
 * L'ATTENTE A UNE FORME — un squelette, pas un écran blanc.
 *
 * Entre le clic et l'arrivée d'une page rendue côté serveur, il n'y avait RIEN : le contenu
 * précédent restait figé, ou l'écran passait au blanc. Sur un réseau mobile, ces deux secondes
 * se lisent « ça n'a pas marché », et l'on reclique — deux navigations pour une.
 *
 * Le squelette reproduit la silhouette de la plupart des écrans (un titre, une rangée de
 * chiffres, une liste) : l'œil sait où regarder avant même que la page soit là. Il est
 * volontairement sobre — un chargeur qui attire l'attention rend l'attente plus longue.
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-48 max-w-full animate-pulse rounded-md bg-secondary" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-secondary/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/60" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/50" />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
