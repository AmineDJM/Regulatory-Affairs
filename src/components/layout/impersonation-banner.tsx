import { Eye } from "lucide-react";
import { QuitterVueBouton } from "./quitter-vue-bouton";

export function ImpersonationBanner({ adminName, viewedName }: { adminName: string; viewedName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        Vue exacte : vous voyez et testez l&apos;OS exactement comme <strong>{viewedName}</strong>. Une demande créée ici est déposée en son nom ; les autres gestes partent en votre nom ({adminName}).
      </span>
      <QuitterVueBouton />
    </div>
  );
}
