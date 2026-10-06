"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { finaliserFicheCoaching, supprimerFicheCoaching } from "@/lib/actions/coaching-actions";
import { Button } from "@/components/ui/button";

/**
 * LES GESTES D'UNE FICHE CONSULTÉE — finaliser, retirer. L'écran ne propose que ce que la règle
 * permet (`gestesSurLaFiche`) ; l'action la revérifie.
 */
export function FicheActions({
  id, collaborateur, finaliser, supprimer, finalisee, complete,
}: {
  id: string;
  collaborateur: string;
  finaliser: boolean;
  supprimer: boolean;
  finalisee: boolean;
  complete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"finaliser" | "supprimer" | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const agir = async (geste: "finaliser" | "supprimer") => {
    const question = geste === "finaliser"
      ? `Finaliser la fiche et la partager avec ${collaborateur} ?\n\nIl en sera prévenu et pourra la consulter. Une fois finalisée, seule la direction des opérations pourra la modifier.`
      : finalisee
        ? `Retirer cette fiche finalisée ? ${collaborateur} en sera prévenu, et elle disparaîtra de son espace.`
        : "Retirer ce brouillon ?";
    if (!window.confirm(question)) return;
    setBusy(geste); setErr(null);
    const fd = new FormData();
    fd.set("id", id);
    const r = geste === "finaliser" ? await finaliserFicheCoaching(fd) : await supprimerFicheCoaching(fd);
    setBusy(null);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
    if (geste === "supprimer") router.push("/medical/coaching");
    router.refresh();
  };

  if (!finaliser && !supprimer) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {err && <span className="text-xs text-destructive" role="alert">{err}</span>}
      {/* Au doigt, l'infobulle du bouton grisé ne s'affiche pas : la raison est écrite. */}
      {finaliser && !complete && <span className="w-full text-xs text-muted-foreground sm:hidden">Notez chaque axe pour pouvoir finaliser.</span>}
      {finaliser && (
        <Button size="sm" onClick={() => void agir("finaliser")} disabled={busy !== null || !complete} title={complete ? undefined : "Notez chaque axe pour pouvoir finaliser."}>
          {busy === "finaliser" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Finaliser et partager
        </Button>
      )}
      {supprimer && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void agir("supprimer")} disabled={busy !== null}>
          {busy === "supprimer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Retirer
        </Button>
      )}
    </span>
  );
}

/** Le bouton d'impression de la page d'impression — et l'impression automatique quand on y arrive par « Imprimer / PDF ». */
export function BoutonImprimer({ auto }: { auto: boolean }) {
  React.useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [auto]);
  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
