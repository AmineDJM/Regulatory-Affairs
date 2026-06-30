"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EntityType } from "@prisma/client";
import { UserPlus, Loader2, Users } from "lucide-react";
import type { MissionAssignmentDTO } from "@/lib/queries/missions";
import { assignMission } from "@/lib/actions/mission-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MissionItem } from "./mission-item";

interface UserOption { id: string; name: string }

export function MissionAssignmentsCard({
  entityType, entityId, assignments, users, canManage, currentUserId, path,
}: {
  entityType: EntityType;
  entityId: string;
  assignments: MissionAssignmentDTO[];
  users: UserOption[];
  canManage: boolean;
  currentUserId: string;
  path: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // On ne propose pas les personnes déjà assignées.
  const assignedIds = new Set(assignments.map((a) => a.userId));
  const options = users.filter((u) => !assignedIds.has(u.id));

  async function add(fd: FormData) {
    fd.set("entityType", entityType); fd.set("entityId", entityId);
    setBusy(true); setError(null);
    const r = await assignMission(fd);
    setBusy(false);
    if (r.ok) { formRef.current?.reset(); router.refresh(); } else setError(r.error ?? "Échec.");
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Accompagnants & délégués</CardTitle>
        <Badge tone="neutral" dot={false}>{assignments.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Assignez un ou plusieurs accompagnants ou un délégué de référence. Chaque personne peut recevoir ou demander un ordre de mission, déposer des pièces et échanger.
        </p>

        {assignments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">Aucune personne assignée.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((m) => (
              <MissionItem key={m.id} m={m} canManage={canManage} currentUserId={currentUserId} path={path} />
            ))}
          </div>
        )}

        {canManage && (
          <form ref={formRef} action={add} className="space-y-2 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="mission-user">Personne</Label>
                <Select id="mission-user" name="userId" required disabled={options.length === 0}>
                  <option value="">{options.length === 0 ? "— Toutes assignées —" : "— Sélectionner —"}</option>
                  {options.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mission-role">Rôle</Label>
                <Select id="mission-role" name="role" defaultValue="ACCOMPAGNANT">
                  <option value="ACCOMPAGNANT">Accompagnant</option>
                  <option value="DELEGATE_REFERENCE">Délégué de référence</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mission-note">Précision</Label>
                <Input id="mission-note" name="note" placeholder="Ville, dates…" />
              </div>
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy || options.length === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Assigner
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
