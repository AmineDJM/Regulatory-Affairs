"use client";

import * as React from "react";
import { Loader2, Send, Landmark, CheckCircle2, Clock, XCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { envoyerPaieAuCentre } from "@/lib/actions/payroll-hr-actions";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { ETAT_VIREMENT_LABEL, moisDeLaPaie, type MoisDeLEntite, type VirementDuMois } from "@/lib/hr/virement-paie";
import { BoutonDecisif } from "@/components/ui/bouton-decisif";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES VIREMENTS DE LA PAIE — un bouton par entité (§118.176).
 *
 * « Pour la paie, c'est un bouton pour toute la paie avec mention obligatoire de la somme des
 * salaires à virer. (un bouton par entité) » — la Direction, 01/10/2026.
 *
 * Chaque entité a sa carte, pour le mois choisi : ce qui est saisi, ce qui attend le centre, ce
 * qui est viré. La SOMME À VIRER se tape — elle n'est jamais pré-remplie : c'est l'attestation des
 * RH sur ce qui doit partir, et un champ prérempli se valide sans être relu. La somme des nets
 * saisis est montrée À CÔTÉ, pour comparer, avec l'écart en direct.
 *
 * Le rafraîchissement passe par `useRafraichir` (§118.172) : tant que la carte n'est pas à jour,
 * l'envoi reste fermé — sinon un second clic partirait sur l'état d'avant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface MoisCarte extends MoisDeLEntite {
  virements: VirementDuMois[];
}

export interface CarteEntite {
  companyId: string;
  label: string;
  /** Index 0 = janvier. */
  mois: MoisCarte[];
}

const ICONE: Record<VirementDuMois["etat"], React.ReactNode> = {
  EN_ATTENTE: <Clock className="h-3.5 w-3.5" />,
  A_VIRER: <Landmark className="h-3.5 w-3.5" />,
  VIRE: <CheckCircle2 className="h-3.5 w-3.5" />,
  REFUSE: <XCircle className="h-3.5 w-3.5" />,
  ANNULE: <XCircle className="h-3.5 w-3.5" />,
};
const TON: Record<VirementDuMois["etat"], "warning" | "info" | "success" | "danger" | "neutral"> = {
  EN_ATTENTE: "warning", A_VIRER: "info", VIRE: "success", REFUSE: "danger", ANNULE: "neutral",
};

export function VirementsPaie({
  year, cartes, sansEntite, budgetOptions, moisInitial,
}: {
  year: number;
  cartes: CarteEntite[];
  /** Salaires saisis de salariés sans entité, par mois (index 0 = janvier). */
  sansEntite: number[];
  budgetOptions: { id: string; label: string }[];
  moisInitial: number;
}) {
  const [mois, setMois] = React.useState<number>(moisInitial);
  const libelleMois = moisDeLaPaie(year, mois);

  return (
    <section className="surface space-y-3 p-3 sm:p-4" aria-labelledby="virements-paie-titre">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="virements-paie-titre" className="flex items-center gap-2 text-sm font-semibold">
            <Send className="h-4 w-4 text-primary" /> Virement de la paie — centre de paiement
          </h2>
          <p className="text-xs text-muted-foreground">
            Un envoi par entité, avec la somme des salaires à virer. Le centre l&apos;autorise, les Finances la virent ;
            les salariés sont prévenus au virement.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mois</span>
          <Select value={String(mois)} onChange={(e) => setMois(Number(e.target.value))} className="h-9 w-40 text-sm" aria-label="Mois de la paie">
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{moisDeLaPaie(year, i + 1)}</option>)}
          </Select>
        </label>
      </div>

      {cartes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune entité ne vous est ouverte : la paie s&apos;envoie entité par entité.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cartes.map((c) => (
            <CarteVirement
              key={`${c.companyId}:${mois}`}
              year={year} month={mois} libelleMois={libelleMois}
              carte={c} etat={c.mois[mois - 1]!} budgetOptions={budgetOptions}
            />
          ))}
        </div>
      )}

      {(sansEntite[mois - 1] ?? 0) > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            {sansEntite[mois - 1]} salaire{(sansEntite[mois - 1] ?? 0) > 1 ? "s" : ""} saisi{(sansEntite[mois - 1] ?? 0) > 1 ? "s" : ""} pour {libelleMois} appartien{(sansEntite[mois - 1] ?? 0) > 1 ? "nent" : "t"} à des salariés
            rattachés à aucune entité : leur paie ne peut pas partir au centre. Rattachez-les à leur entité depuis leur fiche RH.
          </span>
        </p>
      )}
    </section>
  );
}

function CarteVirement({
  year, month, libelleMois, carte, etat, budgetOptions,
}: {
  year: number;
  month: number;
  libelleMois: string;
  carte: CarteEntite;
  etat: MoisCarte;
  budgetOptions: { id: string; label: string }[];
}) {
  const { enCours, rafraichir } = useRafraichir();
  const [somme, setSomme] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const saisie = Number(somme.replace(/[\s  ]/g, "").replace(",", "."));
  const ecart = somme.trim() && Number.isFinite(saisie) ? Math.round((saisie - etat.netsAEnvoyer) * 100) / 100 : null;
  const vire = etat.virements.find((v) => v.etat === "VIRE") ?? null;

  const envoyer = async (fd: FormData) => {
    setBusy(true); setMsg(null);
    fd.set("companyId", carte.companyId);
    fd.set("year", String(year));
    fd.set("month", String(month));
    const r = await envoyerPaieAuCentre(fd).catch(() => ({ ok: false as const, error: "L'envoi n'a pas abouti — réessayez." }));
    setBusy(false);
    setMsg({ ok: r.ok, texte: r.ok ? (r.message ?? "Paie envoyée au centre de paiement.") : (r.error ?? "Envoi refusé.") });
    if (r.ok) { setSomme(""); rafraichir(); }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3" data-entite={carte.label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{carte.label}</p>
        {etat.enCours ? (
          <Badge tone={TON[etat.enCours.etat]} dot={false}>{ETAT_VIREMENT_LABEL[etat.enCours.etat]}</Badge>
        ) : etat.aEnvoyer > 0 ? (
          <Badge tone="warning" dot={false}>{etat.complement ? "Complément à envoyer" : "À envoyer"}</Badge>
        ) : vire || etat.vires > 0 ? (
          <Badge tone="success" dot={false}>Virée</Badge>
        ) : (
          <Badge tone="neutral" dot={false}>Rien de saisi</Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {etat.aEnvoyer > 0
          ? <>{etat.aEnvoyer} salaire{etat.aEnvoyer > 1 ? "s" : ""} saisi{etat.aEnvoyer > 1 ? "s" : ""} à envoyer — nets <strong className="text-foreground">{formatCurrency(etat.netsAEnvoyer)}</strong></>
          : <>Aucun salaire saisi en attente d&apos;envoi pour {libelleMois}.</>}
        {etat.envoyes > 0 && <> · {etat.envoyes} dans l&apos;envoi en cours</>}
        {etat.vires > 0 && <> · {etat.vires} virés</>}
      </p>

      {etat.virements.length > 0 && (
        <ul className="space-y-1 text-xs">
          {etat.virements.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-1.5">
              <Badge tone={TON[v.etat]} dot={false}>{ICONE[v.etat]} {ETAT_VIREMENT_LABEL[v.etat]}</Badge>
              <span className="tabular-nums">{formatCurrency(v.montant)}</span>
              <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">
                {v.reference ?`${v.reference} · ` : ""}envoyée le {formatDate(v.envoyeLe)}{v.vireLe ? ` · virée le ${formatDate(v.vireLe)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {etat.refus ? (
        etat.aEnvoyer > 0 || etat.enCours ? <p className="text-xs text-muted-foreground">{etat.refus}</p> : null
      ) : (
        <form action={envoyer} className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`somme-${carte.companyId}-${month}`}>
                Somme des salaires à virer (DZD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`somme-${carte.companyId}-${month}`} name="amount" inputMode="decimal" required
                value={somme} onChange={(e) => setSomme(e.target.value)} placeholder="Ex. 1 250 000"
                className="h-9 text-right tabular-nums"
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                Nets saisis : {formatCurrency(etat.netsAEnvoyer)}
                {ecart !== null && ecart !== 0 && <> · écart {ecart > 0 ? "+" : "−"}{formatCurrency(Math.abs(ecart))}</>}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cat-${carte.companyId}-${month}`}>Catégorie budgétaire <span className="text-xs font-normal text-muted-foreground">(facultatif)</span></Label>
              <Select id={`cat-${carte.companyId}-${month}`} name="budgetCategoryId" defaultValue="" className="h-9 text-sm">
                <option value="">— Laisser aux Finances —</option>
                {budgetOptions.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </Select>
            </div>
          </div>
          <BoutonDecisif type="submit" size="sm" disabled={busy || enCours} className="h-auto min-h-9 max-w-full whitespace-normal py-1.5 text-left [&_svg]:shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {etat.complement ? `Envoyer un complément — ${carte.label}` : `Envoyer la paie au centre — ${carte.label}`}
          </BoutonDecisif>
        </form>
      )}

      {msg && (
        <p role="status" className={msg.ok ? "rounded-lg bg-success/10 px-3 py-2 text-xs" : "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"}>
          {msg.texte}
        </p>
      )}
    </div>
  );
}
