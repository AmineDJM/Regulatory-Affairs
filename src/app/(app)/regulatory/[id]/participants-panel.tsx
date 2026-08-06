"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Users, Loader2, UserPlus } from "lucide-react";
import { Select } from "@/components/ui/input";
import { setRegulatoryParticipants } from "@/lib/actions/regulatory-actions";

/**
 * Participants / collaborateurs du dossier Regulatory : plusieurs personnes travaillent
 * le même dossier (accès ligne). Le responsable et l'assistant sont toujours inclus
 * (non retirables ici). Ajout/retrait immédiat.
 */
export function ParticipantsPanel({
  productId, participants, allUsers, coreIds, canEdit,
}: {
  productId: string;
  participants: { id: string; name: string }[];
  allUsers: { id: string; name: string }[];
  coreIds: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [ids, setIds] = React.useState<string[]>(participants.map((p) => p.id));
  const [saving, setSaving] = React.useState(false);
  const nameById = React.useMemo(() => new Map([...participants, ...allUsers].map((u) => [u.id, u.name])), [participants, allUsers]);
  const core = new Set(coreIds);
  const available = allUsers.filter((u) => !ids.includes(u.id));

  async function persist(next: string[]) {
    setIds(next);
    setSaving(true);
    const fd = new FormData();
    fd.set("id", productId);
    next.filter((i) => !core.has(i)).forEach((i) => fd.append("participantIds", i));
    await setRegulatoryParticipants(fd);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ids.length === 0 && <span className="text-xs text-muted-foreground">Aucun participant.</span>}
        {ids.map((id) => {
          const isCore = core.has(id);
          return (
            <span key={id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${isCore ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}>
              {nameById.get(id) ?? id}{isCore ? " · titulaire" : ""}
              {canEdit && !isCore && (
                <button type="button" onClick={() => persist(ids.filter((x) => x !== id))} className="rounded-full hover:bg-primary/20" aria-label="Retirer">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <Select value="" onChange={(e) => { if (e.target.value) persist([...ids, e.target.value]); }} disabled={available.length === 0 || saving}>
            <option value="">{available.length ? "+ Ajouter un collaborateur…" : "Tout le monde est déjà participant"}</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
      )}
      <p className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground"><Users className="h-3 w-3" /> Les participants voient et travaillent ce dossier (accès partagé).</p>
    </div>
  );
}
