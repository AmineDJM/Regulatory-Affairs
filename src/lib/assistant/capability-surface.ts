import type { CurrentUser } from "@/lib/session";
import { assistantToolsFor, RESOLVER_WRITE_NAMES } from "@/lib/assistant";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ADAM PEUT RÉELLEMENT FAIRE — une seule source de vérité, pour toutes les surfaces.
 *
 * ── LA PANNE QUI A PRODUIT CE FICHIER ────────────────────────────────────────────────────
 *
 * En production, à l'oral :
 *
 *     — « Envoie un mail à Alla lui disant salut j'espère que tu vas bien. »
 *     — « Je ne peux pas l'envoyer moi-même depuis ce système en l'état. Il manque l'action
 *        d'envoi d'e-mail dans les fonctions disponibles. »
 *
 * Adam n'a pas halluciné : il a décrit fidèlement la liste qu'on lui avait donnée.
 * `VOICE_FAST_TOOL_NAMES` était une liste blanche écrite à la main de trente et un outils
 * EXCLUSIVEMENT EN LECTURE. `send_email` existe, `create_task` existe, l'approbation vocale
 * existe, le transport Gmail existe — rien de tout cela n'était annoncé à la session vocale.
 *
 * Et le piège se refermait : la consigne de délégation dit, en toutes lettres, « NE DÉLÈGUE PAS
 * une demande dont tu connais déjà les gestes… c'est un niveau B, tu l'exécutes toi-même ».
 * Envoyer un mail à un destinataire connu EST un niveau B. Adam ne déléguait donc pas — et ne
 * pouvait pas exécuter. TOUTE écriture de niveau B était structurellement inatteignable à la
 * voix, et le symptôme s'affichait comme une incapacité du produit.
 *
 * ── LA RÈGLE, ET POURQUOI ELLE EST STRUCTURELLE PLUTÔT QU'UNE CONSIGNE ───────────────────
 *
 * Une capacité ouverte à quelqu'un est ATTEIGNABLE sur toutes ses surfaces. Toujours. Elle est
 * soit ANNONCÉE DIRECTEMENT au modèle, soit atteignable PAR DÉLÉGATION — jamais absente.
 *
 * Ce fichier ne réécrit pas la liste des outils : il PROJETTE l'unique registre
 * (`assistantToolsFor`, borné par les droits) sur chaque surface, et un test échoue si une
 * capacité tombe dans un troisième cas. Une liste blanche recopiée à la main peut diverger en
 * silence ; une projection calculée ne le peut pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Là où Adam parle. Le texte annonce tout ; la voix paie chaque outil en latence. */
export type Surface = "text" | "voice";

/**
 * COMMENT UNE CAPACITÉ EST ATTEIGNABLE SUR UNE SURFACE.
 *
 * Il n'y a que deux valeurs, et c'est tout le propos : « absente » n'est pas un état permis.
 */
export type Reach = "direct" | "delegated";

export interface CapabilityView {
  name: string;
  /** Une écriture passe par une carte de confirmation ; une lecture répond tout de suite. */
  kind: "read" | "write";
  reach: Reach;
}

/**
 * LES ÉCRITURES ANNONCÉES DIRECTEMENT À LA VOIX.
 *
 * Le critère n'est pas « inoffensif » — aucune ne l'est, elles produisent toutes une carte de
 * confirmation. Le critère est CONVERSATIONNEL : le geste est entièrement connu depuis la
 * phrase prononcée (« envoie un mail à X en disant Y », « demande à Z de faire W »), donc c'est
 * un niveau B, donc la consigne de délégation INTERDIT de le déléguer. Ce sont exactement les
 * écritures qui doivent être ici, et les seules.
 *
 * Les autres écritures (paie, paiements, réglages plateforme, suppressions) restent hors de la
 * voix : leur geste demande des champs qu'on ne dicte pas, et elles passent par la délégation,
 * qui les propose à l'écran avec le même circuit de confirmation.
 */
export const VOICE_DIRECT_WRITES: readonly string[] = [
  "send_email",
  "send_message",
  "create_task",
  "create_calendar_event",
] as const;

/**
 * LES LECTURES ANNONCÉES DIRECTEMENT À LA VOIX — les fast paths.
 *
 * Sous-ensemble CHOISI : le budget de contexte temps réel se paie en latence, on n'y verse pas
 * les ~90 outils. Ce qui n'est pas ici reste atteignable par délégation, et la consigne vocale
 * le dit explicitement au modèle.
 */
export const VOICE_DIRECT_READS: readonly string[] = [
  "search_everything",
  "inspect_record",
  "employee_360",
  "read_payroll",
  "read_hr_overview",
  "read_budget",
  "read_finances",
  "finance_totals",
  "read_calendar",
  "read_stock",
  "search_drive",
  "read_document",
  "find_documents",
  "product_360",
  "supplier_360",
  "company_state",
  "ceo_attention",
  "executive_alerts",
  "list_pending_decisions",
  "search_knowledge_corpus",
  "time_travel",
  "action_history",
  "what_changed",
  "episodic_recall",
  "regulatory_workload",
  "regulatory_portfolio",
  "investigate_event",
  "inspect_drive_folder",
  "plan_reminder",
  "list_commitments",
  "list_decisions",
  "remember",
  "recall_conversation",
  // L'ANNUAIRE, ajouté avec les écritures : « c'est quoi le mail d'Alla ? » puis « envoie-lui un
  // mail » est UNE seule intention en deux temps. Résoudre la personne par délégation puis
  // écrire en direct ferait payer un aller-retour d'orchestrateur pour une adresse.
  "search_people",
  // LES CAPACITÉS MÉTIER, annoncées à la voix pour la raison qui gouverne cette liste : la voix
  // paie chaque outil en latence, donc n'y entre que ce qui en FAIT ÉCONOMISER. Ces deux-là sont
  // le cas le plus net du registre — « combien rapporte le produit X ? » passait par cinq
  // outils, dont une délégation à l'orchestrateur ; elle en demande UN. Les retirer d'ici
  // rendrait la voix plus lente, pas plus légère.
  "product_economics",
  "pch_market_status",
] as const;

/** Les noms annoncés directement à la voix — lectures puis écritures, l'ordre est significatif. */
export function voiceDirectNames(): readonly string[] {
  return [...VOICE_DIRECT_READS, ...VOICE_DIRECT_WRITES];
}

const isWrite = (name: string): boolean => RESOLVER_WRITE_NAMES.has(name);

/**
 * LA PROJECTION — toutes les capacités ouvertes à CETTE personne, avec leur portée sur CETTE
 * surface. C'est la fonction qu'interrogent la voix, le texte, le résolveur d'outils et les
 * tests : une seule vérité, quatre lecteurs.
 */
export function capabilitiesFor(user: CurrentUser, surface: Surface): CapabilityView[] {
  const direct = new Set(surface === "voice" ? voiceDirectNames() : []);
  return assistantToolsFor(user).map((t) => ({
    name: t.name,
    kind: isWrite(t.name) ? ("write" as const) : ("read" as const),
    // En texte, TOUT est annoncé : le résolveur d'outils réduit la liste par pertinence, pas par
    // capacité — un outil écarté pour ce tour-ci reste rouvrable par découverte.
    reach: surface === "text" || direct.has(t.name) ? ("direct" as const) : ("delegated" as const),
  }));
}

/** Cette capacité est-elle annoncée directement sur cette surface ? */
export function isDirectOn(user: CurrentUser, surface: Surface, name: string): boolean {
  return capabilitiesFor(user, surface).some((c) => c.name === name && c.reach === "direct");
}

/**
 * CETTE CAPACITÉ EXISTE-T-ELLE POUR CETTE PERSONNE ? La question que la voix se posait mal.
 *
 * Rend `true` dès que la capacité est ouverte au compte, QUELLE QUE SOIT la surface : c'est
 * précisément ce qui permet d'interdire « cette fonction n'existe pas » quand elle existe et
 * n'est qu'à un appel de délégation.
 */
export function hasCapability(user: CurrentUser, name: string): boolean {
  return assistantToolsFor(user).some((t) => t.name === name);
}

/**
 * LA CONSIGNE ANTI-« JE NE PEUX PAS » — injectée dans les instructions vocales.
 *
 * Elle NOMME les écritures directes plutôt que de les décrire en général : un modèle qui lit
 * « tu peux écrire » sans savoir avec quoi retombe sur la prudence, c'est-à-dire sur le refus
 * qu'on vient de corriger.
 */
export function capabilityDoctrine(user: CurrentUser): string {
  const ecritures = VOICE_DIRECT_WRITES.filter((n) => hasCapability(user, n));
  const lignes = [
    "CE QUE TU PEUX FAIRE :",
    "- Ne dis JAMAIS qu'une fonction « n'est pas disponible » ou « n'existe pas », et ne propose",
    "  jamais de copier-coller un texte ailleurs : ce qui n'est pas dans tes outils s'atteint par",
    "  `delegate_to_chief_of_staff` — un DÉTOUR, jamais une incapacité.",
  ];
  if (ecritures.length > 0) {
    lignes.push(
      `- Tu ÉCRIS en direct : ${ecritures.join(", ")}. Chacun AFFICHE une carte de confirmation et`,
      "  n'exécute rien avant. Appelle l'outil au lieu de demander « quel objet ? » : les champs",
      "  manquants ont des défauts sensés. UNE demande = UNE carte = UNE confirmation.",
    );
  }
  return lignes.join("\n");
}
