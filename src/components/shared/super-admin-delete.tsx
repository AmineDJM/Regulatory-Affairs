"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { superAdminDelete } from "@/lib/actions/admin-delete-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * Bouton « Supprimer définitivement » réservé au Super Admin (n'est rendu que si `enabled`) :
 * ouvre une confirmation claire, supprime, puis redirige vers la liste où l'élément a disparu.
 * Le serveur revérifie le rôle — ce bouton n'est qu'une commodité.
 *
 * LA PHRASE DE LA CONFIRMATION DISAIT LE CONTRAIRE DU CODE. Elle annonçait « cette action ne
 * peut pas être annulée » alors que `superAdminDelete` passe par `snapshotAndSoftDelete`, qui
 * dépose un instantané dans la corbeille (Administration → Corbeille) d'où le Super Admin
 * restaure. Deux vérités dans le même geste, et celle que la personne LIT était la fausse
 * (§118.5) : elle décourageait un rangement parfaitement défaisable, ou — pire — faisait croire
 * qu'un élément supprimé par erreur était perdu. La phrase dit maintenant ce qui est vrai : le
 * retrait est total sur tous les écrans, et réversible jusqu'à la destruction réelle.
 *
 * `warning` reste la place de ce que la restauration NE rendra PAS : pour un groupe de
 * messagerie, la cascade emporte membres et messages, donc « restaurable » sans cette réserve
 * promettrait un retour qui n'aura pas lieu (§104.16). Elle vient du registre (`KindSpec.reserve`),
 * jamais d'une rédaction propre à l'écran.
 */
export function SuperAdminDeleteButton({
  kind,
  id,
  name,
  enabled,
  label = "Supprimer définitivement",
  warning,
  compact = false,
  stay = false,
}: {
  kind: string;
  id: string;
  name: string;
  enabled: boolean;
  label?: string;
  /** Ligne d'avertissement supplémentaire (ex. périmètre exact de la suppression). */
  warning?: string;
  /** Icône seule (rangée de tableau) — la confirmation, elle, reste identique. */
  compact?: boolean;
  /** Rester sur la page après suppression (ligne d'une liste qui se rafraîchit en place). */
  stay?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!enabled) return null;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("id", id);
    const r = await superAdminDelete(fd);
    if (r.ok) {
      setOpen(false);
      if (!stay) router.push(r.redirect ?? "/mon-espace");
      router.refresh();
    } else {
      setBusy(false);
      setError(r.error ?? "Suppression impossible.");
    }
  }

  return (
    <>
      {compact ? (
        <button
          type="button" onClick={() => setOpen(true)} title={label}
          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> {label}
        </Button>
      )}

      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Supprimer définitivement"
        description="Action réservée au Super Admin — réversible depuis la corbeille."
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Cette suppression retire l'élément de tous les écrans.</p>
              <p>L'élément, ses pièces jointes et ses commentaires n'apparaîtront plus nulle part. Un instantané est déposé dans Administration → Corbeille : le Super Admin peut restaurer, jusqu'à la destruction réelle. Les lignes liées supprimées en cascade, elles, ne reviennent pas.</p>
              {warning && <p className="font-semibold">{warning}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">Élément à supprimer</p>
            <p className="font-medium">{name}</p>
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Oui, supprimer définitivement
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
