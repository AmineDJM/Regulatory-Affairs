"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { setAdProDgThreshold } from "@/lib/actions/settings-actions";
import { deciderVisaCentreAdPro } from "@/lib/actions/ad-pro-centre-actions";
import type { LigneCentre, FormePorte } from "@/lib/ad-pro/centre";

/**
 * LE PLAN DE TRAVAIL DU CENTRE.
 *
 * Deux gestes possibles par ligne, et la distinction n'est pas un confort :
 *
 *   • `VISA_CENTRE` (consulting, autres demandes) — le visa EST la porte, il n'y a pas d'étape de
 *     circuit ailleurs : on tranche ICI.
 *   • `ETAPE_CIRCUIT` / `ETAPE_PROMO` — la décision se prend DEVANT LE DOSSIER, par l'action de
 *     son circuit. Arbitrer 1,2 M DZD depuis une ligne de liste, sans les pièces, sans la
 *     catégorie budgétaire, sans le fil des avis, c'est valider en regardant autre chose
 *     (§104.7). Le centre dit CE QUI attend et POURQUOI, et y mène en un clic.
 */

const LIBELLE_FORME: Record<FormePorte, string> = {
  ETAPE_CIRCUIT: "Étape du circuit",
  ETAPE_PROMO: "Circuit matériel promotionnel",
  VISA_CENTRE: "Visa du centre",
};

export function CentreAdProBoard({ rows, seuil }: { rows: LigneCentre[]; seuil: number }) {
  return (
    <div className="space-y-5">
      <SeuilForm seuil={seuil} />

      <Card>
        <CardHeader>
          <CardTitle>Demandes au-dessus du seuil</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? "Rien n'attend le centre."
              : `${rows.length} demande(s) en attente d'arbitrage, la plus ancienne en tête.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="Aucune demande en attente"
              description="Les demandes Ad & Pro dont le budget total dépasse le seuil apparaîtront ici dès leur soumission. En dessous du seuil, la porte est franchie automatiquement et tracée."
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <LigneCard key={`${r.entityType}:${r.entityId}`} row={r} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SeuilForm({ seuil }: { seuil: number }) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Le seuil</CardTitle>
        <CardDescription>
          Au-dessus de ce montant — <strong>strictement</strong> au-dessus —, une demande Ad &amp; Pro passe
          par ce centre. En dessous, sa porte est franchie automatiquement et tracée. Réglable par la
          Direction Générale et le Super Admin, ici comme dans Administration › Réglages : c&apos;est le
          même réglage, écrit à un seul endroit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            setSaving(true); setError(null);
            const r = await setAdProDgThreshold(fd);
            setSaving(false);
            if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
            else setError(r.error ?? "Échec.");
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <div className="space-y-1">
            <Label htmlFor="adProDgThreshold">Seuil (DZD)</Label>
            <Input id="adProDgThreshold" name="adProDgThreshold" type="number" min="0" step="1000" defaultValue={seuil} />
            <p className="text-xs text-muted-foreground">
              <strong>0</strong> = aucune demande ne passe par le centre. Une demande <em>sans montant
              renseigné</em> y passe quand même : on ne franchit pas un contrôle sur une absence de donnée.
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-success" /> : null}
            {saved ? "Enregistré" : "Enregistrer"}
          </Button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function LigneCard({ row }: { row: LigneCentre }) {
  const jours = Math.floor((Date.now() - new Date(row.depuis).getTime()) / 86_400_000);
  return (
    <li className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{row.intitule}</p>
          <p className="text-xs text-muted-foreground">
            {row.demandeur ? `Demandé par ${row.demandeur} · ` : ""}
            en attente depuis {jours === 0 ? "aujourd'hui" : `${jours} jour(s)`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone="neutral" dot={false}>{LIBELLE_FORME[row.forme]}</Badge>
          {jours >= 7 && <Badge tone="danger" dot={false}>dort depuis {jours} j</Badge>}
        </div>
      </div>

      <p className="text-sm">
        {/* Le montant ET le seuil, côte à côte : c'est le RAPPORT des deux qui explique pourquoi
            cette demande est ici, et un montant seul ne le dit pas. */}
        {row.montant != null && row.montant > 0
          ? <><strong>{row.montant.toLocaleString("fr-FR")} DZD</strong>{row.seuil ? <> — au-dessus du seuil de {row.seuil.toLocaleString("fr-FR")} DZD</> : null}</>
          : <span className="text-muted-foreground">Montant non renseigné — la porte s&apos;ouvre par défaut : on ne franchit pas un contrôle sur une absence de donnée.</span>}
      </p>

      {row.forme === "VISA_CENTRE"
        ? <DecisionVisa row={row} />
        : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={row.href}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-ring"
            >
              Ouvrir le dossier et décider <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <p className="text-xs text-muted-foreground">
              La décision se prend devant le dossier — avec ses pièces, sa catégorie budgétaire et le fil des avis.
            </p>
          </div>
        )}
    </li>
  );
}

function DecisionVisa({ row }: { row: LigneCentre }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const decider = async (approuve: boolean) => {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("entityType", row.entityType);
    fd.set("entityId", row.entityId);
    fd.set("approve", approuve ? "1" : "0");
    fd.set("note", note);
    const r = await deciderVisaCentreAdPro(fd);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "Échec.");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`note-${row.entityId}`}>Motif <span className="text-muted-foreground">(obligatoire pour refuser)</span></Label>
        <Input
          id={`note-${row.entityId}`} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Ce que le demandeur doit savoir"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => decider(true)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Autoriser le dépassement
        </Button>
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => decider(false)}>Refuser</Button>
        <Link
          href={row.href}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Voir le dossier <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
