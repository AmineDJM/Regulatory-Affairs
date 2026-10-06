"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock, GripVertical, Lock, MapPin, MoreVertical, Plus } from "lucide-react";
import {
  ETAT_CELLULE_LABELS, etatCellule, gesteCellule, lireCellule, praticiensParJour, semaineInitiale, semainesDuPlan,
  tonEtatCellule, type EtatCellule,
} from "@/lib/sfe/grille-tournee";
import { SEGMENT_LEVEL } from "@/lib/labels";
import type { LigneVue } from "../ma-journee/emploi-du-temps";
import { Badge } from "@/components/ui/badge";
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
  /** Le niveau de potentiel de la fiche (`SegmentLevel`), quand il est connu. */
  potential: string | null;
  secteur: string | null;
}

/** Une visite enregistrée du plan, avec la clé de sa cellule (`AAAA-MM-JJ|doctorId`). */
export type LigneDuPlan = LigneVue & { cle: string };

export const jourLisible = (j: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" }) =>
  new Date(`${j}T09:00:00`).toLocaleDateString("fr-FR", opts);

/**
 * LA GRILLE DU PLAN DE TOURNÉE — l'emploi du temps : les JOURS en colonnes, les PROFESSIONNELS DE SANTÉ dans les
 * cellules (Direction, 06/10).
 *
 * ── UNE SEMAINE À LA FOIS ───────────────────────────────────────────────────────────────────
 *
 * Un plan mensuel compte vingt-deux jours ouvrés : vingt-deux colonnes ne tiennent sur aucun écran. La grille montre
 * une SEMAINE (dimanche → jeudi) et se feuillette. Sur téléphone — c'est là que le KAM la lit — elle montre UN jour,
 * choisi dans une rangée d'onglets qui défile ; sur ordinateur, la semaine entière.
 *
 * ── CE QUE LA GRILLE NE DÉCIDE PAS ──────────────────────────────────────────────────────────
 *
 * Ni qui peut la modifier (`grilleModifiable`), ni l'état d'une visite (`etatVisite` via `etatCellule`), ni ce qu'un
 * clic ouvre (`gesteCellule`) : le module pur le dit, et l'action serveur le revérifie. La grille affiche, et remonte
 * les gestes à l'écran qui la porte.
 */
export function GrilleTournee({
  joursOuvres, paires, aujourdhui, infoDe, lignesParCle, verrouillees, planValide, jeSuisLeKam, modifiable, occupe,
  onAjouter, onDeplacer, onRetirer, onRapporter, onNonTenue,
}: {
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
}) {
  const semaines = React.useMemo(() => semainesDuPlan(joursOuvres), [joursOuvres]);
  const [semaine, setSemaine] = React.useState(() => semaineInitiale(semaines, aujourdhui));
  const jours = semaines[semaine]?.jours ?? [];
  const [jourMobile, setJourMobile] = React.useState<string>(() => (jours.includes(aujourdhui) ? aujourdhui : jours[0] ?? ""));
  const [menu, setMenu] = React.useState<string | null>(null);
  const [versJour, setVersJour] = React.useState("");
  const [refus, setRefus] = React.useState<string | null>(null);
  const [survol, setSurvol] = React.useState<string | null>(null);

  const parJour = React.useMemo(() => praticiensParJour(paires, joursOuvres, infoDe), [paires, joursOuvres, infoDe]);
  const compte = (j: string) => parJour.get(j)?.length ?? 0;

  const changerSemaine = (i: number) => {
    const s = semaines[i];
    if (!s) return;
    setSemaine(i);
    setJourMobile(s.jours.includes(aujourdhui) ? aujourdhui : s.jours[0] ?? "");
  };

  const ouvrirMenu = (cle: string) => { setRefus(null); setVersJour(""); setMenu(cle); };
  const menuCellule = menu ? lireCellule(menu) : null;
  const menuInfo = menuCellule ? infoDe(menuCellule.doctorId) : null;

  const totalSemaine = jours.reduce((n, j) => n + compte(j), 0);

  // ── TÉLÉPHONE : glisser d'un jour à l'autre, et garder l'onglet du jour en vue ───────────
  const ongletsRef = React.useRef<HTMLDivElement>(null);
  const depart = React.useRef<{ x: number; y: number } | null>(null);
  const glisserJour = (sens: 1 | -1) => {
    const suivant = jours[jours.indexOf(jourMobile) + sens];
    if (suivant) setJourMobile(suivant);
  };
  React.useEffect(() => {
    // Défilement HORIZONTAL de la rangée seulement : `scrollIntoView` ferait aussi remonter la page.
    const rangee = ongletsRef.current;
    const actif = rangee?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (rangee && actif) rangee.scrollTo({ left: actif.offsetLeft - (rangee.clientWidth - actif.offsetWidth) / 2, behavior: "smooth" });
  }, [jourMobile]);

  // ── UNE COLONNE : son en-tête (jour, compte, « + ») et ses cellules ──────────────────────
  const colonne = (j: string) => {
    const ids = parJour.get(j) ?? [];
    const estAujourdhui = j === aujourdhui;
    return (
      <section
        key={j}
        aria-label={`${jourLisible(j, { weekday: "long", day: "numeric", month: "long" })} — ${ids.length} praticien(s)`}
        className={cn(
          "flex min-w-0 flex-col rounded-xl border bg-card",
          estAujourdhui ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
          survol === j && "bg-primary/5",
        )}
        onDragOver={modifiable ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setSurvol(j); } : undefined}
        onDragLeave={modifiable ? () => setSurvol((s) => (s === j ? null : s)) : undefined}
        onDrop={modifiable ? (e) => {
          e.preventDefault();
          setSurvol(null);
          const cle = e.dataTransfer.getData("text/plain");
          if (cle) onDeplacer(cle, j);
        } : undefined}
      >
        <header className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", estAujourdhui ? "text-primary" : "text-muted-foreground")}>
              {jourLisible(j, { weekday: "long" })}
            </p>
            <p className="text-sm font-medium tabular-nums">{jourLisible(j, { day: "2-digit", month: "2-digit" })}{estAujourdhui && <span className="ml-1 text-xs font-normal text-primary">· aujourd&apos;hui</span>}</p>
          </div>
          <Badge tone={ids.length > 0 ? "info" : "neutral"} className="tabular-nums">{ids.length}</Badge>
          {modifiable && (
            <Button
              type="button" size="sm" variant="outline" className="h-10 w-10 px-0 md:h-8 md:w-8" disabled={occupe}
              onClick={() => onAjouter(j)}
              aria-label={`Ajouter des praticiens le ${jourLisible(j, { weekday: "long", day: "numeric", month: "long" })}`}
              title="Ajouter des praticiens ce jour"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </header>
        {ids.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-6 text-center text-xs text-muted-foreground">
            <span>Aucun praticien prévu.</span>
            {modifiable && (
              <button type="button" onClick={() => onAjouter(j)} disabled={occupe} className="mt-1 inline-flex min-h-11 items-center rounded-lg border border-primary/40 px-4 text-sm font-medium text-primary focus-ring hover:underline md:mt-0 md:min-h-0 md:border-0 md:px-0 md:text-xs md:font-normal">
                Ajouter des praticiens
              </button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2 p-2 md:gap-1.5 md:p-1.5">
            {ids.map((id) => {
              const cle = `${j}|${id}`;
              return (
                <Cellule
                  key={cle} cle={cle} jour={j} info={infoDe(id)} ligne={lignesParCle.get(cle) ?? null}
                  verrou={verrouillees.has(cle)} aujourdhui={aujourdhui} planValide={planValide} jeSuisLeKam={jeSuisLeKam} modifiable={modifiable} occupe={occupe}
                  onMenu={() => ouvrirMenu(cle)} onRapporter={onRapporter} onNonTenue={onNonTenue}
                />
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  if (joursOuvres.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aucun jour ouvré dans la période de ce plan.</p>;
  }

  return (
    <div className="space-y-2">
      {/* ── LA SEMAINE, ET LA NAVIGATION ENTRE SEMAINES ─────────────────────── */}
      <div className="flex items-center gap-2">
        {semaines.length > 1 && (
          <Button type="button" size="sm" variant="ghost" className="h-10 w-10 shrink-0 px-0 md:h-8 md:w-8" disabled={semaine === 0} onClick={() => changerSemaine(semaine - 1)} aria-label="Semaine précédente">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          <span className="font-medium">Semaine du {jours[0] ? jourLisible(jours[0], { day: "numeric", month: "long" }) : "—"}</span>
          <span className="text-muted-foreground">
            {semaines.length > 1 && ` · ${semaine + 1}/${semaines.length}`} · {totalSemaine} visite(s)
          </span>
        </p>
        {semaines.length > 1 && (
          <Button type="button" size="sm" variant="ghost" className="h-10 w-10 shrink-0 px-0 md:h-8 md:w-8" disabled={semaine >= semaines.length - 1} onClick={() => changerSemaine(semaine + 1)} aria-label="Semaine suivante">
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── TÉLÉPHONE : un jour par écran, les jours en onglets qui défilent ──── */}
      {/* Le jour affiché se change d'un onglet, ou d'un glissement du pouce sur la liste. */}
      <div className="space-y-2 md:hidden">
        <div ref={ongletsRef} role="group" aria-label="Jours de la semaine" className="no-scrollbar relative -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {jours.map((j) => (
            <button
              key={j} type="button" aria-pressed={j === jourMobile} onClick={() => setJourMobile(j)}
              className={cn(
                "flex min-w-[3.75rem] shrink-0 snap-start flex-col items-center rounded-lg px-3 py-2 text-xs tabular-nums focus-ring",
                j === jourMobile ? "bg-primary text-primary-foreground" : "border border-input bg-card",
                j === aujourdhui && j !== jourMobile && "border-primary/60 text-primary",
              )}
            >
              <span className="font-medium capitalize">{jourLisible(j, { weekday: "short" })}</span>
              <span>{jourLisible(j, { day: "2-digit", month: "2-digit" })}</span>
              <span className={cn("mt-0.5 rounded px-1", j === jourMobile ? "bg-primary-foreground/20" : "bg-secondary")}>{compte(j)}</span>
            </button>
          ))}
        </div>
        <div
          onTouchStart={(e) => { const t = e.touches[0]; depart.current = t ? { x: t.clientX, y: t.clientY } : null; }}
          onTouchEnd={(e) => {
            const d = depart.current;
            depart.current = null;
            const t = e.changedTouches[0];
            if (!d || !t) return;
            const dx = t.clientX - d.x;
            // Un geste franchement horizontal seulement : le défilement vertical de la liste ne change jamais de jour.
            if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(t.clientY - d.y)) glisserJour(dx < 0 ? 1 : -1);
          }}
        >
          {jourMobile && colonne(jourMobile)}
        </div>
      </div>

      {/* ── ORDINATEUR : la semaine entière, une colonne par jour ─────────────── */}
      <div className="hidden gap-2 md:grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, jours.length)}, minmax(0, 1fr))` }}>
        {jours.map((j) => colonne(j))}
      </div>

      {modifiable && (
        <p className="text-xs text-muted-foreground">
          « + » ajoute des praticiens au jour ; <GripVertical className="inline h-3 w-3" aria-hidden /> glissez une carte vers un autre jour,
          ou ouvrez son menu <MoreVertical className="inline h-3 w-3" aria-hidden /> pour la déplacer ou la retirer.
        </p>
      )}
      {planValide && jeSuisLeKam && (
        <p className="text-xs text-muted-foreground">Touchez un praticien « à faire » pour rédiger le rapport de sa visite.</p>
      )}

      {/* ── DÉPLACER / RETIRER — le menu d'une carte, utilisable au doigt comme au clavier ── */}
      <Sheet
        open={menu !== null}
        onClose={() => setMenu(null)}
        title={menuInfo?.name ?? "Praticien"}
        description={menuCellule ? `Prévu le ${jourLisible(menuCellule.jour, { weekday: "long", day: "numeric", month: "long" })}.` : ""}
        width="md"
      >
        {menu && menuCellule && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="grille-deplacer">Déplacer au</Label>
              <div className="flex flex-wrap gap-2">
                <Select id="grille-deplacer" className="min-w-0 flex-1" value={versJour} onChange={(e) => setVersJour(e.target.value)}>
                  <option value="">— Choisir un jour —</option>
                  {joursOuvres.filter((j) => j !== menuCellule.jour).map((j) => {
                    const dejaLa = paires.has(`${j}|${menuCellule.doctorId}`);
                    return <option key={j} value={j} disabled={dejaLa}>{jourLisible(j, { weekday: "long", day: "2-digit", month: "2-digit" })}{dejaLa ? " — déjà prévu" : ""}</option>;
                  })}
                </Select>
                <Button
                  type="button" className="h-11 w-full sm:h-10 sm:w-auto" disabled={!versJour || occupe}
                  onClick={() => { const r = onDeplacer(menu, versJour); if (r) setRefus(r); else setMenu(null); }}
                >
                  Déplacer
                </Button>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <Button
                type="button" variant="outline" className="h-11 w-full text-destructive sm:h-10 sm:w-auto" disabled={occupe}
                onClick={() => { const r = onRetirer(menu); if (r) setRefus(r); else setMenu(null); }}
              >
                Retirer du plan
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">Rien n&apos;est perdu tant que vous n&apos;avez pas enregistré le plan.</p>
            </div>
            {refus && <p role="alert" className="text-sm text-destructive">{refus}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** UNE CELLULE — un professionnel de santé un jour donné, et ce qu'on peut en faire. */
function Cellule({
  cle, jour, aujourdhui, info, ligne, verrou, planValide, jeSuisLeKam, modifiable, occupe, onMenu, onRapporter, onNonTenue,
}: {
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
  onMenu: () => void;
  onRapporter: (ligne: LigneDuPlan) => void;
  onNonTenue: (ligne: LigneDuPlan) => void;
}) {
  const etat: EtatCellule = etatCellule({ etatEnregistre: ligne?.etat ?? null, planValide, jour, aujourdhui });
  const geste = ligne ? gesteCellule({ etat, heuresRestantes: ligne.heuresRestantes, planValide, jeSuisLeKam }) : "AUCUN";
  const deplacable = modifiable && !verrou;
  const segment = info.potential ? SEGMENT_LEVEL[info.potential] : undefined;
  // L'ÉTAT N'EST MONTRÉ QUE QUAND IL DIT QUELQUE CHOSE : « prévue » ou « à venir » sur chaque carte serait du bruit.
  const montrerEtat = etat !== "PREVUE" && etat !== "A_VENIR";

  const contenu = (
    <>
      <span className="block truncate font-medium">{info.name}</span>
      <span className="block truncate text-xs text-muted-foreground">{[info.specialty, info.institution].filter(Boolean).join(" · ") || "—"}</span>
      {(info.wilaya || segment) && (
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {info.wilaya && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden />{info.wilaya}</span>
          )}
          {segment && <Badge tone={segment.tone} className="px-1.5 py-0 text-[0.6875rem]" title="Potentiel de prescription">{segment.label}</Badge>}
        </span>
      )}
    </>
  );

  return (
    <li
      draggable={deplacable}
      onDragStart={deplacable ? (e) => { e.dataTransfer.setData("text/plain", cle); e.dataTransfer.effectAllowed = "move"; } : undefined}
      className={cn(
        "rounded-lg border bg-background p-3 text-sm shadow-sm transition-colors md:p-2",
        deplacable && "cursor-grab active:cursor-grabbing",
        etat === "FAITE" && "border-success/40 bg-success/5",
        etat === "PERDUE" && "border-warning/40 bg-warning/5",
        etat === "NON_ENREGISTREE" && "border-dashed border-warning/60",
        (etat === "ANNULEE" || etat === "REPORTEE") && "opacity-75",
        !["FAITE", "PERDUE", "NON_ENREGISTREE"].includes(etat) && "border-border",
        geste !== "AUCUN" && "hover:border-primary/60",
      )}
    >
      <div className="flex items-start gap-1">
        {geste !== "AUCUN" && ligne ? (
          <button
            type="button" disabled={occupe} onClick={() => onRapporter(ligne)}
            className="min-w-0 flex-1 rounded text-left focus-ring"
            aria-label={`${geste === "RAPPORTER" ? "Rédiger le rapport de" : "Corriger le rapport de"} la visite chez ${info.name}, ${jourLisible(jour, { weekday: "long", day: "numeric", month: "long" })}`}
          >
            {contenu}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{contenu}</div>
        )}
        {deplacable ? (
          <button
            type="button" onClick={onMenu} disabled={occupe}
            className="-mr-1.5 -mt-1.5 shrink-0 rounded-lg p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-ring md:-mr-1 md:mt-0 md:rounded md:p-1"
            aria-label={`Déplacer ou retirer ${info.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ) : verrou && modifiable ? (
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Verrouillée : rapportée, ou passée d'un plan validé — elle reste au plan" />
        ) : null}
      </div>
      {montrerEtat && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <Badge tone={tonEtatCellule(etat)} className="px-1.5 py-0 text-[0.6875rem]">{ETAT_CELLULE_LABELS[etat]}</Badge>
          {etat === "A_FAIRE" && ligne && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" aria-hidden />{ligne.heuresRestantes} h</span>
          )}
          {geste === "CORRIGER" && <span className="text-[11px] text-muted-foreground">corrigeable {ligne?.heuresRestantes} h</span>}
        </div>
      )}
      {geste === "RAPPORTER" && ligne && (
        // DIRE QU'ELLE N'A PAS EU LIEU (§118.193) — dans la même fenêtre que le rapport, la même feuille que « Ma journée ».
        <button type="button" disabled={occupe} onClick={() => onNonTenue(ligne)} className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-input px-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-ring md:mt-1 md:min-h-0 md:rounded md:border-0 md:px-0 md:text-[11px]">
          N&apos;a pas eu lieu
        </button>
      )}
    </li>
  );
}
