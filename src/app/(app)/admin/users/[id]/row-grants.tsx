"use client";

import * as React from "react";
import { Loader2, Check, Search } from "lucide-react";
import { setRowGrants } from "@/lib/actions/access-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface GrantOption {
  id: string;
  label: string;
}

interface RowGrantsProps {
  userId: string;
  entityType: string;
  title: string;
  options: GrantOption[];
  selected: string[];
}

export function RowGrants({ userId, entityType, title, options, selected }: RowGrantsProps) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set(selected));
  const [query, setQuery] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <form
      action={async (fd) => { setSaving(true); await setRowGrants(fd); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
      className="space-y-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="entityType" value={entityType} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title} <span className="text-muted-foreground">({picked.size} accordée·s)</span></p>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune ligne disponible.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer…" className="pl-8" />
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {filtered.map((o) => (
              <label key={o.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                <input
                  type="checkbox"
                  name="rowId"
                  value={o.id}
                  checked={picked.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 rounded border-input"
                />
                {o.label}
              </label>
            ))}
            {filtered.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Aucun résultat.</p>}
          </div>
        </>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
        {saved ? "Enregistré" : "Enregistrer les lignes"}
      </Button>
    </form>
  );
}
