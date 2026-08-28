import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { compile } from "@/lib/missions/compiler/compile";
import { planifier, type ContextePlanification, type MetriquesPlanification } from "@/lib/missions/planner/plan";
import { materialiser, chargerEtat, journaliser } from "@/lib/missions/runtime/store";
import { avancer, type EngineDeps, type StepContext, type StepOutcome } from "@/lib/missions/runtime/engine";
import { executerWorker } from "@/lib/missions/runtime/worker";
import { executerArtefact } from "@/lib/missions/artifacts/build";
import { controleComplet } from "@/lib/missions/goal/qa";
import { JugeReel } from "@/lib/missions/goal/judge";
import { perimetre } from "@/lib/missions/approval/scope";
import { demanderApprobation, porteApprobation, prevenir } from "@/lib/missions/approval/gate";
import { agentPour } from "@/lib/missions/agent/principal";
import { CONCURRENCE_PAR_ECHELLE } from "@/lib/missions/model/roles";
import type { CompileIssue } from "@/lib/missions/planner/contract";
import type { Reasoner } from "@/lib/missions/ports";
import type { ArtifactSink } from "@/lib/missions/artifacts/build";
import { acteurDe, catalogueDe } from "@/platform/in-process/missions/catalog";
import { raisonneur } from "@/platform/in-process/missions/reasoner";
import { ExecutantReel } from "@/platform/in-process/missions/runner";
import { depotDrive } from "@/platform/in-process/missions/sink";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE COMPOSEUR — l'endroit, et le seul, où Adam et le Mission Runtime se rencontrent.
 *
 * ── POURQUOI UN COMPOSEUR PLUTÔT QUE DES BRANCHEMENTS ÉPARPILLÉS ────────────────────────
 *
 * Le runtime ne connaît ni les outils, ni les modèles, ni le Drive : il déclare des ports. Ces
 * ports doivent bien être remplis quelque part. S'ils l'étaient à trois endroits — la route
 * HTTP, l'ordonnanceur, le webhook — on aurait trois assemblages, dont deux finiraient par
 * différer : un gestionnaire oublié ici, un juge absent là. Et un juge absent, c'est une
 * mission qui ne conclut jamais ; un gestionnaire d'artefact absent, c'est un fichier qui
 * n'existe pas alors que l'écran dit qu'il est prêt.
 *
 * Il y a donc UNE fonction qui assemble, et tous les appelants passent par elle.
 *
 * ── CE QUI EST BRANCHÉ, ET CE QUE CHACUN APPORTE ────────────────────────────────────────
 *
 *   catalogue   ce que cette personne a le droit de faire — la même liste qu'en conversation ;
 *   exécutant   le chemin canonique d'écriture, avec RBAC, intent, reçu et idempotence ;
 *   raisonneur  la passerelle modèle, en sorties structurées strictes ;
 *   WORKER      un exécutant éphémère par étape de réflexion ;
 *   QA          le contrôle arithmétique — cardinalité, destinataires, reçus, doublons ;
 *   ARTIFACT    la fabrique de fichiers, contrôlés avant d'être rangés ;
 *   APPROVAL    la porte d'accord, fermée par défaut ;
 *   juge        celui sans qui la mission ne conclut PAS.
 *
 * Les gestionnaires d'attente (`WAIT_EVENT`, `WAIT_INPUT`) ne sont volontairement PAS branchés :
 * le comportement natif du moteur — attendre — est exactement le bon, et le routeur
 * d'événements réveille la mission de l'extérieur. Y mettre un gestionnaire qui « vérifie si
 * l'événement est arrivé » recréerait une scrutation là où il y a déjà une notification.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface AssemblageMission {
  deps: EngineDeps;
  juge: JugeReel;
}

export interface OptionsAssemblage {
  complexite?: "A" | "B" | "C";
  /** Le raisonneur. Par défaut le VRAI, qui appelle la passerelle modèle. */
  reasoner?: Reasoner;
  /** Où déposer les livrables. Par défaut le Drive. */
  sink?: ArtifactSink;
}

/**
 * ASSEMBLE LE MOTEUR POUR UNE PERSONNE.
 *
 * L'acteur est l'AGENT (`isAgent: true`) et non la personne : c'est ce qui active l'interdit
 * structurel d'auto-escalade (`policy/guard.ts`). La personne reste l'initiatrice, et ses
 * droits restent la borne — l'agent ne peut jamais faire PLUS qu'elle, seulement moins.
 */
export function assembler(user: CurrentUser, opts: OptionsAssemblage = {}): AssemblageMission {
  const catalogue = catalogueDe(user);
  const runner = new ExecutantReel(user);
  // LE RAISONNEUR EST INJECTABLE, et le défaut est le VRAI. Ce n'est pas une couture pour les
  // tests : c'est la seule dépendance du composeur qui traverse le réseau, donc la seule qu'un
  // banc d'essai puisse vouloir remplacer sans rien changer d'autre. Tout le reste — catalogue,
  // exécutant, dépôt, moteur, contrôle, juge — reste celui de la production, y compris sous test.
  const cerveau = opts.reasoner ?? raisonneur;
  const juge = new JugeReel(cerveau, opts.complexite ?? "B");

  const deps: EngineDeps = {
    runner,
    catalog: catalogue,
    juge,
    handlers: {
      WORKER: (ctx) => executerWorker(ctx, { reasoner: cerveau }),
      QA: (ctx) => controleQualite(ctx),
      ARTIFACT: (ctx) => executerArtefact(ctx, { reasoner: cerveau, sink: opts.sink ?? depotDrive }),
      APPROVAL: porteApprobation(null, ""),
    },
  };
  return { deps, juge };
}

/**
 * LE NŒUD `QA` — arithmétique, bloquant, et qui NOMME ce qui cloche.
 *
 * Il rend `DONE` quand tout passe et `FAILED` sinon. Le `FAILED` est NON REJOUABLE à dessein :
 * relancer le contrôle sans avoir rien réparé donnerait le même résultat, et la mission
 * tournerait en rond en consommant ses tentatives. C'est la RÉPARATION des étapes manquantes
 * qui débloque, pas l'insistance sur le contrôle.
 */
async function controleQualite(ctx: StepContext): Promise<StepOutcome> {
  const etat = await chargerEtat(ctx.mission.id);
  if (!etat) return { status: "FAILED", error: "mission introuvable", errorKind: "INVALID_STEP", retryable: false };

  const rapport = await controleComplet(etat);
  await journaliser(ctx.mission.id, "QA", rapport.resume, {
    stepKey: ctx.step.key,
    ok: rapport.ok,
    constats: rapport.constats.map((c) => ({ controle: c.controle, ok: c.ok, message: c.message })),
  });

  if (rapport.ok) return { status: "DONE", result: rapport };
  return {
    status: "FAILED",
    error: rapport.resume,
    errorKind: "QA_FAILED",
    retryable: false,
  };
}

export interface LancementOptions extends OptionsAssemblage {
  /** Le contexte que l'appelant connaît : contraintes, working set, mémoire, politiques. */
  contexte?: ContextePlanification;
  /** Un titre pour l'écran. Déduit de l'objectif s'il est absent. */
  titre?: string;
  /** Faire tourner la mission immédiatement après l'avoir créée. */
  demarrer?: boolean;
}

export type ResultatLancement =
  | {
      ok: true;
      missionId: string;
      titre: string;
      /** Le nombre d'étapes compilées — celles écrites, pas celles qui naîtront de l'éventail. */
      etapes: number;
      complexite: string;
      echelle: string;
      /** L'accord demandé, quand la mission produit des effets qui en exigent un. */
      approbation: { id: string; niveau: string; resume: string } | null;
      metriques: MetriquesPlanification;
      gaps: string[];
    }
  | { ok: false; error: string; refus?: CompileIssue[]; metriques?: MetriquesPlanification };

const titreDe = (objectif: string): string => {
  const t = objectif.replace(/\s+/g, " ").trim();
  return t.length <= 90 ? t : `${t.slice(0, 87)}…`;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LANCER UNE MISSION DEPUIS UNE PHRASE — le chemin complet, sans plan écrit à la main.
 *
 *   texte → résolution des capacités → PLANNER (modèle) → COMPILATEUR → base → accord → moteur
 *
 * Le compilateur peut refuser. Dans ce cas on RENVOIE ses refus au planner, une fois : ils
 * nomment l'étape et la règle violée, ce qui est exactement ce dont un correcteur a besoin.
 * Une seule reprise — au-delà, le modèle ne corrige plus, il reformule, et l'on paie deux fois
 * pour découvrir la même chose.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function lancerMission(
  user: CurrentUser,
  objectif: string,
  opts: LancementOptions = {},
): Promise<ResultatLancement> {
  const catalogue = catalogueDe(user);
  const acteur = acteurDe(user);
  const cerveau = opts.reasoner ?? raisonneur;
  const contexte: ContextePlanification = {
    aujourdhui: new Date().toLocaleDateString("fr-FR"),
    ...opts.contexte,
  };

  let plan = await planifier(objectif, catalogue, acteur, cerveau, { contexte });
  if (!plan.ok) return { ok: false, error: plan.error, metriques: plan.metriques };

  // L'ACTEUR DE COMPILATION EST L'AGENT : c'est lui qui exécutera, donc c'est SA politique qui
  // doit refuser une étape d'auto-escalade. Compiler sous l'identité humaine laisserait passer
  // une étape que l'agent n'a pas le droit d'exécuter, et l'échec arriverait à l'exécution.
  const agent = agentPour({ initiatedBy: user.id, executedBy: user.id, label: user.name });
  let compile1 = compile(plan.plan, catalogue, agent);

  if (!compile1.ok) {
    const secondEssai = await planifier(objectif, catalogue, acteur, cerveau, {
      contexte: { ...contexte, refusPrecedent: compile1.issues.map((i) => `[${i.code}] ${i.stepKey ?? "plan"} : ${i.message}`) },
    });
    if (!secondEssai.ok) {
      return { ok: false, error: secondEssai.error, refus: compile1.issues, metriques: secondEssai.metriques };
    }
    plan = secondEssai;
    compile1 = compile(plan.plan, catalogue, agent);
    if (!compile1.ok) {
      return {
        ok: false,
        error: `le plan proposé reste refusé après correction : ${compile1.issues.map((i) => i.message).join(" ; ")}`,
        refus: compile1.issues,
        metriques: plan.metriques,
      };
    }
  }

  const mission = compile1.mission;
  const titre = opts.titre ?? titreDe(mission.objective || objectif);
  const missionId = await materialiser(mission, {
    ownerId: user.id,
    title: titre,
    goalRaw: objectif,
    maxConcurrency: CONCURRENCE_PAR_ECHELLE[mission.scale],
  });

  await journaliser(missionId, "CREATED",
    `Mission planifiée : ${mission.steps.length} étapes, complexité ${mission.complexity}, échelle ${mission.scale}.`,
    {
      capacitesMontrees: plan.metriques.plannerCapabilitiesExposed,
      capacitesOuvertes: plan.metriques.capacitesAutorisees,
      domaines: plan.metriques.domaines,
      role: plan.metriques.role,
      latencyMs: plan.metriques.latencyMs,
      gaps: mission.gaps,
    });

  // ── L'ACCORD (§32-33) — un pour un lot cohérent, jamais quatre-vingt-dix-neuf ─────────
  const p = perimetre(mission);
  let approbation: { id: string; niveau: string; resume: string } | null = null;
  if (p) {
    const id = await demanderApprobation(missionId, p, user.id, titre);
    approbation = { id, niveau: p.niveau, resume: p.resume };
    await prevenir({
      missionId, ownerId: user.id, niveau: "APPROVAL_REQUIRED",
      titre: `Votre accord est demandé — ${titre}`,
      message: p.resume,
    });
  }

  if (opts.demarrer !== false) {
    await avancerMission(user, missionId, { ...opts, complexite: mission.complexity });
  }

  return {
    ok: true,
    missionId,
    titre,
    etapes: mission.steps.length,
    complexite: mission.complexity,
    echelle: mission.scale,
    approbation,
    metriques: plan.metriques,
    gaps: mission.gaps,
  };
}

/**
 * FAIT AVANCER UNE MISSION — le point d'entrée de l'ordonnanceur, du routeur d'événements,
 * de l'écran et de la conversation.
 *
 * Réentrant : deux appels concurrents se disputent les étapes par réservation en base. C'est ce
 * qui permet à l'ordonnanceur et à l'utilisateur de cliquer en même temps sans dommage.
 */
export async function avancerMission(
  user: CurrentUser,
  missionId: string,
  opts: OptionsAssemblage & { maxTours?: number } = {},
) {
  const proprietaire = await prisma.mission.findFirst({
    where: { id: missionId, ownerId: user.id },
    select: { id: true, complexity: true },
  });
  // LE CLOISONNEMENT EST ICI, PAS PLUS LOIN : une mission qui n'appartient pas à la personne
  // n'avance pas, quels que soient ses droits par ailleurs. La mission porte les droits de son
  // propriétaire ; la faire avancer sous quelqu'un d'autre les emprunterait.
  if (!proprietaire) return null;

  const { deps } = assembler(user, {
    ...opts,
    complexite: opts.complexite ?? (proprietaire.complexity as "A" | "B" | "C" | null) ?? "B",
  });
  const agent = agentPour({ initiatedBy: user.id, executedBy: user.id, label: user.name });
  return avancer(missionId, agent, { ...deps, maxTours: opts.maxTours });
}
