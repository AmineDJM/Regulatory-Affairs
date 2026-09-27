"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, Pencil, Send, Stethoscope, Trash2, Upload, Wand2 } from "lucide-react";
import {
  genererBonsDeCommandePromo, modifierBonDeCommandePromo, annulerBonDeCommandePromo, marquerBonDeCommandeEnvoye,
  deposerFacturePromo, demanderPaiementFacturePromo, adresserInfoMedicaleFacturePromo,
} from "@/lib/actions/promo-execution-actions";
import { formatDzd } from "@/lib/promo-material/devis";
import { lienFichierEmis } from "@/lib/legal/fichiers-emis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

/**
 * L'EXÉCUTION D'UN DOSSIER DU CIRCUIT 2 — du devis retenu au visa (§118.152).
 *
 * Une ligne par devis dont une ligne est retenue, et sur chaque ligne la chaîne ENTIÈRE, dans
 * l'ordre où elle se fait : le bon de commande (généré par la plateforme, validé par un centre
 * au-dessus du seuil, signé par les Finances, envoyé), ses factures (fichier obligatoire), leur
 * paiement (centre de paiement), et la demande de visa — ou de déclaration au ministère — qui part
 * avec chaque paiement. Un geste n'apparaît que lorsqu'il est possible : un bouton qu'une action
 * refuse fait chercher la panne au lieu de dire ce qu'on attend.
 *
 * Les règles vivent dans les actions (`promo-execution-actions.ts`) ; l'écran ne fait que
 * montrer ce qu'elles permettent, et dire en clair ce qu'on attend quand elles ne permettent pas.
 */

export interface FactureAffichee {
  id: string;
  reference: string | null;
  montant: number | null;
  date: string | null;
  etatReglement: string;
  reglee: boolean;
  paiementDemande: boolean;
  demandeInfoMedicale: { reference: string; nature: string } | null;
  /** Le fichier déposé (table `Document`) — ouvert par `/api/documents/<id>`. */
  fichierId: string | null;
}

export interface ExecutionAffichee {
  quoteId: string;
  fournisseur: string;
  reference: string | null;
  lignes: number;
  ttc: number;
  bc: { id: string; reference: string | null; montant: number | null; etape: string; libelleEtape: string; pdf: boolean; docx: boolean } | null;
  envoyeLe: string | null;
  factures: FactureAffichee[];
}

interface Props {
  id: string;
  executions: ExecutionAffichee[];
  /** Le demandeur, l'assistante de direction, la Direction — tranché au serveur. */
  canPilot: boolean;
  /** Le dossier est en exécution (toutes les validations obtenues). */
  ouvert: boolean;
}

function useRun() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<ActionResult>, after?: () => void) => {
    setSaving(true); setErr(null); setMsg(null);
    const r = await fn();
    setSaving(false);
    if (r.ok) { setMsg(r.message ?? null); after?.(); router.refresh(); } else setErr(r.error ?? "Action impossible.");
  };
  return { saving, err, msg, run };
}

const Erreur = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;
const Info = ({ msg }: { msg: string | null }) =>
  msg ? <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{msg}</span></div> : null;

const lien = "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary";

/** Choix de la formalité qui accompagne un paiement — visa publicitaire ou déclaration au ministère. */
function ChoixFormalite({ name }: { name: string }) {
  return (
    <select name={name} required defaultValue="" className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Formalité à l'information médicale">
      <option value="" disabled>Formalité…</option>
      <option value="AD_VISA">Demande de visa publicitaire</option>
      <option value="MIP">Déclaration au ministère</option>
    </select>
  );
}

function LigneExecution({ id, e, canPilot, ouvert }: { id: string; e: ExecutionAffichee; canPilot: boolean; ouvert: boolean }) {
  const { saving, err, msg, run } = useRun();
  const [mode, setMode] = React.useState<"modifier" | "supprimer" | "facture" | null>(null);
  const bc = e.bc;
  const signe = bc?.etape === "SIGNE";
  const fige = e.factures.length > 0;
  const agir = canPilot && ouvert;
  const form = (extra: Record<string, string>) => { const f = new FormData(); f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); for (const [k, v] of Object.entries(extra)) f.set(k, v); return f; };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{e.fournisseur}</p>
          <p className="text-xs text-muted-foreground">
            {e.reference ? `Devis n° ${e.reference} · ` : ""}{e.lignes} ligne{e.lignes > 1 ? "s" : ""} retenue{e.lignes > 1 ? "s" : ""} · {formatDzd(e.ttc)} TTC
          </p>
        </div>
        {bc
          ? <Badge tone={signe ? "success" : bc.etape === "A_REVOIR" ? "danger" : "info"}>{bc.reference ? `BC ${bc.reference} — ` : "BC — "}{bc.libelleEtape}</Badge>
          : <Badge tone="warning">Bon de commande à générer</Badge>}
      </div>

      {bc && (
        <div className="flex flex-wrap items-center gap-2">
          {bc.pdf && <a className={lien} href={lienFichierEmis(bc.id, "pdf")} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> PDF</a>}
          {bc.docx && <a className={lien} href={lienFichierEmis(bc.id, "docx", true)}><FileText className="h-3.5 w-3.5" /> Word</a>}
          {bc.montant != null && <span className="text-xs text-muted-foreground">{formatDzd(bc.montant)} TTC</span>}
          {e.envoyeLe
            ? <Badge tone="success">Envoyé le {new Date(e.envoyeLe).toLocaleDateString("fr-FR")}</Badge>
            : signe
              ? (agir && <Button size="sm" variant="outline" disabled={saving} onClick={() => run(() => marquerBonDeCommandeEnvoye(form({})))}><Send className="h-4 w-4" /> Marquer envoyé au fournisseur</Button>)
              : <span className="text-xs text-muted-foreground">Il part chez le fournisseur une fois signé par les Finances.</span>}
          {agir && !fige && mode === null && (
            <>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setMode("modifier")}><Pencil className="h-4 w-4" /> Modifier</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setMode("supprimer")}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            </>
          )}
        </div>
      )}

      {mode === "modifier" && bc && (
        <form className="space-y-2 rounded-lg border border-border p-3" action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => modifierBonDeCommandePromo(f), () => setMode(null)); }}>
          <p className="text-xs text-muted-foreground">Renseignez ce qui change : un champ laissé vide garde sa valeur. Les lignes ne se modifient pas — elles sont ce qui a été validé. Une modification retire la signature des Finances : la pièce est à signer de nouveau.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div><Label htmlFor={`bc-adr-${e.quoteId}`}>Adresse de livraison</Label><Input id={`bc-adr-${e.quoteId}`} name="livraisonAdresse" /></div>
            <div><Label htmlFor={`bc-del-${e.quoteId}`}>Délai de livraison</Label><Input id={`bc-del-${e.quoteId}`} name="livraisonDelai" placeholder="15 jours" /></div>
            <div><Label htmlFor={`bc-cn-${e.quoteId}`}>Interlocuteur</Label><Input id={`bc-cn-${e.quoteId}`} name="contactNom" /></div>
            <div><Label htmlFor={`bc-ct-${e.quoteId}`}>Téléphone</Label><Input id={`bc-ct-${e.quoteId}`} name="contactTelephone" /></div>
          </div>
          <div><Label htmlFor={`bc-notes-${e.quoteId}`}>Notes</Label><Textarea id={`bc-notes-${e.quoteId}`} name="notes" className="min-h-[50px]" /></div>
          <div><Label htmlFor={`bc-motif-${e.quoteId}`}>Motif de la modification</Label><Input id={`bc-motif-${e.quoteId}`} name="motif" /></div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}

      {mode === "supprimer" && bc && (
        <form className="space-y-2 rounded-lg border border-destructive/30 p-3" action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => annulerBonDeCommandePromo(f), () => setMode(null)); }}>
          <Label htmlFor={`bc-sup-${e.quoteId}`}>Pourquoi supprimer ce bon de commande ?</Label>
          <Textarea id={`bc-sup-${e.quoteId}`} name="motif" required className="min-h-[50px]" placeholder="Son numéro reste au registre (annulé), avec ce motif." />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer le BC</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
          </div>
        </form>
      )}

      {/* LES FACTURES DE CE BC — le fichier est obligatoire, et chacune porte son paiement et sa formalité. */}
      {bc && (e.factures.length > 0 || signe) && (
        <div className="space-y-2">
          {e.factures.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">Facture {f.reference ?? "sans numéro"}{f.montant != null ? ` — ${formatDzd(f.montant)} TTC` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {f.date ? `du ${new Date(f.date).toLocaleDateString("fr-FR")} · ` : ""}{f.etatReglement}
                  {f.demandeInfoMedicale ? ` · ${f.demandeInfoMedicale.nature} ${f.demandeInfoMedicale.reference}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {f.fichierId && <a className={lien} href={`/api/documents/${f.fichierId}`} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> Fichier</a>}
                {agir && !f.paiementDemande && (
                  <form className="flex flex-wrap items-center gap-2" action={(fd: FormData) => { fd.set("promoMaterialId", id); fd.set("invoiceId", f.id); run(() => demanderPaiementFacturePromo(fd)); }}>
                    <ChoixFormalite name="formalite" />
                    <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander le paiement</Button>
                  </form>
                )}
                {agir && f.paiementDemande && !f.demandeInfoMedicale && (
                  <form className="flex flex-wrap items-center gap-2" action={(fd: FormData) => { fd.set("promoMaterialId", id); fd.set("invoiceId", f.id); run(() => adresserInfoMedicaleFacturePromo(fd)); }}>
                    <ChoixFormalite name="formalite" />
                    <Button type="submit" size="sm" variant="outline" disabled={saving}><Stethoscope className="h-4 w-4" /> Adresser à l&apos;information médicale</Button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {agir && signe && mode !== "facture" && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => setMode("facture")}><Upload className="h-4 w-4" /> Déposer une facture</Button>
          )}
          {mode === "facture" && (
            <form className="space-y-2 rounded-lg border border-border p-3" action={(f: FormData) => { f.set("promoMaterialId", id); f.set("quoteId", e.quoteId); run(() => deposerFacturePromo(f), () => setMode(null)); }}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div><Label htmlFor={`fa-ref-${e.quoteId}`}>N° de facture *</Label><Input id={`fa-ref-${e.quoteId}`} name="reference" required /></div>
                <div><Label htmlFor={`fa-date-${e.quoteId}`}>Date</Label><Input id={`fa-date-${e.quoteId}`} name="invoiceDate" type="date" /></div>
                <div><Label htmlFor={`fa-mt-${e.quoteId}`}>Montant TTC *</Label><Input id={`fa-mt-${e.quoteId}`} name="amount" inputMode="decimal" required /></div>
              </div>
              <div><Label htmlFor={`fa-file-${e.quoteId}`}>Fichier de la facture *</Label><Input id={`fa-file-${e.quoteId}`} name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" /></div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enregistrer la facture</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={saving}>Annuler</Button>
              </div>
            </form>
          )}
        </div>
      )}

      <Erreur msg={err} />
      <Info msg={msg} />
    </div>
  );
}

export function PromoExecutionCard({ id, executions, canPilot, ouvert }: Props) {
  const { saving, err, msg, run } = useRun();
  const [options, setOptions] = React.useState(false);
  const aGenerer = executions.filter((e) => !e.bc).length;

  return (
    <div className="space-y-3">
      {executions.length === 0 && <p className="text-sm text-muted-foreground">Aucune ligne de devis n&apos;est retenue.</p>}

      {canPilot && ouvert && aGenerer > 0 && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            <strong>{aGenerer}</strong> bon{aGenerer > 1 ? "s" : ""} de commande à générer — un par fournisseur, composé{aGenerer > 1 ? "s" : ""} par la plateforme d&apos;après les lignes validées, sur le papier en-tête de la société.
          </p>
          <form className="space-y-2" action={(f: FormData) => { f.set("promoMaterialId", id); run(() => genererBonsDeCommandePromo(f)); }}>
            {options && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div><Label htmlFor="gen-adr">Adresse de livraison</Label><Input id="gen-adr" name="livraisonAdresse" /></div>
                <div><Label htmlFor="gen-del">Délai de livraison</Label><Input id="gen-del" name="livraisonDelai" placeholder="15 jours" /></div>
                <div className="sm:col-span-2"><Label htmlFor="gen-notes">Notes</Label><Textarea id="gen-notes" name="notes" className="min-h-[50px]" /></div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Générer les bons de commande</Button>
              {!options && <Button type="button" size="sm" variant="ghost" onClick={() => setOptions(true)}>Livraison et notes…</Button>}
            </div>
          </form>
        </div>
      )}

      <Erreur msg={err} />
      <Info msg={msg} />

      {executions.map((e) => <LigneExecution key={e.quoteId} id={id} e={e} canPilot={canPilot} ouvert={ouvert} />)}
    </div>
  );
}
