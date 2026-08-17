"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Plus, Loader2, X, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { PAYMENT_PIECE_KIND_OPTIONS, PAYMENT_URGENCY_OPTIONS } from "@/lib/labels";
import { createPaymentRequest } from "@/lib/actions/payment-request-actions";

interface PieceDraft { file: File; kind: string; note: string }

/**
 * DEMANDER UN PAIEMENT — le dossier se constitue ICI, pièce par pièce.
 *
 * Un formulaire qui se contenterait d'un champ « pièces jointes (multiple) » perdrait ce qui fait
 * la valeur du dossier : **le commentaire attaché à CHAQUE pièce**. « Voici la facture, le montant
 * TTC inclut la livraison » appelle une réponse sur cette facture-là — pas un message général que
 * les Finances devront rattacher de tête, puis rechercher trois semaines plus tard.
 *
 * L'échéance a deux formes, et les deux comptent : la **date convenue** quand elle existe, et
 * sinon **l'urgence**. Une demande sans date n'est pas une demande sans priorité — sans ce
 * second champ, elle finit systématiquement au bas de la pile parce que la colonne est vide.
 */
export function NewPaymentButton({ people }: { people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [pieces, setPieces] = React.useState<PieceDraft[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const reset = () => { setPieces([]); setErr(null); };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setPieces((prev) => [...prev, ...Array.from(list).map((file) => ({ file, kind: "INVOICE", note: "" }))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const patch = (i: number, p: Partial<PieceDraft>) =>
    setPieces((prev) => prev.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const submit = async (draft: boolean) => {
    const form = formRef.current;
    if (!form) return;
    setBusy(true); setErr(null);
    const fd = new FormData(form);
    fd.set("submit", draft ? "0" : "1");
    // Chaque pièce voyage avec SON commentaire et SA nature, à l'index correspondant.
    for (const [i, p] of pieces.entries()) {
      fd.append("files", p.file);
      fd.set(`kind_${i}`, p.kind);
      fd.set(`note_${i}`, p.note);
    }
    const r = await createPaymentRequest(undefined, fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "La demande n'a pas pu être créée."); return; }
    setOpen(false); reset();
    router.push(`/validations/paiements/${r.id}`);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}>
        <Banknote className="h-4 w-4" /> Demander un paiement
      </Button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Demander un paiement"
        description="Le dossier part directement aux Finances : montant, bénéficiaire, échéance, et les pièces qui le justifient."
        width="lg"
      >
        <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-title">Objet du paiement <span className="text-destructive">*</span></Label>
              <Input id="pay-title" name="title" required placeholder="Ex. Facture agence — brochure Cardiomax" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-payee">Bénéficiaire <span className="text-destructive">*</span></Label>
              <Input id="pay-payee" name="payee" required placeholder="À qui l'argent doit aller" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Montant (DZD) <span className="text-destructive">*</span></Label>
              <Input id="pay-amount" name="amount" type="number" step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-recipient">Destinataire aux Finances</Label>
              <Select id="pay-recipient" name="recipientId">
                <option value="">— Tout le pôle Finances —</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              {/* Une demande adressée à une personne absente ne doit pas dormir jusqu'à son retour. */}
              <p className="text-xs text-muted-foreground">Sans destinataire, tout le pôle est prévenu.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-due">Échéance discutée</Label>
              <Input id="pay-due" name="dueDate" type="date" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-urgency">…ou, à défaut de date, l&apos;urgence</Label>
              <Select id="pay-urgency" name="urgency" defaultValue="WHEN_POSSIBLE">
                {PAYMENT_URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-desc">Contexte</Label>
              <Textarea id="pay-desc" name="description" rows={3} placeholder="Ce qui a été convenu, avec qui, et pourquoi ce montant." />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Pièces du dossier</Label>
              <input
                ref={fileRef} type="file" multiple className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Plus className="h-4 w-4" /> Ajouter des pièces
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Facture, bon de commande, devis, bon de livraison… <strong className="text-foreground">Chaque pièce
              porte son propre commentaire</strong> — c&apos;est sur cette pièce-là que les Finances répondront.
            </p>

            {pieces.length === 0 ? (
              <p className="rounded-lg bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                Aucune pièce pour l&apos;instant. Un paiement sans justificatif ne s&apos;autorise pas.
              </p>
            ) : (
              <ul className="space-y-2">
                {pieces.map((p, i) => (
                  <li key={`${p.file.name}-${i}`} className="space-y-2 rounded-lg border border-border bg-secondary/20 p-2.5">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.file.name}</span>
                      <button
                        type="button" aria-label="Retirer"
                        onClick={() => setPieces((prev) => prev.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Select value={p.kind} onChange={(e) => patch(i, { kind: e.target.value })}>
                        {PAYMENT_PIECE_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                      <Input
                        className="sm:col-span-2" value={p.note}
                        onChange={(e) => patch(i, { note: e.target.value })}
                        placeholder="Commentaire sur cette pièce (ex. le TTC inclut la livraison)"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>
              Enregistrer en brouillon
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submit(false)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer aux Finances
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
