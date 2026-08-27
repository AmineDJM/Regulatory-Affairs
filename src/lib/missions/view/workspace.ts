import { prisma } from "@/lib/prisma";
import { MISSION_STATUS_LABEL } from "@/lib/comms/missions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN D'UNE MISSION — construit par le SERVEUR, jamais rédigé par un modèle (§43-47).
 *
 * ── POURQUOI CE FICHIER N'APPELLE AUCUN MODÈLE ───────────────────────────────────────────
 *
 * « Où tu en es ? » est une question dont la réponse est EN BASE. La faire passer par un modèle
 * coûterait une seconde et demie, quelques milliers de jetons, et introduirait le risque qu'il
 * décrive un état qu'il aurait mal lu — pour restituer ce que le serveur savait déjà
 * exactement. La conversation reste vivante précisément parce qu'on ne paie pas ce prix-là.
 *
 * ── LE BLOC SE REMPLACE, IL NE S'EMPILE PAS (§43) ────────────────────────────────────────
 *
 * `blockId` est STABLE — c'est l'identifiant de la mission. L'élagage du fil, déjà en place, ne
 * garde d'un même `blockId` que la dernière occurrence : la mission se met donc à jour SUR
 * PLACE, au lieu de laisser une traînée de douze cartes décrivant douze instants successifs.
 *
 * ── CE QUE CE FICHIER NE CONNAÎT PAS ─────────────────────────────────────────────────────
 *
 * Le type `WorkspaceBlock` vit chez Adam ; l'importer ici inverserait les couches. On rend donc
 * un objet JSON ordinaire, dont la forme est exactement celle que le lecteur d'Adam accepte.
 * La frontière tient, et le contrat est vérifié par un test.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** L'état d'une étape, traduit pour l'écran. Le vocabulaire est celui du bloc « mission ». */
const ETAT_AFFICHE: Record<string, "fait" | "en-cours" | "a-faire" | "echec"> = {
  DONE: "fait",
  RUNNING: "en-cours",
  READY: "en-cours",
  WAITING: "en-cours",
  PENDING: "a-faire",
  FAILED: "echec",
  // Une étape SAUTÉE n'est ni faite ni ratée. On l'affiche « à faire » plutôt que « fait » :
  // marquer accompli ce qui n'a pas eu lieu est le mensonge le plus coûteux d'un tableau de bord.
  SKIPPED: "a-faire",
  CANCELLED: "a-faire",
};

/** Ce que l'écran montre d'une étape en attente — sans jargon de moteur. */
function detailEtape(s: {
  status: string; nodeType: string; errorKind: string | null;
  error: string | null; receipt: string | null; attempt: number; maxAttempts: number;
}): string | null {
  if (s.status === "WAITING") {
    if (s.nodeType === "APPROVAL") return "attend votre accord";
    if (s.nodeType === "WAIT_INPUT") return "attend un élément de votre part";
    if (s.nodeType === "WAIT_EVENT") return "attend un événement";
    return "attend ses étapes filles";
  }
  if (s.status === "FAILED") {
    const reste = s.maxAttempts - s.attempt;
    return reste > 0 ? `échec, ${reste} tentative(s) restante(s)` : "échec définitif";
  }
  if (s.status === "DONE" && s.receipt) {
    // LE REÇU EST MONTRÉ (§47) : c'est ce qui rend l'affirmation « c'est parti » vérifiable.
    return s.receipt === "DEDUPLIQUE" ? "déjà fait — non refait" : `reçu ${s.receipt}`;
  }
  return null;
}

export interface VueMission {
  kind: "mission";
  blockId: string;
  title: string;
  subtitle: string;
  etapes: {
    id: string;
    label: string;
    etat: "fait" | "en-cours" | "a-faire" | "echec";
    detail?: string;
    erreur?: string;
  }[];
  /** Les sous-missions, résumées. Repliées par défaut à l'écran (§45). */
  sousMissions: { id: string; titre: string; etat: string; avancement: string }[];
  /** Ce que la mission attend de l'humain, s'il y a lieu. */
  enAttenteDeVous: string | null;
  avancement: { faites: number; total: number; echouees: number };
}

/**
 * L'ÉTAT COMPLET D'UNE MISSION, prêt à afficher.
 *
 * ── LE REGROUPEMENT DES ÉVENTAILS ────────────────────────────────────────────────────────
 *
 * Trente-trois étapes filles ne produisent PAS trente-trois lignes : elles sont repliées sous
 * leur modèle, avec un compte. Un écran qui déroule trente-trois lignes identiques n'est pas
 * plus honnête — il est seulement illisible, et l'information « 31 sur 33 » y disparaît.
 */
export async function vueMission(missionId: string, ownerId: string): Promise<VueMission | null> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId },
    select: {
      id: true, title: true, status: true, goalVerdict: true, planVersion: true,
      steps: {
        select: {
          key: true, title: true, status: true, nodeType: true, receipt: true,
          error: true, errorKind: true, attempt: true, maxAttempts: true,
        },
        orderBy: [{ createdAt: "asc" }, { key: "asc" }],
      },
      subMissions: {
        select: {
          id: true, title: true, status: true,
          steps: { select: { status: true } },
        },
      },
    },
  });
  if (!m) return null;

  const filles = new Map<string, typeof m.steps>();
  const principales: typeof m.steps = [];
  for (const s of m.steps) {
    const i = s.key.indexOf("#");
    if (i > 0) {
      const parent = s.key.slice(0, i);
      if (!filles.has(parent)) filles.set(parent, []);
      filles.get(parent)!.push(s);
    } else {
      principales.push(s);
    }
  }

  const etapes: VueMission["etapes"] = principales.map((s) => {
    const enfants = filles.get(s.key) ?? [];
    const detail = enfants.length > 0
      ? `${enfants.filter((e) => e.status === "DONE").length}/${enfants.length} effectuées`
      : detailEtape(s);
    return {
      id: s.key,
      label: s.title,
      etat: ETAT_AFFICHE[s.status] ?? "a-faire",
      ...(detail ? { detail } : {}),
      ...(s.error ? { erreur: s.error } : {}),
    };
  });

  // L'avancement compte les ÉTAPES RÉELLES : les filles d'un éventail, pas leur modèle. Compter
  // le modèle pour un donnerait « 2/2 » sur une mission de trente-trois envois dont deux ont raté.
  const reelles = m.steps.filter((s) => !filles.has(s.key));
  const faites = reelles.filter((s) => s.status === "DONE").length;
  const echouees = reelles.filter((s) => s.status === "FAILED").length;

  const attente = m.steps.find((s) => s.status === "WAITING" && (s.nodeType === "APPROVAL" || s.nodeType === "WAIT_INPUT"));

  return {
    kind: "mission",
    // L'IDENTIFIANT DE LA MISSION FAIT L'IDENTITÉ DU BLOC : c'est ce qui la met à jour sur place.
    blockId: `mission:${m.id}`,
    title: m.title,
    subtitle: `${MISSION_STATUS_LABEL[m.status]} — ${faites}/${reelles.length} étapes`
      + (echouees > 0 ? `, ${echouees} en échec` : "")
      + (m.planVersion > 1 ? ` (plan v${m.planVersion})` : ""),
    etapes,
    sousMissions: m.subMissions.map((sm) => ({
      id: sm.id,
      titre: sm.title,
      etat: MISSION_STATUS_LABEL[sm.status],
      avancement: `${sm.steps.filter((x) => x.status === "DONE").length}/${sm.steps.length}`,
    })),
    enAttenteDeVous: attente
      ? (attente.nodeType === "APPROVAL" ? `« ${attente.title} » attend votre accord` : `« ${attente.title} » attend un élément de votre part`)
      : null,
    avancement: { faites, total: reelles.length, echouees },
  };
}

/**
 * LES MISSIONS EN COURS D'UNE PERSONNE — la réponse à « où tu en es ? ».
 *
 * Bornée à cinq : au-delà, ce n'est plus un état, c'est une liste. Et une liste ne répond pas à
 * la question posée, qui porte sur ce qui est en train de se passer MAINTENANT.
 */
export async function missionsEnCours(ownerId: string, limite = 5) {
  const rows = await prisma.mission.findMany({
    where: {
      ownerId, kind: "RUNTIME",
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true, title: true, status: true, updatedAt: true,
      steps: { select: { status: true, key: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
  });

  return rows.map((m) => {
    const modeles = new Set(
      m.steps.filter((s) => s.key.includes("#")).map((s) => s.key.slice(0, s.key.indexOf("#"))),
    );
    const reelles = m.steps.filter((s) => !modeles.has(s.key));
    return {
      id: m.id,
      titre: m.title,
      etat: MISSION_STATUS_LABEL[m.status],
      faites: reelles.filter((s) => s.status === "DONE").length,
      total: reelles.length,
      depuis: m.updatedAt,
    };
  });
}
