"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { setSecondaryRole } from "@/lib/actions/admin-actions";
import { Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/labels";

export type RoleRowData = { id: string; name: string; email: string; role: string; secondaryRole: string | null };

// Rôles proposables comme « autre rôle » (Super Admin exclu : réservé, anti-escalade).
const SECONDARY_OPTIONS = Object.entries(ROLE_LABELS).filter(([v]) => v !== "SUPER_ADMIN");

/**
 * Tableau clair « Rôle principal + Autre rôle » par utilisateur, réglable en ligne
 * par le Super Admin. Le rôle secondaire CUMULE ses capacités (cf. rbac.getAccess).
 */
export function RolesTable({ users, canManage }: { users: RoleRowData[]; canManage: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Utilisateur</th>
            <th className="px-3 py-2 text-left font-medium">Rôle principal</th>
            <th className="px-3 py-2 text-left font-medium">Autre rôle (fonction secondaire)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => <RoleRow key={u.id} u={u} canManage={canManage} />)}
        </tbody>
      </table>
    </div>
  );
}

function RoleRow({ u, canManage }: { u: RoleRowData; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [value, setValue] = React.useState(u.secondaryRole ?? "");

  const change = (next: string) => {
    setValue(next);
    setBusy(true); setErr(null); setSaved(false);
    const fd = new FormData();
    fd.set("id", u.id);
    fd.set("secondaryRole", next);
    setSecondaryRole(fd).then((r) => {
      setBusy(false);
      if (r.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
      else { setErr(r.error ?? "Erreur."); setValue(u.secondaryRole ?? ""); }
    });
  };

  return (
    <tr>
      <td className="px-3 py-2">
        <p className="font-medium">{u.name}</p>
        <p className="text-xs text-muted-foreground">{u.email}</p>
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium">{ROLE_LABELS[u.role] ?? u.role}</span>
      </td>
      <td className="px-3 py-2">
        {canManage ? (
          <div className="flex items-center gap-2">
            <Select value={value} onChange={(e) => change(e.target.value)} disabled={busy} className="h-8 w-64 text-xs">
              <option value="">— Aucun —</option>
              {SECONDARY_OPTIONS.map(([v, l]) => <option key={v} value={v} disabled={v === u.role}>{l}</option>)}
            </Select>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {saved && <Check className="h-4 w-4 text-success" />}
            {err && <span className="text-xs text-destructive">{err}</span>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{u.secondaryRole ? (ROLE_LABELS[u.secondaryRole] ?? u.secondaryRole) : "—"}</span>
        )}
      </td>
    </tr>
  );
}
