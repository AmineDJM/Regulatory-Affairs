"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Car, CheckCircle2 } from "lucide-react";
import { updateRequestStatus, requestApproval, createMission } from "@/lib/actions/admin-request-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { ADMIN_REQUEST_STATUS } from "@/lib/labels";

type U = { id: string; name: string };

export function RequestActions({ requestId, status, users, canManage }: { requestId: string; status: string; users: U[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [approve, setApprove] = React.useState(false);
  const [mission, setMission] = React.useState(false);

  if (!canManage) return null;

  async function run(fd: FormData, action: (f: FormData) => Promise<unknown>, close?: () => void) {
    setBusy(true); await action(fd); setBusy(false); close?.(); router.refresh();
  }

  return (
    <div className="space-y-3">
      <form action={(fd) => run(fd, updateRequestStatus)} className="flex items-end gap-2">
        <input type="hidden" name="id" value={requestId} />
        <div className="flex-1 space-y-1">
          <Label>Changer le statut</Label>
          <Select name="status" defaultValue={status}>{Object.entries(ADMIN_REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </div>
        <Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Appliquer</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" type="button" onClick={() => setApprove(true)}><ShieldCheck className="h-4 w-4" /> Demander validation</Button>
        <Button variant="outline" size="sm" type="button" onClick={() => setMission(true)}><Car className="h-4 w-4" /> Mission chauffeur</Button>
        <form action={(fd) => { fd.set("status", "DONE"); return run(fd, updateRequestStatus); }}>
          <input type="hidden" name="id" value={requestId} />
          <Button variant="outline" size="sm" type="submit"><CheckCircle2 className="h-4 w-4" /> Clôturer</Button>
        </form>
      </div>

      <Sheet open={approve} onClose={() => setApprove(false)} title="Demander une validation" width="md">
        <form action={(fd) => run(fd, requestApproval, () => setApprove(false))} className="space-y-3">
          <input type="hidden" name="requestId" value={requestId} />
          <Field label="Validateur"><Select name="validatorId" required defaultValue=""><option value="" disabled>Choisir…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Montant à valider (DZD, si paiement)"><Input name="amount" type="number" step="any" /></Field>
          <Field label="Commentaire"><Textarea name="comment" /></Field>
          <p className="text-xs text-muted-foreground">Si un montant est validé, un ordre de dépense est créé automatiquement pour le comptable.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setApprove(false)}>Annuler</Button><Button type="submit" disabled={busy}>Envoyer</Button></div>
        </form>
      </Sheet>

      <Sheet open={mission} onClose={() => setMission(false)} title="Créer une mission chauffeur" width="md">
        <form action={(fd) => run(fd, createMission, () => setMission(false))} className="space-y-3">
          <input type="hidden" name="requestId" value={requestId} />
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
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2 space-y-1" : "space-y-1"}><Label>{label}</Label>{children}</div>;
}
