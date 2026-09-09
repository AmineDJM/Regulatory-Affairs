/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * MODIFIER UNE MISSION EN COURS — le geste, branché sur le raisonnement pur.
 *
 * `horizon/modification.ts` décide CE QUI est touché ; ce fichier l'applique. La séparation
 * n'est pas cosmétique : la conversation a besoin de PRÉVOIR l'empreinte (« voilà ce qui va
 * bouger, on y va ? ») sans rien écrire, et le pilote a besoin de l'APPLIQUER. Une seule
 * fonction qui ferait les deux obligerait la conversation à ouvrir une transaction pour poser
 * une question.
 *
 * ── LES DEUX GARANTIES ──────────────────────────────────────────────────────────────────
 *
 *   1. L'empreinte réelle ne dépasse jamais l'empreinte demandée (§118.16). Ce qui n'est pas
 *      touché est nommé, et le reste garde ses étapes, ses reçus et ses effets.
 *   2. Rien ne se rejoue. Une étape qui a déjà envoyé, écrit ou déposé garde son reçu : elle
 *      est NOMMÉE, pas relancée. « Amel à la place de Deepak » ne dé-envoie pas le message à
 *      Deepak — il évite le suivant, et le dit.
 *
 * ── CE QUI N'EST PAS UNE PORTE DÉROBÉE ──────────────────────────────────────────────────
 *
 * Une modification qui REMPLACE ou RAFRAÎCHIT invalide des étapes : le jalon touché repasse à
 * PENDING et sera recompilé, donc repassera par le compilateur, la politique d'acteur ET la
 * porte d'accord (`reouvrirSiChange`). On ne peut pas se servir d'une modification pour faire
 * exécuter ce qu'un accord ne couvrait pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { journaliser } from "@/lib/missions/runtime/store";
import {
  empreinteDeLaModification, type DemandeModification, type EmpreinteModification,
  type NoeudModifiable,
} from "@/lib/missions/horizon/modification";
import { marquerJalon } from "@/lib/missions/horizon/store";

export interface ResultatModification {
  fait: boolean;
  /** L'empreinte calculée — même quand on n'applique pas : c'est ce que la personne lit. */
  empreinte: EmpreinteModification | null;
  message: string;
  /** Les jalons remis à compiler. Vide quand la modification ne touche pas le graphe. */
  jalonsRouverts: number[];
  /** Les étapes remises à zéro. Vide de même. */
  etapesInvalidees: string[];
}

/**
 * CE QUE LA MISSION EXPOSE AU RAISONNEMENT PUR — titre, entrée aplatie, jalon, dépendances.
 *
 * `texte` aplatit les VALEURS de l'entrée : c'est là que vivent les destinataires, les
 * identifiants de dossier, les noms de fichiers. Sans lui, « Deepak » ne serait cherché que
 * dans les titres, et une étape dont le titre dit « demander le prix » mais dont le payload dit
 * `recipientName: "Deepak Sharma"` passerait à travers.
 */
async function grapheModifiable(missionId: string): Promise<NoeudModifiable[]> {
  const etapes = await prisma.missionStep.findMany({
    where: { missionId, supersededAt: null },
    include: {
      deps: { include: { dependsOn: { select: { key: true } } } },
      milestone: { select: { ordre: true } },
    },
    orderBy: [{ createdAt: "asc" }, { key: "asc" }],
  });
  return etapes.map((e) => ({
    key: e.key,
    titre: e.title,
    nodeType: e.nodeType,
    status: e.status,
    milestoneOrdre: e.milestone?.ordre ?? null,
    dependsOn: e.deps.map((d) => d.dependsOn.key),
    texte: aplatir(e.input),
    // L'EFFET SE LIT SUR LE REÇU, PAS SUR LE STATUT. Une étape peut échouer APRÈS avoir produit
    // son effet ; c'est le reçu qui prouve qu'elle est partie (§118.33).
    aEuUnEffet: e.receipt !== null || e.idempotencyKey !== null && e.status === "DONE",
  }));
}

/** Les valeurs textuelles d'un payload, à plat et bornées. */
function aplatir(v: unknown, profondeur = 0): string {
  if (profondeur > 4 || v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => aplatir(x, profondeur + 1)).join(" ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k} ${aplatir(x, profondeur + 1)}`)
      .join(" ");
  }
  return "";
}

/**
 * PRÉVOIR CE QUE LA MODIFICATION VA CHANGER — sans rien écrire.
 *
 * C'est la moitié la plus importante du mécanisme : « ce qui ne bouge pas » est ce que la
 * personne veut entendre avant d'accepter. Une modification dont on ne peut pas annoncer
 * l'empreinte est une modification qu'on ne devrait pas appliquer.
 */
export async function prevoirModification(
  user: CurrentUser,
  missionId: string,
  demande: DemandeModification,
): Promise<EmpreinteModification | null> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId: user.id, kind: "RUNTIME" }, select: { id: true },
  });
  if (!m) return null;
  return empreinteDeLaModification(demande, await grapheModifiable(missionId));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APPLIQUER — et ne toucher QUE ce que l'empreinte nomme.
 *
 * REMPLACER / RAFRAÎCHIR : les étapes touchées repassent à PENDING avec leur `milestoneId`
 * remis à zéro côté jalon (le jalon redevient PENDING, donc il sera RE-compilé). Celles qui ont
 * produit un effet ne sont PAS remises à zéro — elles sont nommées.
 *
 * RETIRER : les étapes de la branche exclusive passent à CANCELLED, et le jalon qui ne porte
 * plus que des étapes annulées passe à SKIPPED — ce qui LIBÈRE sa descendance, parce qu'un
 * livrable retiré ne doit pas retenir en otage ce qui venait après lui.
 *
 * AJOUTER : un jalon de plus, à la fin, dépendant de ce qui existe déjà. Rien d'existant n'est
 * invalidé — ajouter du travail n'est pas en remettre en cause.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function appliquerModification(
  user: CurrentUser,
  missionId: string,
  demande: DemandeModification,
): Promise<ResultatModification> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId: user.id, kind: "RUNTIME" },
    select: { id: true, status: true, goalRaw: true, objective: true },
  });
  if (!m) {
    return {
      fait: false, empreinte: null, jalonsRouverts: [], etapesInvalidees: [],
      message: "Mission introuvable — ou elle ne vous appartient pas.",
    };
  }
  if (["COMPLETED", "CANCELLED"].includes(m.status)) {
    return {
      fait: false, empreinte: null, jalonsRouverts: [], etapesInvalidees: [],
      message: `Une mission ${m.status === "COMPLETED" ? "terminée" : "arrêtée"} ne se modifie pas. `
        + `Ce qui a été fait reste fait ; pour aller plus loin, il faut une nouvelle mission.`,
    };
  }

  const graphe = await grapheModifiable(missionId);
  const empreinte = empreinteDeLaModification(demande, graphe);

  if (!empreinte.reconnue) {
    await journaliser(missionId, "MODIFICATION_REFUSEE", empreinte.resume,
      { genre: demande.genre, cible: demande.cible }, user.id);
    return { fait: false, empreinte, jalonsRouverts: [], etapesInvalidees: [], message: empreinte.resume };
  }

  if (demande.genre === "AJOUTER") {
    const ajoute = await ajouterJalon(missionId, demande);
    await journaliser(missionId, "MILESTONE_ADDED",
      `Un jalon s'ajoute — « ${ajoute.titre} » (rang ${ajoute.ordre}). ${empreinte.resume}`,
      { ordre: ajoute.ordre, titre: ajoute.titre }, user.id);
    return {
      fait: true, empreinte, jalonsRouverts: [ajoute.ordre], etapesInvalidees: [],
      message: `${empreinte.resume} Le jalon ${ajoute.ordre} sera compilé quand ce dont il dépend sera atteint.`,
    };
  }

  // ── CE QUI EST DÉJÀ PARTI NE SE REJOUE PAS ─────────────────────────────────────────────
  const irreversibles = new Set(empreinte.effetsIrreversibles);
  const aToucher = empreinte.aRecompiler.filter((k) => !irreversibles.has(k));

  if (demande.genre === "RETIRER") {
    await prisma.missionStep.updateMany({
      where: { missionId, key: { in: aToucher }, status: { notIn: ["DONE", "CANCELLED"] } },
      data: { status: "CANCELLED" },
    });
  } else {
    /**
     * REMPLACER / RAFRAÎCHIR : on RÉARME au lieu d'annuler.
     *
     * Statut, tentatives et motif repartent à zéro ; la CLÉ D'IDEMPOTENCE reste (§118.33), et
     * c'est ce qui empêche le doublon si l'étape avait échoué APRÈS avoir produit son effet.
     * Les étapes DONE dont l'effet est nommé irréversible sont exclues plus haut : on ne
     * réarme jamais un envoi parti.
     */
    await prisma.missionStep.updateMany({
      where: { missionId, key: { in: aToucher }, status: { not: "CANCELLED" } },
      data: {
        status: "PENDING", attempt: 0, error: null, errorKind: null,
        startedAt: null, completedAt: null, result: undefined,
      },
    });
  }

  // ── LES JALONS TOUCHÉS SONT ROUVERTS, ET EUX SEULS ─────────────────────────────────────
  const jalons = await prisma.missionMilestone.findMany({
    where: { missionId, ordre: { in: empreinte.jalonsTouches } },
    select: { id: true, ordre: true, titre: true },
  });
  for (const j of jalons) {
    if (demande.genre === "RETIRER") {
      /**
       * UN JALON DONT TOUT LE TRAVAIL EST RETIRÉ EST ÉCARTÉ, PAS ANNULÉ.
       *
       * `SKIPPED` libère sa descendance (`jalon.ts`), `CANCELLED` ne la libère pas. « Annule
       * uniquement le PowerPoint » ne doit pas figer l'envoi final qui portait aussi le
       * classeur : ce jalon-là n'a pas eu lieu, mais ce qui suivait garde ses entrées.
       */
      const restantes = await prisma.missionStep.count({
        where: { missionId, milestoneId: j.id, status: { notIn: ["CANCELLED"] }, supersededAt: null },
      });
      if (restantes === 0) await marquerJalon(j.id, "SKIPPED");
    } else {
      // REMIS À PENDING AVEC `planVersion: 0` : c'est la marque « pas encore compilé », donc la
      // frontière le reprendra et un sous-plan NEUF sera écrit — avec la nouvelle cible.
      // L'HISTOIRE DES MURS AUSSI : la demande a changé, les refus d'avant portaient sur une autre
      // demande, et les garder ferait refuser comme « déjà vu » un mur qui n'existe plus (§118.42).
      await marquerJalon(j.id, "PENDING", { planVersion: 0, dernierRefus: null, refusVus: null });
    }
  }

  /**
   * UNE MODIFICATION EST UNE INFORMATION NEUVE : elle rouvre le droit de replanifier (§118.42).
   * Et elle inscrit la nouvelle consigne dans l'objectif brut, pour que tout planificateur
   * ultérieur la lise — sinon le sous-plan suivant réécrirait exactement ce qu'on vient de
   * retirer, et la modification serait défaite par le tour d'après.
   */
  await prisma.mission.update({
    where: { id: missionId },
    data: {
      replanBloque: false, replanRefus: null,
      goalRaw: `${m.goalRaw || m.objective}\n\n[CONSIGNE DU ${new Date().toLocaleDateString("fr-FR")}] ${consigneDe(demande)}`,
    },
  });

  await journaliser(missionId, "MISSION_MODIFIED", empreinte.resume, {
    genre: demande.genre, cible: demande.cible, remplacant: demande.remplacant ?? null,
    visees: empreinte.visees, invalidees: aToucher,
    jalonsRouverts: empreinte.jalonsTouches, preservees: empreinte.preservees.length,
    effetsDejaProduits: empreinte.effetsIrreversibles,
  }, user.id);

  return {
    fait: true,
    empreinte,
    jalonsRouverts: empreinte.jalonsTouches,
    etapesInvalidees: aToucher,
    message: empreinte.resume,
  };
}

/** La consigne inscrite à l'objectif — courte, en français, lisible par un humain et un modèle. */
function consigneDe(d: DemandeModification): string {
  switch (d.genre) {
    case "REMPLACER":
      return `${d.remplacant ?? "quelqu'un d'autre"} remplace ${d.cible}. `
        + `Ne t'adresse plus à ${d.cible} et n'utilise plus ce qui venait de lui.`;
    case "RETIRER":
      return `${d.cible} n'est plus demandé : ne le produis pas, ne le livre pas.`;
    case "RAFRAICHIR":
      return `${d.cible} a changé depuis la dernière lecture : relis la source avant de t'en servir.`;
    default:
      return d.motif ?? d.cible;
  }
}

/**
 * AJOUTE UN JALON À LA FIN — dépendant de tout ce qui n'est pas encore atteint.
 *
 * Il dépend des jalons VIVANTS, pas de tous : le faire dépendre d'un jalon déjà écarté le
 * figerait pour toujours (`SKIPPED` libère, mais `CANCELLED` non — et un jalon annulé ne
 * libérera jamais). Sans dépendance vivante, il part tout de suite, ce qui est le bon
 * comportement pour « ajoute une analyse financière » sur une mission qui attend une réponse.
 */
async function ajouterJalon(
  missionId: string,
  demande: DemandeModification,
): Promise<{ ordre: number; titre: string }> {
  const existants = await prisma.missionMilestone.findMany({
    where: { missionId },
    select: { ordre: true, statut: true },
    orderBy: { ordre: "asc" },
  });
  const ordre = (existants.at(-1)?.ordre ?? 0) + 1;
  const vivants = existants.filter((j) => !["DONE", "SKIPPED", "CANCELLED"].includes(j.statut)).map((j) => j.ordre);
  const quoi = (demande.ajout ?? demande.cible).trim();
  await prisma.missionMilestone.create({
    data: {
      missionId, ordre,
      titre: quoi.slice(0, 200),
      resultat: `${quoi} — ce qui est demandé ici est produit et vérifiable.`,
      dependsOn: vivants,
    },
  });
  return { ordre, titre: quoi.slice(0, 200) };
}
