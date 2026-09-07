"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Landmark, Check } from "lucide-react";
import { setGeneralMeansDepartment } from "@/lib/actions/general-means-service-actions";

/**
 * « C'EST ICI QUE SE TIENNENT LES MOYENS GÉNÉRAUX » — le geste du Super Admin, et de lui seul.
 *
 * Le bouton n'apparaît que sur un département qui n'est PAS déjà le service : sur celui qui
 * l'est, on affiche l'état, sans bouton. Un bouton qui ne change rien invite à cliquer pour
 * vérifier — et l'on ne sait jamais si l'on vient de déplacer la caisse de toute l'entreprise.
 */
export function ServiceSwitch({ departmentId, departmentName, current }: {
  departmentId: string;
  departmentName: string;
  current: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  if (current === departmentId) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
        <Check className="h-4 w-4" /> Service des moyens généraux de la société
      </span>
    );
  }
  return (
    <button type="button" disabled={busy}
      title={`Tout le monde ouvrira la caisse de « ${departmentName} » en arrivant sur les moyens généraux.`}
      onClick={async () => {
        if (!window.confirm(
          `Faire de « ${departmentName} » LE service des moyens généraux ?\n\nC'est cette caisse que toute la société ouvrira désormais.`,
        )) return;
        setBusy(true);
        const fd = new FormData(); fd.set("departmentId", departmentId);
        const r = await setGeneralMeansDepartment(fd);
        setBusy(false);
        if (r.ok) router.refresh(); else window.alert(r.error ?? "Échec.");
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      En faire le service des moyens généraux
    </button>
  );
}
