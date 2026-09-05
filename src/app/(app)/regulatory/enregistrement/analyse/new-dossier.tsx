"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createDossier } from "@/lib/regulatory/intelligence/actions";
import { PROCEDURE_TYPE_LABELS, PROCEDURE_TYPE_ORDER } from "@/lib/regulatory/intelligence/labels";

/** Création d'un dossier CTD (métadonnées) — l'archive ZIP se téléverse ensuite dans le détail. */
export function NewDossier() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Verrou SYNCHRONE : bloque un 2ᵉ envoi déclenché par un double-clic (ou double Entrée) AVANT
  // que le ré-affichage n'ait désactivé le bouton — évite la création en double.
  const lock = React.useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const res = await createDossier(new FormData(e.currentTarget));
    if (res.ok && res.id) {
      // Navigation → le composant se démonte ; on garde le verrou pour ne pas ré-ouvrir la porte.
      router.push(`/regulatory/enregistrement/analyse/${res.id}`);
    } else {
      setError(res.error ?? "Échec de la création.");
      setBusy(false);
      lock.current = false;
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nouveau dossier CTD
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Nouveau dossier CTD</p>
        <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Intitulé du dossier *</span>
          <Input name="title" required placeholder="Ex. Amoxicilline 500 mg gélules — enregistrement" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Type de procédure</span>
          <Select name="procedureType" defaultValue="INITIAL_REGISTRATION">
            {PROCEDURE_TYPE_ORDER.map((p) => (
              <option key={p} value={p}>{PROCEDURE_TYPE_LABELS[p]}</option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Référence (optionnel — générée sinon)</span>
          <Input name="reference" placeholder="REG-2026-…" />
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le dossier
        </Button>
      </div>
    </form>
  );
}
