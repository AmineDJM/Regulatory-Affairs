import * as React from "react";
import { cn } from "@/lib/utils";
import { bilanDesNotes, type GrilleCoaching, type Points } from "@/lib/coaching/grille";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FICHE DE COACHING À L'ÉCRAN (§118.157) — la grille telle que la Direction l'a dessinée :
 * l'axe à gauche, ses quatre critères au milieu (un par niveau, MB → PM), le niveau retenu
 * surligné, le total de l'axe à droite.
 *
 * UN SEUL rendu pour les trois usages — la saisie (avec `onChoisir`), la consultation et
 * l'impression (sans) : trois dessins de la même grille finiraient par ne plus montrer la même
 * chose, et c'est la version imprimée qu'on relit avec le collaborateur.
 *
 * Aucune directive « use client » : sans `onChoisir`, ce composant se rend côté serveur ; avec,
 * il vit dans le formulaire (client) qui l'importe. Il n'importe que le module PUR de la grille.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les couleurs d'un niveau, dans l'ordre du barème — des classes LITTÉRALES, que Tailwind voit. */
const TONS: Record<number, { puce: string; ligne: string; total: string }> = {
  1: { puce: "border-destructive/30 bg-destructive/10 text-destructive", ligne: "bg-destructive/5 ring-1 ring-inset ring-destructive/40", total: "bg-destructive text-destructive-foreground" },
  2: { puce: "border-warning/30 bg-warning/10 text-warning", ligne: "bg-warning/5 ring-1 ring-inset ring-warning/40", total: "bg-warning text-warning-foreground" },
  3: { puce: "border-success/30 bg-success/10 text-success", ligne: "bg-success/5 ring-1 ring-inset ring-success/40", total: "bg-success text-success-foreground" },
  4: { puce: "border-primary/30 bg-primary/10 text-primary", ligne: "bg-primary/5 ring-1 ring-inset ring-primary/40", total: "bg-primary text-primary-foreground" },
};

export function tonsDuNiveau(points: number) {
  return TONS[points] ?? TONS[1]!;
}

/** L'échelle d'évaluation — les quatre niveaux et leurs points. */
export function EchelleNiveaux({ grille, className }: { grille: GrilleCoaching; className?: string }) {
  return (
    <section className={cn("space-y-2", className)} aria-label="Échelle d'évaluation">
      <h2 className="text-sm font-semibold text-foreground">Échelle d&apos;évaluation (niveaux de maîtrise)</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {grille.niveaux.map((n, i) => (
          <li key={n.code} className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <span className={cn("inline-flex h-6 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-bold", tonsDuNiveau(i + 1).puce)}>
              {n.code}
            </span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{n.libelle}</span>
              {n.qualification && <span className="block text-xs italic text-muted-foreground">{n.qualification}</span>}
            </span>
            <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * LA GRILLE. `onChoisir` présent : chaque critère est un bouton radio (clavier et lecteur
 * d'écran compris), et cliquer à nouveau le niveau retenu le retire — une note posée par
 * erreur doit pouvoir s'enlever sans recharger la fiche.
 */
export function GrilleEvaluation({
  grille, notes, onChoisir, nomGroupe = "axe",
}: {
  grille: GrilleCoaching;
  notes: Record<string, Points>;
  onChoisir?: (cle: string, points: Points | null) => void;
  nomGroupe?: string;
}) {
  return (
    <section className="space-y-3" aria-label="Grille d'évaluation des compétences">
      <div className="hidden grid-cols-1 gap-0 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[15rem_1fr_7rem]">
        <span>Axe d&apos;évaluation</span>
        <span className="flex justify-between pl-3 pr-3"><span>Critères d&apos;observation</span><span>Niveau</span></span>
        <span className="text-center">Total des points</span>
      </div>
      {grille.axes.map((axe) => {
        const retenu = notes[axe.cle] ?? null;
        return (
          <div
            key={axe.cle}
            role={onChoisir ? "radiogroup" : "group"}
            aria-labelledby={`${nomGroupe}-${axe.cle}-titre`}
            className="overflow-hidden rounded-xl border border-border bg-card print:break-inside-avoid"
          >
            <div className="grid grid-cols-1 md:grid-cols-[15rem_1fr_7rem]">
              <span
                id={`${nomGroupe}-${axe.cle}-titre`}
                className="flex items-center border-b border-border bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground md:border-b-0 md:border-r"
              >
                {axe.titre}
              </span>
              <div className="divide-y divide-border">
                {axe.criteres.map((critere, k) => {
                  const points = (k + 1) as Points;
                  const niveau = grille.niveaux[k]!;
                  const choisi = retenu === points;
                  const contenu = (
                    <>
                      <span className={cn("mt-0.5 inline-flex h-6 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-bold", tonsDuNiveau(points).puce)}>
                        {niveau.code}
                      </span>
                      <span className={cn("min-w-0 flex-1 text-sm leading-snug", choisi ? "font-medium text-foreground" : "text-foreground/85")}>{critere}</span>
                      <span className={cn("shrink-0 pt-0.5 text-sm tabular-nums", choisi ? "font-bold text-foreground" : "text-muted-foreground")}>{points}</span>
                    </>
                  );
                  const classes = cn("flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors", choisi && tonsDuNiveau(points).ligne);
                  if (!onChoisir) {
                    return (
                      <div key={k} className={classes} aria-current={choisi ? "true" : undefined}>
                        {contenu}
                        {choisi && <span className="sr-only">(niveau retenu)</span>}
                      </div>
                    );
                  }
                  return (
                    <label
                      key={k}
                      className={cn(classes, "cursor-pointer hover:bg-muted/40 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-primary")}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`${nomGroupe}-${axe.cle}`}
                        value={points}
                        checked={choisi}
                        onChange={() => onChoisir(axe.cle, points)}
                        onClick={() => { if (choisi) onChoisir(axe.cle, null); }}
                        aria-label={`${axe.titre} — ${niveau.code} (${points}) : ${critere}`}
                      />
                      {contenu}
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5 md:flex-col md:justify-center md:border-l md:border-t-0">
                <span className="text-xs text-muted-foreground md:hidden">Total de l&apos;axe</span>
                {retenu ? (
                  <span className={cn("inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg px-2 text-base font-bold tabular-nums", tonsDuNiveau(retenu).total)}>
                    {retenu}
                  </span>
                ) : (
                  <span className="inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-lg border border-dashed border-border px-2 text-sm text-muted-foreground" title="Axe non noté">
                    —
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">sur 4</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** LE TOTAL GÉNÉRAL — « 13 / 20 », sa jauge, et les axes qui manquent encore. */
export function TotalFiche({ grille, notes, className }: { grille: GrilleCoaching; notes: Record<string, Points>; className?: string }) {
  const b = bilanDesNotes(grille, notes);
  const pct = b.max ? Math.round((b.total / b.max) * 100) : 0;
  const moyenne = b.notes.length ? b.total / b.notes.length : 0;
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total des points</p>
          <p className="text-3xl font-bold tabular-nums text-foreground">
            {b.total}<span className="text-lg font-semibold text-muted-foreground"> / {b.max}</span>
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{b.notes.length} / {grille.axes.length} axe(s) évalué(s)</p>
          {b.notes.length > 0 && <p>Niveau moyen : {moyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 4</p>}
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={b.max} aria-valuenow={b.total} aria-label="Total des points">
        <div className={cn("h-full rounded-full transition-all", pct >= 75 ? "bg-success" : pct >= 50 ? "bg-primary" : pct >= 35 ? "bg-warning" : "bg-destructive")} style={{ width: `${pct}%` }} />
      </div>
      {!b.complet && (
        <p className="mt-2 text-xs text-muted-foreground">
          Reste à noter : {b.manquants.map((a) => a.titre).join(" · ")}
        </p>
      )}
    </div>
  );
}

/** LE BILAN, en lecture. */
export function BilanLecture({ grille, strengths, improvements }: { grille: GrilleCoaching; strengths: string | null; improvements: string | null }) {
  return (
    <section className="space-y-3" aria-label={grille.bilan.titre}>
      <h2 className="text-sm font-semibold text-foreground">{grille.bilan.titre}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {([[grille.bilan.pointsForts, strengths], [grille.bilan.pointsAAmeliorer, improvements]] as const).map(([titre, texte]) => (
          <div key={titre} className="rounded-xl border border-border bg-card p-4 print:break-inside-avoid">
            <p className="text-sm font-semibold text-foreground">{titre}</p>
            {texte ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{texte}</p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">Non renseigné.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
