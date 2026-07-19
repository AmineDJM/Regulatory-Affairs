"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { saveAccessMatrix } from "@/lib/actions/access-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_COLS = ["CREATE", "UPDATE", "DELETE", "VALIDATE", "EXPORT", "UPLOAD"] as const;
const ACTION_LABELS: Record<string, string> = {
  CREATE: "Créer", UPDATE: "Modifier", DELETE: "Supprimer",
  VALIDATE: "Valider", EXPORT: "Exporter", UPLOAD: "Upload",
};

export interface ModuleAccessRow {
  module: string;
  label: string;
  mode: "DEFAULT" | "CUSTOM" | "BLOCKED";
  actions: Record<string, boolean>;
  scope: "ALL" | "ASSIGNED";
  rowScoped: boolean;
  roleSummary: string; // human description of the role default
}

export function AccessMatrix({ userId, rows }: { userId: string; rows: ModuleAccessRow[] }) {
  const [state, setState] = React.useState(rows);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  function update(module: string, patch: Partial<ModuleAccessRow>) {
    setState((s) => s.map((r) => (r.module === module ? { ...r, ...patch } : r)));
  }

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await saveAccessMatrix(fd);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Onglet / Module</TableHead>
              <TableHead>Accès</TableHead>
              {ACTION_COLS.map((a) => (
                <TableHead key={a} className="text-center">{ACTION_LABELS[a]}</TableHead>
              ))}
              <TableHead>Portée des lignes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.map((r) => {
              const custom = r.mode === "CUSTOM";
              return (
                <TableRow key={r.module}>
                  <TableCell>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">Défaut&nbsp;: {r.roleSummary}</div>
                    <input type="hidden" name={`mode_${r.module}`} value={r.mode} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.mode}
                      onChange={(e) => update(r.module, { mode: e.target.value as ModuleAccessRow["mode"] })}
                      className="h-8 w-32 text-xs"
                    >
                      <option value="DEFAULT">Par défaut</option>
                      <option value="CUSTOM">Personnalisé</option>
                      <option value="BLOCKED">Bloqué</option>
                    </Select>
                  </TableCell>
                  {ACTION_COLS.map((a) => (
                    <TableCell key={a} className="text-center">
                      <input
                        type="checkbox"
                        name={`act_${r.module}_${a}`}
                        checked={custom ? Boolean(r.actions[a]) : false}
                        disabled={!custom}
                        onChange={(e) => update(r.module, { actions: { ...r.actions, [a]: e.target.checked } })}
                        className="h-4 w-4 rounded border-input disabled:opacity-30"
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    {r.module === "DRIVE" || r.module === "DOSSIERS" ? (
                      // Drive & Projets : privés par conception — toujours cloisonnés
                      // (chacun ne voit que SES éléments + ceux partagés). La portée
                      // « tout » est réservée à la vue globale (Direction / Super Admin)
                      // et neutralisée ici pour un compte ordinaire (cf. getAccess).
                      <>
                        <span className="text-xs text-muted-foreground" title="Confidentialité stricte : l'utilisateur ne voit que ses propres fichiers / projets et ceux qu'on lui a partagés ou confiés.">Privé (assignées)</span>
                        <input type="hidden" name={`scope_${r.module}`} value="ASSIGNED" />
                      </>
                    ) : r.rowScoped ? (
                      <Select
                        name={`scope_${r.module}`}
                        value={r.scope}
                        disabled={!custom}
                        onChange={(e) => update(r.module, { scope: e.target.value as "ALL" | "ASSIGNED" })}
                        className="h-8 w-40 text-xs"
                      >
                        <option value="ALL">Toutes les lignes</option>
                        <option value="ASSIGNED">Lignes assignées</option>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <Badge tone="neutral" dot={false}>Par défaut</Badge> applique les droits du rôle ·
          <Badge tone="info" dot={false}>Personnalisé</Badge> droits choisis ·
          <Badge tone="danger" dot={false}>Bloqué</Badge> onglet masqué.
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
          {saved ? "Enregistré" : "Enregistrer les accès"}
        </Button>
      </div>
    </form>
  );
}
