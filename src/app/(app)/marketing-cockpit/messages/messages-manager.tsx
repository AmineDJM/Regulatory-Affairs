"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createPromoMessage, updatePromoMessage, deletePromoMessage,
} from "@/lib/actions/promo-message-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MessageRow {
  id: string; title: string; body: string | null;
  businessUnitId: string | null; buName: string | null;
  isActive: boolean; sortOrder: number;
  /** Combien de rapports terrain le portent — c'est la mesure que le référentiel existe pour. */
  usages: number;
}

/**
 * LE RÉFÉRENTIEL DES MESSAGES — et le COMPTE de ceux qui les ont portés.
 *
 * Le compte n'est pas décoratif : c'est la seule raison d'avoir un référentiel plutôt qu'un
 * texte libre. Un message publié depuis trois mois et porté zéro fois dit quelque chose ; sans
 * le chiffre, la Direction Marketing écrit dans le vide et ne le sait pas.
 */
export function MessagesManager({
  messages, bus, peutEcrire,
}: {
  messages: MessageRow[];
  bus: { id: string; name: string }[];
  peutEcrire: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<MessageRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const run = async (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) => {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return false; }
    router.refresh();
    return true;
  };

  const remove = async (m: MessageRow) => {
    // LA CONSÉQUENCE AVANT LE CLIC : les rapports qui l'ont porté RESTENT — on retire une
    // consigne du catalogue, pas l'historique de ce qui a été dit sur le terrain.
    const msg = `Retirer « ${m.title} » ?\n\n• Il disparaît du menu déroulant des KAM.\n• Les ${m.usages} rapport(s) terrain qui l'ont porté restent intacts.`;
    if (!window.confirm(msg)) return;
    const fd = new FormData();
    fd.set("id", m.id);
    await run(deletePromoMessage, fd);
  };

  return (
    <div className="space-y-4">
      {!peutEcrire && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground">
          Vous consultez ce référentiel sans pouvoir l&apos;écrire. Le droit s&apos;accorde par rôle dans
          <span className="font-medium"> Administration › Réglages</span> (« Messages Direction Marketing ») —
          c&apos;est une liste de rôles et non un droit de module, pour ne pas ouvrir en même temps les praticiens
          et les visites.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {messages.length} message(s) — {messages.filter((m) => m.isActive).length} actif(s).
          {messages.length === 0 && " Tant que le référentiel est vide, tous les rapports terrain sont refusés : ils en exigent au moins un."}
        </p>
        {peutEcrire && (
          <Button onClick={() => { setErr(null); setCreating(true); }} disabled={busy}>
            <Plus className="h-4 w-4" /> Écrire un message
          </Button>
        )}
      </div>

      {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      <div className="space-y-1.5">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucun message. Écrivez ce que les KAM doivent dire au médecin : ils le choisissent dans un menu
            déroulant sur chaque rapport terrain, et c&apos;est ce qui rend l&apos;efficacité d&apos;un message mesurable.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-wrap items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm", !m.isActive && "opacity-60")}
          >
            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{m.title}</span>
              {m.body && <span className="block text-xs text-muted-foreground">{m.body}</span>}
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {/* VIDE = OUVERT À TOUTES LES GAMMES, et on le DIT : une portée qu'on ne voit pas
                    se lit comme une portée restreinte. */}
                <Badge tone="neutral" dot={false}>{m.buName ?? "Toutes les gammes"}</Badge>
                {!m.isActive && <Badge tone="warning" dot={false}>Inactif</Badge>}
                <span className="text-xs text-muted-foreground">
                  {m.usages === 0 ? "jamais porté" : `porté ${m.usages} fois`}
                </span>
              </span>
            </span>
            {peutEcrire && (
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button" onClick={() => { setErr(null); setEditing(m); }} disabled={busy}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={`Modifier ${m.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button" onClick={() => void remove(m)} disabled={busy}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Retirer ${m.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      <Sheet
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Message « ${editing.title} »` : "Écrire un message"}
        description="L'intitulé est ce que le KAM lit dans son menu déroulant — écrivez-le comme une consigne, pas comme un titre de dossier."
        width="md"
      >
        <form
          className="space-y-3"
          action={async (fd) => {
            if (editing) fd.set("id", editing.id);
            const ok = await run(editing ? updatePromoMessage : createPromoMessage, fd);
            if (ok) { setCreating(false); setEditing(null); }
          }}
        >
          <div>
            <Label htmlFor="msg-title">Intitulé</Label>
            <Input id="msg-title" name="title" required defaultValue={editing?.title ?? ""}
              placeholder="Insister sur la tolérance hépatique du Nivolex" />
          </div>
          <div>
            <Label htmlFor="msg-body">Texte complet (facultatif)</Label>
            <Textarea id="msg-body" name="body" rows={3} defaultValue={editing?.body ?? ""}
              placeholder="L'argument, les chiffres à citer, la référence de l'étude." />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="msg-bu">Gamme</Label>
              <Select id="msg-bu" name="businessUnitId" defaultValue={editing?.businessUnitId ?? ""}>
                <option value="">Toutes les gammes</option>
                {bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="msg-order">Ordre d&apos;affichage</Label>
              <Input id="msg-order" name="sortOrder" type="number" defaultValue={String(editing?.sortOrder ?? 0)} />
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              {/* Le témoin caché fait qu'une case DÉCOCHÉE envoie « off » : sans lui, décocher
                  n'aurait aucun effet — un geste sans conséquence, en silence. */}
              <input type="hidden" name="isActive" value="off" />
              <input type="checkbox" name="isActive" value="on" defaultChecked={editing.isActive} className="h-4 w-4 rounded border-input" />
              Message actif (un message inactif ne se propose plus aux KAM)
            </label>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Publier"}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
