"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDossier } from "@/lib/regulatory/intelligence/actions";

/** Suppression d'un dossier (avec confirmation). La cascade + libération des blobs se fait côté serveur. */
export function DeleteDossierButton({ dossierId }: { dossierId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("dossierId", dossierId);
    const res = await deleteDossier(fd);
    if (res.ok) {
      router.push("/regulatory/enregistrement/analyse");
    } else {
      setBusy(false);
      setError(res.error ?? "Échec de la suppression.");
    }
  }

  if (!confirm) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <Trash2 className="h-4 w-4" /> Supprimer
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Confirmer la suppression définitive ?</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(false)} disabled={busy}>Annuler</Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
