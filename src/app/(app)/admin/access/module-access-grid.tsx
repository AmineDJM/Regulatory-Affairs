"use client";

import * as React from "react";
import { Loader2, Check, Search, EyeOff } from "lucide-react";
import { saveModuleAccess } from "@/lib/actions/access-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface UserModuleState {
  mode: "DEFAULT" | "CUSTOM" | "BLOCKED";
  actions: Record<string, boolean>;
  scope: "ALL" | "ASSIGNED";
  roleSummary: string;
}
export interface AccessUser {
  id: string;
  name: string;
  role: string;
  byModule: Record<string, UserModuleState>;
}

/**
 * LES COLONNES VIENNENT DU SERVEUR, déduites des droits réels du module — elles ne sont plus
 * écrites ici. Un module qui n'a aucune validation n'affiche donc pas de case « Valider » : une
 * case qui n'ouvre rien fait croire à un droit accordé, et c'est pire que l'absence de case.
 */
export interface ModuleSpec {
  value: string;
  label: string;
  actions: string[];
  rowScoped: boolean;
  roleCount: number;
  /**
   * Module MASQUÉ (« Modules en service ») — hors service pour tout le monde sauf le Super
   * Admin, quels que soient les droits accordés ici. Sans cette information, on règle des
   * accès qui n'ouvrent rien et l'on conclut que « les droits ne se modifient pas ».
   */
  hidden: boolean;
}

export function ModuleAccessGrid({
  modules, users, actionLabels,
}: { modules: ModuleSpec[]; users: AccessUser[]; actionLabels: Record<string, string> }) {
  const [module, setModule] = React.useState(modules[0]?.value ?? "");
  const spec = modules.find((m) => m.value === module) ?? modules[0];
  const cols = spec?.actions ?? [];
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
            for (const a of cols) if (r.actions[a]) fd.set(`act_${u.id}_${a}`, "on");
            // Drive & Projets : portée toujours cloisonnée (privé), jamais « tout ».
            fd.set(`scope_${u.id}`, module === "DRIVE" || module === "DOSSIERS" ? "ASSIGNED" : r.scope);
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
          {spec && (
            <p className="text-xs text-muted-foreground">
              {spec.roleCount === 0
                // Le dire ici évite de chercher longtemps pourquoi « personne n'y a accès ».
                ? "Aucun rôle n'atteint ce module par défaut : l'accès se donne nommément, ci-dessous."
                : `${spec.roleCount} rôle${spec.roleCount > 1 ? "s" : ""} y ont accès par défaut · ${spec.actions.length || "aucune"} capacité${spec.actions.length > 1 ? "s" : ""} réglable${spec.actions.length > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé…" className="w-56 pl-8" />
        </div>
      </div>

      {/* LE MODULE HORS SERVICE SE DIT ICI, pas ailleurs. Un module masqué se referme pour tout
          le monde sauf le Super Admin : les droits réglés ci-dessous s'enregistrent bel et bien,
          mais n'ouvrent RIEN tant qu'il n'est pas remis en service. Sans ce bandeau, on règle,
          on teste, on ne comprend pas — et l'on conclut que les accès du module sont cassés. */}
      {spec?.hidden && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <strong>{spec.label} est hors service</strong> — retiré de la plateforme pour tout le monde
            (le Super Admin excepté). Les droits réglés ci-dessous s&apos;enregistrent, mais n&apos;ouvriront
            rien tant que le module ne sera pas remis en service dans{" "}
            <a href="/admin/settings" className="font-medium text-primary hover:underline">Administration › Réglages › Modules en service</a>.
          </p>
        </div>
      )}

      <div className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employé</TableHead>
              <TableHead>Accès</TableHead>
              {cols.map((a) => <TableHead key={a} className="text-center">{actionLabels[a] ?? a}</TableHead>)}
              {cols.length === 0 && <TableHead>Capacités</TableHead>}
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
                  {cols.map((a) => (
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
                  {cols.length === 0 && (
                    <TableCell className="text-xs text-muted-foreground">Consultation seule</TableCell>
                  )}
                  <TableCell>
                    {module === "DRIVE" || module === "DOSSIERS" ? (
                      <span className="text-xs text-muted-foreground" title="Confidentialité stricte : l'utilisateur ne voit que ses propres fichiers / projets et ceux qu'on lui a partagés ou confiés.">Privé (assignées)</span>
                    ) : spec?.rowScoped ? (
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
