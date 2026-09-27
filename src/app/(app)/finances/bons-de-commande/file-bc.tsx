"use client";

import * as React from "react";
import Link from "next/link";
import { FilePen, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useAction } from "@/components/shared/use-action";
import { signerBonDeCommande } from "@/lib/actions/bc-signature-actions";
import { LIBELLE_CENTRE_BC } from "@/lib/bons-de-commande/regle";
import type { LigneBCFinances } from "@/lib/queries/bons-de-commande";
import { lienFichierEmis } from "@/lib/legal/fichiers-emis";

/**
 * LA FILE DES FINANCES — chaque BC avec ce qu'il faut pour le signer en connaissance de cause :
 * la pièce elle-même (on signe ce qu'on a LU, §104.7), la partie en face, le montant, et
 * POURQUOI il est là — validé par tel centre, ou sous le seuil. Un BC sans cette raison se lirait
 * comme un BC qui a sauté la validation.
 *
 * Le module de la règle (`regle.ts`) n'importe rien : l'afficher côté navigateur ne tire aucune
 * dépendance serveur (CLAUDE.md, frontière client / serveur).
 */
export function FileBonsDeCommande({
  aSigner, signes, peutSigner, refus, tronquee,
}: {
  aSigner: LigneBCFinances[];
  signes: LigneBCFinances[];
  peutSigner: boolean;
  refus: string | null;
  tronquee: boolean;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>À signer</CardTitle>
          <CardDescription>
            {aSigner.length === 0
              ? "Aucun bon de commande n'attend votre signature."
              : `${aSigner.length} bon(s) de commande, le plus ancien en tête : c'est lui qui retient une commande.`}
            {refus ? ` ${refus}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aSigner.length === 0 ? (
            <EmptyState
              icon="FilePen"
              title="Rien à signer"
              description="Un bon de commande arrive ici une fois validé par son centre de validation, ou directement s'il est sous le seuil de validation."
            />
          ) : (
            <ul className="space-y-3">
              {aSigner.map((l) => <LigneASigner key={l.id} ligne={l} peutSigner={peutSigner} />)}
            </ul>
          )}
          {tronquee && (
            <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
              La file a été bornée aux 200 bons de commande en cours les plus anciens : d&apos;autres existent, ils apparaîtront à mesure que ceux-ci seront signés.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signés récemment</CardTitle>
          <CardDescription>Les derniers bons de commande signés par les Finances — ils peuvent partir chez le fournisseur.</CardDescription>
        </CardHeader>
        <CardContent>
          {signes.length === 0 ? (
            <EmptyState icon="CircleCheck" title="Aucune signature pour l'instant" />
          ) : (
            <ul className="divide-y divide-border">
              {signes.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <Link href={`/legal/${l.id}`} className="font-medium hover:underline">{l.reference ?? l.title}</Link>
                    {l.counterparty ? <span className="text-muted-foreground"> — {l.counterparty}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {montant(l.montant)} · signé {l.signeLe ? `le ${new Date(l.signeLe).toLocaleDateString("fr-FR")}` : ""}
                    {l.signePar ? ` par ${l.signePar}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const montant = (m: number | null) => (m != null && m > 0 ? `${m.toLocaleString("fr-FR")} DZD` : "montant non renseigné");

/** POURQUOI ce BC est à signer : validé par un centre, ou sous le seuil — jamais laissé implicite. */
function raison(l: LigneBCFinances): string {
  if (l.porte?.etat === "VALIDE") {
    return l.porte.source === "POSTE"
      ? "Poste Ad & Pro validé par le centre de validation Ad & Pro"
      : `Validé par le ${LIBELLE_CENTRE_BC[l.porte.centre]}`;
  }
  return "Sous le seuil de validation — aucun centre n'avait à le valider";
}

function LigneASigner({ ligne: l, peutSigner }: { ligne: LigneBCFinances; peutSigner: boolean }) {
  const { saving, err, run } = useAction();
  const [fait, setFait] = React.useState<string | null>(null);
  const jours = Math.floor((Date.now() - new Date(l.creeLe).getTime()) / 86_400_000);
  return (
    <li className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">
            {l.reference ? `${l.reference} — ` : ""}{l.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {l.counterparty ?? "Fournisseur non renseigné"}{l.societe ? ` · ${l.societe}` : ""}
            {l.creePar ? ` · établi par ${l.creePar}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{montant(l.montant)}</p>
          <p className="text-xs text-muted-foreground">{jours <= 0 ? "aujourd'hui" : `il y a ${jours} j`}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={l.porte ? "success" : "info"} dot={false}>{raison(l)}</Badge>
        {l.porte?.note ? <span className="text-xs text-muted-foreground">« {l.porte.note} »</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/legal/${l.id}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Ouvrir la fiche
        </Link>
        {/* LIRE AVANT DE SIGNER. Le fichier émis vit dans le Drive personnel de celui qui a émis le
            BC : l'ouvrir par le Drive répondait 403 aux Finances. Il s'ouvre sous la porte de la
            PIÈCE ; un fichier rattaché à la main garde la porte du Drive (§118.152). */}
        {l.fichiers.pdf || l.fichiers.docx ? (
          <a href={lienFichierEmis(l.id, l.fichiers.pdf ? "pdf" : "docx")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
            Lire la pièce
          </a>
        ) : l.driveNodeId ? (
          <a href={`/api/drive/${l.driveNodeId}/raw`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary">
            Lire la pièce
          </a>
        ) : null}
        {peutSigner && !fait && (
          <Button
            size="sm" disabled={saving}
            onClick={() => {
              const fd = new FormData();
              fd.set("id", l.id);
              void run(async () => {
                const r = await signerBonDeCommande(fd);
                if (r.ok) setFait(r.message ?? "Signé.");
                return r;
              });
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePen className="h-4 w-4" />}
            Signer
          </Button>
        )}
      </div>
      {fait && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-foreground">{fait}</p>}
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </li>
  );
}
