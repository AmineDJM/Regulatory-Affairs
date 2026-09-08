import { Check, CircleDashed, Loader2, Pause, X } from "lucide-react";
import type { VueMission } from "@/lib/missions/view/workspace";
import { depuis } from "@/lib/missions/view/duree";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'HORIZON D'UNE MISSION LONGUE (§118.40) — et pourquoi il ne ressemble pas à une liste
 * d'étapes.
 *
 * ── CE QU'UN JALON EST, ET CE QU'IL N'EST PAS ───────────────────────────────────────────
 *
 * Un jalon est une INTENTION : un titre, et un RÉSULTAT qu'on doit pouvoir constater. Il ne
 * devient des étapes qu'au moment où la frontière l'atteint — c'est-à-dire quand ce qui le
 * précède a réellement produit ses résultats. « 0 étape » sur le jalon 7 n'est donc pas un
 * défaut d'affichage : c'est l'état NORMAL d'un jalon qui n'existe encore que comme intention,
 * et le dire est ce qui empêche de le lire comme un travail oublié.
 *
 * ── C'EST LE RÉSULTAT QU'ON MONTRE, PAS LE TITRE ────────────────────────────────────────
 *
 * Le contrôle de fin compare le RÉSULTAT au réel (§118.10) — jamais le titre. Montrer le titre
 * seul donnerait à lire autre chose que ce qui sera jugé, et une personne qui approuve un
 * périmètre doit lire exactement ce sur quoi le jugement portera.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ICONE = {
  fait: Check,
  "en-cours": Loader2,
  "a-faire": CircleDashed,
  echec: X,
} as const;

const COULEUR = {
  fait: "text-emerald-600",
  "en-cours": "animate-spin text-slate-500",
  "a-faire": "text-slate-300",
  echec: "text-rose-600",
} as const;

export function MissionHorizon({ horizon }: { horizon: NonNullable<VueMission["horizon"]> }) {
  const pourcent = Math.round(horizon.part * 100);

  return (
    <section className="mt-4 border-t border-slate-100 pt-3" data-testid="mission-horizon">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-800">
          Horizon — {horizon.franchis}/{horizon.total} jalons
        </h3>
        <p className="text-xs text-slate-500">
          {pourcent} % de l&apos;objectif
          {horizon.ecartes > 0 ? ` · ${horizon.ecartes} écarté(s) comme sans objet` : ""}
          {horizon.bloques > 0 ? ` · ${horizon.bloques} jalon(s) en échec` : ""}
        </p>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className={`h-full rounded-full ${horizon.bloques > 0 ? "bg-rose-500" : "bg-slate-900"}`}
          style={{ width: `${Math.max(0, Math.min(100, pourcent))}%` }}
        />
      </div>

      <ol className="mt-3 space-y-2">
        {horizon.jalons.map((j) => {
          const Icone = ICONE[j.etat];
          return (
            <li key={j.ordre} className="flex items-start gap-2 text-sm" data-testid="mission-jalon">
              <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${COULEUR[j.etat]}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-slate-800">
                  <span className="text-slate-400">{j.ordre}.</span> {j.titre}
                </p>
                {/* LE RÉSULTAT ATTENDU, TOUJOURS VISIBLE. C'est lui que le contrôle de fin
                    jugera ; le cacher derrière un dépliant reviendrait à faire approuver un
                    périmètre qu'on ne lit pas. */}
                <p className="text-xs text-slate-500">{j.resultat}</p>
                <p className="text-xs text-slate-400">
                  {j.compile
                    ? `${j.etapes} étape(s) écrites`
                    : "pas encore de sous-plan — ce jalon n'existe que comme intention"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * LA PAUSE — depuis quand, pourquoi, et ce qu'elle a interrompu.
 *
 * `pausedFrom` n'est pas de la décoration : une mission suspendue en pleine attente et une
 * mission suspendue en plein travail ne se reprennent pas de la même façon, et sans cette
 * information la reprise ne pourrait que deviner d'où repartir (§118.45).
 */
export function MissionPause(
  { pause, maintenant }: { pause: NonNullable<VueMission["pause"]>; maintenant: Date },
) {
  const attendait = pause.interrompue?.startsWith("WAITING") ?? false;
  return (
    <div className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3" data-testid="mission-pause">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        <Pause className="h-4 w-4" aria-hidden /> Suspendue {depuis(pause.depuis, maintenant)}
      </p>
      {pause.motif ? <p className="mt-1 text-sm text-slate-600">{pause.motif}</p> : null}
      <p className="mt-1 text-xs text-slate-500">
        {attendait
          ? "Elle attendait quand vous l'avez suspendue — la reprise la remettra en attente, sans rien perdre."
          : "Elle travaillait quand vous l'avez suspendue — la reprise repartira de l'étape suivante."}
        {" "}Tant qu&apos;elle est suspendue, elle ne consomme rien.
      </p>
    </div>
  );
}
