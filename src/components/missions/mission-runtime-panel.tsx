import { AlertTriangle, Check, CircleAlert, FileSpreadsheet, Loader2, X } from "lucide-react";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { vueMission } from "@/lib/missions/view/workspace";
import { attentesDeMission, journalDeMission, lecturesAgeesDeMission } from "@/lib/missions/view/control";
import { approbationsEnAttente } from "@/lib/missions/approval/gate";
import {
  AccordControls, ConduiteControls, ElementControls, ModificationControls, PrioriteControls,
} from "./mission-runtime-controls";
import { MissionHorizon, MissionPause } from "./mission-horizon";
import { MissionAttentes, MissionCout, MissionJournal, MissionLectures } from "./mission-journal";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN D'UNE MISSION (§55) — celui vers lequel pointent toutes ses notifications.
 *
 * ── POURQUOI IL VIT AU-DESSUS DE LA CONVERSATION ────────────────────────────────────────
 *
 * `prevenir()` met déjà `/assistant?mission=<id>` dans chaque notification poussée. Jusqu'ici ce
 * lien ouvrait la conversation et rien de plus : la personne recevait « en attente de votre
 * accord » sur son téléphone, cliquait, et arrivait sur un écran qui ne parlait pas de la
 * mission. Le circuit se terminait dans le vide.
 *
 * Le panneau se met donc AU-DESSUS du fil, sans le remplacer : on veut pouvoir répondre au
 * modèle dans la foulée (« pourquoi ce montant ? ») sans changer d'écran.
 *
 * ── CE QU'IL AFFICHE, ET CE QU'IL REFUSE D'AFFICHER ─────────────────────────────────────
 *
 * Le compte des étapes RÉELLES — trente-trois envois comptent pour trente-trois, jamais pour un
 * (`vueMission` s'en charge). Les livrables avec l'état de leur CONTRÔLE, parce que « écrit » et
 * « vérifié » ne se valent pas. Et rien qui vienne d'un modèle : tout est lu en base, donc exact.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ETAPE_ICON = {
  fait: Check,
  "en-cours": Loader2,
  "a-faire": CircleAlert,
  echec: X,
} as const;

const LIVRABLE_ETAT: Record<string, { texte: string; classe: string }> = {
  VERIFIED: { texte: "vérifié", classe: "text-emerald-700" },
  BUILT: { texte: "produit, non vérifié", classe: "text-amber-700" },
  REJECTED: { texte: "refusé au contrôle", classe: "text-rose-700" },
  PENDING: { texte: "en préparation", classe: "text-slate-500" },
};

/**
 * Rend `null` quand la mission n'existe pas OU ne lui appartient pas — les deux cas sont
 * indiscernables de l'extérieur, comme partout ailleurs dans ce produit.
 */
export async function MissionRuntimePanel({ user, missionId }: { user: CurrentUser; missionId: string }) {
  const vue = await vueMission(missionId, user.id);
  if (!vue) return null;

  const maintenant = new Date();
  const [attentes, journal, lectures, chiffres] = await Promise.all([
    attentesDeMission(missionId, user.id),
    journalDeMission(missionId, user.id),
    lecturesAgeesDeMission(missionId, user.id, maintenant),
    prisma.mission.findFirst({
      where: { id: missionId, ownerId: user.id },
      select: { priority: true, costUsd: true, modelCalls: true },
    }),
  ]);

  // L'accord se cherche dans la liste de CETTE personne : l'identifiant de mission ne suffit
  // pas à en obtenir un, et c'est voulu.
  const accord = vue.attente?.nodeType === "APPROVAL"
    ? (await approbationsEnAttente(user.id)).find((a) => a.missionId === missionId) ?? null
    : null;

  const { faites, total, echouees } = vue.avancement;
  const pourcent = total > 0 ? Math.round((faites / total) * 100) : 0;

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="mission-panel"
      data-statut={vue.statut}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900">{vue.title}</h2>
          {/* LE SOUS-TITRE VIENT DE LA VUE, PAS D'UN CALCUL LOCAL. Sur une mission longue il
              dit « jalon 3/7 » ; le recomposer ici en « faites/total » redirait les étapes du
              sous-plan courant, c'est-à-dire « presque fini » sur une mission de six semaines
              (§118.40). Deux endroits qui calculent la même phrase finissent par diverger. */}
          <p className="mt-0.5 text-sm text-slate-600">{vue.subtitle}</p>
        </div>
        <ConduiteControls missionId={missionId} statut={vue.statut} />
      </header>

      {/* LA JAUGE COMPTE LES ÉTAPES RÉELLES. Une mission de trente-trois envois dont deux ont
          échoué affiche 31/33 — jamais « 2/2 étapes du plan ». Sur une mission à horizon, c'est
          la jauge des JALONS qui fait foi (plus bas) : celle-ci ne parle que du sous-plan en
          cours, et l'écran le dit au lieu de laisser croire le contraire. */}
      {vue.horizon ? null : (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full rounded-full bg-slate-900" style={{ width: `${pourcent}%` }} />
        </div>
      )}

      {vue.pause ? <MissionPause pause={vue.pause} maintenant={maintenant} /> : null}
      {vue.horizon ? <MissionHorizon horizon={vue.horizon} /> : null}

      {/* ── CE QUI ATTEND LA PERSONNE, EN PREMIER ─────────────────────────────────────── */}
      {accord ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Cette mission attend votre accord
          </p>
          <div className="mt-2">
            <AccordControls approvalId={accord.id} resume={accord.summary} />
          </div>
        </div>
      ) : null}

      {vue.attente?.nodeType === "WAIT_INPUT" ? (
        <div className="mt-4 rounded-md border border-slate-300 bg-slate-50 p-3">
          <ElementControls
            missionId={missionId}
            stepKey={vue.attente.stepKey}
            question={vue.attente.titre}
          />
        </div>
      ) : null}

      {/* ── LES ÉTAPES ───────────────────────────────────────────────────────────────── */}
      {vue.horizon ? (
        <h3 className="mt-4 text-sm font-medium text-slate-800">
          Le jalon en cours — {faites}/{total} étapes{echouees > 0 ? `, ${echouees} en échec` : ""}
        </h3>
      ) : null}
      <ol className="mt-4 space-y-1.5">
        {vue.etapes.map((e) => {
          const Icon = ETAPE_ICON[e.etat];
          return (
            <li key={e.id} className="flex items-start gap-2 text-sm" data-testid="mission-panel-step">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  e.etat === "fait" ? "text-emerald-600"
                    : e.etat === "echec" ? "text-rose-600"
                      : e.etat === "en-cours" ? "animate-spin text-slate-500" : "text-slate-400"
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="text-slate-800">{e.label}</span>
                {e.detail ? <span className="ml-2 text-slate-500">{e.detail}</span> : null}
                {e.erreur ? <span className="ml-2 text-rose-700">{e.erreur}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {/* CE QUE LE PLAN COURANT A CONTOURNÉ. Ces étapes ne sont plus « à faire » — un plan
          neuf a tourné autour — mais les taire ferait disparaître du travail que quelqu'un
          avait demandé. On les compte, sans les remettre dans le dénominateur. */}
      {vue.contournees > 0 ? (
        <p className="mt-2 text-xs text-slate-500" data-testid="mission-contournees">
          {vue.contournees} étape(s) d&apos;un plan précédent ont été contournées par le plan courant.
        </p>
      ) : null}

      {attentes && attentes.length > 0 ? (
        <MissionAttentes attentes={attentes} maintenant={maintenant} />
      ) : null}

      {lectures && lectures.length > 0 ? <MissionLectures lectures={lectures} /> : null}

      {/* ── LES LIVRABLES, avec l'état de leur contrôle ───────────────────────────────── */}
      {vue.livrables.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-sm font-medium text-slate-800">Livrables</h3>
          <ul className="mt-1.5 space-y-1">
            {vue.livrables.map((l) => {
              const etat = LIVRABLE_ETAT[l.statut] ?? { texte: l.statut, classe: "text-slate-500" };
              return (
                <li key={l.key} className="flex items-center gap-2 text-sm" data-testid="mission-livrable">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {/* LE LIEN N'EXISTE QUE SI LE FICHIER EST RANGÉ. Un lien mort vaut moins qu'un
                      libellé honnête : la personne cliquerait, échouerait, et perdrait confiance
                      dans les autres liens de l'écran. */}
                  {l.driveNodeId ? (
                    <a className="truncate text-slate-800 underline" href={`/drive?file=${l.driveNodeId}`}>
                      {l.fichier}
                    </a>
                  ) : (
                    <span className="truncate text-slate-800">{l.fichier}</span>
                  )}
                  <span className={`shrink-0 text-xs ${etat.classe}`}>{etat.texte}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {vue.sousMissions.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {vue.sousMissions.length} sous-mission(s) :{" "}
          {vue.sousMissions.map((s) => `${s.titre} (${s.avancement})`).join(", ")}
        </p>
      ) : null}

      {journal ? <MissionJournal journal={journal} maintenant={maintenant} /> : null}

      <MissionCout usd={chiffres?.costUsd ?? 0} appels={chiffres?.modelCalls ?? 0} />

      {/* LES GESTES DE CONDUITE FINE. Ils ne sont proposés que sur une mission VIVANTE :
          repriorisier ou modifier une mission terminée n'a pas de sens, et un bouton qui ne
          peut rien faire apprend à ne plus faire confiance aux boutons. */}
      {vue.statut !== "COMPLETED" && vue.statut !== "CANCELLED" ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <PrioriteControls missionId={missionId} priorite={chiffres?.priority ?? 0} />
          <ModificationControls missionId={missionId} />
        </div>
      ) : null}
    </section>
  );
}
