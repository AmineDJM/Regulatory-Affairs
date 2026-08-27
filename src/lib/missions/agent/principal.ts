import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/missions/runtime/store";
import type { MissionActor } from "@/lib/missions/ports";
import { refusPourActeur, messageRefus } from "@/lib/missions/policy/guard";
import type { Effect } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ D'ADAM QUAND IL AGIT (§29-30).
 *
 * ── CE QU'ELLE N'EST PAS : UN COMPTE DE PLUS ─────────────────────────────────────────────
 *
 * La tentation évidente est de créer un utilisateur « Adam » avec ses propres droits. Ce serait
 * une erreur, et pas une petite : ce compte aurait des pouvoirs PROPRES, indépendants de qui lui
 * parle, et la règle fondatrice de l'assistant — « ses pouvoirs sont ceux de son interlocuteur,
 * ni plus ni moins » — cesserait d'être vraie. Le jour où quelqu'un ouvrirait un module à ce
 * compte pour dépanner, il l'ouvrirait à tout le monde à travers Adam.
 *
 * ── CE QU'ELLE EST : UNE DOUBLE SIGNATURE ────────────────────────────────────────────────
 *
 * Adam agit SOUS les droits de la personne qui l'a mandaté. L'identité d'agent ne dit pas ce
 * qu'il peut faire — elle dit QUI A DEMANDÉ et QUI A EXÉCUTÉ. C'est la seule chose qui permet
 * de répondre, six mois plus tard, à « qui a envoyé ce mail ? » par « le PDG l'a demandé, Adam
 * l'a exécuté le 3 mars à 14 h 12, sous l'approbation VAL-441 » plutôt que par un nom seul.
 *
 * ── ET UNE CONTRAINTE, PAS UN PRIVILÈGE ──────────────────────────────────────────────────
 *
 * `isAgent: true` RETIRE des capacités : c'est ce drapeau que la politique lit pour refuser
 * toute auto-escalade (§29). Un acteur marqué agent ne peut ni modifier des permissions, ni
 * s'attribuer SUPER_ADMIN, ni toucher au RBAC, ni créer d'identifiants, ni désactiver un
 * garde-fou — quels que soient les droits de la personne sous laquelle il tourne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le nom sous lequel l'agent apparaît partout — journal, écran, audit. Une seule chaîne. */
export const ADAM_AGENT_NAME = "Adam";

/**
 * LE MANDAT — qui a demandé, sous quels droits, pour quelle mission.
 *
 * `initiatedBy` et `executedBy` peuvent différer et c'est le point : le PDG demande, Adam
 * exécute. Les confondre rendrait l'audit muet sur la question qui compte.
 */
export interface Mandat {
  /** L'humain qui a demandé. C'est LUI qui répond de la décision. */
  initiatedBy: string;
  /** Sous quels droits le travail se fait. En pratique, ceux de `initiatedBy`. */
  executedBy: string;
  label: string;
}

/**
 * L'ACTEUR AGENT — construit depuis un mandat humain, jamais depuis rien.
 *
 * Il n'existe pas de fonction qui rende un acteur agent sans mandat. C'est délibéré : un agent
 * sans mandataire serait un compte de service, avec des pouvoirs propres et personne pour en
 * répondre. Ici, il y a toujours quelqu'un derrière.
 */
export function agentPour(mandat: Mandat): MissionActor {
  return {
    userId: mandat.executedBy,
    label: `${ADAM_AGENT_NAME} (pour ${mandat.label})`,
    isAgent: true,
  };
}

/** L'acteur HUMAIN direct — quand la personne agit elle-même, sans passer par l'agent. */
export function humainPour(userId: string, label: string): MissionActor {
  return { userId, label, isAgent: false };
}

/**
 * LA VÉRIFICATION FINALE, JUSTE AVANT D'AGIR.
 *
 * ── POURQUOI DEUX FOIS ───────────────────────────────────────────────────────────────────
 *
 * Le compilateur a déjà refusé ces capacités à la compilation. Cette seconde vérification
 * existe pour le cas où une étape arriverait AUTREMENT que par un plan compilé — une reprise,
 * une réparation, un appel direct. Une garde qui ne vit qu'à un seul endroit protège tant que
 * personne n'ouvre un second chemin ; celle-ci protège aussi le second chemin.
 *
 * C'est le seul contrôle dupliqué du runtime, et la duplication est ici le but, pas un oubli.
 */
export function verifierAvantAgir(
  capability: string,
  effect: Effect,
  actor: MissionActor,
): { ok: true } | { ok: false; raison: string } {
  const refus = refusPourActeur(capability, effect, actor);
  return refus ? { ok: false, raison: messageRefus(refus) } : { ok: true };
}

/**
 * LA TRACE D'UNE ACTION DE MISSION (§30) — dans `MissionEvent`, pas ailleurs.
 *
 * ── POURQUOI PAS `AuditLog` ──────────────────────────────────────────────────────────────
 *
 * Parce que `AuditLog` est déjà écrit — par les ACTIONS CANONIQUES elles-mêmes, quand une
 * mission modifie l'ERP. Y ajouter une seconde ligne par étape donnerait deux entrées pour un
 * seul fait, et l'une des deux serait toujours la moins complète. Le raisonnement est exactement
 * celui du §17 sur le registre d'événements : on n'écrit pas deux fois la même histoire.
 *
 * `MissionEvent` porte déjà l'acteur, l'horodatage et un détail structuré. Ce qui manquait est
 * la DOUBLE SIGNATURE — qui a demandé, qui a exécuté — et c'est ce que cette fonction ajoute.
 *
 * Les erreurs sont avalées, comme pour le registre d'événements : ne pas pouvoir écrire la
 * trace ne doit pas empêcher le travail. Mais elles sont journalisées, parce qu'un audit
 * silencieusement absent est un audit qu'on croit avoir.
 */
export async function tracerAction(opts: {
  mandat: Mandat;
  missionId: string;
  stepKey: string;
  capability: string;
  receipt?: string | null;
}): Promise<void> {
  try {
    await journaliser(
      opts.missionId,
      "ACTION_TRACED",
      `${opts.capability} — demandé par ${opts.mandat.label}, exécuté par ${ADAM_AGENT_NAME}.`,
      {
        // LES TROIS CHAMPS QUE §30 EXIGE, nommés tels quels pour être cherchables.
        initiatedBy: opts.mandat.initiatedBy,
        executedBy: `${ADAM_AGENT_NAME}:${opts.mandat.executedBy}`,
        missionId: opts.missionId,
        stepKey: opts.stepKey,
        capability: opts.capability,
        ...(opts.receipt ? { receipt: opts.receipt } : {}),
      },
      // L'ACTEUR DU JOURNAL EST L'HUMAIN QUI A DEMANDÉ. C'est lui qui répond de la décision ;
      // Adam n'est que la main. Inscrire Adam ici rendrait le journal inexploitable le jour où
      // l'on cherche « ce que le PDG a lancé ».
      opts.mandat.initiatedBy,
    );
  } catch (err) {
    console.error("[missions] trace d'action impossible", opts.missionId, opts.stepKey, err);
  }
}

/**
 * CE QU'ADAM A FAIT POUR QUELQU'UN — la question qu'on pose quand on doute.
 *
 * Filtrée sur le PROPRIÉTAIRE de la mission : on ne lit que ses propres traces. Le cloisonnement
 * vaut aussi pour l'audit, sans quoi il suffirait de demander à Adam ce qu'il a fait pour les
 * autres.
 */
export async function tracesPour(initiatedBy: string, missionId?: string, limite = 50) {
  return prisma.missionEvent.findMany({
    where: {
      kind: "ACTION_TRACED",
      actorId: initiatedBy,
      mission: { ownerId: initiatedBy },
      ...(missionId ? { missionId } : {}),
    },
    select: { id: true, missionId: true, summary: true, detail: true, at: true },
    orderBy: { at: "desc" },
    take: limite,
  });
}
