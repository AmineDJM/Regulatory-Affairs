import { COMPLEXITIES, NODE_TYPES, SCALES, APPROVAL_STRATEGIES } from "@/lib/missions/planner/contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SCHÉMA IMPOSÉ AU PLANNER (§2) — une sortie structurée STRICTE, pas de la prose analysée.
 *
 * ── POURQUOI UN SCHÉMA PLUTÔT QU'UN « RÉPONDS EN JSON » ──────────────────────────────────
 *
 * « Réponds en JSON » produit du JSON neuf fois sur dix, et la dixième fois produit du JSON
 * précédé d'une phrase polie. On passe alors sa vie à écrire des rattrapages : couper avant la
 * première accolade, retirer les blocs de code, réparer une virgule. Chacun de ces rattrapages
 * est une invitation à accepter une réponse à moitié valide.
 *
 * Ici la conformité est imposée par le FOURNISSEUR (`strict: true`). Une réponse non conforme
 * n'arrive pas : elle échoue. Et un échec franc est infiniment plus exploitable qu'un objet
 * plausible auquel il manque un champ.
 *
 * ── LES TROIS CONTRAINTES DU MODE STRICT, ET CE QU'ELLES NOUS ONT FAIT CHANGER ───────────
 *
 *   1. tout objet doit porter `additionalProperties: false` ;
 *   2. `required` doit lister TOUTES les propriétés — l'optionnel se dit `["string","null"]` ;
 *   3. aucun objet libre n'est permis.
 *
 * La troisième a une conséquence de fond, et c'est une BONNE conséquence : le planner ne peut
 * pas nous rendre un « objet quelconque ». Ni l'entrée d'une étape, ni le schéma de sortie d'un
 * worker. Il les décrit donc en LISTES DE CHAMPS TYPÉS, et c'est le CODE qui en fabrique
 * l'objet et le JSON Schema. Le modèle décide QUOI ; le code décide COMMENT — littéralement.
 *
 * ── CE QUI N'EST PAS DANS CE SCHÉMA, VOLONTAIREMENT ──────────────────────────────────────
 *
 * Aucun champ ne permet de nommer un modèle, d'accorder un droit, de désigner un rôle ERP ou
 * de lever un garde-fou. Le vocabulaire du planner est CLOS : ce qu'il ne peut pas dire, il ne
 * peut pas le demander. C'est le premier des trois verrous, avant `policy/guard.ts` et la
 * seconde garde du moteur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le type d'une valeur d'entrée, pour reconstruire un objet sans jamais accepter d'objet libre. */
export const INPUT_KINDS = ["TEXT", "NUMBER", "BOOLEAN", "JSON"] as const;
export type InputKind = (typeof INPUT_KINDS)[number];

/** Les types que le planner peut demander dans un schéma de sortie de worker. */
export const FIELD_TYPES = ["string", "number", "boolean", "string[]"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const str = (description: string) => ({ type: "string", description });
const nullableStr = (description: string) => ({ type: ["string", "null"], description });
const enumOf = (values: readonly string[], description: string) => ({
  type: "string",
  enum: [...values],
  description,
});

/** Un objet strict : toutes les propriétés requises, aucune propriété libre. */
function objet(properties: Record<string, unknown>, description?: string) {
  return {
    type: "object",
    ...(description ? { description } : {}),
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const PAIRE_ENTREE = objet(
  {
    key: str("Le nom du champ attendu par la capacité (« to », « subject », « body »)."),
    kind: enumOf(INPUT_KINDS, "TEXT pour du texte, NUMBER, BOOLEAN, ou JSON pour une liste/objet écrit en JSON."),
    value: str(
      "La valeur, TOUJOURS écrite en texte. Pour référencer la sortie d'une étape précédente, " +
        "utiliser {{cle_etape.chemin}} ; pour la valeur courante d'un éventail, {{alias.champ}}.",
    ),
  },
  "Un champ d'entrée. Les objets libres n'existent pas : on décrit, le code reconstruit.",
);

const CHAMP_SORTIE = objet(
  {
    name: str("Nom du champ attendu en sortie du worker."),
    type: enumOf(FIELD_TYPES, "Le type du champ."),
    description: str("Ce que ce champ doit contenir, en une phrase."),
  },
  "Un champ du résultat attendu d'un WORKER.",
);

const ETAPE = objet({
  key: str(
    "Identité STABLE et lisible de l'étape (« liste:salaries », « email:voeux »). " +
      "Jamais un numéro : un numéro change au moindre replan et casse toutes les dépendances.",
  ),
  title: str("Ce que fait l'étape, en français, à l'infinitif ou à l'impératif."),
  workstream: nullableStr("L'identifiant de l'axe de travail auquel cette étape appartient."),
  nodeType: enumOf(NODE_TYPES, "CAPABILITY appelle une capacité ; WORKER fait réfléchir un modèle ; WAIT_EVENT attend un fait ; WAIT_INPUT attend une personne ; APPROVAL demande un accord ; QA contrôle ; ARTIFACT fabrique un fichier ; JOIN attend ses dépendances."),
  capability: nullableStr("Le nom EXACT d'une capacité de la liste fournie. Obligatoire si nodeType vaut CAPABILITY, null sinon. Ne jamais inventer un nom."),
  inputs: { type: "array", items: PAIRE_ENTREE, description: "Les champs d'entrée. Liste vide si l'étape n'en prend pas." },
  dependsOn: {
    type: "array",
    items: { type: "string" },
    description: "Les clés des étapes qui doivent être TERMINÉES avant celle-ci.",
  },
  forEachFrom: nullableStr("Pour une étape répétée : la clé de l'étape amont qui produit la collection. null sinon."),
  forEachPath: nullableStr("Le chemin de la collection dans la sortie de cette étape (« salaries »). null sinon."),
  forEachAs: nullableStr("Le nom sous lequel chaque élément est injecté (« salarie »). null sinon."),
  waitEvent: nullableStr("Pour WAIT_EVENT : le type de fait attendu (par ex. EMAIL_RECEIVED). null sinon."),
  waitFrom: nullableStr("De qui l'on attend le fait (nom, identifiant ou adresse). null sinon."),
  waitEntity: nullableStr("L'entité concernée, en TYPE:id. null sinon."),
  waitAsk: nullableStr("Pour WAIT_INPUT : ce qu'on demande à la personne, en français. null sinon."),
  waitWithinDays: { type: ["integer", "null"], description: "Délai indicatif en jours au-delà duquel relancer. null sinon." },
  outputFields: {
    type: "array",
    items: CHAMP_SORTIE,
    description: "Pour un WORKER : les champs EXACTS attendus en retour. Liste vide pour les autres types.",
  },
  completionCondition: str("À quelle condition VÉRIFIABLE cette étape est finie. « 33 destinataires ont un reçu », pas « le travail est bien fait »."),
  reasoningRequirement: enumOf(
    ["NONE", "LIGHT", "HEAVY"],
    "NONE = extraire/classer/reformuler ; LIGHT = rédiger court ; HEAVY = arbitrer, juger, rédiger ce qu'on signe.",
  ),
  approvalRequirement: enumOf(
    ["NONE", "NORMAL", "SENSITIVE", "CRITICAL"],
    "Le niveau d'accord PROPOSÉ. La politique de la maison tranche ensuite : proposer NONE ne dispense de rien.",
  ),
  maxAttempts: { type: ["integer", "null"], description: "Nombre d'essais avant échec. null pour la valeur par défaut." },
});

const AXE = objet({
  id: str("Identifiant court de l'axe (« voeux », « classement-drive »)."),
  title: str("Le nom de l'axe, en français."),
  outcome: str("Ce que cet axe doit avoir produit quand il est fini."),
});

const LIVRABLE = objet({
  key: str("Identifiant du livrable."),
  format: enumOf(["XLSX", "DOCX", "PDF", "PPTX", "CSV", "ZIP"], "Le format du fichier."),
  title: str("Le nom du fichier attendu, en français."),
  fromStep: nullableStr("La clé de l'étape qui le produit. null si aucune ne le produit encore."),
});

/**
 * LE SCHÉMA COMPLET.
 *
 * `acceptanceCriteria` et `completionCriteria` ne sont PAS deux façons de dire la même chose :
 * le premier est ce qu'on exigeait AVANT de commencer (il sert au juge), le second est le
 * critère arithmétique de fin (il sert au contrôle qualité). Les fusionner ferait disparaître
 * la distinction qui compte : « toutes les étapes ont tourné » n'est pas « l'objectif est
 * atteint » (§10 de la doctrine).
 */
export const MISSION_PLAN_SCHEMA: Record<string, unknown> = objet({
  goal: str("L'objectif reformulé, tel que tu l'as compris, en une ou deux phrases."),
  reasoningComplexity: enumOf(
    COMPLEXITIES,
    "A = le chemin est évident ; B = il demande de la méthode ; C = il demande un arbitrage. " +
      "N'ESTIME PAS d'après le nombre d'étapes : envoyer le même message à trois cents personnes reste A ou B.",
  ),
  executionScale: enumOf(
    SCALES,
    "La QUANTITÉ de travail : S (quelques actions), M, L, XL, MASSIVE (des centaines). " +
      "Indépendant de la difficulté.",
  ),
  acceptanceCriteria: {
    type: "array",
    items: { type: "string" },
    description:
      "Ce qui devra être VRAI pour que la personne considère l'objectif atteint. Écrits pour être vérifiés, " +
      "avec des nombres quand il y en a. Au moins un.",
  },
  workstreams: { type: "array", items: AXE, description: "Les axes de travail. Un seul suffit pour une mission simple." },
  steps: { type: "array", items: ETAPE, description: "Les étapes. Utiliser l'éventail plutôt que de répéter une étape N fois." },
  expectedArtifacts: { type: "array", items: LIVRABLE, description: "Les fichiers attendus. Liste vide si la mission n'en produit aucun." },
  approvalStrategy: enumOf(
    APPROVAL_STRATEGIES,
    "NONE si aucun effet externe ; BUNDLE pour un accord unique sur un lot cohérent ; " +
      "PER_EFFECT_CLASS pour un accord par famille d'effet ; PER_STEP seulement pour un effet irréversible isolé.",
  ),
  completionCriteria: str("La règle ARITHMÉTIQUE de fin : ce qu'il faut compter et à quoi le comparer."),
  gaps: {
    type: "array",
    items: { type: "string" },
    description: "Ce que tu n'as PAS su faire avec les capacités fournies. Vide si tout est couvert. Ne jamais inventer une capacité pour combler un manque.",
  },
  rationale: str("Pourquoi ce plan, en deux phrases. Pour la relecture humaine."),
});

export const MISSION_PLAN_SCHEMA_NAME = "mission_plan";

/** Le poids du schéma en jetons — mesuré, pas estimé au doigt mouillé (§3 `plannerSchemaTokens`). */
export function tailleSchemaJetons(): number {
  return Math.ceil(JSON.stringify(MISSION_PLAN_SCHEMA).length / 3.6);
}
