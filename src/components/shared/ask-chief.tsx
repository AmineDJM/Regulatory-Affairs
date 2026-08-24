import Link from "next/link";
import { Crown } from "lucide-react";

/**
 * « DEMANDER AU CHIEF OF STAFF » — l'entrée contextuelle depuis une fiche.
 *
 * Le bouton emmène sur /chief-of-staff avec la référence du dossier : la question arrive
 * PRÉ-REMPLIE (« donne-moi toute l'histoire de… »), prête à partir — sans recopier la référence.
 * À n'afficher qu'aux détenteurs du module CHIEF_OF_STAFF (le rendre, c'est déjà l'avoir
 * vérifié côté serveur) ; la page vérifie de toute façon le droit à l'arrivée.
 */
export function AskChief({ reference, question }: { reference?: string; question?: string }) {
  const href = question
    ? `/chief-of-staff?q=${encodeURIComponent(question)}`
    : `/chief-of-staff?ref=${encodeURIComponent(reference ?? "")}`;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
      title="Ouvrir My Chief of Staff avec ce dossier"
    >
      <Crown className="h-3.5 w-3.5" /> Demander au Chief of Staff
    </Link>
  );
}
