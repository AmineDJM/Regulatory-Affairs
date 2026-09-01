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
export function NewPaymentButton() {
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
    // ── LE FICHIER SE LIT AVANT, JAMAIS DANS L'UPDATER ────────────────────────────────────────
    //
    // `setPieces((prev) => [...prev, ...Array.from(list)…])` paraît identique et ne l'est pas :
    // le corps de la fonction n'est exécuté que LORSQUE React traite la mise à jour — c'est-à-dire
    // APRÈS la ligne suivante, qui remet l'input à vide. Or vider un `<input type="file">` VIDE SA
    // FileList : `list` est alors une liste vide, et l'on ajoutait zéro pièce.
    //
    // D'où le défaut rapporté : on joignait bien une pièce, et l'envoi répondait quand même
    // « Joignez au moins une pièce ». Le comportement dépendait du moment où React traitait la
    // mise à jour — donc intermittent, donc incompréhensible.
    //
    // On matérialise le tableau MAINTENANT ; l'updater ne fait plus que concaténer.
    const ajoutees = Array.from(list).map((file) => ({ file, kind: "INVOICE", note: "" }));
    if (ajoutees.length === 0) return;
    setPieces((prev) => [...prev, ...ajoutees]);
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
        description="Le dossier part au CENTRE DE PAIEMENT — il n'y a pas de destinataire à choisir : c'est le centre qui autorise, avant que les Finances ne voient quoi que ce soit. Montant, bénéficiaire, échéance demandée, et les pièces qui le justifient."
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
            {/* PLUS DE DESTINATAIRE — la demande va AU CENTRE DE PAIEMENT.
                Choisir une personne aux Finances n'avait plus de sens depuis que le centre est le
                guichet unique : les Finances ne voient rien avant l'autorisation, si bien que le
                champ désignait quelqu'un qui ne pouvait pas encore agir. Et une demande adressée
                à un absent dormait jusqu'à son retour. */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-due">Échéance demandée</Label>
              <Input id="pay-due" name="dueDate" type="date" />
              {/* C'est un SOUHAIT, formé sans voir la trésorerie ni les autres engagements du
                  mois. Le centre de paiement voit la file entière et pose, en autorisant, la
                  date que la comptabilité devra tenir. Dire « demandée » évite de la croire
                  acquise. */}
              <p className="text-xs text-muted-foreground">Le centre de paiement arbitre : il voit la file entière.</p>
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
              // LA RÈGLE SE DIT AVANT, PAS APRÈS. Le bouton « Envoyer » partait, l'action
              // refusait, et l'on découvrait l'exigence dans un message d'erreur rouge après
              // avoir tout saisi. Une contrainte qu'on n'apprend qu'en la heurtant se vit comme
              // une panne.
              <p className="rounded-lg border border-dashed border-warning/50 bg-warning/5 px-3 py-4 text-center text-xs text-muted-foreground">
                Aucune pièce pour l&apos;instant. <strong className="text-foreground">Une pièce au moins est
                nécessaire pour envoyer</strong> — c&apos;est ce que le centre de paiement doit pouvoir lire
                avant d&apos;autoriser. Vous pouvez enregistrer un brouillon sans pièce et la joindre ensuite.
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
            <Button
              type="button"
              disabled={busy || pieces.length === 0}
              title={pieces.length === 0 ? "Joignez au moins une pièce — le centre de paiement doit pouvoir la lire avant d'autoriser." : undefined}
              onClick={() => void submit(false)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer au centre de paiement
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
