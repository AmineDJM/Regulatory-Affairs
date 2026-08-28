import { prisma } from "@/lib/prisma";
import { getAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { attentesEchues, missionsAFaireAvancer } from "@/lib/missions/events/router";
import { journaliser } from "@/lib/missions/runtime/store";
import { prevenir } from "@/lib/missions/approval/gate";
import { avancerMission, replanifierMission } from "@/platform/in-process/missions/runtime";

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

/**
 * RECONSTRUIT L'UTILISATEUR à partir de son compte — sans session, puisqu'il n'y en a pas.
 *
 * Les DROITS sont relus en base (`getAccess`), jamais supposés : une mission lancée le lundi par
 * quelqu'un dont on a fermé un module le mardi ne doit pas continuer à s'en servir le mercredi.
 * C'est la propriété qui rend un balayage sans session acceptable.
 */
async function proprietaire(userId: string): Promise<CurrentUser | null> {
  const u = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!u) return null;
  const access = await getAccess(u.id, u.role);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: access.role ?? u.role,
    secondaryRole: access.secondaryRole,
    access,
    mustChangePassword: false,
  };
}

/**
 * FAIT AVANCER LES MISSIONS QUI PEUVENT AVANCER.
 *
 * Ne lève jamais : une mission qui plante ne doit pas emporter le battement, ni les onze autres.
 */
export async function balayerMissions(): Promise<BalayageMissions> {
  const out: BalayageMissions = { examinees: 0, avancees: 0, etapesExecutees: 0, relances: 0, replanifiees: 0 };
  if ((process.env.MISSIONS_SWEEP ?? "").toLowerCase() === "off") return out;

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
        select: { id: true, ownerId: true },
      }).catch(() => [] as { id: string; ownerId: string }[])
    : [];

  const cache = new Map<string, CurrentUser | null>();
  for (const m of missions) {
    out.examinees += 1;
    try {
      if (!cache.has(m.ownerId)) cache.set(m.ownerId, await proprietaire(m.ownerId));
      const user = cache.get(m.ownerId);
      if (!user) continue;

      const r = await avancerMission(user, m.id, { maxTours: TOURS_PAR_MISSION });
      if (r && (r.executees > 0 || r.deployees > 0)) {
        out.avancees += 1;
        out.etapesExecutees += r.executees;
      }

      // ── LE PLAN NE PASSE PLUS : ON EN ÉCRIT UN AUTRE (§39-40) ──────────────────────
      //
      // Seulement quand le moteur a épuisé ce qu'il savait faire — réessayer, réparer — et que
      // la mission s'est arrêtée en échec ou bloquée. Replanifier plus tôt jetterait un plan qui
      // marchait pour un incident passager ; ne jamais replanifier laisserait la mission morte
      // sur une étape que le planificateur savait contourner.
      //
      // `replanifierMission` porte ses propres garde-fous : quatre plans au maximum, et tout ce
      // que le nouveau plan ajoute repasse par l'accord de la personne (§8). Le battement
      // n'ouvre donc aucune porte — il ne fait que ne pas abandonner.
      const apres = await prisma.mission.findUnique({ where: { id: m.id }, select: { status: true } });
      if (apres && (apres.status === "FAILED" || apres.status === "BLOCKED")) {
        const rp = await replanifierMission(user, m.id).catch(() => null);
        if (rp?.replanifie) {
          out.replanifiees += 1;
          await avancerMission(user, m.id, { maxTours: TOURS_PAR_MISSION }).catch(() => null);
        }
      }
    } catch (e) {
      console.error(`[missions] avancement de ${m.id} échoué`, e);
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
      if (dejaDit) continue;

      await journaliser(e.missionId, "OVERDUE",
        `L'attente « ${e.stepTitle} » a dépassé son échéance.`, { stepKey: e.stepKey });
      await prevenir({
        missionId: e.missionId,
        ownerId: e.ownerId,
        niveau: "IMPORTANT",
        titre: `En attente depuis trop longtemps — ${e.missionTitle}`,
        message: `« ${e.stepTitle} » attend toujours. Voulez-vous relancer ?`,
      });
      out.relances += 1;
    }
  } catch (e) {
    console.error("[missions] balayage des attentes échues échoué", e);
  }

  return out;
}
