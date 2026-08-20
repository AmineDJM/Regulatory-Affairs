"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { MIN_QUERY } from "@/lib/drive/search";

/**
 * LA BARRE DE RECHERCHE DU DRIVE.
 *
 * Elle cherche dans TOUT le Drive visible, jamais dans le seul dossier ouvert : si l'on savait
 * déjà où regarder, on n'aurait pas besoin de chercher. C'est pourquoi elle renvoie toujours vers
 * `/drive?q=…`, y compris depuis une catégorie — la recherche est un MODE, pas un filtre local.
 *
 * Deux détails qui font la différence à l'usage :
 *
 *   • **`replace` et non `push`** : chaque frappe remplace l'entrée d'historique. Sans cela, un
 *     terme de huit lettres laisserait huit entrées derrière lui, et le bouton « retour » du
 *     navigateur rejouerait la saisie lettre par lettre au lieu de ramener au Drive.
 *   • **un délai de 350 ms** : la recherche est une requête serveur, pas un filtre en mémoire. La
 *     lancer à chaque caractère la ferait tourner pour des préfixes que personne ne voulait
 *     chercher. Entrée déclenche immédiatement, pour qui n'aime pas attendre.
 */

const DEBOUNCE_MS = 350;

export function DriveSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();

  const go = React.useCallback((raw: string) => {
    const q = raw.trim();
    startTransition(() => {
      router.replace(q.length >= MIN_QUERY ? `/drive?q=${encodeURIComponent(q)}` : "/drive");
    });
  }, [router]);

  // La navigation ne part que si la saisie a VRAIMENT changé : sans cette garde, arriver sur une
  // page de résultats relancerait la même recherche au montage.
  React.useEffect(() => {
    if (value.trim() === initial.trim()) return;
    const timer = window.setTimeout(() => go(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, initial, go]);

  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); go(value); }}
      className="relative w-full sm:w-72"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { setValue(""); go(""); } }}
        placeholder="Rechercher dans le Drive…"
        aria-label="Rechercher dans le Drive"
        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => { setValue(""); go(""); }}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {pending && (
        <span className="absolute -bottom-4 left-0 text-[0.6875rem] text-muted-foreground">Recherche…</span>
      )}
    </form>
  );
}
