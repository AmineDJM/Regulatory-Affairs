import { Eye } from "lucide-react";
import { QuitterVueBouton } from "./quitter-vue-bouton";

/**
 * LE BANDEAU DE LA VUE EXACTE — une phrase, un bouton (Direction, 06/10 : « quand je vois l'écran de Leila, je dois
 * voir vraiment SON interface, tout »). Rien du profil de l'administrateur n'y figure : ni son nom, ni son menu.
 * La règle des écritures (§118.184 — une demande créée ici l'est au nom de la personne, tout autre geste au vôtre)
 * reste lisible au survol, sans se mêler à l'écran.
 */
export function ImpersonationBanner({ viewedName }: { viewedName: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950"
      title="Une demande créée dans cette vue est déposée au nom de la personne visualisée ; tout autre geste part en votre nom."
      data-vue-exacte
    >
      <span className="flex min-w-0 items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">Vous voyez l&apos;interface de <strong>{viewedName}</strong></span>
      </span>
      <QuitterVueBouton />
    </div>
  );
}
