import { COMPILE_ERRORS, CompileIssue, Complexity, MissionPlan, NODE_TYPES, NodeType, PLAN_LIMITS, PlannedStep, Scale, type StepCondition } from "@/lib/missions/planner/contract";
import type { ApprovalStrategy, PlannedArtifact, PlannedWorkstream } from "@/lib/missions/planner/contract";
import { EFFECT_RANK, Effect, effetMaximal } from "@/lib/missions/registry/capability-meta";
import { effetDuNoeud } from "@/lib/missions/registry/node-effect";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { layout } from "@/lib/missions/compiler/graph";
import { messageRefus, refusPourActeur } from "@/lib/missions/policy/guard";
import {
  reecrireClesDansRegles,
  reparerReglesDacceptation,
  type ContexteReglesPlan,
} from "@/lib/missions/goal/rules";
import { lireAttente } from "@/lib/missions/events/match";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE COMPILATEUR DE MISSION — le plan d'un modèle n'est JAMAIS exécuté tel quel (§6).
 *
 * ── CE QUE FAIT CE FICHIER, EN UNE PHRASE ────────────────────────────────────────────────
 *
 * Il transforme une PROPOSITION (du texte structuré, produit par un modèle, donc faillible) en
 * un PROGRAMME (un graphe validé, dont chaque nœud existe, est autorisé, a un effet connu et
 * une stratégie de reprise). Entre les deux, il refuse.
 *
 * ── CE QU'IL REFUSE, ET POURQUOI CHACUN COMPTE ───────────────────────────────────────────
 *
 *   • une capacité qui n'existe pas — le modèle a inventé `super_magic_send()` ;
 *   • une capacité que l'acteur n'a pas le droit d'appeler — une mission n'est pas une porte
 *     dérobée (§48), et c'est ICI que ça se joue, pas au moment de l'appel ;
 *   • un graphe cyclique — il ne s'exécuterait jamais, et l'apprendre en production coûte ;
 *   • une forme incohérente — une attente sans condition de sortie, un appel sans capacité ;
 *   • une CARDINALITÉ fausse — trente-trois destinataires dans un champ au lieu de trente-trois
 *     étapes. C'est le refus le plus important du fichier, parce que c'est le seul dont la
 *     conséquence est irréversible et publique (§26).
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────────────────────
 *
 * Il ne DÉPLOIE PAS l'éventail. Une étape « pour chaque salarié » ne connaît pas ses salariés
 * avant que l'étape amont ait tourné : les démultiplier ici obligerait à interroger la base
 * pendant la compilation, donc à recompiler à chaque exécution. Le compilateur valide la FORME
 * de l'éventail ; le moteur le matérialise avec les vraies données. C'est ce qui rend une
 * mission à trois étapes et une mission à trois mille strictement identiques (§4).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface CompiledStep {
  key: string;
  title: string;
  workstream: string | null;
  nodeType: NodeType;
  capability: string | null;
  input: Record<string, unknown>;
  dependsOn: string[];
  effect: Effect;
  /** La capacité est-elle rejouable PAR ELLE-MÊME ? Voir la nuance dans `capability-meta.ts`. */
  idempotent: boolean;
  /** Le moteur doit-il poser une clé d'idempotence autour de l'appel ? */
  needsIdempotencyKey: boolean;
  /** Cette étape entre-t-elle dans le périmètre soumis à approbation ? */
  needsApproval: boolean;
  maxAttempts: number;
  modelRole: "cheap" | "standard" | "strong" | null;
  forEach: { from: string; path: string; as: string } | null;
  waitFor: PlannedStep["waitFor"] | null;
  /**
   * LA SPÉCIFICATION D'EXÉCUTION — à côté de `input`, jamais dedans.
   *
   * `input` est le payload : ce que l'humain approuve, ce que la capacité reçoit. `spec` est ce
   * que le MOTEUR doit savoir pour exécuter l'étape correctement — quel schéma de sortie exiger
   * d'un worker, à quelle condition l'étape est finie, quel niveau de réflexion elle demande.
   * Mélanger les deux ferait diverger le payload stocké du payload approuvé.
   */
  spec: StepSpec | null;
  /** La vague d'exécution : les étapes de même vague partent ensemble. */
  wave: number;
}

/** Ce que le moteur lit pour exécuter une étape — produit par le planner, figé à la compilation. */
export interface StepSpec {
  /** Le JSON Schema qu'un WORKER doit respecter. Imposé au fournisseur, pas espéré. */
  expectedOutputSchema?: Record<string, unknown>;
  /** La condition VÉRIFIABLE d'achèvement, en français. Lue par le contrôle qualité et le juge. */
  completionCondition?: string;
  /** La réflexion demandée — choisit le rôle de modèle (§4). */
  reasoningRequirement?: "NONE" | "LIGHT" | "HEAVY";
  /** Le niveau d'accord PROPOSÉ par le planner. La politique tranche ensuite. */
  approvalRequirement?: "NONE" | "NORMAL" | "SENSITIVE" | "CRITICAL";
  /**
   * CE QUI REND UN RÉSULTAT ACCEPTABLE — lu par l'évaluateur sémantique (§6).
   *
   * Sans lui, une étape qui rend HTTP 200 est « réussie », même si elle a rapporté une
   * convention speaker là où on demandait un contrat. Avec lui, la vérification est
   * arithmétique ou typée, donc sans appel de modèle.
   */
  attendu?: { type?: string; nombre?: number; cible?: string };
  /** L'ÉTAPE CONDITIONNELLE : l'issue ou la sortie amont qui l'autorise à partir (`runtime/condition.ts`). */
  when?: StepCondition;
  /** Pour une étape ARTIFACT : quel livrable elle produit. */
  artifactKey?: string;
  artifactFormat?: string;
  artifactTitle?: string;
}

export interface CompiledMission {
  objective: string;
  acceptance: string[];
  complexity: Complexity;
  scale: Scale;
  steps: CompiledStep[];
  /** L'effet le plus grave du plan — ce qui décide du niveau d'approbation (§32). */
  maxEffect: Effect;
  requiresApproval: boolean;
  /** Les capacités réellement mobilisées. C'est le PÉRIMÈTRE que l'humain approuve (§33). */
  capabilities: string[];
  depth: number;
  gaps: string[];
  /**
   * LA CARTE DU PLAN — axes, livrables attendus, stratégie d'accord, critère de fin.
   *
   * Le compilateur ne la VALIDE pas : ce sont des intentions, pas des instructions exécutables.
   * Il la TRANSPORTE, parce que le contrôle qualité et le juge en ont besoin et qu'ils lisent
   * la mission, pas le plan d'origine.
   */
  planMeta: {
    workstreams: PlannedWorkstream[];
    expectedArtifacts: PlannedArtifact[];
    approvalStrategy: ApprovalStrategy;
    completionCriteria: string | null;
  };
}

export type CompileResult =
  | { ok: true; mission: CompiledMission; warnings: CompileIssue[] }
  | { ok: false; issues: CompileIssue[] };

const ERREURS = new Set<string>(COMPILE_ERRORS);

/**
 * LES CHAMPS QUI DÉSIGNENT DES DESTINATAIRES.
 *
 * La liste est explicite plutôt que devinée. Une heuristique du genre « tout tableau de chaînes
 * qui ressemble à des e-mails » se tromperait dans les deux sens : elle raterait un champ nommé
 * autrement, et bloquerait une liste de pièces jointes.
 */
const CHAMPS_DESTINATAIRES = ["to", "destinataire", "destinataires", "recipients", "cc", "bcc", "employeeIds", "personIds"];

/** Combien de destinataires ce champ porte-t-il ? `-1` quand ce n'est pas un champ de ce genre. */
function nbDestinataires(input: Record<string, unknown>): number {
  let max = -1;
  for (const champ of CHAMPS_DESTINATAIRES) {
    const v = input[champ];
    if (Array.isArray(v)) max = Math.max(max, v.length);
    else if (typeof v === "string" && v.trim() !== "") {
      // Une chaîne « a@x.dz, b@x.dz » est une liste déguisée : c'est exactement la forme par
      // laquelle un envoi groupé se glisse sans qu'aucun tableau n'apparaisse.
      max = Math.max(max, v.split(/[;,]/).filter((p) => p.trim() !== "").length);
    }
  }
  return max;
}

const issue = (code: string, stepKey: string | null, message: string): CompileIssue => {
  if (!ERREURS.has(code)) throw new Error(`code de refus inconnu : ${code}`);
  return { code: code as CompileIssue["code"], stepKey, message };
};

/**
 * LA SPÉCIFICATION D'UNE ÉTAPE, extraite du plan.
 *
 * Rend `null` quand il n'y a rien à dire : une colonne JSON pleine de `{}` coûte de la place et
 * fait croire, à la relecture, qu'une information a été perdue. `null` dit « rien n'a été
 * demandé », ce qui est vrai et différent.
 */
function specDe(s: PlannedStep): StepSpec | null {
  const spec: StepSpec = {};
  if (s.expectedOutputSchema) spec.expectedOutputSchema = s.expectedOutputSchema;
  if (s.completionCondition) spec.completionCondition = s.completionCondition;
  if (s.reasoningRequirement) spec.reasoningRequirement = s.reasoningRequirement;
  if (s.approvalRequirement) spec.approvalRequirement = s.approvalRequirement;
  if (s.when) spec.when = s.when;
  return Object.keys(spec).length > 0 ? spec : null;
}

/**
 * LA FORME ATTENDUE PAR TYPE DE NŒUD.
 *
 * Déclarée en table plutôt qu'en cascade de `if` : la table se lit d'un coup d'œil, et le test
 * peut la parcourir exhaustivement au lieu de deviner quelles branches existent.
 */
const FORMES: Record<NodeType, { capacite: "requise" | "interdite"; attente: "requise" | "interdite" }> = {
  CAPABILITY: { capacite: "requise", attente: "interdite" },
  WORKER: { capacite: "interdite", attente: "interdite" },
  WAIT_EVENT: { capacite: "interdite", attente: "requise" },
  WAIT_INPUT: { capacite: "interdite", attente: "requise" },
  APPROVAL: { capacite: "interdite", attente: "interdite" },
  QA: { capacite: "interdite", attente: "interdite" },
  ARTIFACT: { capacite: "interdite", attente: "interdite" },
  JOIN: { capacite: "interdite", attente: "interdite" },
};

/**
 * CE QUI EXISTE DÉJÀ DANS LA MISSION, D'UN PLAN PRÉCÉDENT.
 *
 * ── LE DÉFAUT QUE CE PARAMÈTRE CORRIGE ───────────────────────────────────────────────────
 *
 * À la replanification, le planificateur reçoit la liste de ce qui est DÉJÀ FAIT — c'est
 * volontaire : lui cacher l'acquis le ferait refaire trente-et-un envois déjà partis. Il écrit
 * donc, très logiquement, un plan dont certaines étapes dépendent de ces clés-là.
 *
 * Le compilateur ne connaissait que le plan qu'on lui donnait. Il refusait donc le nouveau plan
 * pour « dépend de « rechercher:dossiers-reglementaires », qui n'existe pas dans le plan » —
 * alors que cette étape existe bel et bien, en base, terminée, avec son résultat. Deux missions
 * réelles sur trois sont mortes BLOCKED sur ce refus.
 *
 * ── POURQUOI LE MOTEUR, LUI, N'AVAIT PAS DE PROBLÈME ─────────────────────────────────────
 *
 * `etapesPretes` résout les dépendances contre TOUTES les étapes de la mission, pas contre le
 * plan courant. Une dépendance vers une étape v1 terminée se satisfait immédiatement. Le
 * blocage était donc entièrement statique : le compilateur refusait ce que le moteur savait
 * exécuter.
 *
 * ── CE QUI RESTE REFUSÉ, ET C'EST VOULU ──────────────────────────────────────────────────
 *
 * Seules les clés ABOUTIES sont acceptées. Dépendre d'une étape en échec produirait une
 * attente que rien ne viendra lever : le refus est alors le bon comportement, et il garde son
 * message d'origine.
 */
export interface OptionsCompilation {
  /**
   * LE PLAFOND D'EFFET DE LA MISSION.
   *
   * Absent = aucun plafond, et c'est le cas courant : la politique et le catalogue tranchent.
   * Présent, il REFUSE À LA COMPILATION toute étape qui produirait davantage — y compris un
   * nœud sans capacité, comme un ARTIFACT qui fabrique un fichier. C'est cette dernière porte
   * qu'un run Render a trouvée ouverte alors que le rapport annonçait « lecture seule ».
   */
  effetMax?: Effect;
  /** Les clés d'étapes déjà présentes ET abouties dans la mission (plans antérieurs). */
  acquises?: ReadonlySet<string>;
}

/** L'alphabet d'une clé d'étape — la même contrainte que le refus de forme, mais APPLIQUÉE. */
const CLE_VALIDE = /^[A-Za-z0-9:_\-.]+$/;

const normaliserCle = (brute: string): string =>
  brute
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9:_\-.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * ── 0. L'ASSAINISSEMENT DES CLÉS — une mission ne meurt pas d'un accent ──────────────────
 *
 * Un run Render a tué une mission AVANT SA NAISSANCE pour la clé « recherche:federée » : la
 * clé est un IDENTIFIANT MACHINE, le modèle écrit du français, et la retouche du planificateur
 * a REPRODUIT la faute — le refus était donc une impasse structurelle, pas un garde-fou. §5 :
 * les modèles décident QUOI (le contenu du plan), le code décide COMMENT (la forme des
 * identifiants). Une clé hors alphabet se NORMALISE — accents décomposés, caractères interdits
 * remplacés — et chaque référence qui la citait (dependsOn, forEach.from, règles d'acceptation)
 * est réécrite avec elle, sinon l'assainissement CRÉERAIT la référence fantôme qu'il évite.
 *
 * Ce qui N'EST PAS assaini, et c'est voulu : deux clés IDENTIQUES restent identiques —
 * DUPLICATE_KEY reste un refus, c'est une vraie faute de plan, pas une faute d'alphabet. Une
 * collision CRÉÉE par la normalisation, elle, se suffixe : les deux étapes existent bel et
 * bien, les fondre serait perdre l'une des deux.
 */
function assainirPlan(brut: MissionPlan): { plan: MissionPlan; notes: string[] } {
  const renommages = new Map<string, string>();
  const prises = new Set<string>();
  for (const s of brut.steps) {
    if (typeof s.key === "string" && CLE_VALIDE.test(s.key)) prises.add(s.key);
  }
  const notes: string[] = [];
  for (const [i, s] of brut.steps.entries()) {
    const brute = s.key ?? "";
    if (CLE_VALIDE.test(brute) || renommages.has(brute)) continue;
    let candidate = normaliserCle(brute) || `etape-${i + 1}`;
    if (prises.has(candidate)) {
      let n = 2;
      while (prises.has(`${candidate}-${n}`)) n += 1;
      candidate = `${candidate}-${n}`;
    }
    renommages.set(brute, candidate);
    prises.add(candidate);
    notes.push(`clé « ${brute} » assainie en « ${candidate} » — une clé est un identifiant machine `
      + `(lettres, chiffres, :_-.), jamais du français.`);
  }
  if (renommages.size === 0) return { plan: brut, notes };
  const steps = brut.steps.map((s) => ({
    ...s,
    key: renommages.get(s.key ?? "") ?? s.key,
    dependsOn: s.dependsOn?.map((d) => renommages.get(d) ?? d),
    forEach: s.forEach
      ? { ...s.forEach, from: renommages.get(s.forEach.from) ?? s.forEach.from }
      : s.forEach,
  }));
  return {
    plan: { ...brut, steps, acceptance: reecrireClesDansRegles(brut.acceptance, renommages) },
    notes,
  };
}

/** Ce que le réparateur de règles doit savoir du plan — calculé au seul endroit qui a le plan entier. */
function contexteReglesDuPlan(plan: MissionPlan, acquises: ReadonlySet<string>): ContexteReglesPlan {
  const clesEtapes = new Set<string>([...plan.steps.map((s) => s.key), ...acquises]);
  const clesAvecRequete = new Set<string>();
  const sortiesStructurees: { cle: string; champs: string[] }[] = [];
  for (const s of plan.steps) {
    const q = (s.input ?? {})["query"];
    if (typeof q === "string" && q.trim() !== "" && !q.includes("{{")) clesAvecRequete.add(s.key);
    if (s.expectedOutputSchema && typeof s.expectedOutputSchema === "object") {
      const props = (s.expectedOutputSchema as { properties?: Record<string, unknown> }).properties;
      if (props && typeof props === "object") sortiesStructurees.push({ cle: s.key, champs: Object.keys(props) });
    }
  }
  return { clesEtapes, clesAvecRequete, sortiesStructurees };
}

export function compile(
  planBrut: MissionPlan,
  catalog: CapabilityCatalog,
  actor: MissionActor,
  opts: OptionsCompilation = {},
): CompileResult {
  const acquises = opts.acquises ?? new Set<string>();
  const issues: CompileIssue[] = [];
  const warnings: CompileIssue[] = [];

  // ── 0. L'ASSAINISSEMENT, PUIS LA RÉPARATION DES RÈGLES ───────────────────────────────
  //
  // LE TAUX DE CRÉATION DE MISSION EST UN INVARIANT (100 %). Une faute de FORME écrite par le
  // modèle dans un identifiant ou dans un critère ne condamne jamais un plan dont les étapes
  // compilent : elle se répare en CODE, la réparation est DITE en warning, et l'audit la voit.
  // Refuser renverrait la faute au même modèle qui vient de la commettre — mesuré : il récidive.
  const assainissement = assainirPlan(planBrut);
  for (const note of assainissement.notes) warnings.push(issue("INVALID_SHAPE", null, note));
  const reparation = reparerReglesDacceptation(
    assainissement.plan.acceptance,
    contexteReglesDuPlan(assainissement.plan, acquises),
  );
  for (const note of reparation.notes) warnings.push(issue("INVALID_SHAPE", null, note));
  let plan: MissionPlan = { ...assainissement.plan, acceptance: reparation.criteres };

  /**
   * ── §28 — UNE QUESTION NE SUSPEND PAS SA RÉPONSE À SON PROPRE DEMANDEUR ──────────────
   *
   * Trois missions d'ANALYSE d'un run réel ont fini WAITING_INPUT : le planificateur, ne
   * trouvant pas la donnée, avait écrit une étape « attendre que la personne fournisse X » —
   * et la mission suspendait sa réponse… à celui qui posait la question. Pour une mission en
   * LECTURE SEULE (plafond ≤ ANALYZE), la réponse honnête à une donnée absente n'est pas une
   * attente : c'est « voici ce qui existe, voici ce qui manque » — une absence DITE est une
   * réponse recevable. L'attente humaine se CONVERTIT donc en travail de synthèse qui nomme
   * le manque ; la conversion est dite en warning, et le juge garde le dernier mot sur la
   * qualité de la réponse. Une mission qui ÉCRIT garde ses attentes : un envoi peut
   * légitimement attendre une pièce humaine — c'est le plafond d'effet qui les distingue.
   */
  if (opts.effetMax && EFFECT_RANK[opts.effetMax] <= EFFECT_RANK.ANALYZE) {
    const attentes = plan.steps.filter(
      (s) => (s.nodeType ?? (s.capability ? "CAPABILITY" : "WORKER")) === "WAIT_INPUT");
    if (attentes.length > 0) {
      plan = {
        ...plan,
        steps: plan.steps.map((s) => {
          if ((s.nodeType ?? (s.capability ? "CAPABILITY" : "WORKER")) !== "WAIT_INPUT") return s;
          const demande = s.waitFor?.ask?.trim() || s.title;
          return {
            ...s,
            nodeType: "WORKER" as NodeType,
            waitFor: undefined,
            reasoningRequirement: s.reasoningRequirement ?? "LIGHT",
            completionCondition: `Ce qui est déjà établi pour « ${demande} » est dit avec sa provenance, `
              + "et ce qui manque est nommé précisément — sans rien inventer.",
          };
        }),
      };
      for (const a of attentes) {
        warnings.push(issue("INVALID_SHAPE", a.key,
          `l'attente humaine « ${a.waitFor?.ask ?? a.title} » est convertie en synthèse : une mission `
          + `d'analyse en lecture seule répond avec ce qui existe et DIT ce qui manque, elle ne `
          + `suspend pas sa réponse à une fourniture humaine (§28).`));
      }
    }
  }

  // ── 1. LES LIMITES OPÉRATIONNELLES ────────────────────────────────────────────────────
  if (plan.steps.length > PLAN_LIMITS.plannedSteps) {
    issues.push(issue("LIMIT_EXCEEDED", null,
      `${plan.steps.length} étapes écrites à la main dépassent la limite de ${PLAN_LIMITS.plannedSteps}. `
      + `Un plan de cette taille se découpe en sous-missions — le moteur est le même.`));
  }
  if (plan.steps.length === 0) {
    issues.push(issue("INVALID_SHAPE", null, "un plan sans étape ne peut pas atteindre son objectif."));
  }
  if (plan.acceptance.length === 0) {
    issues.push(issue("INVALID_SHAPE", null,
      "un plan sans critère d'acceptation produit une mission qui se déclare finie parce qu'elle a "
      + "fini de tourner. Ce n'est pas la question posée (§20)."));
  }
  // ── 2. LES CLÉS ───────────────────────────────────────────────────────────────────────
  const vues = new Set<string>();
  for (const s of plan.steps) {
    if (!s.key || !/^[A-Za-z0-9:_\-.]+$/.test(s.key)) {
      issues.push(issue("INVALID_SHAPE", s.key || null,
        `clé « ${s.key} » invalide : lettres, chiffres et « :_-. » seulement.`));
      continue;
    }
    if (vues.has(s.key)) issues.push(issue("DUPLICATE_KEY", s.key, `la clé « ${s.key} » apparaît deux fois.`));
    vues.add(s.key);
  }

  // ── 3. CHAQUE ÉTAPE, UNE PAR UNE ──────────────────────────────────────────────────────
  const compiled: CompiledStep[] = [];
  for (const s of plan.steps) {
    const nodeType: NodeType = s.nodeType ?? (s.capability ? "CAPABILITY" : "WORKER");
    if (!NODE_TYPES.includes(nodeType)) {
      issues.push(issue("INVALID_SHAPE", s.key, `type de nœud inconnu : ${String(nodeType)}.`));
      continue;
    }

    const forme = FORMES[nodeType];
    if (forme.capacite === "requise" && !s.capability) {
      issues.push(issue("INVALID_SHAPE", s.key, `un nœud ${nodeType} doit nommer une capacité.`));
    }
    if (forme.capacite === "interdite" && s.capability) {
      issues.push(issue("INVALID_SHAPE", s.key,
        `un nœud ${nodeType} n'appelle pas de capacité (« ${s.capability} » a été déclarée).`));
    }
    if (forme.attente === "requise") {
      const w = s.waitFor;
      // UN SEUL DÉCODEUR fait foi : `lireAttente` — la même relecture que celle du routeur de
      // réveil. Un WAIT_EVENT est décrit s'il attend un ÉVÉNEMENT, un MOMENT (`until` —
      // WAIT_FOR_TIME), ou une composition de branches. Valider ici avec une AUTRE règle que
      // celle du réveil fabriquerait des attentes compilables que rien ne réveille jamais.
      const decrite = nodeType === "WAIT_EVENT" ? lireAttente(w) !== null : Boolean(w?.ask);
      if (!decrite) {
        issues.push(issue("INVALID_SHAPE", s.key,
          nodeType === "WAIT_EVENT"
            ? "une attente doit dire QUEL événement (event), QUEL moment (until, ISO 8601) ou "
              + "quelles branches (anyOf/allOf) — sinon rien ne la réveillera jamais."
            : "une attente humaine doit dire ce qu'on demande, sinon personne ne sait quoi fournir."));
      }
      // Une échéance illisible réveillerait… jamais. Refusée à la compilation, pas découverte
      // dans trois jours quand personne ne comprend pourquoi la mission dort encore.
      const untils = [w?.until, ...(w?.anyOf ?? []).map((b) => b.until), ...(w?.allOf ?? []).map((b) => b.until)]
        .filter((u): u is string => typeof u === "string" && u.trim() !== "");
      for (const u of untils) {
        if (!Number.isFinite(Date.parse(u))) {
          issues.push(issue("INVALID_SHAPE", s.key,
            `l'échéance « ${u} » n'est pas une date ISO 8601 lisible — cette attente ne se réveillerait jamais.`));
        }
      }
    }
    if (forme.attente === "interdite" && s.waitFor) {
      issues.push(issue("INVALID_SHAPE", s.key, `un nœud ${nodeType} n'attend rien.`));
    }

    /**
     * ── La capacité : existe-t-elle, et l'acteur y a-t-il droit ? ─────────────────────
     *
     * LE DÉFAUT VIENT DE LA TABLE DES TYPES DE NŒUD, et c'est une correction. Il valait
     * `ANALYZE` en dur, ce qui recouvrait par hasard le cas WORKER et surestimait tous les
     * autres — une attente d'événement se voyait attribuer l'effet d'un appel de modèle. Pire :
     * `WAIT_EVENT` et `WAIT_INPUT` n'apparaissaient dans AUCUNE des branches ci-dessous, si bien
     * qu'un plafond `READ` les refusait. La table `EFFET_NOEUD` est exhaustive par le TYPE :
     * ajouter un type de nœud sans lui donner d'effet ne compile plus.
     */
    let effect: Effect = effetDuNoeud(nodeType);
    let idempotent = true;
    let batchable = true;
    let confirmation: "POLICY_ENGINE" | "ALWAYS" | "NEVER" = "NEVER";

    if (s.capability) {
      if (!catalog.has(s.capability)) {
        issues.push(issue("UNKNOWN_CAPABILITY", s.key,
          `la capacité « ${s.capability} » n'existe pas au registre. Un plan ne peut pas inventer un `
          + `outil : il faut décomposer autrement, ou déclarer un manque.`));
      } else if (!catalog.allowed(s.capability, actor)) {
        issues.push(issue("FORBIDDEN_CAPABILITY", s.key,
          `${actor.label} n'a pas le droit d'appeler « ${s.capability} ». Une mission ne contourne `
          + `pas les droits : elle passe par les mêmes.`));
      } else {
        const m = catalog.meta(s.capability);

        // ── §29 : L'INTERDIT STRUCTUREL, VÉRIFIÉ MÊME QUAND LE CATALOGUE DIT OUI ────────
        //
        // L'ordre compte. Si l'on ne regardait la politique qu'après le droit, il suffirait
        // qu'un compte soit trop largement doté pour qu'Adam puisse modifier ses propres
        // permissions. Ici, aucun droit ne lève l'interdit : le refus est de compilation.
        const refus = refusPourActeur(s.capability, m.effect, actor);
        if (refus) {
          issues.push(issue("FORBIDDEN_CAPABILITY", s.key, messageRefus(refus)));
        }

        effect = m.effect;
        idempotent = m.idempotent;
        batchable = m.batchable;
        confirmation = m.confirmation;
        if (!m.declared) {
          warnings.push(issue("INVALID_SHAPE", s.key,
            `« ${s.capability} » n'a pas de métadonnée déclarée : elle est traitée au plus prudent `
            + `(${m.effect}, non rejouable, sous confirmation).`));
        }
      }
    }

    /**
     * ── LE PLAFOND D'EFFET S'APPLIQUE À L'ÉTAPE, PAS SEULEMENT À LA CAPACITÉ ───────────
     *
     * LE FAUX VERT QUE CE BLOC FERME. Un run Render a lancé les trois scénarios en lecture
     * seule, et le rapport a affiché `READ_ONLY_EXECUTION PASS` — pendant que deux missions
     * écrivaient de vrais fichiers XLSX dans le Drive de production :
     *
     *     ARTIFACT · « Vérification Zorbamyxine-K7 » (XLSX, 12 Ko) fabriqué et contrôlé.
     *
     * Le plafond `ANALYZE` était bien posé, mais il ne filtrait QUE LE CATALOGUE, donc que les
     * étapes portant une `capability`. Un nœud ARTIFACT n'en porte pas : il produit un fichier
     * sans passer par le catalogue, et personne ne comparait son effet au plafond. Le plan
     * compilait en annonçant lui-même « effet maximal PREPARE », au-dessus du plafond, et le
     * compilateur l'acceptait — il CALCULAIT `maxEffect` sans jamais s'en servir.
     *
     * Le contrôle porte donc désormais sur l'EFFET de l'étape, quelle que soit sa nature. C'est
     * la seule formulation qui ne laisse pas de porte : un effet est un effet, qu'il vienne
     * d'une capacité déclarée ou d'un nœud qui fabrique.
     *
     * CONSÉQUENCE MESURÉE, ET ELLE EST BONNE. Les fichiers laissés par les runs précédents
     * étaient retrouvés par le run suivant : « il n'existe rien sur cette molécule » devenait
     * faux à cause du banc lui-même. Fermer le trou assainit le scénario par la même occasion.
     */
    if (opts.effetMax && EFFECT_RANK[effect] > EFFECT_RANK[opts.effetMax]) {
      issues.push(issue("FORBIDDEN_EFFECT", s.key,
        `« ${s.title} » porte l'effet ${effect}, au-dessus du plafond ${opts.effetMax} de cette `
        + `mission. Un nœud ${nodeType} produit un effet même sans capacité déclarée : le plafond `
        + `porte sur ce qui SORT, pas sur la façon dont l'étape est écrite.`));
    }

    // ── L'ÉVENTAIL ────────────────────────────────────────────────────────────────────
    const dependsOn = [...new Set(s.dependsOn ?? [])];
    if (s.forEach) {
      if (!s.forEach.from || !s.forEach.path || !s.forEach.as) {
        issues.push(issue("INVALID_SHAPE", s.key,
          "un éventail doit dire d'où vient la collection, où la lire et sous quel nom l'injecter."));
      } else if (!vues.has(s.forEach.from)) {
        issues.push(issue("UNKNOWN_FANOUT_SOURCE", s.key,
          `l'éventail lit « ${s.forEach.from} », qui n'est pas une étape du plan.`));
      } else if (!batchable && s.capability) {
        issues.push(issue("NOT_BATCHABLE", s.key,
          `« ${s.capability} » n'est pas déclarée répétable : la déployer en éventail exécuterait `
          + `N fois un appel dont on ne sait pas s'il supporte d'être répété.`));
      }
      // LA DÉPENDANCE IMPLICITE. Lire la sortie d'une étape, c'est en dépendre — l'écrire à la
      // main serait un oubli de plus à chaque replan, et l'oubli produirait une lecture de vide.
      if (s.forEach.from && !dependsOn.includes(s.forEach.from)) dependsOn.push(s.forEach.from);
    }

    // ── LA CONDITION ──────────────────────────────────────────────────────────────────
    //
    // Observer l'issue d'une étape, c'est en dépendre : la dépendance est implicite, comme
    // pour l'éventail. Le reste est de la cohérence de FORME, refusée ici plutôt que découverte
    // à l'exécution par une étape qui ne partirait jamais sans dire pourquoi.
    if (s.when) {
      const w = s.when;
      const amontConnu = vues.has(w.step) || acquises.has(w.step);
      if (!w.step || !amontConnu) {
        issues.push(issue("INVALID_SHAPE", s.key,
          `la condition observe « ${w.step} », qui n'est pas une étape du plan.`));
      } else {
        if (w.step === s.key) {
          issues.push(issue("INVALID_SHAPE", s.key, "une étape ne peut pas conditionner son propre départ."));
        }
        const amont = plan.steps.find((x) => x.key === w.step);
        const typeAmont = amont ? (amont.nodeType ?? (amont.capability ? "CAPABILITY" : "WORKER")) : null;
        if ((w.outcome === "EVENT" || w.outcome === "TIMEOUT") && typeAmont && typeAmont !== "WAIT_EVENT") {
          issues.push(issue("INVALID_SHAPE", s.key,
            `l'issue ${w.outcome} n'a de sens qu'après une attente d'événement ; « ${w.step} » est un nœud ${typeAmont}.`));
        }
        if (w.op && !w.path) {
          issues.push(issue("INVALID_SHAPE", s.key, `l'opérateur « ${w.op} » exige un champ (path) de la sortie amont.`));
        }
        if (w.op && !["exists", "empty"].includes(w.op) && (w.value === undefined || w.value === "")) {
          issues.push(issue("INVALID_SHAPE", s.key, `l'opérateur « ${w.op} » exige une valeur de comparaison.`));
        }
        if (w.path && !w.op) {
          issues.push(issue("INVALID_SHAPE", s.key, "un champ (path) sans opérateur ne teste rien — préciser op (exists, eq, gt…)."));
        }
        if (!w.outcome && !w.op) {
          issues.push(issue("INVALID_SHAPE", s.key, "une condition doit attendre une issue (outcome) ou tester la sortie (path/op)."));
        }
        if (!dependsOn.includes(w.step)) dependsOn.push(w.step);
      }
    }

    if (dependsOn.length > PLAN_LIMITS.depsPerStep) {
      issues.push(issue("LIMIT_EXCEEDED", s.key,
        `${dependsOn.length} dépendances dépassent la limite de ${PLAN_LIMITS.depsPerStep}. `
        + `Une jonction (JOIN) exprime la même chose sans rendre le graphe illisible.`));
    }
    for (const d of dependsOn) {
      // Une clé ACQUISE est une étape d'un plan antérieur, terminée, dont le résultat est en
      // base. Le moteur la résout ; le compilateur n'a aucune raison de la refuser.
      if (!vues.has(d) && !acquises.has(d)) {
        issues.push(issue("UNKNOWN_DEPENDENCY", s.key, `dépend de « ${d} », qui n'existe pas dans le plan.`));
      }
    }

    // ── LA CARDINALITÉ (§26) ──────────────────────────────────────────────────────────
    //
    // La règle est simple, et c'est sa simplicité qui la rend sûre : une étape qui COMMUNIQUE
    // et qui n'est PAS un éventail ne peut avoir qu'un destinataire. Vouloir écrire à trente-
    // trois personnes se déclare avec `forEach` — ce qui produit trente-trois envois séparés,
    // trente-trois clés d'idempotence, trente-trois reçus.
    const input = s.input ?? {};
    if (EFFECT_RANK[effect] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) {
      const n = nbDestinataires(input);
      if (n > 1 && !s.forEach) {
        issues.push(issue("CARDINALITY", s.key,
          `${n} destinataires dans une seule étape « ${s.capability ?? nodeType} ». Un envoi individuel `
          + `par personne se déclare avec un éventail (forEach), jamais avec une liste : sinon les `
          + `${n} personnes se voient mutuellement, et un seul échec emporte les ${n} envois.`));
      }
      if (n > 1 && s.forEach) {
        issues.push(issue("CARDINALITY", s.key,
          `l'étape est déjà déployée en éventail et porte pourtant ${n} destinataires : chaque `
          + `itération enverrait à tout le monde.`));
      }
    }

    compiled.push({
      key: s.key,
      title: s.title || s.key,
      workstream: s.workstream ?? null,
      nodeType,
      capability: s.capability ?? null,
      input,
      dependsOn,
      effect,
      idempotent,
      // UNE ÉCRITURE NON REJOUABLE EXIGE UNE CLÉ. C'est la seule chose qui empêche un crash à
      // l'étape 73 de renvoyer les soixante-douze e-mails précédents (§15).
      needsIdempotencyKey: !idempotent && EFFECT_RANK[effect] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE,
      needsApproval: confirmation === "ALWAYS"
        || (confirmation === "POLICY_ENGINE" && EFFECT_RANK[effect] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE),
      maxAttempts: Math.min(Math.max(s.maxAttempts ?? 3, 1), 10),
      modelRole: nodeType === "WORKER" ? (s.modelRole ?? "standard") : null,
      forEach: s.forEach ?? null,
      waitFor: s.waitFor ?? null,
      spec: specDe(s),
      wave: 0,
    });
  }

  // ── 4. LE GRAPHE ──────────────────────────────────────────────────────────────────────
  const g = layout(compiled.map((c) => ({ key: c.key, dependsOn: c.dependsOn })));
  if (g.cycle.length > 0) {
    issues.push(issue("CYCLE", g.cycle[0],
      `le graphe contient un cycle (${g.cycle.join(" → ")}) : aucune de ces étapes ne pourra jamais partir.`));
  }
  if (g.depth > PLAN_LIMITS.depth) {
    issues.push(issue("LIMIT_EXCEEDED", null,
      `une chaîne de ${g.depth} étapes consécutives dépasse la limite de ${PLAN_LIMITS.depth}. `
      + `Une telle profondeur est presque toujours une séquence qui pouvait être parallèle.`));
  }
  for (const c of compiled) c.wave = g.wave.get(c.key) ?? 0;

  // POURQUOI IL N'Y A PAS DE VÉRIFICATION « LA SOURCE DE L'ÉVENTAIL EST-ELLE EN AMONT ? »
  //
  // Parce qu'elle ne pourrait jamais échouer : la dépendance implicite ajoutée plus haut fait de
  // `forEach.from` un ancêtre par construction. Si le planner désigne une étape située APRÈS,
  // cette même dépendance ferme un cycle — et c'est `CYCLE` qui est rapporté, ce qui est le bon
  // diagnostic. Ajouter une garde inatteignable donnerait l'illusion d'un contrôle de plus.

  /**
   * ── UN PLAN QUI NE FAIT RIEN N'EST PAS UN PLAN ──────────────────────────────────────
   *
   * Run Render, scénario RECOURS : le juge refuse l'objectif, la replanification tourne, et le
   * plan v2 est UN SEUL nœud JOIN — « clôturer la restitution déjà réalisée ». Un JOIN attend
   * ses dépendances ; sans dépendance, il est DONE à l'instant où il naît. Le plan a été
   * compilé, matérialisé, exécuté en zéro milliseconde, et le juge a relu exactement le même
   * dossier pour rendre exactement le même refus. Une version de plan et deux appels de modèle
   * consommés pour rien.
   *
   * Un plan doit contenir au moins une étape qui PRODUIT quelque chose — un appel, un travail
   * de modèle, un fichier, une attente d'information nouvelle. Les nœuds de structure (JOIN,
   * QA, APPROVAL) organisent ce que d'autres produisent ; seuls, ils n'organisent rien. Le
   * refus renvoie le planner vers la seule sortie utile : une étape qui apporte la preuve
   * manquante, ou aucun plan du tout — et « aucun plan » est une réponse honnête, que
   * l'appelant sait conclure.
   */
  const productives = new Set(["CAPABILITY", "WORKER", "ARTIFACT", "WAIT_EVENT", "WAIT_INPUT"]);
  if (compiled.length > 0 && !compiled.some((c) => productives.has(c.nodeType))) {
    issues.push(issue("INVALID_SHAPE", null,
      `aucune des ${compiled.length} étape(s) ne produit quoi que ce soit : uniquement des nœuds `
      + `de structure (JOIN/QA/APPROVAL). Un plan doit contenir au moins une étape qui apporte `
      + `une information ou un effet nouveau — sinon, ne rends AUCUN plan.`));
  }

  if (issues.length > 0) return { ok: false, issues };

  const maxEffect = effetMaximal(compiled.map((c) => c.effect));
  return {
    ok: true,
    warnings,
    mission: {
      objective: plan.objective,
      acceptance: plan.acceptance,
      complexity: plan.complexity,
      scale: plan.scale,
      steps: compiled,
      maxEffect,
      requiresApproval: compiled.some((c) => c.needsApproval),
      capabilities: [...new Set(compiled.map((c) => c.capability).filter((x): x is string => Boolean(x)))].sort(),
      depth: g.depth,
      gaps: plan.gaps ?? [],
      planMeta: {
        workstreams: plan.workstreams ?? [],
        expectedArtifacts: plan.expectedArtifacts ?? [],
        approvalStrategy: plan.approvalStrategy ?? "BUNDLE",
        completionCriteria: plan.completionCriteria ?? null,
      },
    },
  };
}
