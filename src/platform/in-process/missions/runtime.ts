import { prisma } from "@/lib/prisma";
import { PLANNER_PROMPT_VERSION } from "@/lib/missions/planner/plan";
import { prechargerCapacitesDynamiques } from "@/platform/in-process/skills";
import { assurerFormes } from "@/platform/in-process/missions/formes";
import type { CurrentUser } from "@/lib/session";
import { compile } from "@/lib/missions/compiler/compile";
import { planifier, type ContextePlanification, type MetriquesPlanification } from "@/lib/missions/planner/plan";
import { materialiser, chargerEtat, journaliser, transitionner } from "@/lib/missions/runtime/store";
import { avancer, type EngineDeps, type StepContext, type StepOutcome } from "@/lib/missions/runtime/engine";
import { executerWorker } from "@/lib/missions/runtime/worker";
import { executerArtefact } from "@/lib/missions/artifacts/build";
import { controleComplet } from "@/lib/missions/goal/qa";
import { JugeReel } from "@/lib/missions/goal/judge";
import { perimetre } from "@/lib/missions/approval/scope";
import { demanderApprobation, porteApprobation, reouvrirSiChange } from "@/lib/missions/approval/gate";
import { agentPour } from "@/lib/missions/agent/principal";
import { assurerCompteAgent } from "@/lib/missions/agent/account";
import { CONCURRENCE_PAR_ECHELLE } from "@/lib/missions/model/roles";
import type { CompileIssue } from "@/lib/missions/planner/contract";
import type { Reasoner } from "@/lib/missions/ports";
import type { ArtifactSink } from "@/lib/missions/artifacts/build";
import { acteurDe, catalogueDe } from "@/platform/in-process/missions/catalog";
import { raisonneur } from "@/platform/in-process/missions/reasoner";
import { withTurn, setTurnContext } from "@/lib/models/telemetry";
import { ExecutantReel } from "@/platform/in-process/missions/runner";
import { depotDrive } from "@/platform/in-process/missions/sink";
import { registreRecoursDe } from "@/platform/in-process/missions/recovery-registry";
import { enqueter, resumerSituation } from "@/platform/in-process/missions/situation";
import { porteAttentionPour } from "@/platform/in-process/missions/attention";

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
  /**
   * LECTURE SEULE — le catalogue est plafonné à `ANALYZE` (§ `OptionsCatalogue.effetMax`).
   *
   * Aucune capacité qui écrit, communique, engage ou détruit n'entre dans la liste que le
   * planner voit et que le compilateur consulte. Ce n'est donc pas une consigne donnée au
   * modèle — qu'un document lu en cours de route pourrait contredire — mais l'ABSENCE de
   * l'outil. Le diagnostic fournisseur s'en sert pour prouver la chaîne sans rien toucher.
   *
   * PORTÉE : les TROIS chemins qui construisent un catalogue — `lancerMission` (planification),
   * `assembler` (exécution) et `replanifierMission` (nouveau plan).
   *
   * Le troisième a d'abord été laissé de côté, au motif que le diagnostic ne replanifiait pas.
   * Le premier run réel l'a démenti : une mission qui n'atteint pas son objectif passe par la
   * replanification canonique, et sans plafond ce nouveau plan repartirait du catalogue COMPLET.
   * Le trou n'était pas théorique — il s'ouvrait exactement là où la mission a le plus de
   * latitude. Une garantie qui s'arrête au premier plan n'est pas une garantie.
   */
  lectureSeule?: boolean;
}

/**
 * ASSEMBLE LE MOTEUR POUR UNE PERSONNE.
 *
 * L'acteur est l'AGENT (`isAgent: true`) et non la personne : c'est ce qui active l'interdit
 * structurel d'auto-escalade (`policy/guard.ts`). La personne reste l'initiatrice, et ses
 * droits restent la borne — l'agent ne peut jamais faire PLUS qu'elle, seulement moins.
 */
export function assembler(user: CurrentUser, opts: OptionsAssemblage = {}): AssemblageMission {
  const catalogue = catalogueDe(user, opts.lectureSeule ? { effetMax: "ANALYZE" } : {});
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
    // CE QUI REND « ESSAIE AILLEURS » EXÉCUTABLE. Sans lui, le barreau `AUTRE_SOURCE` n'a
    // aucune capacité de remplacement à proposer et se saute — l'échelle descend alors vers ce
    // qui agit réellement, au lieu de rejouer le même appel sous un autre nom.
    registre: registreRecoursDe(user, opts.lectureSeule ? { effetMax: "ANALYZE" } : {}),
    // LA PORTE D'ATTENTION : c'est par elle que la conclusion, le blocage ou l'échec d'une
    // mission parviennent au dirigeant — niveau, cadence et canaux décidés par la politique.
    attention: porteAttentionPour(),
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
  /** Matérialiser DANS cette mission existante (le talon d'un lancement en arrière-plan). */
  missionId?: string;
  /** Sauter l'enquête (bancs qui mesurent le planificateur seul). Jamais en production. */
  sansEnquete?: boolean;
}

/**
 * UNE PANNE TRANSITOIRE DU FOURNISSEUR N'EST PAS UN REFUS. « HTTP 502 upstream request failed »,
 * un délai dépassé, une coupure réseau, une limite de débit : la demande était bonne, c'est le
 * réseau qui a lâché. La perdre — « la mission n'a PAS été lancée » — serait faire payer au
 * dirigeant une panne qu'il ne voit pas. On la classe pour la RETENIR au lieu de la refuser.
 */
export function estPanneTransitoire(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\bHTTP (5\d\d|408|425|429)\b|upstream|timeout|timed out|d[ée]lai d[ée]pass[ée]|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|fetch failed|rate.?limit|overloaded|temporarily|indisponible|unavailable/i.test(message);
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
      /**
       * VRAI quand le fournisseur a lâché pendant la planification : la mission est ENREGISTRÉE
       * (talon PLANNING, le battement reprendra), pas encore planifiée. `etapes` vaut 0.
       */
      differe?: boolean;
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
/**
 * CHAQUE ENTRÉE DU RUNTIME OUVRE UN TOUR MESURÉ (« background ») et le signe : personne, mission,
 * usage. C'est ce qui donne un coût PAR MISSION dans `ModelCallLog` — le planificateur, les
 * workers, le juge et l'artefact y rattachent leurs appels sans rien savoir de la base. Un tour
 * déjà ouvert (une mission lancée depuis la conversation) est REJOINT, et le contexte s'y ajoute.
 */
/**
 * LE RÔLE DE PLANIFICATION PEUT ÊTRE FORCÉ PAR L'EXPLOITATION (`ADAM_PLANNER_ROLE`) — pour
 * mesurer un modèle plus rapide sur le banc, jamais par confort. Absent : la politique des rôles.
 *
 * Il s'applique à TOUTES les planifications d'une mission — la première, la reprise après refus
 * du compilateur, la replanification. Mesuré : forcé sur la première seule, la reprise repartait
 * au rôle par défaut, dont l'appel dépassait la coupure du mandataire ; deux missions sur neuf
 * mouraient « non lancées » pour une raison qui n'avait rien à voir avec leur plan.
 */
function roleForcePlanification(): { role?: string } {
  const role = (process.env.ADAM_PLANNER_ROLE ?? "").trim();
  return role ? { role } : {};
}

/** La personne qui demande, telle que le planificateur doit la nommer pour lui écrire. */
const demandeurDe = (u: Pick<CurrentUser, "name" | "email">): string => (u.email ? `${u.name} <${u.email}>` : u.name);

export function lancerMission(
  user: CurrentUser,
  objectif: string,
  opts: LancementOptions = {},
): Promise<ResultatLancement> {
  return withTurn("background", async () => {
    setTurnContext({ userId: user.id, feature: "mission" });
    await prechargerCapacitesDynamiques(user).catch(() => 0);
    await assurerFormes();
    return lancerMissionInterne(user, objectif, opts);
  });
}

async function lancerMissionInterne(
  user: CurrentUser,
  objectif: string,
  opts: LancementOptions = {},
): Promise<ResultatLancement> {
  // L'ESPACE D'ADAM EXISTE AVANT SA PREMIÈRE MISSION, et se répare s'il a dérivé. Appelé ici
  // plutôt qu'au démarrage : c'est le seul point par lequel une mission commence, et une
  // réparation qui ne tourne qu'au démarrage ne corrige rien entre deux déploiements.
  const espace = await assurerCompteAgent();
  if (espace && espace.corrections.length > 0) {
    console.warn(`[agent] espace d'Adam réaligné : ${espace.corrections.join(" ; ")}`);
  }

  const catalogue = catalogueDe(user, opts.lectureSeule ? { effetMax: "ANALYZE" } : {});
  const acteur = acteurDe(user);
  const cerveau = opts.reasoner ?? raisonneur;
  // LES FORMES ÉPROUVÉES (§64) — une indication murmurée au planner, chargée ICI parce que
  // c'est le côté qui possède la base. Une liste vide est la réponse normale d'un système jeune.
  const formesValidees = opts.contexte?.formesValidees
    ?? await import("@/lib/missions/planner/patterns").then((m) => m.indicesDeFormes()).catch(() => []);
  // ── L'ENQUÊTE AVANT LE PLAN ─────────────────────────────────────────────────────────────
  //
  // Le code établit la situation (entités reconnues, fiches, changements, documents, engagements)
  // avec les droits de la personne, et le planificateur planifie à partir de faits. Sous délai :
  // une enquête qui traîne rend ce qu'elle a, et une enquête qui échoue rend `null` — le plan
  // part alors comme avant, et le journal le dit.
  const situation = opts.sansEnquete || opts.contexte?.situation
    ? opts.contexte?.situation ?? null
    : await enqueter(user, objectif).catch(() => null);
  // ── LES RÈGLES ENSEIGNÉES (Teach Adam, §119) ────────────────────────────────────────
  //
  // Ce que la personne et sa société ont appris à Adam entre DANS le contexte du planificateur
  // (`politiques`), avec ce que l'appelant savait déjà. Composé par le code, sous budget, jamais
  // accumulé : la même règle ne s'y répète pas d'un plan à l'autre.
  const politiquesEnseignees = await import("@/platform/in-process/teach/store")
    .then((m) => m.politiquesPourMission(user.id))
    .catch(() => [] as string[]);
  const contexte: ContextePlanification = {
    aujourdhui: new Date().toLocaleDateString("fr-FR"),
    ...opts.contexte,
    ...(situation ? { situation } : {}),
    ...(formesValidees.length > 0 ? { formesValidees } : {}),
    ...(politiquesEnseignees.length > 0 || opts.contexte?.politiques?.length
      ? { politiques: [...(opts.contexte?.politiques ?? []), ...politiquesEnseignees.filter((p) => !(opts.contexte?.politiques ?? []).includes(p))] }
      : {}),
    demandeur: demandeurDe(user),
  };

  let plan = await planifier(objectif, catalogue, acteur, cerveau, {
    ...roleForcePlanification(),
    contexte,
    // LE RETRIEVAL SPÉCULATIF (§65) : pendant que le modèle planifie (des secondes), on
    // préchauffe l'annuaire sur les noms propres de l'objectif — des LECTURES, dont le résultat
    // est jeté : le gain est le cache de Postgres et le pool déjà chauds quand la première
    // étape de la mission lit pour de vrai. Ne retient jamais le plan (course, pas jointure).
    speculation: async (but) => {
      const debut = Date.now();
      const noms = [...new Set(
        (but.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{2,}\b/g) ?? [])
          .filter((n) => !["Les", "Une", "Des", "Adam", "Envoie", "Fais", "Puis", "Pour", "Avec", "Dans", "Chaque"].includes(n))
          .slice(0, 4),
      )];
      if (noms.length === 0) return [];
      const lectures = await Promise.all(noms.map(async (nom) => {
        const t0 = Date.now();
        await prisma.user.findMany({
          where: { isActive: true, name: { contains: nom, mode: "insensitive" } },
          select: { id: true },
          take: 3,
        }).catch(() => []);
        return { libelle: `annuaire:${nom}`, ms: Date.now() - t0 };
      }));
      return [{ libelle: `total:${noms.length} noms`, ms: Date.now() - debut }, ...lectures];
    },
  });
  if (!plan.ok) {
    // ── LE REPLI : UNE PANNE TRANSITOIRE RETIENT LA DEMANDE AU LIEU DE LA PERDRE ────────
    //
    // Sans talon déjà écrit (lancement direct), on en écrit un : la mission existe en base dès
    // maintenant, PLANNING sans étape, et le battement la reprendra comme un lancement détaché
    // (`rattraperLancementsPerdus`). Avec un talon (finalisation différée), l'appelant décide.
    if (!opts.missionId && estPanneTransitoire(plan.error)) {
      const titre = opts.titre ?? titreDe(objectif);
      const talon = await creerTalon(user, objectif, titre);
      if (talon) {
        await journaliser(talon, "PLANNING_DEFERRED",
          `Le fournisseur de modèle a lâché pendant la planification (${plan.error.slice(0, 120)}) : la demande est retenue, la planification reprendra au prochain battement.`,
          { transitoire: true });
        return {
          ok: true, missionId: talon, titre, etapes: 0,
          complexite: "?", echelle: "?", approbation: null, metriques: plan.metriques, gaps: [], differe: true,
        };
      }
    }
    return { ok: false, error: plan.error, metriques: plan.metriques };
  }

  // L'ACTEUR DE COMPILATION EST L'AGENT : c'est lui qui exécutera, donc c'est SA politique qui
  // doit refuser une étape d'auto-escalade. Compiler sous l'identité humaine laisserait passer
  // une étape que l'agent n'a pas le droit d'exécuter, et l'échec arriverait à l'exécution.
  const agent = agentPour({ initiatedBy: user.id, executedBy: user.id, label: user.name });
  /**
   * LE PLAFOND SUIT LA MISSION JUSQU'AU COMPILATEUR.
   *
   * `lectureSeule` plafonnait le CATALOGUE, donc les capacités — et rien d'autre. Un nœud
   * ARTIFACT, qui n'a pas de capacité, passait au travers et écrivait un fichier dans le Drive
   * pendant que le rapport annonçait « lecture seule ». Le plafond porte maintenant sur l'effet
   * de l'étape, quelle que soit sa nature.
   */
  const plafond = opts.lectureSeule ? { effetMax: "ANALYZE" as const } : {};
  let compile1 = compile(plan.plan, catalogue, agent, plafond);

  if (!compile1.ok) {
    const secondEssai = await planifier(objectif, catalogue, acteur, cerveau, {
      ...roleForcePlanification(),
      contexte: { ...contexte, refusPrecedent: compile1.issues.map((i) => `[${i.code}] ${i.stepKey ?? "plan"} : ${i.message}`) },
    });
    if (!secondEssai.ok) {
      return { ok: false, error: secondEssai.error, refus: compile1.issues, metriques: secondEssai.metriques };
    }
    plan = secondEssai;
    compile1 = compile(plan.plan, catalogue, agent, plafond);
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
    // L'OBSERVABILITÉ (§33) : quelle version de consigne a planifié, quelles règles enseignées elle a lues.
    planMetaExtra: { promptVersion: PLANNER_PROMPT_VERSION, politiques: contexte.politiques ?? [] },
    maxConcurrency: CONCURRENCE_PAR_ECHELLE[mission.scale],
    ...(opts.missionId ? { missionId: opts.missionId } : {}),
  });
  setTurnContext({ missionId });
  if (situation) {
    await journaliser(missionId, "INVESTIGATED", resumerSituation(situation), {
      entites: situation.entites.slice(0, 8).map((e) => `${e.type}:${e.label}`),
      faits: situation.faits.length,
      domaines: situation.domaines,
      sources: situation.couverture.sources,
      enEchec: situation.couverture.enEchec,
      ms: situation.couverture.ms,
    });
  }
  await journaliser(missionId, "CREATED",
    `Mission planifiée : ${mission.steps.length} étapes, complexité ${mission.complexity}, échelle ${mission.scale}.`,
    {
      // LE COÛT DE LA PLANIFICATION SUIT LA MISSION : l'appel est parti avant que la mission ait
      // un identifiant, il ne porte donc pas le sien dans le journal des appels. Ses jetons sont
      // écrits ici, là où le banc et l'écran les relisent.
      usage: plan.metriques.usage,
      voie: plan.metriques.voie,
      enquete: situation ? { faits: situation.faits.length, ms: situation.couverture.ms } : null,
      capacitesMontrees: plan.metriques.plannerCapabilitiesExposed,
      capacitesOuvertes: plan.metriques.capacitesAutorisees,
      domaines: plan.metriques.domaines,
      role: plan.metriques.role,
      latencyMs: plan.metriques.latencyMs,
      gaps: mission.gaps,
      // §64 : combien de FORMES ÉPROUVÉES ont été murmurées au planner pour CE plan — le
      // chiffre qui rend « les patterns influencent » vérifiable au journal, mission par mission.
      formesProposees: formesValidees.length,
    });

  // ── L'ACCORD (§32-33) — un pour un lot cohérent, jamais quatre-vingt-dix-neuf ─────────
  const p = perimetre(mission);
  let approbation: { id: string; niveau: string; resume: string } | null = null;
  if (p) {
    const id = await demanderApprobation(missionId, p, user.id, titre);
    approbation = { id, niveau: p.niveau, resume: p.resume };
    await porteAttentionPour().signaler({
      kind: "APPROVAL_REQUIRED", missionId, ownerId: user.id, titre, raison: p.resume,
      niveauApprobation: p.niveau, stepKey: "accord", planVersion: 1,
    }).catch(() => undefined);
  }

  let etapes = mission.steps.length;
  if (opts.demarrer !== false) {
    const tour = await avancerMission(user, missionId, { ...opts, complexite: mission.complexity });
    const etat = tour?.status ?? null;

    /**
     * ── L'ESCALADE DU CHEMIN DIRECT — ce qui rend son erreur inoffensive ──────────────
     *
     * Le chemin direct PROPOSE une lecture sans payer de planificateur. Il se trompe rarement,
     * mais il se trompe : la capacité dominante peut ne pas être celle qui répond. La garde
     * n'est pas un réglage de seuil, c'est le JUGE — le même que pour tout autre plan.
     *
     * S'il refuse de conclure, on replanifie SUR-LE-CHAMP avec le modèle, sans attendre un
     * battement d'ordonnanceur ni un clic. La personne qui a posé la question ne doit pas payer
     * la tentative en délai : le pari du chemin court se solde dans la même requête.
     *
     * Coût d'une erreur : une lecture de trop. Coût d'une réussite : la planification entière
     * économisée — 79 % du temps mesuré. C'est cette asymétrie qui autorise le pari.
     */
    if (plan.metriques.voie === "DIRECTE" && (etat === "BLOCKED" || etat === "PARTIAL" || etat === "FAILED")) {
      await journaliser(missionId, "REPLANNED",
        "Le chemin direct n'a pas satisfait l'objectif : reprise par le planificateur complet.",
        { voie: "DIRECTE", etatAtteint: etat });
      const reprise = await replanifierMission(user, missionId, opts);
      if (reprise.replanifie) {
        etapes = reprise.etapes ?? etapes;
        await avancerMission(user, missionId, { ...opts, complexite: mission.complexity });
      }
    }
  }

  return {
    ok: true,
    missionId,
    titre,
    etapes,
    complexite: mission.complexity,
    echelle: mission.scale,
    approbation,
    metriques: plan.metriques,
    gaps: mission.gaps,
  };
}

/**
 * LANCE UNE MISSION EN ARRIÈRE-PLAN — la conversation est LIBÉRÉE en dessous de la seconde.
 *
 * ── LE CONTRAT (§12-13) ──────────────────────────────────────────────────────────────────
 *
 * « Fais ça de côté, parlons d'autre chose. » La personne ne doit pas payer la planification
 * en délai de conversation. Le TALON de mission est écrit EN BASE d'abord (statut PLANNING,
 * l'objectif mot pour mot), la main est rendue avec l'identifiant, puis la planification et le
 * premier tour tournent hors requête.
 *
 * ── POURQUOI LE TALON D'ABORD, ET PAS UN simple `setImmediate` ──────────────────────────
 *
 * Parce qu'un `setImmediate` sans trace meurt avec le processus : un déploiement entre la
 * promesse (« je m'en occupe ») et la planification perdrait la demande — la pire des pannes,
 * celle dont personne ne s'aperçoit. Avec le talon, le battement retrouve toute mission
 * PLANNING sans étapes et RELANCE la planification (`rattraperLancementsPerdus`) : la
 * durabilité est dans la base, jamais dans la mémoire du processus.
 */
/** LE TALON : la mission existe en base, PLANNING sans étape — la demande est retenue. */
async function creerTalon(user: CurrentUser, objectif: string, titre: string): Promise<string | null> {
  try {
    const stub = await prisma.mission.create({
      data: {
        kind: "RUNTIME",
        status: "PLANNING",
        title: titre,
        objective: objectif,
        goalRaw: objectif,
        ownerId: user.id,
        // 0 : la matérialisation qui suit incrémente à 1 — le premier plan reste « plan 1 ».
        planVersion: 0,
      },
      select: { id: true },
    });
    return stub.id;
  } catch {
    return null;
  }
}

export async function lancerEnArrierePlan(
  user: CurrentUser,
  objectif: string,
  opts: LancementOptions = {},
): Promise<{ ok: true; missionId: string; titre: string } | { ok: false; error: string }> {
  try {
    const titre = opts.titre ?? titreDe(objectif);
    const id = await creerTalon(user, objectif, titre);
    if (!id) return { ok: false, error: "la mission n'a pas pu être enregistrée" };
    const stub = { id };
    await journaliser(stub.id, "DETACHED",
      "Mission enregistrée : la planification et l'exécution continuent en arrière-plan.",
      { objectif: objectif.slice(0, 300) });

    setImmediate(() => {
      void finaliserLancementDifere(stub.id, user, objectif, opts).catch((e) => {
        console.error(`[missions] finalisation différée de ${stub.id} échouée`, e);
      });
    });

    return { ok: true, missionId: stub.id, titre };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * PLANIFIE ET DÉMARRE une mission-talon — le second temps du lancement détaché, et le chemin
 * de RATTRAPAGE après un crash. Idempotent par construction : si le talon porte déjà des
 * étapes (une autre instance a fini le travail), il n'y a rien à faire.
 */
export async function finaliserLancementDifere(
  missionId: string,
  user: CurrentUser,
  objectif: string,
  opts: LancementOptions = {},
): Promise<{ finalise: boolean; raison?: string }> {
  const etapes = await prisma.missionStep.count({ where: { missionId } });
  if (etapes > 0) return { finalise: false, raison: "déjà matérialisée" };
  const mission = await prisma.mission.findUnique({
    where: { id: missionId }, select: { status: true },
  });
  if (!mission || mission.status === "CANCELLED" || mission.status === "FAILED") {
    return { finalise: false, raison: "mission close" };
  }

  const r = await lancerMission(user, objectif, { ...opts, missionId });
  if (!r.ok) {
    // UNE PANNE TRANSITOIRE NE CLÔT PAS LA MISSION : le talon reste PLANNING, le journal dit
    // pourquoi, et `rattraperLancementsPerdus` reprendra (trois tentatives au plus, espacées
    // par le battement). Seul un refus DURABLE — plan irrecevable, aucun fournisseur — passe
    // FAILED : la personne voit « la planification a échoué », pas une carte qui tourne pour
    // toujours.
    if (estPanneTransitoire(r.error)) {
      await journaliser(missionId, "PLANNING_DEFERRED",
        `Le fournisseur de modèle a lâché pendant la planification (${r.error.slice(0, 120)}) : nouvelle tentative au prochain battement.`,
        { transitoire: true });
      return { finalise: false, raison: r.error };
    }
    // LA PANNE EST DITE, JAMAIS SILENCIEUSE : la mission passe FAILED avec le motif — la
    // personne voit « la planification a échoué », pas une carte qui tourne pour toujours.
    await prisma.mission.update({
      where: { id: missionId },
      data: { status: "FAILED" },
    }).catch(() => undefined);
    await journaliser(missionId, "PLANNING_FAILED",
      `La planification en arrière-plan a échoué : ${r.error}`, {});
    return { finalise: false, raison: r.error };
  }
  return { finalise: true };
}

/**
 * RATTRAPE LES LANCEMENTS PERDUS — le filet du talon (§5 durabilité).
 *
 * Une mission PLANNING sans étape ET sans activité récente est un lancement dont le processus
 * est mort entre la promesse et la planification. Le battement la retrouve et RELANCE — au
 * plus deux reprises (comptées au journal), sinon FAILED avec le motif : relancer sans fin une
 * planification qui meurt à chaque fois serait une boucle, pas de la persévérance.
 */
export async function rattraperLancementsPerdus(
  chargerProprietaire: (userId: string) => Promise<CurrentUser | null>,
  opts: { plusVieuxQueMs?: number; limite?: number } = {},
): Promise<number> {
  const seuil = new Date(Date.now() - (opts.plusVieuxQueMs ?? 2 * 60_000));
  const talons = await prisma.mission.findMany({
    where: {
      kind: "RUNTIME", status: "PLANNING", updatedAt: { lt: seuil },
      steps: { none: {} },
    },
    select: { id: true, ownerId: true, goalRaw: true },
    take: opts.limite ?? 5,
    orderBy: { updatedAt: "asc" },
  });

  let repris = 0;
  for (const talon of talons) {
    if (!talon.goalRaw) continue;
    const reprises = await prisma.missionEvent.count({
      where: { missionId: talon.id, kind: "PLANNING_RETRY" },
    });
    if (reprises >= 2) {
      await prisma.mission.update({ where: { id: talon.id }, data: { status: "FAILED" } }).catch(() => undefined);
      await journaliser(talon.id, "PLANNING_FAILED",
        "Trois lancements ont été tentés sans qu'aucun n'aboutisse — la mission est close, le motif est au journal.", {});
      continue;
    }
    const user = await chargerProprietaire(talon.ownerId);
    if (!user) continue;
    await journaliser(talon.id, "PLANNING_RETRY",
      "Lancement retrouvé sans plan : la planification reprend (le processus qui la portait s'est arrêté).", {});
    const f = await finaliserLancementDifere(talon.id, user, talon.goalRaw, {});
    if (f.finalise) repris += 1;
  }
  return repris;
}

/**
 * FAIT AVANCER UNE MISSION — le point d'entrée de l'ordonnanceur, du routeur d'événements,
 * de l'écran et de la conversation.
 *
 * Réentrant : deux appels concurrents se disputent les étapes par réservation en base. C'est ce
 * qui permet à l'ordonnanceur et à l'utilisateur de cliquer en même temps sans dommage.
 */
export function avancerMission(
  user: CurrentUser,
  missionId: string,
  opts: OptionsAssemblage & { maxTours?: number } = {},
) {
  return withTurn("background", async () => {
    setTurnContext({ userId: user.id, missionId, feature: "mission" });
    await prechargerCapacitesDynamiques(user).catch(() => 0);
    await assurerFormes();
    return avancerMissionInterne(user, missionId, opts);
  });
}

async function avancerMissionInterne(
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
  const res = await avancer(missionId, agent, { ...deps, maxTours: opts.maxTours });
  // ── UNE QUESTION AU DIRIGEANT SE POSE, ELLE NE S'ATTEND PAS EN SILENCE ─────────────────
  //
  // Une étape WAIT_INPUT met la mission en WAITING_INPUT ; avant ce crochet, personne n'était
  // prévenu — la mission dormait jusqu'à ce que quelqu'un ouvre l'écran. La porte d'attention
  // classe la question en ARBITRAGE et ne la redemande pas d'elle-même (cadence infinie).
  if (res.status === "WAITING_INPUT") {
    const q = await prisma.missionStep.findFirst({
      where: { missionId, status: "WAITING", nodeType: "WAIT_INPUT" },
      select: { key: true, title: true, waitFor: true },
      orderBy: { updatedAt: "desc" },
    }).catch(() => null);
    if (q) {
      const ask = (q.waitFor as { ask?: unknown } | null)?.ask;
      const m = await prisma.mission.findUnique({ where: { id: missionId }, select: { title: true, planVersion: true } }).catch(() => null);
      await porteAttentionPour().signaler({
        kind: "QUESTION", missionId, ownerId: user.id, titre: m?.title ?? "",
        raison: typeof ask === "string" && ask.trim() ? ask : `« ${q.title} » attend un élément de votre part.`,
        decision: "répondre depuis l'écran de la mission", stepKey: q.key, planVersion: m?.planVersion ?? null,
      }).catch(() => undefined);
    }
  }
  return res;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA REPLANIFICATION (§39-40) — un échec n'est pas une fin, et un nouveau plan n'est pas un
 * chèque en blanc.
 *
 * ── QUAND ELLE SE DÉCLENCHE ─────────────────────────────────────────────────────────────
 *
 * Quand la mission est BLOQUÉE ou EN ÉCHEC et qu'il reste au moins une étape non aboutie dont
 * les tentatives sont épuisées. Autrement dit : le moteur a fait tout ce qu'il savait faire —
 * réessayer, réparer — et il n'y arrive pas. Replanifier AVANT cela reviendrait à jeter un plan
 * qui marchait pour un incident passager.
 *
 * ── CE QUI EST DONNÉ AU PLANIFICATEUR, ET CE QUI NE L'EST PAS ──────────────────────────
 *
 * On lui donne l'objectif d'origine MOT POUR MOT, ce qui a DÉJÀ abouti (pour qu'il ne le
 * redemande pas) et ce qui a échoué AVEC son motif. On ne lui donne pas l'ancien plan : le lui
 * remettre sous les yeux le pousserait à le reproduire, alors que c'est précisément ce plan-là
 * qui n'a pas marché.
 *
 * ── LA GARANTIE QUI COMPTE LE PLUS ─────────────────────────────────────────────────────
 *
 * Un nouveau plan porte des étapes que personne n'a autorisées. `reouvrirSiChange` compare le
 * périmètre au dernier accord donné et ROUVRE la partie non couverte — elle seule (§8). Sans
 * cette ligne, un replan serait une porte dérobée : il suffirait qu'une étape échoue pour que
 * la mission se réécrive et parte sur un accord qui portait sur autre chose.
 *
 * ── CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────────────────────────
 *
 * Elle ne touche à AUCUNE étape terminée. `materialiser` est ré-entrante et n'écrase pas une
 * étape `DONE` ; une clé qui disparaît du nouveau plan garde son historique. C'est ce qui
 * permet de dire « ceci a été fait sous le plan 1 » au lieu de laisser croire que le plan
 * actuel a tout produit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface ResultatReplanification {
  replanifie: boolean;
  raison: string;
  planVersion?: number;
  etapes?: number;
  /** Ce que le changement de plan a rouvert à l'accord — vide quand rien n'a bougé. */
  rouvertes?: string[];
}

/** Les états d'où une replanification a un sens. Ailleurs, il n'y a rien à replanifier. */
const ETATS_REPLANIFIABLES = new Set(["FAILED", "BLOCKED", "PARTIAL"]);

/**
 * COMBIEN DE PLANS AVANT DE S'ARRÊTER.
 *
 * §9 dit qu'on ne s'arrête jamais à la première difficulté — il dit aussi que l'échelle de
 * recours a des barreaux, et qu'on peut les épuiser. Sans plafond, une mission qui échoue pour
 * une raison que le planificateur ne peut pas voir (un service tiers en panne, un droit retiré)
 * se réécrirait indéfiniment, en payant un appel de modèle à chaque tour de battement.
 *
 * Quatre plans, c'est trois corrections. Au-delà, ce n'est plus le plan qui est en cause, et la
 * bonne réponse est de le DIRE à la personne plutôt que de continuer à essayer sans elle.
 */
const PLANS_MAX = 4;

export function replanifierMission(
  user: CurrentUser,
  missionId: string,
  opts: OptionsAssemblage = {},
): Promise<ResultatReplanification> {
  return withTurn("background", async () => {
    setTurnContext({ userId: user.id, missionId, feature: "mission" });
    await prechargerCapacitesDynamiques(user).catch(() => 0);
    await assurerFormes();
    return replanifierMissionInterne(user, missionId, opts);
  });
}

async function replanifierMissionInterne(
  user: CurrentUser,
  missionId: string,
  opts: OptionsAssemblage = {},
): Promise<ResultatReplanification> {
  const m = await prisma.mission.findFirst({
    where: { id: missionId, ownerId: user.id, kind: "RUNTIME" },
    select: { id: true, title: true, status: true, goalRaw: true, objective: true, planVersion: true },
  });
  if (!m) return { replanifie: false, raison: "Mission introuvable — ou elle ne vous appartient pas." };
  if (!ETATS_REPLANIFIABLES.has(m.status)) {
    return { replanifie: false, raison: `Une mission ${m.status} n'a rien à replanifier.` };
  }
  if (m.planVersion >= PLANS_MAX) {
    return {
      replanifie: false,
      raison: `${m.planVersion} plans ont déjà été essayés. Ce n'est plus le plan qui est en cause — `
        + `il faut regarder ce qui bloque avant d'en écrire un cinquième.`,
    };
  }

  const etat = await chargerEtat(missionId);
  if (!etat) return { replanifie: false, raison: "État de mission illisible." };

  const abouties = etat.steps.filter((s) => s.status === "DONE");
  const bloquees = etat.steps.filter(
    (s) => s.status === "FAILED" && s.attempt >= s.maxAttempts,
  );
  /**
   * DEUX RAISONS DE REPLANIFIER, ET LA SECONDE MANQUAIT.
   *
   * La première est celle d'origine : des étapes ont épuisé leurs tentatives, le moteur ne sait
   * plus réparer seul. La seconde est apparue dans un run réel — toutes les étapes abouties, le
   * contrôle qualité vert, et le juge qui refuse : le PLAN était insuffisant, sans qu'aucune
   * étape n'ait échoué. Exiger un échec d'étape fermait la porte exactement là où le nouveau
   * plan était la seule issue, et la mission mourait BLOCKED.
   */
  const objectifManque = m.status === "BLOCKED" && etat.steps.length > 0
    && etat.steps.every((s) => ["DONE", "SKIPPED", "CANCELLED"].includes(s.status));
  if (bloquees.length === 0 && !objectifManque) {
    return {
      replanifie: false,
      raison: "Aucune étape n'a épuisé ses tentatives : le moteur peut encore réparer tout seul.",
    };
  }

  /**
   * ── LA PORTE DÉTERMINISTE AVANT LE REPLAN (§13, chantier latence) ────────────────────
   *
   * Un run réel a payé 7,9 s et 5 718 jetons de replanification pour que le planificateur
   * réponde « aucune étape exploitable » : toutes les étapes étaient DONE, et le refus du
   * juge ne désignait rien qu'un plan NOUVEAU puisse changer. Ce signal existait déjà — le
   * juge remplit `suggestedRecovery` — mais personne ne le relisait avant de payer.
   *
   * La porte ne ferme QUE le cas mesuré : toutes les étapes abouties (aucune à réparer) ET
   * le dernier refus journalisé porte explicitement « aucun recours » (`recoursSuggere:
   * null, présent`). Un refus SANS ce champ (juge arithmétique, mission antérieure, juge
   * en panne) laisse la porte ouverte — l'absence de mesure n'est pas une mesure (§78).
   */
  if (objectifManque && bloquees.length === 0) {
    const dernierRefus = await prisma.missionEvent.findFirst({
      where: { missionId, kind: "GOAL_UNSATISFIED" },
      orderBy: { at: "desc" },
      select: { detail: true },
    }).catch(() => null);
    const detail = dernierRefus?.detail as Record<string, unknown> | null | undefined;
    if (detail && "recoursSuggere" in detail && detail.recoursSuggere === null) {
      await journaliser(missionId, "REPLAN_SKIPPED",
        "Replanification refusée SANS appel de modèle : toutes les étapes sont abouties et le "
        + "juge n'a suggéré aucun recours — un plan nouveau redécouvrirait la même impasse.",
        { porte: "RECOURS_ABSENT" });
      return {
        replanifie: false,
        raison: "Toutes les étapes sont abouties et le juge n'a suggéré aucun recours : un nouveau "
          + "plan n'aurait rien de neuf à proposer. Le verdict du juge est la réponse.",
      };
    }
  }

  const catalogue = catalogueDe(user, opts.lectureSeule ? { effetMax: "ANALYZE" } : {});
  const acteur = acteurDe(user);
  const cerveau = opts.reasoner ?? raisonneur;
  const objectif = m.goalRaw || m.objective;

  const contexteReplan = {
    aujourdhui: new Date().toLocaleDateString("fr-FR"),
    demandeur: demandeurDe(user),
    politiques: await import("@/platform/in-process/teach/store").then((m) => m.politiquesPourMission(user.id)).catch(() => [] as string[]),
    // CE QUI EST DÉJÀ FAIT : le planificateur doit repartir de là, pas de zéro. Lui cacher
    // l'acquis le ferait renvoyer trente-et-un messages déjà partis — l'idempotence les
    // arrêterait, mais au prix d'un plan illisible et d'un travail inutile.
    dejaFait: abouties.map((s) => `${s.key} : ${s.title}`).slice(0, 60),
    refusPrecedent: bloquees.map((s) => `[${s.errorKind ?? "ÉCHEC"}] ${s.key} : ${s.error ?? "sans motif"}`),
  };
  const optionsPlan = {
    contexte: contexteReplan,
    /**
     * UNE REPLANIFICATION NE REPREND JAMAIS LE CHEMIN DIRECT.
     *
     * Le chemin direct est déterministe : sur la même demande il rend le même plan. Le
     * reprendre ici reproduirait à l'identique celui que le juge vient de refuser — une boucle
     * qui consomme une version de plan et n'apprend rien. C'est le seul endroit du dépôt qui
     * l'interdit, et c'est ce qui garantit que se tromper de chemin coûte une lecture, pas une
     * réponse fausse.
     */
    sansCheminDirect: true as const,
    ...roleForcePlanification(),
  };
  const optionsCompile = {
    // LES ACQUIS SONT DES DÉPENDANCES LÉGITIMES. On vient de dire au planificateur ce qui était
    // déjà fait ; lui refuser ensuite d'en dépendre serait lui reprocher d'avoir écouté.
    acquises: new Set(etat.steps.filter((s) => s.status === "DONE" || s.status === "SKIPPED").map((s) => s.key)),
    // LE PLAFOND SURVIT AU REPLAN. Sans cette ligne, une mission plafonnée en lecture
    // retrouverait le droit d'écrire à la deuxième version de son plan — une porte dérobée qui
    // ne s'ouvrirait qu'après un échec, donc au pire moment.
    ...(opts.lectureSeule ? { effetMax: "ANALYZE" as const } : {}),
  };

  const plan = await planifier(objectif, catalogue, acteur, cerveau, optionsPlan);
  if (!plan.ok) return { replanifie: false, raison: `Le planificateur n'a rien rendu : ${plan.error}` };

  const agent = agentPour({ initiatedBy: user.id, executedBy: user.id, label: user.name });
  let c = compile(plan.plan, catalogue, agent, optionsCompile);
  if (!c.ok) {
    /**
     * ── LE REFUS EST RENVOYÉ AU PLANIFICATEUR — UNE FOIS, comme au lancement ─────────────
     *
     * `lancerMission` fait ce second essai depuis toujours ; la replanification, non. Sur un
     * run réel : le plan v2 propose un nœud ARTIFACT sous plafond de lecture, le compilateur
     * refuse (FORBIDDEN_EFFECT, correctement), et la mission meurt BLOCKED sans jamais
     * atteindre le juge — alors qu'un plan corrigé était à un message près. Le refus du
     * compilateur est exactement l'information dont le planner a besoin, et elle était jetée.
     */
    const secondEssai = await planifier(objectif, catalogue, acteur, cerveau, {
      ...optionsPlan,
      contexte: {
        ...contexteReplan,
        refusPrecedent: [
          ...contexteReplan.refusPrecedent,
          ...c.issues.map((i) => `[${i.code}] ${i.stepKey ?? "plan"} : ${i.message}`),
        ],
      },
    });
    if (!secondEssai.ok) {
      return { replanifie: false, raison: `Le planificateur n'a rien rendu : ${secondEssai.error}` };
    }
    const c2 = compile(secondEssai.plan, catalogue, agent, optionsCompile);
    if (!c2.ok) {
      return {
        replanifie: false,
        raison: `Le nouveau plan reste refusé après correction : `
          + `${c2.issues.map((i) => i.message).slice(0, 2).join(" ; ")}`,
      };
    }
    c = c2;
  }

  await transitionner(missionId, "PLANNING", "Replanification après échec sans recours");
  await materialiser(c.mission, {
    ownerId: user.id,
    title: m.title,
    goalRaw: objectif,
    missionId,
    maxConcurrency: CONCURRENCE_PAR_ECHELLE[c.mission.scale],
    planMetaExtra: { promptVersion: PLANNER_PROMPT_VERSION, politiques: contexteReplan.politiques ?? [] },
  });

  // ── §8 : CE QUI N'EST PLUS COUVERT REPASSE À L'ACCORD, ET RIEN D'AUTRE ─────────────
  const rouvert = await reouvrirSiChange(missionId, c.mission, user.id, m.title);
  if (rouvert) {
    await porteAttentionPour().signaler({
      kind: "PLAN_CHANGED", missionId, ownerId: user.id, titre: m.title,
      raison: `${rouvert.stepKeys.length} étape(s) ne sont pas couvertes par votre accord précédent.`,
      stepKey: rouvert.stepKeys.join("+").slice(0, 120),
    }).catch(() => undefined);
  }

  const apres = await prisma.mission.findUnique({
    where: { id: missionId }, select: { planVersion: true },
  });

  return {
    replanifie: true,
    raison: `Nouveau plan (v${apres?.planVersion ?? "?"}) : ${c.mission.steps.length} étapes, `
      + `${abouties.length} déjà aboutie(s) conservée(s).`,
    planVersion: apres?.planVersion,
    etapes: c.mission.steps.length,
    rouvertes: rouvert?.stepKeys ?? [],
  };
}
