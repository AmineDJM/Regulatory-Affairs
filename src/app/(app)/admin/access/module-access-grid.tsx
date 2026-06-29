"use client";

import * as React from "react";
import { Loader2, Check, Search } from "lucide-react";
import { saveModuleAccess } from "@/lib/actions/access-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_COLS = ["CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"] as const;
const ACTION_LABELS: Record<string, string> = {
  CREATE: "Créer", UPDATE: "Modifier", DELETE: "Supprimer", VALIDATE: "Valider", EXPORT: "Exporter", UPLOAD: "Upload",
};

export interface UserModuleState {
  mode: "DEFAULT" | "CUSTOM" | "BLOCKED";
  actions: Record<string, boolean>;
  scope: "ALL" | "ASSIGNED";
  rowScoped: boolean;
  roleSummary: string;
}
export interface AccessUser {
  id: string;
  name: string;
  role: string;
  byModule: Record<string, UserModuleState>;
}

interface Opt { value: string; label: string }

export function ModuleAccessGrid({ modules, users }: { modules: Opt[]; users: AccessUser[] }) {
  const [module, setModule] = React.useState(modules[0]?.value ?? "");
  const [rows, setRows] = React.useState<Record<string, UserModuleState>>({});
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // (Re)charge les états du module sélectionné.
  React.useEffect(() => {
    const next: Record<string, UserModuleState> = {};
    for (const u of users) next[u.id] = { ...u.byModule[module], actions: { ...u.byModule[module]?.actions } };
    setRows(next);
  }, [module, users]);

  function update(userId: string, patch: Partial<UserModuleState>) {
    setRows((s) => ({ ...s, [userId]: { ...s[userId], ...patch } }));
  }

  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        fd.set("module", module);
        for (const u of users) {
          const r = rows[u.id];
          if (!r) continue;
          fd.append("userId", u.id);
          fd.set(`mode_${u.id}`, r.mode);
          if (r.mode === "CUSTOM") {
            for (const a of ACTION_COLS) if (r.actions[a]) fd.set(`act_${u.id}_${a}`, "on");
            fd.set(`scope_${u.id}`, r.scope);
          }
        }
        await saveModuleAccess(fd);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[16rem] space-y-1">
          <label className="text-sm font-medium" htmlFor="module-pick">Module</label>
          <Select id="module-pick" value={module} onChange={(e) => setModule(e.target.value)} className="w-64">
            {modules.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé…" className="w-56 pl-8" />
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Accès</TableHead>
              {ACTION_COLS.map((a) => <TableHead key={a} className="text-center">{ACTION_LABELS[a]}</TableHead>)}
              <TableHead>Portée</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => {
              const r = rows[u.id];
              if (!r) return null;
              const custom = r.mode === "CUSTOM";
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.role} · défaut : {r.roleSummary}</div>
                  </TableCell>
                  <TableCell>
                    <Select value={r.mode} onChange={(e) => update(u.id, { mode: e.target.value as UserModuleState["mode"] })} className="h-8 w-28 text-xs">
                      <option value="DEFAULT">Par défaut</option>
                      <option value="CUSTOM">Personnalisé</option>
                      <option value="BLOCKED">Bloqué</option>
                    </Select>
                  </TableCell>
                  {ACTION_COLS.map((a) => (
                    <TableCell key={a} className="text-center">
                      <input
                        type="checkbox"
                        checked={custom ? Boolean(r.actions[a]) : false}
                        disabled={!custom}
                        onChange={(e) => update(u.id, { actions: { ...r.actions, [a]: e.target.checked } })}
                        className="h-4 w-4 rounded border-input disabled:opacity-30"
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    {r.rowScoped ? (
                      <Select value={r.scope} disabled={!custom} onChange={(e) => update(u.id, { scope: e.target.value as "ALL" | "ASSIGNED" })} className="h-8 w-36 text-xs">
                        <option value="ALL">Toutes les lignes</option>
                        <option value="ASSIGNED">Lignes assignées</option>
                      </Select>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <Badge tone="neutral" dot={false}>Par défaut</Badge> droits du rôle ·
          <Badge tone="info" dot={false}>Personnalisé</Badge> droits choisis ·
          <Badge tone="danger" dot={false}>Bloqué</Badge> module masqué. « Voir » est implicite (sauf Bloqué).
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
          {saved ? "Enregistré" : "Enregistrer ce module"}
        </Button>
      </div>
    </form>
  );
}
