"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, FileDown, Lock, Plus, ShieldAlert } from "lucide-react";
import {
  ETAT_CELLULE_LABELS, etatCellule, gesteCellule, lireCellule, praticiensParJour, semaineInitiale, semainesDuPlan,
  tonEtatCellule, type EtatCellule,
} from "@/lib/sfe/grille-tournee";
import { SEGMENT_LEVEL } from "@/lib/labels";
import type { Lettre } from "@/lib/segmentation/regles";
import type { LigneVue } from "../ma-journee/emploi-du-temps";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Ce que la cellule montre d'un praticien. */
export interface InfoPraticien {
  name: string;
  specialty: string | null;
  institution: string | null;
  wilaya: string | null;
  /** Le niveau de potentiel de la fiche (`SegmentLevel`) — le repère des seuls praticiens hors segmentation. */
  potential: string | null;
  /** LA LETTRE DE SEGMENTATION (H, A–D, NA, non ciblé) — la référence du liseré (Direction, 07/10) ; null = hors segmentation. */
  lettre?: Lettre | null;
  secteur: string | null;
}

/** Le liseré d'une lettre — les couleurs de la pastille de la Segmentation (H violet, A vert, B bleu, C orange, D rouge). */
const TON_LETTRE: Record<Lettre, string> = { H: "purple", A: "success", B: "info", C: "warning", D: "danger", NA: "neutral", NC: "neutral" };

/** Le repère d'une cellule : la lettre quand le praticien est segmenté, sinon l'ancien palier de potentiel. */
function repereDe(info: InfoPraticien): { tone: string; libelle: string } | null {
  if (info.lettre) return { tone: TON_LETTRE[info.lettre], libelle: info.lettre === "NC" ? "non ciblé" : `lettre ${info.lettre}` };
  const s = info.potential ? SEGMENT_LEVEL[info.potential] : undefined;
  return s ? { tone: s.tone, libelle: `potentiel ${s.label.toLowerCase()}` } : null;
}

/** Une visite enregistrée du plan, avec la clé de sa cellule (`AAAA-MM-JJ|doctorId`). */
export type LigneDuPlan = LigneVue & { cle: string };

export const jourLisible = (j: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" }) =>
  new Date(`${j}T09:00:00`).toLocaleDateString("fr-FR", opts);

/** Le liseré du potentiel — la couleur de son badge (`SEGMENT_LEVEL`), en bordure gauche de la cellule. */
const LISERE: Record<string, string> = {
  purple: "border-l-violet-500", success: "border-l-success", info: "border-l-primary", warning: "border-l-warning",
  danger: "border-l-destructive", neutral: "border-l-muted-foreground/40",
};
const PASTILLE: Record<string, string> = {
  purple: "bg-violet-500", success: "bg-success", info: "bg-primary", warning: "bg-warning", danger: "bg-destructive", neutral: "bg-muted-foreground/40",
};
const TEXTE_ETAT: Record<string, string> = { success: "text-success", warning: "text-warning", info: "text-primary", neutral: "text-muted-foreground" };

/**
 * LE PLAN DE TOURNÉE EN TABLEAU (Direction, 07/10 — maquette validée) : les JOURS en colonnes, une LIGNE par visite.
 *
 * Une semaine (dimanche → jeudi) à la fois, qu'on feuillette. Le même tableau au téléphone : il défile dans son cadre (deux
 * jours à l'écran), la colonne des rangs reste fixe. La lettre de segmentation se lit au liseré de la cellule, l'état de la visite dans la
 * cellule. UN geste par cellule : la toucher ouvre ce qu'on peut en faire (rédiger le rapport, dire qu'elle n'a pas eu lieu,
 * la déplacer, la retirer) ; une case vide d'un plan en brouillon porte un « + ».
 *
 * Ni qui peut modifier (`grilleModifiable`), ni l'état d'une visite (`etatCellule`), ni ce qu'un clic ouvre (`gesteCellule`) ne
 * se décident ici : le module pur le dit, l'action serveur le revérifie.
 */
export function GrilleTournee({
  joursOuvres, paires, aujourdhui, infoDe, lignesParCle, verrouillees, planValide, jeSuisLeKam, modifiable, occupe,
  onAjouter, onDeplacer, onRetirer, onRapporter, onNonTenue, exportHref, lienPv = null,
}: {
  /**
   * Le signalement de pharmacovigilance prérempli avec CE praticien (`lienSignalerPv`) — passé seulement au KAM qui
   * peut signaler : la feuille d'une visite l'offre en geste secondaire (Direction, 07/10).
   */
  lienPv?: ((doctorId: string) => string) | null;
  joursOuvres: string[];
  paires: ReadonlySet<string>;
  /** `AAAA-MM-JJ` du jour, calculé par le serveur — un `new Date()` au rendu diverge entre serveur et navigateur. */
  aujourdhui: string;
  infoDe: (doctorId: string) => InfoPraticien;
  lignesParCle: ReadonlyMap<string, LigneDuPlan>;
  /** Les cellules qu'on ne déplace ni ne retire : rapportées, ou passées d'un plan déjà validé (§118.193). */
  verrouillees: ReadonlySet<string>;
  planValide: boolean;
  jeSuisLeKam: boolean;
  modifiable: boolean;
  occupe: boolean;
  onAjouter: (jour: string) => void;
  /** Rend le refus (une phrase), ou `null` quand le déplacement est fait. */
  onDeplacer: (cle: string, versJour: string) => string | null;
  onRetirer: (cle: string) => string | null;
  onRapporter: (ligne: LigneDuPlan) => void;
  onNonTenue: (ligne: LigneDuPlan) => void;
  /** Le PDF du plan validé (`/api/medical/plan-de-tournee/<id>/pdf`) — absent tant que le plan n'est pas validé. */
  exportHref?: string | null;
}) {
  const semaines = React.useMemo(() => semainesDuPlan(joursOuvres), [joursOuvres]);
  const [semaine, setSemaine] = React.useState(() => semaineInitiale(semaines, aujourdhui));
  const jours = semaines[semaine]?.jours ?? [];
  const [actif, setActif] = React.useState<string | null>(null);
  const [versJour, setVersJour] = React.useState("");
  const [refus, setRefus] = React.useState<string | null>(null);
  const [survol, setSurvol] = React.useState<string | null>(null);
  /** Le rapport déjà fait, déplié en lecture dans la feuille de la visite (« Voir le rapport »). */
  const [voirRapport, setVoirRapport] = React.useState(false);

  const parJour = React.useMemo(() => praticiensParJour(paires, joursOuvres, infoDe), [paires, joursOuvres, infoDe]);
  const compte = (j: string) => parJour.get(j)?.length ?? 0;
  const totalSemaine = jours.reduce((n, j) => n + compte(j), 0);
  // Autant de lignes que le jour le plus chargé ; une de plus en brouillon, pour le « + » de chaque jour.
  const nbLignes = Math.max(1, Math.max(0, ...jours.map(compte)) + (modifiable ? 1 : 0));

  const ouvrir = (cle: string) => { setRefus(null); setVersJour(""); setVoirRapport(false); setActif(cle); };
  const actifCellule = actif ? lireCellule(actif) : null;
  const actifInfo = actifCellule ? infoDe(actifCellule.doctorId) : null;
  const actifLigne = actif ? lignesParCle.get(actif) ?? null : null;
  const actifEtat: EtatCellule | null = actifCellule
    ? etatCellule({ etatEnregistre: actifLigne?.etat ?? null, planValide, jour: actifCellule.jour, aujourdhui })
    : null;
  const actifGeste = actifLigne && actifEtat ? gesteCellule({ etat: actifEtat, heuresRestantes: actifLigne.heuresRestantes, planValide, jeSuisLeKam }) : "AUCUN";
  const actifDeplacable = Boolean(actif) && modifiable && !verrouillees.has(actif ?? "");
  const actifRapportFait = actifEtat === "FAITE" && actifLigne !== null;
  const actifLienPv = lienPv && actifCellule && actifEtat !== "PREVUE" && actifEtat !== "A_VENIR" && actifEtat !== "NON_ENREGISTREE"
    ? lienPv(actifCellule.doctorId)
    : null;

  if (joursOuvres.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun jour ouvré dans la période de ce plan.</p>;
  }

  const deposer = (j: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setSurvol(null);
    const cle = e.dataTransfer.getData("text/plain");
    if (cle) onDeplacer(cle, j);
  };

  return (
    <div className="space-y-2">
      {/* ── LA SEMAINE, SA NAVIGATION, ET LE PDF DU PLAN VALIDÉ ──────────────── */}
      <div className="flex items-center gap-2">
        {semaines.length > 1 && (
          <Button type="button" size="sm" variant="ghost" className="h-10 w-10 shrink-0 px-0 md:h-8 md:w-8" disabled={semaine === 0} onClick={() => setSemaine(semaine - 1)} aria-label="Semaine précédente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <p className="min-w-0 flex-1 truncate text-sm" aria-live="polite">
          <span className="font-medium">Semaine du {jours[0] ? jourLisible(jours[0], { day: "numeric", month: "long" }) : "—"}</span>
          <span className="text-muted-foreground">{semaines.length > 1 && ` · ${semaine + 1}/${semaines.length}`} · {totalSemaine} visite{totalSemaine > 1 ? "s" : ""}</span>
        </p>
        {exportHref && (
          <a href={exportHref} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary md:h-8">
            <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Exporter en</span> PDF
          </a>
        )}
        {semaines.length > 1 && (
          <Button type="button" size="sm" variant="ghost" className="h-10 w-10 shrink-0 px-0 md:h-8 md:w-8" disabled={semaine >= semaines.length - 1} onClick={() => setSemaine(semaine + 1)} aria-label="Semaine suivante">
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── LE TABLEAU — le même à toutes les tailles ; au téléphone il défile dans son cadre ── */}
      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card [scroll-snap-type:x_mandatory]">
        <table className="w-full border-separate border-spacing-0 text-sm md:table-fixed" aria-label={`Plan de tournée, semaine du ${jours[0] ? jourLisible(jours[0], { day: "numeric", month: "long" }) : ""}`}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-20 w-9 border-b border-r border-border bg-card px-0 py-2 text-center text-xs font-normal text-muted-foreground">#</th>
              {jours.map((j) => {
                const estAujourdhui = j === aujourdhui;
                return (
                  <th
                    key={j} scope="col"
                    className={cn(
                      "min-w-[9.5rem] snap-start border-b border-r border-border bg-card px-3 py-2 text-left align-top font-normal last:border-r-0 md:min-w-0",
                      estAujourdhui && "shadow-[inset_0_-2px_0_hsl(var(--primary))]",
                    )}
                    onDragOver={modifiable ? (e) => { e.preventDefault(); setSurvol(j); } : undefined}
                    onDrop={modifiable ? deposer(j) : undefined}
                  >
                    <span className="float-right text-xs tabular-nums text-muted-foreground">{compte(j)}</span>
                    <span className={cn("block text-xs font-medium uppercase tracking-wide", estAujourdhui ? "text-primary" : "text-muted-foreground")}>
                      {jourLisible(j, { weekday: "long" })}
                    </span>
                    <span className={cn("block font-semibold tabular-nums", estAujourdhui && "text-primary")}>{jourLisible(j, { day: "2-digit", month: "2-digit" })}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: nbLignes }, (_, r) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 border-b border-r border-border bg-card text-center text-xs tabular-nums text-muted-foreground">{r + 1}</td>
                {jours.map((j) => {
                  const ids = parJour.get(j) ?? [];
                  const id = ids[r];
                  const cle = id ? `${j}|${id}` : null;
                  return (
                    <td
                      key={j}
                      className={cn("h-16 border-b border-r border-border p-0 align-top last:border-r-0", survol === j && "bg-primary/5")}
                      onDragOver={modifiable ? (e) => { e.preventDefault(); setSurvol(j); } : undefined}
                      onDragLeave={modifiable ? () => setSurvol((s) => (s === j ? null : s)) : undefined}
                      onDrop={modifiable ? deposer(j) : undefined}
                    >
                      {cle && id ? (
                        <Cellule
                          cle={cle} jour={j} info={infoDe(id)} ligne={lignesParCle.get(cle) ?? null} verrou={verrouillees.has(cle)}
                          aujourdhui={aujourdhui} planValide={planValide} jeSuisLeKam={jeSuisLeKam} modifiable={modifiable} occupe={occupe}
                          onOuvrir={() => ouvrir(cle)} avecPv={Boolean(lienPv)}
                        />
                      ) : modifiable && r === ids.length ? (
                        <button
                          type="button" onClick={() => onAjouter(j)} disabled={occupe}
                          aria-label={`Ajouter des praticiens le ${jourLisible(j, { weekday: "long", day: "numeric", month: "long" })}`}
                          className="flex h-full min-h-16 w-full items-center justify-center text-muted-foreground/50 hover:bg-primary/5 hover:text-primary focus-ring"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* La légende du liseré — les lettres de la segmentation, une ligne. */}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["H", "A", "B", "C", "D"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><i className={cn("inline-block h-2 w-2 rounded-full", PASTILLE[TON_LETTRE[k]] ?? PASTILLE.neutral)} aria-hidden />{k}</span>
        ))}
      </p>

      {/* ── CE QU'ON FAIT D'UNE VISITE — une feuille, au doigt comme au clavier ── */}
      <Sheet
        open={actif !== null}
        onClose={() => setActif(null)}
        title={actifInfo?.name ?? "Praticien"}
        description={actifCellule ? jourLisible(actifCellule.jour, { weekday: "long", day: "numeric", month: "long" }) : ""}
        width="md"
      >
        {actif && actifCellule && (
          <div className="space-y-4">
            {actifEtat && actifEtat !== "PREVUE" && actifEtat !== "A_VENIR" && (
              <p className={cn("text-sm font-medium", TEXTE_ETAT[tonEtatCellule(actifEtat)])}>
                {ETAT_CELLULE_LABELS[actifEtat]}
                {actifEtat === "A_FAIRE" && actifLigne && <span className="ml-2 inline-flex items-center gap-1 font-normal text-muted-foreground"><Clock className="h-3.5 w-3.5" />{actifLigne.heuresRestantes} h</span>}
              </p>
            )}
            {/* LE RAPPORT FAIT, EN LECTURE — pour le KAM comme pour qui relit son plan (Direction, 07/10). */}
            {actifRapportFait && actifLigne && voirRapport && <RapportLu ligne={actifLigne} />}
            {/* UN GESTE PRINCIPAL : « Faire le rapport » (à faire) ou « Voir le rapport » (fait) ; le reste en secondaire. */}
            {actifLigne && (actifGeste !== "AUCUN" || actifRapportFait || actifLienPv) && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {actifGeste === "RAPPORTER" && (
                  <Button type="button" className="h-11 sm:h-10" disabled={occupe} onClick={() => { setActif(null); onRapporter(actifLigne); }}>
                    Faire le rapport
                  </Button>
                )}
                {actifRapportFait && !voirRapport && (
                  <Button type="button" className="h-11 sm:h-10" disabled={occupe} onClick={() => setVoirRapport(true)}>
                    Voir le rapport
                  </Button>
                )}
                {actifGeste === "CORRIGER" && (
                  <Button type="button" variant="outline" className="h-11 sm:h-10" disabled={occupe} onClick={() => { setActif(null); onRapporter(actifLigne); }}>
                    Corriger le rapport
                  </Button>
                )}
                {actifGeste === "RAPPORTER" && (
                  <Button type="button" variant="outline" className="h-11 sm:h-10" disabled={occupe} onClick={() => { setActif(null); onNonTenue(actifLigne); }}>
                    N&apos;a pas eu lieu
                  </Button>
                )}
                {actifLienPv && (
                  <Link href={actifLienPv} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-warning hover:bg-warning/10 sm:h-10">
                    <ShieldAlert className="h-4 w-4" /> Pharmacovigilance
                  </Link>
                )}
              </div>
            )}
            {actifDeplacable && (
              <div className={cn("space-y-3", actifGeste !== "AUCUN" && "border-t border-border pt-3")}>
                <div className="space-y-1.5">
                  <Label htmlFor="grille-deplacer">Déplacer au</Label>
                  <div className="flex flex-wrap gap-2">
                    <Select id="grille-deplacer" className="min-w-0 flex-1" value={versJour} onChange={(e) => setVersJour(e.target.value)}>
                      <option value="">— Choisir un jour —</option>
                      {joursOuvres.filter((j) => j !== actifCellule.jour).map((j) => {
                        const dejaLa = paires.has(`${j}|${actifCellule.doctorId}`);
                        return <option key={j} value={j} disabled={dejaLa}>{jourLisible(j, { weekday: "long", day: "2-digit", month: "2-digit" })}{dejaLa ? " — déjà prévu" : ""}</option>;
                      })}
                    </Select>
                    <Button
                      type="button" className="h-11 w-full sm:h-10 sm:w-auto" disabled={!versJour || occupe}
                      onClick={() => { const r = onDeplacer(actif, versJour); if (r) setRefus(r); else setActif(null); }}
                    >
                      Déplacer
                    </Button>
                  </div>
                </div>
                <Button
                  type="button" variant="outline" className="h-11 w-full text-destructive sm:h-10 sm:w-auto" disabled={occupe}
                  onClick={() => { const r = onRetirer(actif); if (r) setRefus(r); else setActif(null); }}
                >
                  Retirer du plan
                </Button>
              </div>
            )}
            {!actifDeplacable && modifiable && verrouillees.has(actif) && (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Rapportée ou passée : elle reste au plan.</p>
            )}
            {refus && <p role="alert" className="text-sm text-destructive">{refus}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** UNE CELLULE — un professionnel de santé un jour donné. La toucher ouvre ce qu'on peut en faire. */
function Cellule({
  cle, jour, aujourdhui, info, ligne, verrou, planValide, jeSuisLeKam, modifiable, occupe, onOuvrir, avecPv,
}: {
  /** La feuille offre le signalement de pharmacovigilance (KAM qui peut signaler). */
  avecPv: boolean;
  cle: string;
  jour: string;
  aujourdhui: string;
  info: InfoPraticien;
  ligne: LigneDuPlan | null;
  verrou: boolean;
  planValide: boolean;
  jeSuisLeKam: boolean;
  modifiable: boolean;
  occupe: boolean;
  onOuvrir: () => void;
}) {
  const etat: EtatCellule = etatCellule({ etatEnregistre: ligne?.etat ?? null, planValide, jour, aujourdhui });
  const geste = ligne ? gesteCellule({ etat, heuresRestantes: ligne.heuresRestantes, planValide, jeSuisLeKam }) : "AUCUN";
  const deplacable = modifiable && !verrou;
  // L'ÉTAT N'EST ÉCRIT QUE QUAND IL DIT QUELQUE CHOSE : « prévue » ou « à venir » dans chaque case serait du bruit.
  const montrerEtat = etat !== "PREVUE" && etat !== "A_VENIR";
  // UN RAPPORT FAIT S'OUVRE TOUJOURS (« Voir le rapport »), même hors de la fenêtre de correction ; une visite passée
  // s'ouvre aussi pour la pharmacovigilance du KAM.
  const ouvrable = geste !== "AUCUN" || deplacable || (modifiable && verrou)
    || (ligne !== null && (etat === "FAITE" || (avecPv && montrerEtat && etat !== "NON_ENREGISTREE")));
  const segment = repereDe(info);
  const nonTenue = etat === "ANNULEE" || etat === "REPORTEE";
  const ton = tonEtatCellule(etat);

  const contenu = (
    <>
      <span className="flex min-w-0 items-start gap-2">
        <span className={cn("block min-w-0 flex-1 truncate font-medium", nonTenue && "text-muted-foreground line-through")}>{info.name}</span>
        {montrerEtat && <span className={cn("shrink-0 text-[0.6875rem] font-medium", TEXTE_ETAT[ton])}>{etat === "FAITE" ? "✓ Visité" : ETAT_CELLULE_LABELS[etat]}</span>}
      </span>
      <span className="block truncate text-xs text-muted-foreground">{[info.specialty, info.institution].filter(Boolean).join(" · ") || "—"}</span>
    </>
  );
  const classe = cn(
    "block h-full min-h-16 w-full border-l-[3px] px-2.5 py-2 text-left",
    segment ? LISERE[segment.tone] ?? LISERE.neutral : "border-l-transparent",
    etat === "FAITE" && "bg-success/5",
    (etat === "PERDUE" || etat === "NON_ENREGISTREE") && "bg-warning/5",
  );

  return ouvrable ? (
    <button
      type="button" onClick={onOuvrir} disabled={occupe}
      draggable={deplacable}
      onDragStart={deplacable ? (e) => { e.dataTransfer.setData("text/plain", cle); e.dataTransfer.effectAllowed = "move"; } : undefined}
      aria-label={`${info.name}, ${jourLisible(jour, { weekday: "long", day: "numeric", month: "long" })}${segment ? ` — ${segment.libelle}` : ""}`}
      className={cn(classe, "hover:bg-secondary/60 focus-ring", deplacable && "cursor-grab active:cursor-grabbing")}
    >
      {contenu}
    </button>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

/** LE RAPPORT D'UNE VISITE, EN LECTURE — ce que la ligne enregistrée porte déjà (`loadVisitesDuPlan`), rien de relu. */
function RapportLu({ ligne }: { ligne: LigneDuPlan }) {
  const bloc = (titre: string, contenu: string) => (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titre}</p>
      <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{contenu}</p>
    </div>
  );
  return (
    <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3">
      {bloc("Produits", ligne.produits.join(" · ") || "—")}
      {bloc("Messages", ligne.messages.join(" · ") || "—")}
      {bloc("Compte rendu", ligne.rapport || "—")}
      {ligne.suite && bloc("Ce qu'il reste à faire", ligne.suite)}
    </div>
  );
}
