"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileDown, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateDocumentAction } from "@/lib/regulatory/intelligence/docgen/actions";

interface Template { code: string; name: string; category: string; version: string }
interface GenDoc { id: string; filename: string; templateVersion: string; factsUsed: number; factsMissing: number; createdAt: string }

/**
 * Génération documentaire (G10) — produit un .docx à partir d'un template versionné et des
 * données du jumeau numérique APPROUVÉ uniquement. Les données non approuvées apparaissent
 * en « [À COMPLÉTER] » (jamais inventées).
 */
export function DocgenPanel({ dossierId, templates, docs }: { dossierId: string; templates: Template[]; docs: GenDoc[] }) {
  const router = useRouter();
  const [code, setCode] = React.useState(templates[0]?.code ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function generate() {
    setBusy(true); setError(null); setMsg(null);
    const fd = new FormData(); fd.set("dossierId", dossierId); fd.set("templateCode", code);
    const r = await generateDocumentAction(fd);
    setBusy(false);
    if (r.ok) { setMsg(`Document généré : ${r.used} donnée(s) approuvée(s) utilisée(s), ${r.missing} à compléter.`); router.refresh(); }
    else setError(r.error ?? "Échec.");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Les documents sont produits à partir du <strong>jumeau numérique approuvé</strong> (faits confirmés/corrigés).
        Les données non approuvées ou absentes apparaissent en « [À COMPLÉTER] » — jamais inventées.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm">
          {templates.map((t) => <option key={t.code} value={t.code}>{t.name} (v{t.version})</option>)}
        </select>
        <Button type="button" size="sm" disabled={busy || !code} onClick={generate}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Générer (.docx)
        </Button>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {msg && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{msg}</p>}

      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium" title={d.filename}>{d.filename}</span>
              <span className="text-muted-foreground">{d.factsUsed} donnée·s · {d.factsMissing} à compléter</span>
              <a href={`/api/regulatory/intelligence/generated/${d.id}`} className="inline-flex items-center gap-1 text-primary hover:underline"><FileDown className="h-3.5 w-3.5" /> Télécharger</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
