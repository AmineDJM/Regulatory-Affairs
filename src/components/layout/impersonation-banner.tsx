import { Eye, X } from "lucide-react";
import { stopImpersonation } from "@/lib/actions/impersonation-actions";

export function ImpersonationBanner({ adminName, viewedName }: { adminName: string; viewedName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="flex items-center gap-2">
        <Eye className="h-4 w-4 shrink-0" />
        Vue exacte : vous voyez l'OS exactement comme <strong>{viewedName}</strong>. Vos actions seront enregistrées au nom de {adminName}.
      </span>
      <form action={stopImpersonation}>
        <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20">
          <X className="h-3.5 w-3.5" /> Quitter la vue
        </button>
      </form>
    </div>
  );
}
