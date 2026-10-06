"use client";

import * as React from "react";
import { Loader2, Undo2 } from "lucide-react";
import { retirerDemandeDevisPromo } from "@/lib/actions/promo-devis-actions";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/**
 * RETIRER LA DEMANDE DE DEVIS DEPUIS LE DOSSIER (audit du 04/10, constat 35). Offert seulement quand le
 * serveur l'a décidé possible (le demandeur ou la Direction, étape « devis demandés ») ; quand l'assistante
 * a déjà retranscrit, le geste n'est pas offert et la carte dit pourquoi — la phrase même de l'action
 * (§118.83). Le motif est exigé : c'est ce que lira l'assistante.
 */
export function RetirerDemandeDevis({ promoMaterialId, references, refus }: { promoMaterialId: string; references: string[]; refus: string | null }) {
  const { enCours, rafraichir } = useRafraichir();
  const [ouvert, setOuvert] = React.useState(false);
  const [motif, setMotif] = React.useState("");
  const [envoi, setEnvoi] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  if (refus) return <p className="text-xs text-muted-foreground">{refus}</p>;
  const occupe = envoi || enCours;
  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5 text-xs">
      {msg && <p className="text-emerald-700 dark:text-emerald-400">{msg}</p>}
      {err && <p role="alert" className="text-destructive">{err}</p>}
      {!ouvert ? (
        <Button size="sm" variant="outline" className="h-auto min-h-9 w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] sm:h-auto sm:min-h-8 sm:w-auto" disabled={occupe} onClick={() => { setOuvert(true); setErr(null); }}>
          <Undo2 className="h-4 w-4" /> Retirer la demande de devis{references.length ? ` (${references.join(", ")})` : ""}
        </Button>
      ) : (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData();
            f.set("promoMaterialId", promoMaterialId);
            f.set("motif", motif);
            setEnvoi(true); setErr(null);
            const r = await retirerDemandeDevisPromo(f);
            setEnvoi(false);
            if (!r.ok) { setErr(r.error ?? "Retrait impossible."); return; }
            setMsg(r.message ?? "Demande de devis retirée.");
            setOuvert(false); setMotif("");
            rafraichir();
          }}
        >
          <label className="block font-medium" htmlFor={`motif-retrait-${promoMaterialId}`}>Pourquoi retirer la demande de devis ?</label>
          <Textarea id={`motif-retrait-${promoMaterialId}`} value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="submit" size="sm" variant="destructive" disabled={occupe || motif.trim() === ""}>
              {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Retirer la demande
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={occupe} onClick={() => setOuvert(false)}>Annuler</Button>
          </div>
        </form>
      )}
    </div>
  );
}
