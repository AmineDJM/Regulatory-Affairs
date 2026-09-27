"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, Loader2, ShieldCheck, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adresserBCAuCentre } from "@/lib/actions/legal-actions";
import {
  LIBELLE_CENTRE_BC, LIBELLE_ETAT_BC, CHEMIN_CENTRE_BC, reserveBC,
  type CentreBC, type EtatPorteBC, type PorteBC,
} from "@/lib/bons-de-commande/regle";

/**
 * LA PORTE D'UN BON DE COMMANDE, SUR SA FICHE (§118.148).
 *
 * « Tout BC passe par un centre de validation » ne se croit pas sur parole : la fiche dit
 * LEQUEL, où le BC en est, et le motif du centre quand il a refusé ou demandé une correction.
 * Sans elle, la personne qui a enregistré le BC devrait aller chercher la réponse dans un centre
 * où elle ne siège pas — c'est-à-dire ne jamais la trouver.
 *
 * Et un BC SANS porte (enregistré avant la règle, ou dont l'aiguillage a échoué) porte ici le
 * geste qui le rattrape. La règle pure vit au socle et ne lit rien : ce composant client peut
 * l'importer sans tirer la base dans le navigateur.
 */

const TON: Record<EtatPorteBC, "warning" | "success" | "danger" | "info"> = {
  EN_ATTENTE: "warning",
  VALIDE: "success",
  REFUSE: "danger",
  A_REVOIR: "info",
};

export function BonDeCommandeGate({
  documentId, porte, centreAttendu, canAddress, siegeAuCentre,
}: {
  documentId: string;
  porte: PorteBC | null;
  /** Le centre que l'origine du BC désigne — celui où il ira s'il n'a pas encore de porte. */
  centreAttendu: CentreBC;
  canAddress: boolean;
  /** La personne siège-t-elle au centre de la porte ? Le lien n'est offert qu'à elle. */
  siegeAuCentre: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const adresser = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const f = new FormData();
    f.set("id", documentId);
    const r = await adresserBCAuCentre(f);
    setBusy(false);
    if (r.ok) { setMsg(r.message ?? null); router.refresh(); }
    else setErr(r.error ?? "L'envoi au centre a échoué.");
  };

  const centre = porte?.centre ?? centreAttendu;
  const reserve = reserveBC(porte);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Validation du bon de commande
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {porte ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TON[porte.etat]} dot={false}>{LIBELLE_ETAT_BC[porte.etat]}</Badge>
              <span className="text-muted-foreground">
                {/* Le centre, NOMMÉ : « en attente » tout seul ne dit pas qui relancer. */}
                au {LIBELLE_CENTRE_BC[porte.centre]}
                {porte.source === "POSTE" && " — décidé sur la demande de bon de commande du poste Ad & Pro"}
              </span>
            </div>
            {porte.note && (
              <p className="rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs">
                <strong>Motif du centre :</strong> {porte.note}
              </p>
            )}
            {reserve && <p className="text-xs text-muted-foreground">{reserve}</p>}
            {siegeAuCentre && porte.etat === "EN_ATTENTE" && (
              <Link href={CHEMIN_CENTRE_BC[centre]} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Décider depuis le {LIBELLE_CENTRE_BC[centre]} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </>
        ) : (
          <>
            <p>
              Ce bon de commande n&apos;est passé par <strong>aucun</strong> centre de validation. Il n&apos;engage
              pas la société tant qu&apos;il n&apos;a pas été validé : d&apos;après son origine, il revient au{" "}
              <strong>{LIBELLE_CENTRE_BC[centreAttendu]}</strong>.
            </p>
            {canAddress && (
              <Button size="sm" variant="primary" onClick={adresser} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Adresser au {LIBELLE_CENTRE_BC[centreAttendu]}
              </Button>
            )}
          </>
        )}
        {msg && <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-foreground">{msg}</p>}
        {err && (
          <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
