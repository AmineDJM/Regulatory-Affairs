import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Ton } from "@/lib/site-web/contrat";

/**
 * L'ÉTAT D'UN CONTENU SUR LE SITE — une pastille et, au besoin, sa phrase. La phrase vient TOUJOURS
 * de `etatPublication` (module pur) : la liste des articles, la fiche d'une offre, la carte d'un
 * recrutement et le tableau de bord disent la même chose du même contenu (§118.158).
 *
 * Aucun import serveur : la page calcule l'état, ce composant ne fait que le montrer — il peut donc
 * vivre aussi bien dans une page serveur que dans un formulaire client.
 */
export interface EtatVisible {
  libelle: string;
  ton: Ton;
  detail: string | null;
  lien: string | null;
}

export function EtatPublicationBadge({ etat, avecDetail = false }: { etat: EtatVisible; avecDetail?: boolean }) {
  return (
    <span className="inline-flex min-w-0 flex-col gap-0.5">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge tone={etat.ton} dot>{etat.libelle}</Badge>
        {etat.lien && (
          <a href={etat.lien} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Voir sur le site <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </span>
      {avecDetail && etat.detail && <span className="text-xs text-muted-foreground">{etat.detail}</span>}
    </span>
  );
}
