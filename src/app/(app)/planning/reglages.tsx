import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

/**
 * L'EN-TÊTE DES RÉGLAGES DE LA FORCE DE VENTE (« ⋯ › Réglages », Direction 07/10) — Business units, Secteurs, Paramètres.
 * Réservés à qui configure : chaque page le vérifie côté serveur avant de rendre cet en-tête.
 */
const LIENS = [
  { cle: "business-units", label: "Business units", href: "/planning/business-units" },
  { cle: "secteurs", label: "Secteurs", href: "/planning/business-units?etape=secteurs" },
  { cle: "parametres", label: "Paramètres", href: "/planning/parametres" },
] as const;

export function EnteteReglages({ actif }: { actif: (typeof LIENS)[number]["cle"] }) {
  return (
    <div className="space-y-3">
      <Link href="/planning" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Force de vente
      </Link>
      <PageHeader title="Réglages" />
      <nav className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0" aria-label="Réglages">
        {LIENS.map((l) => (
          <Link key={l.cle} href={l.href} aria-current={actif === l.cle ? "page" : undefined}
            className={cn("shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium sm:py-2",
              actif === l.cle ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
