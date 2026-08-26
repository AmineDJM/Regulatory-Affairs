import type { Domain, QueryRoute } from "./router";

/**
 * NE PAS DÉCRIRE 77 OUTILS POUR RÉPONDRE « OUI, TROIS MAILS » (§23, §24).
 *
 * LA MESURE QUI JUSTIFIE CE FICHIER. Sur le compte le plus puissant, chaque tour du mode texte
 * envoie 38 737 tokens estimés de contexte fixe — dont 23 316 rien qu'en SCHÉMAS D'OUTILS, soit
 * 60 %. Le PDG n'a pas encore ouvert la bouche que la moitié du budget est dépensée à expliquer
 * au modèle comment lire une fiche de paie, alors qu'il demande si Deepak a répondu.
 *
 * CE N'EST PAS QU'UNE QUESTION DE COÛT. Soixante-dix-sept descriptions d'outils, c'est aussi
 * soixante-dix-sept occasions de choisir le mauvais. Réduire la liste au domaine de la question
 * améliore la SÉLECTION autant que la facture — c'est l'argument principal, la facture n'est que
 * le bénéfice visible.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * LA PARITÉ EST NON NÉGOCIABLE, et elle est garantie par TROIS mécanismes, pas par une intention :
 *
 *   1. TOUT OUTIL EST CLASSÉ. `tool-shortlist.test.ts` échoue si un seul outil du registre
 *      n'apparaît pas ici. Un outil ajouté demain sans classement casse la CI — il ne disparaît
 *      pas en silence du champ de vision d'Adam.
 *   2. UN SOCLE EST TOUJOURS LÀ. Recherche universelle, lecture de fiche, résolution de personne,
 *      mémorisation : avec ces quatre-là, aucune question ne devient impossible, seulement plus lente.
 *   3. LA DÉCOUVERTE EXISTE. `list_more_tools` permet au modèle de réclamer le reste quand il ne
 *      trouve pas son compte. C'est l'échappatoire qui transforme une restriction en un ORDRE DE
 *      PRÉSENTATION : rien n'est retiré, tout est différé.
 *
 * Sans ces trois-là, raccourcir la liste serait exactement ce que la mission interdit : une perte
 * de capacité déguisée en optimisation.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Le classement. Un outil peut servir plusieurs domaines — « gmail_prepare_mail » en est un. */
export const TOOL_DOMAINS: Record<string, Domain[]> = {
  // ── Messagerie ──────────────────────────────────────────────────────────────────────────
  gmail_search: ["MAIL"],
  gmail_read_thread: ["MAIL"],
  gmail_pending_mail: ["MAIL"],
  gmail_prepare_mail: ["MAIL"],
  gmail_organize: ["MAIL"],
  gmail_read_attachment: ["MAIL", "DRIVE"],

  // ── Agenda ──────────────────────────────────────────────────────────────────────────────
  read_calendar: ["CALENDAR"],
  gcal_search: ["CALENDAR"],
  gcal_free_slots: ["CALENDAR"],
  find_free_slot: ["CALENDAR"],
  pre_meeting_brief: ["CALENDAR"],

  // ── Réglementaire ───────────────────────────────────────────────────────────────────────
  regulatory_portfolio: ["REGULATORY"],
  regulatory_workload: ["REGULATORY", "HR"],
  product_360: ["REGULATORY"],
  search_hospitals: ["REGULATORY"],
  read_stock: ["REGULATORY"],

  // ── Finances ────────────────────────────────────────────────────────────────────────────
  read_budget: ["FINANCE"],
  read_finances: ["FINANCE"],
  finance_totals: ["FINANCE"],

  // ── Ressources humaines ─────────────────────────────────────────────────────────────────
  read_employee: ["HR"],
  read_hr_overview: ["HR"],
  read_payroll: ["HR"],
  employee_360: ["HR"],
  organization_insights: ["HR"],

  // ── Documents ───────────────────────────────────────────────────────────────────────────
  gdrive_search: ["DRIVE"],
  gdrive_read: ["DRIVE"],
  gdrive_put_internal_file: ["DRIVE"],
  inspect_drive_folder: ["DRIVE"],
  search_drive: ["DRIVE"],
  find_documents: ["DRIVE"],
  read_document: ["DRIVE"],
  gdoc_read_or_append: ["DRIVE"],
  gworkspace_create: ["DRIVE"],
  list_artifacts: ["DRIVE"],
  draft_deliverable: ["DRIVE"],

  // ── Juridique & courriers ───────────────────────────────────────────────────────────────
  search_courriers: ["LEGAL"],

  // ── Missions, engagements, rappels ──────────────────────────────────────────────────────
  mission_status: ["MISSION"],
  mission_create: ["MISSION"],
  mission_consolidate: ["MISSION"],
  mission_nudge_candidates: ["MISSION"],
  list_commitments: ["MISSION"],
  record_commitment: ["MISSION"],
  close_commitment: ["MISSION"],
  plan_reminder: ["MISSION"],
  list_reminders: ["MISSION"],
  cancel_reminder: ["MISSION"],

  // ── Annuaire & personnes ────────────────────────────────────────────────────────────────
  directory_lookup: ["DIRECTORY"],
  directory_list: ["DIRECTORY"],
  person_report: ["DIRECTORY", "HR"],
  supplier_360: ["DIRECTORY"],

  // ── Administration & traçabilité ────────────────────────────────────────────────────────
  adam_status: ["ADMIN"],
  action_history: ["ADMIN"],
  list_decisions: ["ADMIN"],
  record_decision: ["ADMIN"],
  update_decision_outcome: ["ADMIN"],

  // ── Transverses : utiles partout, donc rattachés à GENERAL ──────────────────────────────
  search_everything: ["GENERAL"],
  inspect_record: ["GENERAL"],
  resolve_person: ["GENERAL"],
  company_state: ["GENERAL"],
  ceo_attention: ["GENERAL"],
  executive_brief: ["GENERAL"],
  executive_alerts: ["GENERAL"],
  list_pending_decisions: ["GENERAL"],
  what_changed: ["GENERAL"],
  time_travel: ["GENERAL"],
  investigate_event: ["GENERAL"],
  process_insights: ["GENERAL"],
  simulate_scenario: ["GENERAL"],
  create_report: ["GENERAL"],
  remember: ["GENERAL"],
  forget_memory: ["GENERAL"],
  list_memories: ["GENERAL"],
  recall_conversation: ["GENERAL"],
  episodic_recall: ["GENERAL"],
  search_knowledge_corpus: ["GENERAL"],
  read_corpus_document: ["GENERAL"],
  list_corpus_sources: ["GENERAL"],
};

/**
 * LE SOCLE — présent à CHAQUE appel de modèle, quel que soit le domaine.
 *
 * Quatre outils, choisis pour qu'aucune question ne devienne IMPOSSIBLE quand le domaine est mal
 * deviné : de quoi chercher partout, ouvrir n'importe quelle fiche, identifier une personne — et
 * RETENIR ce que le PDG vient de dire. Ce dernier n'est pas un confort : oublier une consigne
 * parce que la question portait sur la messagerie serait une régression franche, et c'est le seul
 * des transverses dont l'absence ne se rattrape pas au tour suivant.
 * Un mauvais aiguillage coûte alors un tour de plus, jamais un « je ne peux pas ».
 */
export const ALWAYS_ON = ["search_everything", "inspect_record", "resolve_person", "remember"] as const;

/**
 * LES OUTILS DE HAUTEUR — pour les questions qui traversent l'entreprise.
 *
 * Une question causale (« pourquoi on en est arrivé là ? ») ne tient dans aucun domaine : elle
 * demande l'état d'ensemble, la chronologie et les contradictions. Les restreindre à un domaine
 * serait l'erreur symétrique de celle qu'on corrige.
 */
const EXECUTIVE = [
  "company_state", "ceo_attention", "executive_brief", "executive_alerts",
  "what_changed", "time_travel", "investigate_event", "process_insights", "simulate_scenario",
];

/**
 * L'ÉCHAPPATOIRE QUI PRÉSERVE LA PARITÉ. Sans elle, la liste courte serait une amputation ; avec
 * elle, ce n'est qu'un ordre de présentation. Le modèle qui ne trouve pas son compte demande, et
 * reçoit — au prix d'un tour, pas d'une capacité.
 */
export const DISCOVERY_TOOL = {
  name: "list_more_tools",
  description:
    "LES AUTRES OUTILS. Cette conversation ne montre que les outils du domaine en cours. "
    + "Si ce que vous cherchez n'y est pas — un autre module, une lecture chiffrée, une action "
    + "d'un autre pôle — appelez ceci avec le domaine voulu pour obtenir la liste complète. "
    + "Ne répondez JAMAIS « je n'ai pas d'outil pour cela » sans avoir appelé ceci d'abord.",
  input_schema: {
    type: "object" as const,
    properties: {
      domain: {
        type: "string",
        description: "Domaine cherché : MAIL, CALENDAR, REGULATORY, FINANCE, HR, DRIVE, LEGAL, MISSION, DIRECTORY, ADMIN — ou vide pour tout.",
      },
    },
  },
};

/** Les noms d'outils que cette route mérite. Rendu séparément du filtrage, pour être testable. */
export function shortlistNames(route: Pick<QueryRoute, "route" | "domain">): string[] {
  // Une route déterministe n'appelle aucun modèle : elle n'a besoin d'aucun schéma.
  if (route.route === "FAST_DETERMINISTIC") return [];

  const keep = new Set<string>(ALWAYS_ON);
  // LE DOMAINE SEUL — et surtout PAS « + GENERAL ».
  //
  // La première version ajoutait GENERAL à tous les domaines : les vingt-deux outils transverses
  // repartaient dans chaque liste, et la « liste courte » ne raccourcissait rien. Le test l'a
  // montré en une ligne (raisonnement profond et requête simple donnaient le MÊME nombre d'outils).
  // Ce qui est vraiment universel tient dans le socle ci-dessus ; le reste se découvre.
  const wanted: Domain[] = [route.domain];

  for (const [name, domains] of Object.entries(TOOL_DOMAINS)) {
    if (domains.some((d) => wanted.includes(d))) keep.add(name);
  }
  // Le raisonnement profond voit large — c'est sa raison d'être.
  if (route.route === "DEEP_REASONING") for (const n of EXECUTIVE) keep.add(n);

  return [...keep].sort();
}

/**
 * Filtre une liste de définitions d'outils, en conservant l'ORDRE d'origine (le modèle y est
 * sensible) et en ajoutant toujours la découverte.
 *
 * Un outil absent du classement est CONSERVÉ, jamais écarté. C'est le comportement sûr : le
 * ratchet de test signalera l'oubli au développeur, mais en attendant, la production ne perd
 * aucune capacité à cause d'une ligne oubliée dans une table.
 */
export function shortlistTools<T extends { name: string }>(
  tools: T[],
  route: Pick<QueryRoute, "route" | "domain">,
): (T | typeof DISCOVERY_TOOL)[] {
  if (route.route === "FAST_DETERMINISTIC") return [];
  const names = new Set(shortlistNames(route));
  const kept = tools.filter((t) => names.has(t.name) || !(t.name in TOOL_DOMAINS));
  return [...kept, DISCOVERY_TOOL];
}
