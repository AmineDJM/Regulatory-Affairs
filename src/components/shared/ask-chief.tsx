import Link from "next/link";
import { Crown, Phone } from "lucide-react";

/**
 * « DEMANDER AU CHIEF OF STAFF » — l'entrée contextuelle depuis une fiche.
 *
 * Le bouton emmène sur /chief-of-staff avec la référence du dossier : la question arrive
 * PRÉ-REMPLIE (« donne-moi toute l'histoire de… »), prête à partir — sans recopier la référence.
 * À n'afficher qu'aux détenteurs du module CHIEF_OF_STAFF (le rendre, c'est déjà l'avoir
 * vérifié côté serveur) ; la page vérifie de toute façon le droit à l'arrivée.
 *
 * `call` (opt-in, réservé aux détenteurs de la voix temps réel) ajoute « Appeler » : l'appel
 * vocal démarre AVEC ce dossier en contexte (?call=1&ref=…) — « où ça bloque ? » se résout
 * sans répéter la référence. Le serveur re-vérifie le droit d'appel à la création de session.
 */
export function AskChief({ reference, question, call }: { reference?: string; question?: string; call?: boolean }) {
  const href = question
    ? `/chief-of-staff?q=${encodeURIComponent(question)}`
    : `/chief-of-staff?ref=${encodeURIComponent(reference ?? "")}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
        title="Ouvrir My Chief of Staff avec ce dossier"
      >
        <Crown className="h-3.5 w-3.5" /> Demander au Chief of Staff
      </Link>
      {call && (
        <Link
          href={`/chief-of-staff?call=1&ref=${encodeURIComponent(reference ?? "")}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"
          title="Appeler My Chief of Staff — l'appel démarre avec ce dossier en contexte"
        >
          <Phone className="h-3.5 w-3.5" /> Appeler
        </Link>
      )}
    </span>
  );
}
