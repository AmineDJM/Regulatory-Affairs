"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { Plus, Trash2, Loader2, IdCard, Bell } from "lucide-react";
import { addCongressBeneficiary, removeCongressBeneficiary, requestBeneficiaryIds } from "@/lib/actions/congress-beneficiary-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentUpload } from "@/components/documents/document-upload";

export interface Beneficiary { id: string; name: string; role?: string }

export function BeneficiariesCard({
  entityType, entityId, beneficiaries, idDocCount, canManage,
}: {
  entityType: EntityType;
  entityId: string;
  beneficiaries: Beneficiary[];
  idDocCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const kind = entityType === "CONGRESS_INTERNATIONAL" ? "INTERNATIONAL" : "NATIONAL";
  const [busy, setBusy] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const hidden = () => { const fd = new FormData(); fd.set("kind", kind); fd.set("id", entityId); return fd; };

  async function add(fd: FormData) {
    fd.set("kind", kind); fd.set("id", entityId);
    setBusy(true); await addCongressBeneficiary(fd); setBusy(false);
    formRef.current?.reset(); router.refresh();
  }
  async function remove(benefId: string) {
    const fd = hidden(); fd.set("benefId", benefId);
    await removeCongressBeneficiary(fd); router.refresh();
  }
  async function requestIds() {
    setBusy(true); await requestBeneficiaryIds(hidden()); setBusy(false); router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><IdCard className="h-4 w-4" /> Personnes prises en charge</CardTitle>
        <Badge tone="neutral" dot={false}>{beneficiaries.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {beneficiaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune personne enregistrée. Ajoutez les personnes prises en charge puis demandez leurs pièces d'identité.</p>
        ) : (
          <ul className="space-y-1.5">
            {beneficiaries.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0"><span className="font-medium">{b.name}</span>{b.role && <span className="text-xs text-muted-foreground"> · {b.role}</span>}</span>
                {canManage && <button onClick={() => remove(b.id)} title="Retirer" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <form ref={formRef} action={add} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[120px] flex-1"><Input name="name" required placeholder="Nom et prénom" className="text-sm" /></div>
            <div className="min-w-[100px] flex-1"><Input name="role" placeholder="Qualité (médecin, invité…)" className="text-sm" /></div>
            <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
          </form>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Pièces d'identité reçues : <span className="font-medium text-foreground">{idDocCount}</span> / {beneficiaries.length || "—"}</p>
          {canManage && (
            <>
              <DocumentUpload entityType={entityType} entityId={entityId} categories={["ID_DOCUMENT", "OTHER"]} compact />
              <Button type="button" size="sm" variant="outline" onClick={requestIds} disabled={busy}><Bell className="h-4 w-4" /> Demander les pièces d'identité</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
