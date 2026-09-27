"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transfererConsulting } from "@/lib/actions/consulting-actions";

/**
 * TRANSFÉRER LE CONTRAT VERS L'AUTRE PÔLE (§118.150) — Ad & Pro ⇄ Ressources humaines.
 *
 * La page ne monte ce bloc que pour qui a le droit de MODIFIER des deux côtés ; l'action revérifie.
 * La confirmation dit ce qui BOUGE et ce qui NE bouge PAS avant le clic : après, la personne qui
 * suivait le contrat ne le voit plus, et découvrir la portée d'un geste en le faisant n'est pas
 * une confirmation (§118.53).
 */
export function TransferPanel({
  id, depuis, vers, versLibelle,
}: {
  id: string;
  depuis: string;
  vers: string;
  versLibelle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [fait, setFait] = React.useState<string | null>(null);

  const transferer = async () => {
    if (!window.confirm(
      `Transférer ce contrat de ${depuis} vers ${versLibelle} ?\n\n`
      + `• Il quitte la liste de ${depuis} et rejoint celle de ${versLibelle} : ceux qui n'ont que ${depuis} ne le verront plus.\n`
      + "• Rien n'est perdu : référence, tâches, pièces, validation et historique suivent le contrat.\n"
      + "• Une validation encore en attente au centre Ad & Pro est retirée si le contrat quitte Ad & Pro.\n\n"
      + "Le geste inverse le ramène.",
    )) return;
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("vers", vers);
    const r = await transfererConsulting(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Le transfert a échoué."); return; }
    setFait(r.message ?? `Contrat transféré vers ${versLibelle}.`);
    router.refresh();
  };

  return (
    <div className="surface space-y-2 p-4">
      <h3 className="text-sm font-semibold">Pôle du contrat</h3>
      <p className="text-xs text-muted-foreground">
        Suivi aujourd&apos;hui par {depuis}. Le transfert le confie à {versLibelle}, sans rien perdre.
      </p>
      <Button variant="outline" className="w-full" disabled={busy} onClick={transferer}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
        Transférer vers {versLibelle}
      </Button>
      {fait && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{fait}</p>}
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}
