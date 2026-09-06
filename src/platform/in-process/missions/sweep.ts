import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { attentesEchues, missionsAFaireAvancer, reveillerAttentesTemporelles } from "@/lib/missions/events/router";
import { journaliser } from "@/lib/missions/runtime/store";
import { relancerAttente } from "@/platform/in-process/missions/relance";
import { porteAttentionPour } from "@/platform/in-process/missions/attention";
import { avancerMission, rattraperLancementsPerdus, replanifierMission } from "@/platform/in-process/missions/runtime";

/**
 * LE BAIL vit dans le moteur (`runtime/bail.ts`) : c'est `avancer` qui le prend et le renouvelle
 * à chaque vague, pour QUICONQUE conduit une mission — battement, conversation, banc. Le balayage
 * le prend AVANT d'examiner une mission (ne pas payer un chargement pour rien) et le REND quand
 * son passage est fini. Réexporté ici pour les appelants historiques.
 */
export { prendreBail, rendreBail } from "@/lib/missions/runtime/bail";
import { prendreBail, rendreBail } from "@/lib/missions/runtime/bail";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BATTEMENT DES MISSIONS — ce qui les fait avancer sans personne devant l'écran.
 *
 * ── LE DÉFAUT QU'IL FERME ────────────────────────────────────────────────────────────────
 *
 * Sans lui, une mission n'avance que pendant l'appel qui l'a lancée. Fermer l'onglet la fige :
 * les étapes restent en attente, l'écran dit « en cours », et rien ne se passe. C'est
 * exactement le contraire de ce qu'on promet — « elle continue même si vous fermez
 * l'application » — et le genre de promesse qui, non tenue, coûte la confiance.
 *
 * Le réveil par ÉVÉNEMENT existe déjà (`events/ledger.ts` → `reveillerMissions`) : il remet les
 * étapes en attente à l'état prêt. Mais remettre une étape à l'état prêt n'exécute rien ; il
 * faut encore que quelqu'un fasse tourner le moteur. C'est ce balayage-ci.
 *
 * ── POURQUOI CE N'EST PAS UN « WORKFLOW » DU PLANIFICATEUR ──────────────────────────────
 *
 * `scheduler/handlers.ts` déclare, en toutes lettres, que ses traitements ne mutent RIEN : un
 * traitement planifié produit un constat, jamais un effet. Y ranger l'avancement des missions
 * ferait du planificateur un contournement de la politique d'approbation — précisément ce que
 * son en-tête interdit. Le balayage vit donc à part, il est appelé par le même battement, et il
 * porte ses propres garde-fous.
 *
 * ── LES GARDE-FOUS, ET LEUR RAISON ──────────────────────────────────────────────────────
 *
 *   • un nombre de missions BORNÉ par passage — sinon un pic de missions bloquerait le
 *     battement, qui sert aussi à l'analyse réglementaire et à l'ingestion ;
 *   • un nombre de tours BORNÉ par mission — une mission énorme avance par paquets, à chaque
 *     passage, plutôt que de monopoliser un battement entier ;
 *   • les missions en attente d'un ACCORD sont ignorées — les faire tourner ne produirait rien
 *     et brûlerait des requêtes pour reconstater qu'une porte est fermée ;
 *   • un débrayage par variable d'environnement, pour arrêter sans redéployer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Borne par passage. Douze missions × quelques tours tiennent largement dans un battement. */
const MISSIONS_PAR_PASSAGE = 12;
const TOURS_PAR_MISSION = 25;

export interface BalayageMissions {
  examinees: number;
  avancees: number;
  etapesExecutees: number;
  relances: number;
  /** Les missions dont le plan a été RÉÉCRIT parce qu'il ne pouvait plus aboutir (§39-40). */
  replanifiees: number;
}

// `proprietaire` vit dans son propre module : la porte d'attention l'emploie aussi, sans dépendre du balayage.
export { proprietaire } from "@/platform/in-process/missions/proprietaire";
import { proprietaire } from "@/platform/in-process/missions/proprietaire";
import { estReplanifiable } from "@/lib/missions/runtime/replan";

export interface ConduiteMission {
  executees: number;
  deployees: number;
  replanifie: boolean;
  /** Le statut à la fin du passage. */
  statut: string | null;
  /** Le dirigeant a-t-il été prévenu par ce passage (blocage ou échec NOUVEAU, sans recours) ? */
  signale: boolean;
}

/**
 * CONDUIT UNE MISSION D'UN PASSAGE : avancer, replanifier si elle coince, et — seulement si elle
 * coince ENCORE — le dire au dirigeant. C'est la séquence du battement, exposée pour qu'un banc
 * puisse la jouer sur une mission sans balayer toute la base.
 *
 * ── LE PLAN NE PASSE PLUS : ON EN ÉCRIT UN AUTRE (§39-40) ──────────────────────────────
 *
 * Seulement quand le moteur a épuisé ce qu'il savait faire — réessayer, réparer — et que la
 * mission s'est arrêtée en échec ou bloquée. Replanifier plus tôt jetterait un plan qui
 * marchait pour un incident passager ; ne jamais replanifier laisserait la mission morte sur une
 * étape que le planificateur savait contourner. `replanifierMission` porte ses propres
 * garde-fous : quatre plans au maximum, et tout ce que le nouveau plan ajoute repasse par
 * l'accord de la personne (§8). Le battement n'ouvre donc aucune porte — il ne fait que ne pas
 * abandonner.
 *
 * ── ET QUAND ELLE COINCE ENCORE, ON LE DIT — UNE FOIS ───────────────────────────────────
 *
 * Mesuré par le banc « données modifiées en cours de mission » : la cible d'un envoi disparaît,
 * l'étape échoue en le disant, le graphe se fige, la mission passe BLOCKED par déduction d'état —
 * et PERSONNE n'était prévenu, parce que seule la conclusion par le juge signalait. Ici, un
 * blocage ou un échec que la replanification n'a pas levé est signalé au moment où il APPARAÎT
 * (le statut a changé pendant ce passage), jamais répété à chaque battement : « résolu seul »
 * reste au journal, « coince sans recours » remonte.
 */
export async function conduireMission(
  user: CurrentUser,
  missionId: string,
  opts: { maxTours?: number; reasoner?: Parameters<typeof avancerMission>[2] extends infer O ? (O extends { reasoner?: infer R } ? R : never) : never } = {},
): Promise<ConduiteMission> {
  const avant = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true } });
  const options = { maxTours: opts.maxTours ?? TOURS_PAR_MISSION, ...(opts.reasoner ? { reasoner: opts.reasoner } : {}) };
  const r = await avancerMission(user, missionId, options);
  const out: ConduiteMission = { executees: r?.executees ?? 0, deployees: r?.deployees ?? 0, replanifie: false, statut: null, signale: false };

  let apres = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true, planVersion: true, ownerId: true } });
  let raisonReplan: string | null = null;
  // PARTIAL EST REPLANIFIABLE, et il ne l'était pas ici. C'est l'état d'une composition à
  // moitié faite — lecture réussie, calcul ou document mort — c'est-à-dire le cas le plus
  // fréquent de la famille. `replanifierMission` l'accepte (ETATS_REPLANIFIABLES), la voie
  // manuelle l'acceptait, le battement non : la mission tournait en rond sans jamais atteindre
  // le planificateur qui savait la réécrire.
  if (apres && estReplanifiable(apres.status)) {
    const rp = await replanifierMission(user, missionId, opts.reasoner ? { reasoner: opts.reasoner } : undefined).catch(() => null);
    raisonReplan = rp?.raison ?? null;
    if (rp?.replanifie) {
      out.replanifie = true;
      const r2 = await avancerMission(user, missionId, options).catch(() => null);
      out.executees += r2?.executees ?? 0;
      out.deployees += r2?.deployees ?? 0;
      apres = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true, planVersion: true, ownerId: true } });
    }
  }
  out.statut = apres?.status ?? null;

  if (apres && (apres.status === "FAILED" || apres.status === "BLOCKED") && avant?.status !== apres.status) {
    const morte = await prisma.missionStep.findFirst({
      where: { missionId, status: "FAILED" }, orderBy: { updatedAt: "desc" }, select: { title: true, error: true },
    });
    const raison = morte
      ? `« ${morte.title} » : ${morte.error ?? "en échec"}${raisonReplan ? ` — replanification : ${raisonReplan}` : ""}`
      : raisonReplan ?? "la mission ne peut plus avancer seule";
    await porteAttentionPour().signaler({
      kind: apres.status === "FAILED" ? "MISSION_FAILED" : "MISSION_BLOCKED",
      missionId, ownerId: apres.ownerId, titre: "", raison,
      decision: "préciser la demande, replanifier depuis l'écran de la mission, ou l'arrêter",
      planVersion: apres.planVersion,
    }).catch(() => undefined);
    out.signale = true;
  }
  return out;
}

/**
 * FAIT AVANCER LES MISSIONS QUI PEUVENT AVANCER.
 *
 * Ne lève jamais : une mission qui plante ne doit pas emporter le battement, ni les onze autres.
 */
export async function balayerMissions(): Promise<BalayageMissions> {
  const out: BalayageMissions = { examinees: 0, avancees: 0, etapesExecutees: 0, relances: 0, replanifiees: 0 };
  if ((process.env.MISSIONS_SWEEP ?? "").toLowerCase() === "off") return out;

  // ── 0. LE TEMPS D'ABORD (WAIT_FOR_TIME) ─────────────────────────────────────────────
  //
  // Les échéances passées se règlent AVANT de chercher les missions à faire avancer : une
  // mission dont « reviens demain 10 h » vient d'échoir devient candidate DANS CE battement,
  // pas au suivant. La granularité est celle du battement (~60 s) — largement suffisante pour
  // « demain », et aucun minuteur en mémoire à perdre au redéploiement.
  await reveillerAttentesTemporelles(new Date()).catch(() => []);

  // ── 0bis. LES LANCEMENTS PERDUS — le filet du lancement détaché (§5 durabilité) ───────
  //
  // Une mission-talon PLANNING sans étape dont le processus est mort entre « je m'en occupe »
  // et la planification est RETROUVÉE ici et relancée. La demande n'est jamais perdue : elle
  // vit en base depuis la première seconde.
  await rattraperLancementsPerdus(proprietaire).catch(() => 0);

  // ── 1. LES MISSIONS QUI ONT QUELQUE CHOSE À FAIRE ───────────────────────────────────
  //
  // `missionsAFaireAvancer` est PRÉCISE : elle ne rend que les missions portant au moins une
  // étape en attente ou réparable. Interroger « toutes les missions actives » ferait tourner le
  // moteur sur des missions qui dorment en attendant un événement — un travail nul, répété à
  // chaque battement, sur chaque mission longue du produit.
  const candidates = await missionsAFaireAvancer(MISSIONS_PAR_PASSAGE).catch(() => [] as string[]);
  const missions = candidates.length > 0
    ? await prisma.mission.findMany({
        where: { id: { in: candidates } },
        select: { id: true, ownerId: true, modelCallsCap: true, modelCalls: true },
      }).catch(() => [] as { id: string; ownerId: string; modelCallsCap: number | null; modelCalls: number }[])
    : [];

  const cache = new Map<string, CurrentUser | null>();
  for (const m of missions) {
    out.examinees += 1;
    try {
      /**
       * ── LE PLAFOND DE MODÈLE (« ne dépense plus de modèle sur ce dossier ») ──────────
       *
       * Atteint, la mission DORT — elle n'échoue pas, elle n'avance pas : lever le plafond la
       * fait repartir au même point. Le battement le vérifie AVANT de payer quoi que ce soit.
       */
      if (m.modelCallsCap !== null && m.modelCalls >= m.modelCallsCap) {
        const dejaDit = await prisma.missionEvent.findFirst({
          where: { missionId: m.id, kind: "BUDGET_HOLD" }, select: { id: true },
        });
        if (!dejaDit) {
          await journaliser(m.id, "BUDGET_HOLD",
            `Plafond de modèle atteint (${m.modelCalls}/${m.modelCallsCap} appels) : la mission attend qu'on le relève.`,
            { modelCalls: m.modelCalls, cap: m.modelCallsCap });
        }
        continue;
      }

      if (!cache.has(m.ownerId)) cache.set(m.ownerId, await proprietaire(m.ownerId));
      const user = cache.get(m.ownerId);
      if (!user) continue;

      // ── LE BAIL — deux battements concurrents ne paient pas deux fois les mêmes tours ──
      if (!(await prendreBail(m.id))) continue;

      const c = await conduireMission(user, m.id, { maxTours: TOURS_PAR_MISSION });
      if (c.executees > 0 || c.deployees > 0) {
        out.avancees += 1;
        out.etapesExecutees += c.executees;
      }
      if (c.replanifie) out.replanifiees += 1;
    } catch (e) {
      console.error(`[missions] avancement de ${m.id} échoué`, e);
    } finally {
      // Le bail se REND, même sur erreur — sinon la mission attendrait son expiration (90 s)
      // avant que quiconque la reprenne. Un bail perdu (crash) expire tout seul : c'est le
      // sabotage « lease lost », et il converge sans intervention.
      await rendreBail(m.id);
    }
  }

  // ── 2. LES ATTENTES ÉCHUES — matière à RELANCE, jamais à échec (§87) ──────────────
  //
  // Une personne qui n'a pas répondu en cinq jours n'a pas fait échouer la mission ; elle n'a
  // pas répondu. La différence compte : la première formulation conduit à abandonner, la
  // seconde à relancer. On PRÉVIENT le propriétaire, une fois, et la mission continue d'attendre.
  try {
    const echues = (await attentesEchues(new Date())).slice(0, 20);
    for (const e of echues) {
      const dejaDit = await prisma.missionEvent.findFirst({
        where: { missionId: e.missionId, kind: "OVERDUE", detail: { path: ["stepKey"], equals: e.stepKey } },
        select: { id: true },
      });
      if (!dejaDit) {
        await journaliser(e.missionId, "OVERDUE",
          `L'attente « ${e.stepTitle} » a dépassé son échéance.`, { stepKey: e.stepKey });
      }
      // ADAM RELANCE LUI-MÊME — un barreau par jour, la hiérarchie au troisième, le dirigeant
      // seulement quand l'échelle est épuisée ou que la personne attendue est externe. L'échelle
      // relit le journal : rappelée à chaque battement, elle ne fait rien de plus dans la journée.
      const r = await relancerAttente(e).catch(() => null);
      if (r && r.geste !== "SILENCE") out.relances += 1;
    }
  } catch (e) {
    console.error("[missions] balayage des attentes échues échoué", e);
  }

  return out;
}
