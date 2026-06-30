"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Landmark, ShieldCheck, Car, CheckCircle2, Trash2 } from "lucide-react";
import {
  updateRequestStatus, createMission, startRequestProcessing,
  requestFinanceValidation, requestInternalValidation, finishRequest, deleteRequests,
} from "@/lib/actions/admin-request-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { ADMIN_REQUEST_STATUS } from "@/lib/labels";

type U = { id: string; name: string };

export function RequestActions({
  requestId, status, type, users, financeUsers, canManage,
}: {
  requestId: string;
  status: string;
  type: string;
  users: U[];
  financeUsers: U[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [finance, setFinance] = React.useState(false);
  const [internal, setInternal] = React.useState(false);
  const [mission, setMission] = React.useState(false);
  const [del, setDel] = React.useState(false);

  if (!canManage) return null;
  const isPurchase = type === "PURCHASE";

  async function run(fd: FormData, action: (f: FormData) => Promise<{ ok: boolean; error?: string }>, close?: () => void) {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (r.ok) { close?.(); router.refresh(); } else setErr(r.error ?? "Erreur.");
  }

  return (
    <div className="space-y-3">
      {/* Flux : commencer, demander validation, clôturer */}
      <div className="flex flex-wrap gap-2">
        {status === "NEW" && (
          <form action={(fd) => { fd.set("id", requestId); return run(fd, startRequestProcessing); }}>
            <Button type="submit" size="sm" disabled={busy}><Play className="h-4 w-4" /> Commencer le traitement</Button>
          </form>
        )}
        {isPurchase ? (
          <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setFinance(true); }}>
            <Landmark className="h-4 w-4" /> Demande de validation des Finances
          </Button>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setInternal(true); }}>
            <ShieldCheck className="h-4 w-4" /> Demander une validation
          </Button>
        )}
        <Button variant="outline" size="sm" type="button" onClick={() => { setErr(null); setMission(true); }}><Car className="h-4 w-4" /> Mission chauffeur</Button>
        <form action={(fd) => { fd.set("id", requestId); return run(fd, finishRequest); }}>
          <Button variant="outline" size="sm" type="submit" disabled={busy}><CheckCircle2 className="h-4 w-4" /> Fin de la demande</Button>
        </form>
      </div>

      {isPurchase && (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Flux achat : commencez le traitement → uploadez le <strong>devis</strong> de l'agence (Documents) → demandez la
          validation des Finances → après accord, uploadez la <strong>facture finale</strong> puis cliquez « Fin de la demande ».
        </p>
      )}

      {/* Changement de statut manuel */}
      <form action={(fd) => { fd.set("id", requestId); return run(fd, updateRequestStatus); }} className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label>Changer le statut</Label>
          <Select name="status" defaultValue={status}>{Object.entries(ADMIN_REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Appliquer</Button>
      </form>

      <button type="button" onClick={() => { setErr(null); setDel(true); }} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
        <Trash2 className="h-3.5 w-3.5" /> Supprimer la demande
      </button>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Validation Finances (flux achat) */}
      <Sheet open={finance} onClose={() => setFinance(false)} title="Demande de validation des Finances" width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, requestFinanceValidation, () => setFinance(false)); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">La demande arrive dans le bureau « Demandes de validations » des Finances. En cas de refus ou de modification demandée, vous pourrez renvoyer une nouvelle validation (va-et-vient).</p>
          <Field label="Validateur Finances">
            <Select name="validatorId" defaultValue={financeUsers[0]?.id ?? ""}>
              <option value="">— Toute l'équipe Finances</option>
              {financeUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="Montant estimé (DZD)"><Input name="amount" type="number" step="any" /></Field>
          <Field label="Commentaire (devis joint, détails…)"><Textarea name="comment" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFinance(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer aux Finances</Button></div>
        </form>
      </Sheet>

      {/* Validation interne (hors achat) */}
      <Sheet open={internal} onClose={() => setInternal(false)} title="Demander une validation" width="md">
        <form action={(fd) => { fd.set("id", requestId); return run(fd, requestInternalValidation, () => setInternal(false)); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">Choisissez qui doit valider (opérations, direction, autre). La demande arrive dans leur bureau « Demandes de validations ».</p>
          <Field label="Validateur"><Select name="validatorId" required defaultValue=""><option value="" disabled>Choisir…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="2ᵉ validateur (optionnel)"><Select name="validator2Id" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Commentaire"><Textarea name="comment" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setInternal(false)}>Annuler</Button><Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer</Button></div>
        </form>
      </Sheet>

      {/* Mission chauffeur */}
      <Sheet open={mission} onClose={() => setMission(false)} title="Créer une mission chauffeur" width="md">
        <form action={(fd) => { fd.set("requestId", requestId); return run(fd, createMission, () => setMission(false)); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field full label="Titre"><Input name="title" required placeholder="Ex. Déposer dossier à la PCH" /></Field>
            <Field label="Chauffeur"><Select name="assignedToId" defaultValue=""><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
            <Field label="Échéance"><Input name="deadline" type="date" /></Field>
            <Field label="Lieu de départ"><Input name="startLocation" /></Field>
            <Field label="Destination"><Input name="destination" /></Field>
            <Field full label="Adresse"><Input name="address" /></Field>
            <Field label="Contact"><Input name="contactName" /></Field>
            <Field label="Téléphone"><Input name="contactPhone" /></Field>
            <Field full label="Instructions"><Textarea name="instructions" /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMission(false)}>Annuler</Button><Button type="submit" disabled={busy}>Créer la mission</Button></div>
        </form>
      </Sheet>

      {/* Suppression traçable */}
      <Sheet open={del} onClose={() => setDel(false)} title="Supprimer la demande" width="md">
        <form action={(fd) => { fd.set("ids", requestId); return run(fd, deleteRequests, () => { setDel(false); router.push("/demandes"); }); }} className="space-y-3">
          <p className="text-xs text-muted-foreground">La suppression est <strong>tracée</strong> (qui, quand, pourquoi). La demande est archivée et masquée des listes, mais reste consultable en corbeille.</p>
          <Field label="Motif de suppression (obligatoire)"><Textarea name="reason" required placeholder="Ex. Doublon, demande annulée par le service…" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDel(false)}>Annuler</Button><Button type="submit" variant="destructive" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Supprimer</Button></div>
        </form>
      </Sheet>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2 space-y-1" : "space-y-1"}><Label>{label}</Label>{children}</div>;
}
