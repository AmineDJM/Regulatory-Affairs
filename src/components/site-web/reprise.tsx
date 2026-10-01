import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LIBELLE_ORIGINE, origineReprise } from "@/lib/site-web/reprise-lecture";
import { formatDate } from "@/lib/utils";

/**
 * LA TRACE D'UNE REPRISE DU SITE (§118.160) — une pastille dans les listes, une phrase sur la fiche.
 *
 * Un contenu repris a l'air de n'importe quel autre contenu de l'ERP, et c'est voulu : on le modifie et
 * on le supprime de la même façon. Mais la personne doit pouvoir savoir d'où il vient — un article
 * qu'elle n'a pas écrit, une offre « en brouillon » qu'elle n'a pas créée — et ce que ses gestes y
 * feront : c'est la différence entre corriger un texte et découvrir qu'on vient de retirer du site un
 * article que le public lisait depuis des mois.
 *
 * Aucun import serveur : la page lit la reprise, ce composant ne fait que la montrer.
 */

export function RepriseBadge({ origine }: { origine: string | null | undefined }) {
  if (!origineReprise(origine)) return null;
  return (
    <Badge tone="info" className="ml-1.5 align-middle" title={LIBELLE_ORIGINE[origineReprise(origine)!]}>
      Repris du site
    </Badge>
  );
}

export interface RepriseVisible {
  origine: string;
  cleSite: string;
  titre: string;
  createdAt: Date;
}

/** La phrase d'une fiche reprise : d'où elle vient, et ce que l'enregistrer ou la supprimer fera sur le site. */
export function RepriseNote({ reprise, dejaEnvoye }: { reprise: RepriseVisible | null; dejaEnvoye: boolean }) {
  const origine = origineReprise(reprise?.origine);
  if (!reprise || !origine) return null;
  const quand = formatDate(reprise.createdAt);
  const phrases: string[] =
    origine === "ARTICLE_DEPOT"
      ? [
          `Repris du site le ${quand} : c'était l'article « ${reprise.titre} » écrit dans le dépôt du site (/blog/${reprise.cleSite}).`,
          dejaEnvoye
            ? "C'est désormais cette version qui s'affiche sur le site : modifiez-la ou supprimez-la ici, comme n'importe quel article."
            : "Sa version de l'ERP n'est pas encore partie : le site montre encore l'article d'origine, jusqu'à ce qu'elle parte (dès que son contenu est accepté par le site).",
          "Le supprimer ici le retire aussi du site : l'ancien fichier ne reviendra pas.",
        ]
      : origine === "OFFRE_EXEMPLE"
        ? [
            `Reprise du site le ${quand} : c'est une offre d'EXEMPLE livrée avec le site (« ${reprise.titre} »).`,
            "Elle a été reprise en brouillon et n'est pas en ligne : publiez-la seulement si ce poste existe vraiment, sinon supprimez-la.",
          ]
        : [
            `Reprise du site le ${quand} : cette offre avait été saisie dans l'administration du site.`,
            dejaEnvoye
              ? "C'est désormais cette version qui s'affiche sur la page Carrières : modifiez-la ou supprimez-la ici."
              : "Sa version de l'ERP n'est pas encore partie : le site montre encore l'offre d'origine.",
          ];
  return (
    <div role="note" className="flex gap-2 rounded-xl border border-info/30 bg-info/5 p-3 text-sm">
      <History className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
      <div className="min-w-0 space-y-1">
        {phrases.map((p) => <p key={p} className="break-words">{p}</p>)}
      </div>
    </div>
  );
}
