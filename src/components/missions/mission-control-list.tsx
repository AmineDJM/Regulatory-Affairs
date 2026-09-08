import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, Flag, Pause } from "lucide-react";
import type { LigneMission } from "@/lib/missions/view/control";
import { depuis } from "@/lib/missions/view/duree";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARC DE MISSIONS — une ligne par mission, et la seule chose qui compte en premier.
 *
 * ── CE QUE CHAQUE LIGNE DOIT RÉPONDRE, ET DANS CET ORDRE ────────────────────────────────
 *
 *   1. Est-ce que ça m'attend, MOI ?          → le bandeau ambre, en tête de liste
 *   2. Est-ce que c'est bloqué ?              → le bandeau rouge
 *   3. Où ça en est vraiment ?                → les JALONS quand il y en a, sinon les étapes
 *   4. Depuis quand rien n'a bougé ?          → la durée, jamais l'horodatage
 *
 * ── POURQUOI LA JAUGE CHANGE DE DÉNOMINATEUR ────────────────────────────────────────────
 *
 * Sur une mission longue, « 4/5 étapes » sont les étapes du JALON COURANT — les jalons suivants
 * n'ont pas encore d'étapes, par construction (§118.40). Afficher ce ratio ferait lire
 * « presque fini » sur une mission qui a six semaines devant elle. Quand la mission a un
 * horizon, c'est LUI qui donne l'avancement, et les étapes deviennent le détail du jalon en
 * cours — dit explicitement, pour qu'on ne compare pas deux chiffres qui ne parlent pas de la
 * même chose.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function Jauge({ part, ton }: { part: number; ton: "normal" | "alerte" }) {
  const pourcent = Math.max(0, Math.min(100, Math.round(part * 100)));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div
        className={`h-full rounded-full ${ton === "alerte" ? "bg-rose-500" : "bg-slate-900"}`}
        style={{ width: `${pourcent}%` }}
      />
    </div>
  );
}

export function MissionControlRow({ m, maintenant }: { m: LigneMission; maintenant: Date }) {
  const part = m.jalons
    ? m.jalons.part
    : m.etapes.total > 0 ? m.etapes.faites / m.etapes.total : 0;

  return (
    <li
      className="surface flex flex-col gap-2 p-4"
      data-testid="mission-control-row"
      data-statut={m.statut}
      data-attend={m.attend ?? ""}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/missions/${m.id}`} className="group inline-flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground group-hover:underline">{m.titre}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {m.etat}
            {/* LA PRIORITÉ NE S'AFFICHE QUE SI ELLE A ÉTÉ POSÉE. « priorité 0 » sur trente
                lignes est du bruit ; « priorité 3 » sur une seule est une information. */}
            {m.priorite !== 0 ? (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700">
                <Flag className="h-3 w-3" aria-hidden /> priorité {m.priorite}
              </span>
            ) : null}
            <span className="ml-2">· {depuis(m.majLe, maintenant)}</span>
          </p>
        </div>

        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {m.jalons ? (
            <span data-testid="mission-control-jalons">
              {m.jalons.franchis}/{m.jalons.total} jalons
            </span>
          ) : (
            <span data-testid="mission-control-etapes">
              {m.etapes.faites}/{m.etapes.total} étapes
            </span>
          )}
          {m.livrables.total > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" aria-hidden />
              {m.livrables.verifies}/{m.livrables.total}
            </span>
          ) : null}
        </div>
      </div>

      <Jauge part={part} ton={m.bloquee ? "alerte" : "normal"} />

      {/* CE QUI ATTEND LA PERSONNE PASSE AVANT LE RESTE — c'est la seule ligne qui appelle un
          geste, et la mettre en bas la ferait manquer sur un écran de téléphone. */}
      {m.attend ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-800" data-testid="mission-control-attente">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {m.attend === "ACCORD" ? "Attend votre accord" : "Attend un élément de votre part"}
          {m.attendQuoi ? <span className="truncate">— « {m.attendQuoi} »</span> : null}
          {m.attendDepuis ? <span className="shrink-0 text-amber-700">({depuis(m.attendDepuis, maintenant)})</span> : null}
        </p>
      ) : null}

      {m.statut === "PAUSED" ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden /> Suspendue — elle ne consomme rien tant qu'elle l'est.
        </p>
      ) : null}

      {m.bloquee && m.attend === null ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-700" data-testid="mission-control-bloquee">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Plus rien n&apos;avance tout seul
          {m.jalons && m.jalons.bloques > 0 ? ` — ${m.jalons.bloques} jalon(s) en échec` : ""}
          {m.etapes.echouees > 0 ? ` — ${m.etapes.echouees} étape(s) en échec` : ""}
        </p>
      ) : null}
    </li>
  );
}

/** La liste, avec l'état vide qui DIT ce qu'il faut faire plutôt que « rien à afficher ». */
export function MissionControlList(
  { lignes, maintenant, vide }: { lignes: LigneMission[]; maintenant: Date; vide: React.ReactNode },
) {
  if (lignes.length === 0) return <>{vide}</>;
  return (
    <ul className="space-y-2" data-testid="mission-control-list">
      {lignes.map((m) => <MissionControlRow key={m.id} m={m} maintenant={maintenant} />)}
    </ul>
  );
}

/** Les missions closes, repliées : on les garde à portée sans qu'elles encombrent. */
export function MissionsCloses({ lignes, maintenant }: { lignes: LigneMission[]; maintenant: Date }) {
  if (lignes.length === 0) return null;
  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {lignes.length} mission(s) terminée(s) ou arrêtée(s)
      </summary>
      <ul className="mt-2 space-y-1.5">
        {lignes.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <Link href={`/missions/${m.id}`} className="min-w-0 truncate text-foreground hover:underline">
              {m.titre}
            </Link>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {m.statut === "COMPLETED" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : null}
              {m.etat} · {depuis(m.majLe, maintenant)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
