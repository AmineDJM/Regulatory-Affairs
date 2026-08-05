import Link from "next/link";
import { FlaskConical } from "lucide-react";

/**
 * Bandeau permanent affiché quand le compte est en **mode test** : il voit des nouveautés
 * que le reste de l'entreprise ne voit pas encore. Sans ce rappel, on croit facilement que
 * tout le monde voit la même chose — et on valide (ou on s'inquiète) à tort.
 */
export function TestModeBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-warning px-4 py-1.5 text-center text-xs font-medium text-warning-foreground">
      <FlaskConical className="h-3.5 w-3.5 shrink-0" />
      <span>Mode test — vous voyez des nouveautés que l&apos;entreprise ne voit pas encore.</span>
      <Link href="/admin/versions" className="underline underline-offset-2 hover:opacity-80">
        Gérer les versions
      </Link>
    </div>
  );
}
