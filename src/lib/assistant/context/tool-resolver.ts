import { detectDomains, type Domain, type QueryRoute } from "./router";
import { normalizeUtterance } from "@/lib/assistant/voice/fast-path";
import { TOOL_DOMAINS_ALL, ALWAYS_ON, EXECUTIVE, DISCOVERY_TOOL } from "./tool-shortlist";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉSOLVEUR D'OUTILS — ne décrire au modèle que ce que la demande peut réellement exiger.
 *
 * ── CE QUI PRÉCÈDE, ET POURQUOI ÇA NE SUFFISAIT PAS ──────────────────────────────────────
 *
 * `fitToolBudget` a éteint un incident : 161 outils envoyés pour un plafond de 128, donc un
 * HTTP 400 sur « Hello ». Il reste en place et il reste utile — mais c'était un PLAFOND, pas une
 * décision. Il ramenait à 106 parce que 106 tenait dans 128, pas parce que 106 outils avaient
 * quelque chose à voir avec la question. « Bonjour » embarquait encore cent-six schémas.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * **On envoie les outils que la demande peut avoir besoin d'appeler. Pas ceux qui tiennent.**
 *
 * Deux faits, tirés du code et non devinés, suffisent à le décider :
 *
 *   LE NIVEAU (A / B / C, `triage.ts`) — combien d'opérations, et sait-on déjà lesquelles ?
 *   LES DOMAINES (`detectDomains`)     — de quoi la phrase parle-t-elle, dans l'ordre où elle
 *                                        en parle ? Le premier est le domaine principal.
 *
 * ── LES QUATRE RÉGIMES ───────────────────────────────────────────────────────────────────
 *
 *   AUCUN  une salutation, un remerciement, un accusé de réception. Rien à faire, donc AUCUN
 *          schéma. C'est le seul régime où l'on descend à zéro, et il est reconnu strictement :
 *          il faut qu'il ne RESTE rien une fois les formules de politesse retirées.
 *   A      une opération, connue d'avance → le socle et les LECTURES du domaine principal.
 *          Pas les écritures : on ne décrit pas comment supprimer un dossier à quelqu'un qui
 *          demande où il en est.
 *   B      plusieurs opérations connues, écritures comprises → socle + lectures ET écritures de
 *          tous les domaines cités.
 *   C      il faut DÉCOUVRIR quoi faire → socle + outils de hauteur + tous les domaines cités.
 *          C'est le régime le plus large, et c'est justifié : le travail EST l'exploration.
 *
 * ── CE QUI REND LA RESTRICTION ACCEPTABLE ────────────────────────────────────────────────
 *
 * `list_more_tools` accompagne A, B et C. Le modèle qui ne trouve pas son compte réclame le
 * reste, et l'obtient dans le même tour. La liste courte est donc un ORDRE DE PRÉSENTATION,
 * jamais une amputation — c'est la condition posée depuis le début, et elle ne bouge pas.
 *
 * Un régime AUCUN n'a pas de découverte, et c'est cohérent : on ne donne pas d'échappatoire à
 * une salutation, on lui répond. Si la reconnaissance se trompait, le tour suivant repart d'une
 * résolution neuve — le coût d'une erreur est un aller-retour, pas une capacité perdue.
 *
 * ── CE QUI RESTE DERRIÈRE ────────────────────────────────────────────────────────────────
 *
 * `fitToolBudget` puis `capTools` restent branchés APRÈS ce module. Ils ne servent plus au
 * fonctionnement normal — ce fichier fait tenir la liste bien en dessous du plafond — mais un
 * garde-fou qui ne se déclenche jamais reste un garde-fou. Le jour où quelqu'un ajoute quarante
 * outils transverses, on veut une liste tronquée et un journal, pas un HTTP 400.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le niveau de la demande, au sens de `triage.ts` — plus « AUCUN », qui n'a pas d'opération. */
export type RequestLevel = "AUCUN" | "A" | "B" | "C";

/**
 * LES PLAFONDS PAR NIVEAU. Ce sont des BORNES, pas des cibles : une demande simple dans un petit
 * domaine sort bien en dessous, et c'est le résultat voulu.
 *
 * Ils ne sont pas arbitraires — ils correspondent à ce qu'un niveau peut réellement appeler :
 * un A appelle une opération (le socle plus une poignée de lectures suffisent), un C explore
 * (il lui faut la hauteur et plusieurs domaines).
 */
/** Tous les domaines métier — le repli quand la phrase n'en désigne aucun. */
const TOUS_DOMAINES: Domain[] = [
  "MAIL", "CALENDAR", "REGULATORY", "FINANCE", "HR", "DRIVE", "LEGAL", "MISSION", "DIRECTORY", "ADMIN",
];

export const LEVEL_CAP: Record<RequestLevel, number> = { AUCUN: 0, A: 15, B: 30, C: 40 };

/**
 * LES FORMULES QUI NE DEMANDENT RIEN.
 *
 * Reconnues sur la phrase ENTIÈRE, pas en sous-chaîne : « bonjour, où en est le dossier ? »
 * n'est pas une salutation, c'est une question précédée d'une salutation. La différence est
 * toute la sûreté de ce régime.
 */
const POLITESSE = /^(bonjour|bonsoir|salut|hello|hi|hey|coucou|yo|slt|re|bjr|merci|merci beaucoup|thanks|thank you|ok|okay|d accord|daccord|parfait|super|tres bien|nickel|bien recu|bien note|noté|note|a plus|au revoir|bonne journee|bonne soiree|bye|ciao|test|ping)$/;

/** Les mots qui ne portent aucune demande — on les retire avant de juger « il ne reste rien ». */
const VIDE = /\b(adam|s il te plait|s il vous plait|stp|svp|please|dis moi|dis|alors|donc|bon|eh|ah|oh|et|le|la|les|un|une|des|du|de|a|au|aux)\b/g;

/**
 * EST-CE QUE LA PHRASE NE DEMANDE RIEN ?
 *
 * Volontairement STRICTE et volontairement CONSERVATRICE : dans le doute, ce n'est PAS une
 * salutation, et la demande reçoit des outils. Se tromper ici dans un sens coûte un aller-retour ;
 * se tromper dans l'autre coûte une capacité, ce qui est plus grave.
 */
export function estSansDemande(question: string): boolean {
  const q = normalizeUtterance(question).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!q) return true;
  if (POLITESSE.test(q)) return true;
  // Une salutation SUIVIE d'autre chose n'en est plus une. On retire les formules connues, puis
  // les mots creux, et on regarde ce qui survit : s'il reste un mot porteur, il y a une demande.
  const reste = q
    .split(" ")
    .filter((m: string) => !POLITESSE.test(m))
    .join(" ")
    .replace(VIDE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return reste.length === 0;
}

/**
 * LE NIVEAU, DÉDUIT DE CE QUE LE CODE SAIT AVANT D'APPELER LE MODÈLE.
 *
 * `triage.ts` dit que le triage A/B/C est fait par le modèle temps réel, qui a le contexte de
 * l'appel. C'est vrai — et sans objet ici : il faut choisir les outils AVANT de lui parler. On
 * ne refait donc pas son jugement, on prend celui que le routeur a déjà rendu, dont la
 * `RouteClass` porte exactement la même distinction sous d'autres noms.
 *
 * L'asymétrie de `triage.ts` est conservée telle quelle : **dans le doute, on monte**. Un B
 * traité comme un A perd un outil ; un C traité comme un A perd la réponse.
 */
export function classifyRequest(question: string, route: Pick<QueryRoute, "route" | "confidence">): RequestLevel {
  if (estSansDemande(question)) return "AUCUN";

  // ON NE COMPTE PAS. Une version de ce code faisait « trois domaines cités = C », et le scénario
  // transverse passait — mais « Prépare un mail à l'ANPP et mets une relance dans l'agenda
  // vendredi » en touche QUATRE (MAIL, REGULATORY, MISSION, CALENDAR) et reste un B : les deux
  // gestes sont nommés, il n'y a rien à découvrir. `triage.ts` le dit en toutes lettres — « le
  // NOMBRE D'ACTIONS ne définit PAS la complexité » — et compter les domaines au lieu des actions
  // ne fait que déplacer la faute. Le vrai critère reste la CONNAISSANCE DU PLAN, et c'est le
  // routeur qui la porte : une demande qui ne nomme pas son geste doit être reconnue par lui
  // (porte DEEP), pas rattrapée ici par un décompte.
  switch (route.route) {
    // Le code a déjà choisi l'outil et l'exécutera lui-même : le modèle ne fait que formuler.
    case "FAST_DETERMINISTIC": return "A";
    case "STRUCTURED_QUERY": return "A";
    case "ACTION": return "B";
    case "HYBRID_RETRIEVAL": return "B";
    case "DEEP_REASONING": return "C";
    // Un routeur qui ne sait pas ne doit pas faire descendre le niveau.
    default: return "C";
  }
}

export interface ResolvedTools<T> {
  tools: (T | typeof DISCOVERY_TOOL)[];
  level: RequestLevel;
  /** Les domaines retenus, dans l'ordre de la phrase — le premier est le principal. */
  domains: Domain[];
  /** Ce qui a été écarté, pour l'observabilité. Un choix qu'on ne peut pas relire ne se corrige pas. */
  dropped: number;
  reason: string;
}

/** Un outil qui écrit ne sert pas à répondre « où en est X ? ». */
const estEcriture = (nom: string, ecritures: ReadonlySet<string>): boolean => ecritures.has(nom);

/**
 * RÉSOUT LA LISTE D'OUTILS D'UN TOUR.
 *
 * `ecritures` est INJECTÉ plutôt qu'importé : les tableaux qui distinguent lecture et écriture
 * vivent dans `assistant.ts`, qui importe déjà ce module. L'importer en retour créerait un cycle
 * — et ce dépôt en connaît déjà un, documenté, qui fait échouer des suites entières. Passer
 * l'ensemble en paramètre coûte un argument et supprime la classe de bogue.
 */
export function resolveTools<T extends { name: string }>(
  tools: T[],
  question: string,
  route: Pick<QueryRoute, "route" | "domain" | "confidence">,
  opts: { ecritures?: ReadonlySet<string>; knownEntities?: { name: string; domain: Domain }[] } = {},
): ResolvedTools<T> {
  const ecritures = opts.ecritures ?? new Set<string>();
  const level = classifyRequest(question, route);

  if (level === "AUCUN") {
    return { tools: [], level, domains: [], dropped: tools.length, reason: "Aucune demande : rien à outiller." };
  }

  // LES DOMAINES DE LA PHRASE, puis celui du routeur en renfort. Le routeur tranche pour UN
  // domaine ; la phrase, elle, peut en toucher plusieurs, et un B qui en cite deux doit servir
  // les deux. `GENERAL` n'ajoute rien : c'est l'aveu du routeur qu'il n'a rien reconnu.
  const detectes = detectDomains(normalizeUtterance(question), opts.knownEntities);
  const domains: Domain[] = [...new Set([...detectes, route.domain])].filter((d) => d !== "GENERAL");

  // AUCUN DOMAINE RECONNU N'EST PAS UNE DEMANDE ÉTROITE — c'est une demande qu'on n'a pas su
  // lire. Les distinguer est tout l'enjeu : sans cela, « audite l'ensemble des demandes
  // bloquées » repartait avec CINQ outils (le socle seul), c'est-à-dire moins qu'une question
  // sur les congés. Le banc l'a montré ; la lecture du code ne l'aurait pas montré.
  //
  // C'est exactement la faute corrigée le même jour dans le routeur de connaissance, où
  // l'absence de marqueur valait preuve que la réponse était dans une colonne. Absence de
  // signal ne vaut pas signal d'absence. On ouvre donc tous les domaines et on laisse le
  // plafond du niveau borner — il est là pour ça.
  const effectifs: Domain[] = domains.length ? domains : TOUS_DOMAINES;

  // ── LE SOCLE. Quatre outils sans lesquels une question devient impossible plutôt que lente.
  const garde = new Set<string>(ALWAYS_ON);

  // ── LES DOMAINES. En A on ne prend que les LECTURES : décrire les écritures d'un domaine à
  //    quelqu'un qui pose une question, c'est offrir l'occasion de se tromper de geste.
  const veutEcritures = level !== "A";
  for (const [nom, ds] of Object.entries(TOOL_DOMAINS_ALL)) {
    if (!ds.some((d) => effectifs.includes(d))) continue;
    if (!veutEcritures && estEcriture(nom, ecritures)) continue;
    garde.add(nom);
  }

  // ── LA HAUTEUR, pour C seulement. Une question causale ne tient dans aucun domaine : la
  //    borner à un domaine serait l'erreur symétrique de celle qu'on corrige.
  if (level === "C") for (const n of EXECUTIVE) garde.add(n);

  // ── LE TRI PAR PERTINENCE, qui décide de ce qui tombe quand le plafond serre.
  //    Il est DÉTERMINISTE et il se relit : socle, puis domaine principal, puis domaines
  //    secondaires dans l'ordre de la phrase, puis hauteur. Couper « les derniers » n'a de sens
  //    que si les derniers sont vraiment les moins utiles.
  const rang = (nom: string): number => {
    if ((ALWAYS_ON as readonly string[]).includes(nom)) return 0;
    const ds = TOOL_DOMAINS_ALL[nom] ?? [];
    const i = effectifs.findIndex((d) => ds.includes(d));
    if (i === 0) return 1;
    if (i > 0) return 1 + i;
    return EXECUTIVE.includes(nom) ? 90 : 99;
  };

  const retenus = tools
    .filter((t) => garde.has(t.name))
    .map((t, ordre) => ({ t, ordre, rang: rang(t.name) }))
    // À rang égal, l'ORDRE D'ORIGINE est conservé : le modèle y est sensible, et une liste dont
    // l'ordre change d'un tour à l'autre rend les comparaisons de mesure fausses.
    .sort((a, b) => a.rang - b.rang || a.ordre - b.ordre)
    .map((x) => x.t);

  // LA DÉCOUVERTE COMPTE DANS LE PLAFOND. Elle était ajoutée APRÈS la coupe, donc un niveau B
  // sortait à 31 pour un plafond de 30 — un dépassement d'exactement un, invisible à la lecture
  // et visible au banc. Un plafond qu'on dépasse toujours de un n'est pas un plafond.
  const cap = Math.max(0, LEVEL_CAP[level] - 1);
  const coupes = Math.max(0, retenus.length - cap);
  const finaux = retenus.slice(0, cap);

  return {
    tools: [...finaux, DISCOVERY_TOOL],
    level,
    domains,
    dropped: tools.length - finaux.length,
    reason: `Niveau ${level}, domaines ${domains.length ? domains.join("+") : "aucun"} — `
      + `${finaux.length}/${tools.length} outils${coupes ? ` (${coupes} au-delà du plafond ${cap})` : ""}.`,
  };
}
