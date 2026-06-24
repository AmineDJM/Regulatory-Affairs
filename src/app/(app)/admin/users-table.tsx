"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toggleUserActive, updateUserRole } from "@/lib/actions/admin-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  region: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

function RoleSelect({ id, role }: { id: string; role: string }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await updateUserRole(fd);
        setSaving(false);
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <Select
        name="role"
        defaultValue={role}
        className="h-8 w-52 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {Object.entries(ROLE_LABELS).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </Select>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </form>
  );
}

export function UsersTable({ users, canManage }: { users: UserRow[]; canManage: boolean }) {
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Fonction</TableHead>
            <TableHead>Dernière connexion</TableHead>
            <TableHead>Statut</TableHead>
            {canManage && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar name={u.name} size="sm" />
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {canManage ? <RoleSelect id={u.id} role={u.role} /> : <Badge tone="neutral">{ROLE_LABELS[u.role] ?? u.role}</Badge>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {u.title || "—"}
                {u.region && <span className="block text-xs">{u.region}</span>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}
              </TableCell>
              <TableCell>
                {u.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Inactif</Badge>}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <form action={async (fd) => { await toggleUserActive(fd); }} className="inline">
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit" className="text-xs font-medium text-primary hover:underline">
                      {u.isActive ? "Désactiver" : "Activer"}
                    </button>
                  </form>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
