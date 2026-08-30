"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, Plus, X } from "lucide-react";
import { addMailLink, removeMailLink } from "@/lib/actions/mail-register-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

/**
 * « RELIER À… » (§25) — un pli concerne souvent PLUSIEURS affaires : le marché, son contrat,
 * le dossier Regulatory. Les liens s'ajoutent et se retirent ici ; chaque lien est une pastille
 * cliquable qui mène à l'affaire. Le rattachement de NAISSANCE (« Rattaché à » sur la carte du
 * pli) ne bouge pas — il dit d'où le pli a été créé, les liens disent ce qu'il concerne.
 */
export interface MailLinkView {
  id: string;
  typeLabel: string;
  label: string;
  href: string | null;
}

export interface MailLinkCandidates {
  type: string;
  typeLabel: string;
  options: { value: string; label: string }[];
}

export function MailLinks({ entryId, links, candidates, canEdit }: {
  entryId: string;
  links: MailLinkView[];
  candidates: MailLinkCandidates[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [type, setType] = React.useState(candidates[0]?.type ?? "");
  const groupe = candidates.find((c) => c.type === type);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Erreur."); return false; }
    router.refresh();
    return true;
  };

  if (links.length === 0 && !canEdit) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" aria-hidden /> Relié à
          <span className="text-sm font-normal text-muted-foreground">({links.length})</span>
        </CardTitle>
        {canEdit && candidates.some((c) => c.options.length > 0) && (
          <Button size="sm" variant="outline" onClick={() => { setErr(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Relier à…
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun lien. Reliez ce pli aux affaires qu&apos;il concerne (marché, contrat, dossier…) —
            elles l&apos;afficheront dans leur fiche.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 py-1 pl-2.5 pr-1 text-sm">
                <span className="text-xs text-muted-foreground">{l.typeLabel} ·</span>
                {l.href ? (
                  <Link href={l.href} className="inline-flex items-center gap-1 font-medium hover:underline">
                    {l.label} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                ) : (
                  <span className="font-medium">{l.label}</span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Retirer le lien ${l.label}`}
                    disabled={busy}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() => run(() => { const fd = new FormData(); fd.set("id", l.id); return removeMailLink(fd); })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {err && !open && <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      </CardContent>

      <Sheet open={open} onClose={() => setOpen(false)} title="Relier le courrier à…" width="md">
        <form
          className="space-y-4"
          action={async (fd) => {
            fd.set("entryId", entryId);
            fd.set("entityType", type);
            if (await run(() => addMailLink(fd))) setOpen(false);
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="mail-link-type">Type d&apos;objet</label>
            <select
              id="mail-link-type"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.type} value={c.type} disabled={c.options.length === 0}>
                  {c.typeLabel}{c.options.length === 0 ? " (aucun)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="mail-link-target">Objet</label>
            <select
              id="mail-link-target"
              name="entityId"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>— Choisir —</option>
              {(groupe?.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {err && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Relier
            </Button>
          </div>
        </form>
      </Sheet>
    </Card>
  );
}
