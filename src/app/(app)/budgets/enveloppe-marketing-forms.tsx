"use client";

/**
 * BUDGET MARKETING — les deux tiroirs de la Direction Marketing : créer une enveloppe, la régler.
 *
 * Volontairement plus courts que ceux de Budgets : ni listes d'accès ni délégations (le module Budget Marketing suffit
 * à voir et gérer ses enveloppes ; les accès fins restent au Super Admin, dans Budgets). Une enveloppe se crée pour une
 * ANNÉE, avec ou sans les six catégories Ad & Pro ; la BU et le produit sont facultatifs.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { InfoBulle } from "@/components/ui/info-bulle";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { createMarketingEnvelope, updateMarketingEnvelope, deleteMarketingEnvelope } from "@/lib/actions/budget-marketing-actions";
import type { BudgetOverview } from "@/lib/queries/budget";
import { CHEMIN_BUDGET_MARKETING } from "@/lib/budget-marketing/domaine";

export interface RattachementOptions {
  businessUnits: { id: string; nom: string }[];
  produits: { id: string; nom: string }[];
}

type Resultat = { ok: boolean; error?: string };

function useEnvoi() {
  const { enCours, rafraichir } = useRafraichir();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const envoyer = async (fn: () => Promise<Resultat>, onOk?: () => void) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) { onOk?.(); rafraichir(); } else setErr(r.error ?? "Erreur.");
  };
  return { busy: busy || enCours, err, envoyer };
}

function ChampsRattachement({ options, bu, produit }: { options: RattachementOptions; bu?: string | null; produit?: string | null }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Business Unit</Label>
        <Select name="businessUnitId" defaultValue={bu ?? ""}>
          <option value="">— Aucune —</option>
          {options.businessUnits.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Produit</Label>
        <Select name="productId" defaultValue={produit ?? ""}>
          <option value="">— Aucun —</option>
          {options.produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Select>
      </div>
    </>
  );
}

export function NouvelleEnveloppeMarketing({ options }: { options: RattachementOptions }) {
  const [open, setOpen] = React.useState(false);
  const { busy, err, envoyer } = useEnvoi();
  const annee = new Date().getFullYear();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nouvelle enveloppe</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouvelle enveloppe marketing" width="md">
        <form action={(fd) => envoyer(() => createMarketingEnvelope(fd), () => setOpen(false))} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nom</Label>
            <Input name="name" required placeholder={`Ad & Pro ${annee}`} />
          </div>
          <div className="space-y-1.5">
            <Label>Année</Label>
            <Input name="annee" type="number" inputMode="numeric" min={2000} max={2100} defaultValue={annee} />
          </div>
          <div className="space-y-1.5">
            <Label>Montant (DZD)</Label>
            <Input name="totalAmount" type="number" inputMode="decimal" step="any" min={0} placeholder="0" />
          </div>
          <ChampsRattachement options={options} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="adPro" value="on" defaultChecked className="h-4 w-4 rounded border-input" />
            Catégories Ad &amp; Pro
            <InfoBulle label="À propos : catégories Ad & Pro">
              Crée Sponsoring, Événements, Congrès nationaux, Congrès internationaux, Matériel promotionnel et Autres, chacune liée à son module : les postes Ad &amp; Pro accordés s&apos;y rangent. Décochez pour une enveloppe libre.
            </InfoBulle>
          </label>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" rows={2} /></div>
          {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Créer</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function EnveloppeMarketingSheet({ envelope, options, canDelete, onClose }: {
  envelope: BudgetOverview["envelope"];
  options: RattachementOptions;
  canDelete: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { busy, err, envoyer } = useEnvoi();
  const d10 = (iso: string) => iso.slice(0, 10);
  return (
    <Sheet open onClose={onClose} title="Modifier l'enveloppe" width="md">
      <form action={(fd) => { fd.set("id", envelope.id); envoyer(() => updateMarketingEnvelope(fd), onClose); }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Nom</Label><Input name="name" required defaultValue={envelope.name} /></div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Montant (DZD)</Label>
          <Input name="totalAmount" type="number" inputMode="decimal" step="any" min={0} defaultValue={envelope.total} />
        </div>
        <div className="space-y-1.5"><Label>Début</Label><Input name="periodStart" type="date" defaultValue={d10(envelope.periodStart)} /></div>
        <div className="space-y-1.5"><Label>Fin</Label><Input name="periodEnd" type="date" defaultValue={d10(envelope.periodEnd)} /></div>
        <ChampsRattachement options={options} bu={envelope.businessUnitId} produit={envelope.productId} />
        <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" defaultValue={envelope.notes ?? ""} rows={2} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="hidden" name="isActive" value="off" />
          <input type="checkbox" name="isActive" value="on" defaultChecked={envelope.isActive} className="h-4 w-4 rounded border-input" /> Enveloppe active
        </label>
        {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          {canDelete ? (
            <Button
              type="button" variant="ghost" className="text-destructive"
              onClick={() => {
                if (!window.confirm("Supprimer cette enveloppe et ses catégories ? Les dépenses imputées repasseront « à imputer ».")) return;
                const fd = new FormData(); fd.set("id", envelope.id);
                envoyer(() => deleteMarketingEnvelope(fd), () => { onClose(); router.push(CHEMIN_BUDGET_MARKETING); });
              }}
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : <span />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
