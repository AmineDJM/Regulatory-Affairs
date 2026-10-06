"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Lock, RotateCcw } from "lucide-react";
import { cloturerSponsoring, rouvrirSponsoring } from "@/lib/actions/sponsoring-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

/**
 * LA VALIDATION FINALE ET LA CLÔTURE D'UN SPONSORING (§118.151) — l'écran du geste.
 *
 * Tout ce qu'il affiche vient du SERVEUR, calculé par le module pur (`ad-pro/cloture-sponsoring`)
 * que l'action relit au moment du clic : le bilan (ce qui manque, dit en une fois), le total qui
 * sera écrit, et qui a le droit. Le recalculer ici ferait deux vérités — un bouton actif qu'une
 * action refuse, ou l'inverse (§118.5).
 */
export interface BilanAffiche {
  cloturable: boolean;
  manques: string[];
  total: number;
  accordes: number;
  refuses: number;
  aDecider: number;
}

export function ClosurePanel({
  id, statut, bilan, peutAgir, quiCloture, cloture,
}: {
  id: string;
  statut: string;
  bilan: BilanAffiche;
  /** Tient l'autorité de la clôture (et de la réouverture) sur CETTE demande. */
  peutAgir: boolean;
  /** « la Direction Marketing » ou « la Direction (…) » — qui agit, dit en clair. */
  quiCloture: string;
  /** Renseigné quand la demande a été clôturée par sa validation finale. */
  cloture: { le: string; par: string | null; note: string | null; montant: number | null } | null;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [motif, setMotif] = React.useState("");
  const [rouvrir, setRouvrir] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  const agir = (fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, champs: Record<string, string>) =>
    start(async () => {
      setErr(null);
      const fd = new FormData();
      fd.set("id", id);
      for (const [k, v] of Object.entries(champs)) if (v.trim()) fd.set(k, v.trim());
      const r = await fn(fd);
      if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
      setNote(""); setMotif(""); setRouvrir(false);
      router.refresh();
    });

  // ── CLÔTURÉE : ce qui a été arrêté, et le geste qui rouvre ──
  if (cloture) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-start gap-2 rounded-lg bg-success/10 px-3 py-2 text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Validée et clôturée le {cloture.le}{cloture.par ? ` par ${cloture.par}` : ""} —
            montant accordé <strong>{cloture.montant != null ? formatCurrency(cloture.montant) : "—"}</strong>
            {" "}({bilan.accordes} poste{bilan.accordes > 1 ? "s" : ""} accordé{bilan.accordes > 1 ? "s" : ""}
            {bilan.refuses > 0 ? `, ${bilan.refuses} refusé${bilan.refuses > 1 ? "s" : ""}` : ""}).
          </span>
        </p>
        {cloture.note && <p className="text-muted-foreground">« {cloture.note} »</p>}
        {peutAgir && (
          rouvrir ? (
            <div className="space-y-2">
              <Textarea
                value={motif} onChange={(e) => setMotif(e.target.value)} className="min-h-[60px]"
                placeholder="Pourquoi rouvrir ? (obligatoire — une facture d'un autre montant, un poste oublié…)"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={pending || !motif.trim()} onClick={() => agir(rouvrirSponsoring, { reason: motif })}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Rouvrir la demande
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setRouvrir(false); setErr(null); }}>Annuler</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setRouvrir(true)}>
              <RotateCcw className="h-4 w-4" /> Rouvrir la demande
            </Button>
          )
        )}
        {err && <Erreur texte={err} />}
      </div>
    );
  }

  // ── PAS ENCORE PRÉ-VALIDÉE : la clôture vient après la tenue ──
  if (statut !== "PRE_VALIDATED") {
    return (
      <p className="text-sm text-muted-foreground">
        La validation finale vient après la <strong className="text-foreground">pré-validation de la tenue</strong> (fin du circuit
        ci-dessus) : les postes se préparent alors — devis, BC, factures —, puis {quiCloture} valide chaque poste, le range dans
        un budget et clôture la demande.
      </p>
    );
  }

  // ── PRÉ-VALIDÉE : le bilan, et le geste s'il est possible ──
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        La tenue est pré-validée. Une fois l&apos;événement complété, {quiCloture} valide chaque poste, le range dans un budget,
        puis clôture : la somme des postes accordés devient le montant accordé de la demande.
      </p>
      {/* Le total (un montant en DZD) prend toute la largeur au téléphone : trois colonnes l'écrasaient. */}
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
        <Chiffre libelle="Accordés" valeur={String(bilan.accordes)} />
        <Chiffre libelle="À décider" valeur={String(bilan.aDecider)} alerte={bilan.aDecider > 0} />
        <Chiffre libelle="Total accordé" valeur={formatCurrency(bilan.total)} className="col-span-2 sm:col-span-1" />
      </div>
      {!bilan.cloturable && (
        <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
          {bilan.manques.map((m) => (
            <li key={m} className="flex items-start gap-1.5"><AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" /> {m}</li>
          ))}
        </ul>
      )}
      {peutAgir ? (
        <div className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[50px]" placeholder="Note de clôture (facultative)" />
          <BoutonDecisif
            size="sm" disabled={pending || !bilan.cloturable}
            title={bilan.cloturable ? undefined : "Réglez d'abord ce qui est listé ci-dessus."}
            confirmation={`valider et clôturer — accordé ${formatCurrency(bilan.total)}, postes arrêtés`}
            onClick={() => { agir(cloturerSponsoring, { note }); }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Valider et clôturer
          </BoutonDecisif>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">La validation finale revient à {quiCloture} — jamais à l&apos;auteur de la demande.</p>
      )}
      {err && <Erreur texte={err} />}
    </div>
  );
}

function Chiffre({ libelle, valeur, alerte = false, className = "" }: { libelle: string; valeur: string; alerte?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border px-2 py-1.5 ${alerte ? "border-warning/50 bg-warning/5" : "border-border"} ${className}`}>
      <p className="text-[0.6875rem] text-muted-foreground">{libelle}</p>
      <p className="break-words font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}

function Erreur({ texte }: { texte: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span className="min-w-0 break-words">{texte}</span>
    </div>
  );
}
