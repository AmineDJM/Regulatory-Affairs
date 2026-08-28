import type { CurrentUser } from "@/lib/session";
import { approbationsEnAttente, decider } from "@/lib/missions/approval/gate";
import { annuler, mettreEnPause, reprendre } from "@/lib/missions/runtime/control";
import { avancerMission, replanifierMission } from "@/platform/in-process/missions/runtime";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES GESTES DE CONDUITE, VUS DEPUIS ADAM — et pourquoi ils passent par le pont.
 *
 * ── LE CLIQUET A TRANCHÉ, ET IL AVAIT RAISON ────────────────────────────────────────────
 *
 * L'outil `mission_control` vit dans `src/lib/assistant/` : le périmètre d'Adam. Y importer
 * directement `missions/runtime/control` et `missions/approval/gate` ajoutait deux
 * franchissements de la frontière Adam → ERP, et `boundary.test.ts` l'a refusé.
 *
 * La bonne réponse n'était pas de relever le plafond mais de reconnaître ce qu'est ce code :
 * une COMPOSITION, exactement comme `runtime.ts` et `sweep.ts` à côté. Le pont est le seul
 * endroit d'Adam autorisé à connaître l'ERP ; c'est sa raison d'être, et c'est ce qui garde la
 * propriété utile — arracher Adam, c'est supprimer `assistant/`, `models/` et `in-process/`,
 * et le Mission Runtime reste debout.
 *
 * ── CE QUE CE FICHIER N'EXPOSE PAS, DÉLIBÉRÉMENT ────────────────────────────────────────
 *
 * `decider(GRANTED)` et `fournirEntree`. Ce sont des attestations humaines : elles passent par
 * une vraie session, sur `/missions/<id>`. Le REFUS, lui, est ici — parce qu'il ne fait que
 * réduire ce qui va se produire, et qu'une injection qui ferait refuser une mission se voit
 * immédiatement et se répare d'un clic.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface GesteMission {
  fait: boolean;
  statut: string | null;
  message: string;
}

export async function pauserMission(
  user: CurrentUser, missionId: string, motif?: string,
): Promise<GesteMission> {
  const r = await mettreEnPause(missionId, user.id, motif);
  return { fait: r.ok, statut: r.vers, message: r.message };
}

/**
 * REPREND, puis RELANCE tout de suite.
 *
 * Sans la relance, la personne qui vient de dire « reprends » verrait « suspendue » jusqu'au
 * prochain battement — jusqu'à une minute pendant laquelle rien ne semble se passer.
 */
export async function reprendreMissionAgent(
  user: CurrentUser, missionId: string,
): Promise<GesteMission> {
  const r = await reprendre(missionId, user.id);
  if (!r.ok) return { fait: false, statut: r.vers, message: r.message };
  await avancerMission(user, missionId, { maxTours: 25 }).catch(() => undefined);
  return { fait: true, statut: "RUNNING", message: r.message };
}

export async function arreterMissionAgent(
  user: CurrentUser, missionId: string, motif?: string,
): Promise<GesteMission> {
  const r = await annuler(missionId, user.id, motif);
  return { fait: r.ok, statut: r.vers, message: r.message };
}

/**
 * REFUSE L'AUTORISATION QU'UNE MISSION DEMANDE.
 *
 * On cherche dans la liste des accords EN ATTENTE DE CETTE PERSONNE : c'est le cloisonnement
 * lui-même. Une mission dont on n'attend rien ne donne rien à refuser, et on le dit.
 */
export async function refuserAccordMission(
  user: CurrentUser, missionId: string,
): Promise<GesteMission> {
  const cible = (await approbationsEnAttente(user.id)).find((a) => a.missionId === missionId);
  if (!cible) {
    return { fait: false, statut: null, message: "Cette mission n'attend aucune autorisation de votre part." };
  }
  const ok = await decider(cible.id, "REFUSED", user.id);
  return {
    fait: ok,
    statut: null,
    message: ok
      ? "Refus enregistré. Les étapes concernées ne seront pas exécutées."
      : "Cette demande avait déjà été tranchée.",
  };
}

/**
 * RÉÉCRIT LE PLAN, PUIS RELANCE.
 *
 * Le geste est ici parce qu'il ne peut RIEN faire sortir sans accord : tout ce que le nouveau
 * plan ajoute est rouvert à l'approbation de la personne par `reouvrirSiChange` (§8). Une
 * injection qui le déclencherait obtiendrait donc, au pire, une demande d'accord de plus — ce
 * qui se voit, et se refuse d'un clic.
 */
export async function replanifierAgent(
  user: CurrentUser, missionId: string,
): Promise<GesteMission> {
  const r = await replanifierMission(user, missionId);
  if (!r.replanifie) return { fait: false, statut: null, message: r.raison };
  await avancerMission(user, missionId, { maxTours: 25 }).catch(() => undefined);
  return { fait: true, statut: null, message: r.raison };
}
