import { Clock, Coins, Hourglass, Mail, ShieldCheck, TimerReset } from "lucide-react";
import type { AttenteLue, JournalMission, LectureDatee } from "@/lib/missions/view/control";
import { depuis } from "@/lib/missions/view/duree";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MISSION ATTEND, ET CE QU'ELLE A FAIT.
 *
 * ── LES ATTENTES, TOUTES ────────────────────────────────────────────────────────────────
 *
 * `vueMission` rend UNE attente : celle qui appelle un geste immédiat de la personne. Une
 * mission longue en a plusieurs à la fois — trois collègues sollicités, un événement ERP, une
 * échéance — et n'en montrer qu'une transforme « pourquoi ça n'avance pas ? » en devinette.
 * On les montre donc toutes, avec DEPUIS QUAND : une attente de deux heures est normale, la
 * même à six jours est un problème, et c'est la durée qui fait la différence.
 *
 * ── LE JOURNAL, FILTRÉ ET ASSUMÉ ────────────────────────────────────────────────────────
 *
 * Le journal brut est majoritairement de la comptabilité de moteur (8 751 « le moteur prend la
 * main » sur la base de banc). L'afficher tel quel noierait les six lignes qui expliquent où la
 * mission en est. Ce qui a été écarté est COMPTÉ et dit — un filtre silencieux ferait croire
 * qu'il ne s'est rien passé d'autre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const NATURE = {
  ACCORD: { Icone: ShieldCheck, texte: "attend un accord", classe: "text-amber-700" },
  ELEMENT: { Icone: Mail, texte: "attend un élément", classe: "text-amber-700" },
  EVENEMENT: { Icone: Hourglass, texte: "attend un événement", classe: "text-slate-600" },
} as const;

export function MissionAttentes(
  { attentes, maintenant }: { attentes: AttenteLue[]; maintenant: Date },
) {
  if (attentes.length === 0) return null;
  return (
    <section className="mt-4 border-t border-slate-100 pt-3" data-testid="mission-attentes">
      <h3 className="text-sm font-medium text-slate-800">
        {attentes.length} attente(s) ouverte(s)
      </h3>
      <ul className="mt-1.5 space-y-1.5">
        {attentes.map((a) => {
          const n = NATURE[a.nature];
          return (
            <li key={a.stepKey} className="flex items-start gap-2 text-sm" data-testid="mission-attente">
              <n.Icone className={`mt-0.5 h-4 w-4 shrink-0 ${n.classe}`} aria-hidden />
              <span className="min-w-0">
                <span className="text-slate-800">{a.titre}</span>
                <span className="ml-2 text-slate-500">
                  {n.texte}
                  {a.de ? ` de ${a.de}` : ""}
                  {" · "}{depuis(a.depuis, maintenant)}
                  {/* LES RELANCES SE DISENT. Sans ce compte, on relance une quatrième fois
                      quelqu'un qu'Adam a déjà relancé trois fois — ce qui coûte la relation,
                      pas seulement un e-mail. */}
                  {a.relances > 0 ? ` · ${a.relances} relance(s)` : ""}
                  {a.jusqua ? ` · échéance ${a.jusqua}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TON: Record<string, string> = {
  decision: "text-slate-900",
  fait: "text-slate-600",
  probleme: "text-rose-700",
};

export function MissionJournal(
  { journal, maintenant }: { journal: JournalMission; maintenant: Date },
) {
  if (journal.lignes.length === 0) return null;
  return (
    <details className="mt-4 border-t border-slate-100 pt-3" data-testid="mission-journal">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">
        Journal — {journal.lignes.length} événement(s)
      </summary>
      <ol className="mt-2 space-y-1.5">
        {journal.lignes.map((l) => (
          <li key={l.id} className="flex items-start gap-2 text-sm" data-testid="mission-journal-ligne">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
            <span className="min-w-0">
              <span className={TON[l.gravite] ?? "text-slate-600"}>{l.texte}</span>
              {l.fois > 1 ? <span className="ml-1 text-slate-400">(×{l.fois})</span> : null}
              <span className="ml-2 text-xs text-slate-400">{depuis(l.quand, maintenant)}</span>
            </span>
          </li>
        ))}
      </ol>
      {journal.bruitEcarte > 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          {journal.bruitEcarte} ligne(s) de comptabilité du moteur écartées (changements d&apos;état,
          étapes abouties, notifications) — elles sont déjà dites ailleurs sur cet écran.
        </p>
      ) : null}
    </details>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MISSION A LU, ET QUI A DE L'ÂGE (§118.41).
 *
 * Une mission longue conclut sur des chiffres lus au premier jour. Si Finance a révisé son
 * forecast entre-temps, le livrable est cohérent, le contrôle passe, le juge est satisfait — et
 * le chiffre est mort. C'est le faux succès SANS AUCUNE signature d'échec, et le seul moyen de
 * le voir est de dater les lectures.
 *
 * L'écran DIT. Il ne relit pas : relire coûte des appels et peut avoir des effets ; décider de
 * relire appartient au plan, ou à la personne — qui a maintenant de quoi le décider.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function MissionLectures({ lectures }: { lectures: LectureDatee[] }) {
  if (lectures.length === 0) return null;
  return (
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3" data-testid="mission-lectures">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
        <TimerReset className="h-4 w-4" aria-hidden />
        {lectures.length} lecture(s) ont de l&apos;âge
      </h3>
      <ul className="mt-1.5 space-y-1">
        {lectures.slice(0, 8).map((l) => (
          <li key={`${l.cle}-${l.lueLe}`} className="text-xs text-amber-900" data-testid="mission-lecture">
            {l.phrase}
          </li>
        ))}
      </ul>
      {lectures.length > 8 ? (
        <p className="mt-1 text-xs text-amber-700">et {lectures.length - 8} autre(s).</p>
      ) : null}
      <p className="mt-1.5 text-xs text-amber-800">
        Adam ne les relit pas de lui-même : relire coûte des appels et peut avoir des effets.
        Dites-le-lui, ou modifiez la mission (« utilise maintenant le nouveau forecast »).
      </p>
    </section>
  );
}

/**
 * CE QUE LA MISSION A COÛTÉ.
 *
 * Zéro est une VALEUR, pas une absence : une mission qui n'a rien coûté en modèle n'en a
 * simplement appelé aucun. Ne rien afficher dans ce cas ferait croire à une mesure manquante.
 */
export function MissionCout({ usd, appels }: { usd: number; appels: number }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400" data-testid="mission-cout">
      <Coins className="h-3.5 w-3.5" aria-hidden />
      {appels} appel(s) de modèle · {usd.toFixed(4)} $
    </p>
  );
}
