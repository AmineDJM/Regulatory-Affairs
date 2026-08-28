import { prisma } from "@/lib/prisma";
import { journaliser, transitionner } from "@/lib/missions/runtime/store";
import { canTransition, type MissionState } from "@/lib/missions/runtime/state";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MAIN HUMAINE SUR UNE MISSION (§39-40) — pause, reprise, arrêt.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST SI PETIT ─────────────────────────────
 *
 * Tout ce qu'il fait, la machine à états et le journal savaient déjà le faire. Ce qui manquait
 * n'était pas la mécanique : c'était la PORTE. Une mission suspendue, reprise ou arrêtée était
 * une capacité écrite nulle part, donc une capacité inexistante — le PDG pouvait lancer une
 * mission de trois mille actions et n'avait aucun moyen de lui dire « stop ».
 *
 * ── LE CLOISONNEMENT EST DANS LA SIGNATURE ──────────────────────────────────────────────
 *
 * Chaque fonction exige le `ownerId` et le met dans le `where`. On ne vérifie pas la propriété
 * après avoir lu la mission : on lit la mission DE cette personne, et un identifiant deviné ne
 * donne rien. C'est la même règle que la mémoire d'assistant, pour la même raison.
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────────────────
 *
 * On ne touche pas aux ÉTAPES. Une mission suspendue pendant qu'elle attendait un contrat
 * repart en attendant toujours ce contrat ; une mission arrêtée laisse ses étapes telles
 * qu'elles étaient, et le journal dit pourquoi. Remettre les étapes à zéro rendrait la reprise
 * dangereuse — on relancerait des actions déjà faites — et l'arrêt illisible.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ResultatControle {
  ok: boolean;
  /** L'état AVANT, quand la mission a été trouvée. */
  depuis: MissionState | null;
  /** L'état APRÈS. Égal à `depuis` quand rien n'a bougé. */
  vers: MissionState | null;
  message: string;
}

const introuvable: ResultatControle = {
  ok: false, depuis: null, vers: null,
  message: "Mission introuvable — ou elle ne vous appartient pas.",
};

async function etat(missionId: string, ownerId: string): Promise<MissionState | null> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId, kind: "RUNTIME" },
    select: { status: true },
  });
  return (m?.status as MissionState) ?? null;
}

/**
 * SUSPEND UNE MISSION.
 *
 * Le motif est facultatif mais fortement encouragé : trois jours plus tard, « pourquoi cette
 * mission est-elle en pause ? » est exactement la question qu'on se pose, et le journal est le
 * seul endroit qui puisse répondre.
 */
export async function mettreEnPause(
  missionId: string, ownerId: string, motif?: string,
): Promise<ResultatControle> {
  const depuis = await etat(missionId, ownerId);
  if (!depuis) return introuvable;
  if (depuis === "PAUSED") {
    return { ok: true, depuis, vers: depuis, message: "Cette mission était déjà en pause." };
  }
  if (!canTransition(depuis, "PAUSED")) {
    return {
      ok: false, depuis, vers: depuis,
      message: `Une mission ${depuis === "COMPLETED" ? "terminée" : "annulée"} ne se met pas en pause.`,
    };
  }

  await transitionner(missionId, "PAUSED", motif ? `Suspendue : ${motif}` : "Suspendue à la demande");
  await journaliser(missionId, "NOTE",
    motif ? `Mise en pause — ${motif}` : "Mise en pause", { motif: motif ?? null }, ownerId);
  return { ok: true, depuis, vers: "PAUSED", message: "Mission suspendue. Elle repartira où elle s'est arrêtée." };
}

/**
 * REPREND UNE MISSION SUSPENDUE.
 *
 * On repasse par RUNNING et non par l'état d'avant la pause — délibérément. Ré-établir l'état
 * antérieur exigerait de le stocker, donc de l'entretenir, et il serait faux dès qu'un
 * événement serait arrivé pendant la pause. RUNNING est l'état honnête : « elle travaille » ;
 * le moteur redécouvre en un tour, sans effet de bord, ce qu'elle attend réellement.
 */
export async function reprendre(missionId: string, ownerId: string): Promise<ResultatControle> {
  const depuis = await etat(missionId, ownerId);
  if (!depuis) return introuvable;
  if (depuis !== "PAUSED") {
    return { ok: false, depuis, vers: depuis, message: `Cette mission n'est pas en pause (${depuis}).` };
  }

  await transitionner(missionId, "RUNNING", "Reprise à la demande");
  await journaliser(missionId, "NOTE", "Reprise", undefined, ownerId);
  return { ok: true, depuis, vers: "RUNNING", message: "Mission reprise." };
}

/**
 * ARRÊTE UNE MISSION, DÉFINITIVEMENT.
 *
 * `CANCELLED` est terminal : c'est ce qui garantit qu'un événement en retard ne la réveillera
 * pas trois jours après. Ce qui a DÉJÀ été fait reste fait — on n'annule pas un e-mail parti, et
 * prétendre le contraire serait le pire des mensonges d'interface.
 */
export async function annuler(
  missionId: string, ownerId: string, motif?: string,
): Promise<ResultatControle> {
  const depuis = await etat(missionId, ownerId);
  if (!depuis) return introuvable;
  if (depuis === "CANCELLED") {
    return { ok: true, depuis, vers: depuis, message: "Cette mission était déjà arrêtée." };
  }
  if (!canTransition(depuis, "CANCELLED")) {
    return { ok: false, depuis, vers: depuis, message: "Une mission terminée ne s'annule pas." };
  }

  // LES ÉTAPES QUI N'ONT PAS COMMENCÉ SONT ANNULÉES ; celles qui tournent, attendent ou sont
  // faites ne sont PAS touchées. Une étape `DONE` annulée effacerait la trace d'un effet réel,
  // et une étape `RUNNING` annulée en base pendant qu'elle s'exécute vraiment produirait un
  // reçu sans étape pour le porter.
  await prisma.missionStep.updateMany({
    where: { missionId, status: { in: ["PENDING", "READY"] } },
    data: { status: "CANCELLED" },
  });

  await transitionner(missionId, "CANCELLED", motif ? `Arrêtée : ${motif}` : "Arrêtée à la demande");
  await journaliser(missionId, "CLOSED",
    motif ? `Arrêtée — ${motif}` : "Arrêtée à la demande", { motif: motif ?? null }, ownerId);
  return {
    ok: true, depuis, vers: "CANCELLED",
    message: "Mission arrêtée. Ce qui avait déjà été fait reste fait — rien n'est défait.",
  };
}
