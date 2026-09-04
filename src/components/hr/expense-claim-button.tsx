"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Camera, Loader2, Paperclip, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requestHrDocument } from "@/lib/actions/hr-document-actions";

const moisCourant = () => new Date().toISOString().slice(0, 7);

/**
 * AJOUTER UNE NOTE DE FRAIS — depuis son espace, avec le reçu qu'on a dans la main.
 *
 * ── POURQUOI UNE PORTE DE PLUS, ET PAS UN CIRCUIT DE PLUS ───────────────────────────────────
 *
 * La note de frais EXISTE : c'est une demande RH de type `EXPENSE_REPORT`, avec son mois, ses
 * pièces, son accusé de réception des originaux et sa décision. Elle ne se déposait que depuis
 * « Mon dossier RH », derrière une liste déroulante de douze types — on y allait pour une
 * attestation, pas pour se faire rembourser un taxi.
 *
 * Ce bouton n'invente donc RIEN : il appelle la MÊME action (`requestHrDocument`) et écrit la
 * MÊME demande. Un second circuit aurait donné deux notes de frais pour un seul remboursement,
 * et deux files aux RH (§17).
 *
 * ── SCANNER OU CHOISIR UN FICHIER ───────────────────────────────────────────────────────────
 *
 * Le reçu est un bout de papier qu'on a sous les yeux au moment où l'on saisit. Deux entrées,
 * donc, et le même champ `files` derrière : l'APPAREIL PHOTO (`capture` — sur un téléphone, le
 * bouton ouvre la caméra directement) et le CHOIX DE FICHIERS pour les scans déjà faits et les
 * PDF. Une seule entrée « parcourir » obligeait à photographier d'abord, retrouver l'image
 * ensuite — deux gestes et une photo perdue dans la galerie.
 *
 * ── CE QUE LE FORMULAIRE NE PROMET PAS ──────────────────────────────────────────────────────
 *
 * Les scans ne remplacent pas les ORIGINAUX : le secrétariat en accuse réception dans la
 * demande, et les RH ne décident qu'après. Le dire ici évite de croire le dossier complet — et
 * c'est la même règle que sur l'autre porte, parce que c'est la même demande.
 */
export function ExpenseClaimButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (fd: FormData) => {
    setBusy(true); setErr(null);
    // La nature est POSÉE ICI, pas choisie : le bouton dit ce qu'il fait.
    fd.set("type", "EXPENSE_REPORT");
    const r = await requestHrDocument(fd);
    setBusy(false);
    if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "L'envoi a échoué.");
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setErr(null); setOpen(true); }}>
        <ReceiptText className="h-4 w-4" /> Ajouter une note de frais
      </Button>

      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Ajouter une note de frais"
        description="Le mois concerné, ce que vous avez avancé, et le reçu — photographié ou choisi dans vos fichiers. Les RH la traitent depuis votre dossier."
        width="md"
      >
        <form action={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nf-mois">Mois concerné <span className="text-destructive">*</span></Label>
            <Input id="nf-mois" type="month" name="expenseMonth" defaultValue={moisCourant()} required />
            <p className="text-xs text-muted-foreground">
              Le mois des dépenses. Les RH valideront pour ce mois ou pour le mois suivant.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nf-details">Montant et motif</Label>
            <Textarea
              id="nf-details" name="details" rows={3}
              placeholder="Ex. 4 200 DZD — taxi et péage, déplacement PCH Alger du 12/09"
            />
          </div>

          {/* ── LE REÇU : deux entrées, un seul champ ── */}
          <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <Paperclip className="h-4 w-4 text-primary" /> Le justificatif
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="nf-scan" className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Scanner / photographier
              </Label>
              {/* `capture` ouvre l'appareil photo sur un téléphone ; sur ordinateur, le
                  navigateur retombe de lui-même sur un choix de fichier — rien à gérer. */}
              <input
                id="nf-scan" type="file" name="files" accept="image/*" capture="environment" multiple
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-fichiers">…ou choisir des fichiers</Label>
              <input
                id="nf-fichiers" type="file" name="files" accept="image/*,application/pdf" multiple
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Les originaux restent à déposer</strong> au bureau du secrétariat, qui en
              accusera réception dans cette demande. Les RH décident ensuite.
            </span>
          </p>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {err}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer la note de frais
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
