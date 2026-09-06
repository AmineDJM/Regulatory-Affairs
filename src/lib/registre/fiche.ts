/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FICHE D'UNE CAPACITÉ (mandat 6 §44) — ce qu'on sait d'elle, et ce qu'on n'en sait PAS.
 *
 * ── CE QUE LE REGISTRE EXISTANT DIT DÉJÀ, ET CE QU'IL NE DIT PAS ─────────────────────────
 *
 * `registry/capability-meta.ts` répond au COMPILATEUR : effet, rejouabilité, groupabilité,
 * confirmation, contrat de sortie. C'est exactement ce qu'il faut pour décider si un plan est
 * légal. Ce n'est pas ce qu'il faut pour décider s'il est RAISONNABLE.
 *
 * Choisir entre deux capacités qui savent toutes deux répondre suppose de savoir laquelle a
 * déjà marché, combien de temps elle prend, ce qu'elle coûte, ce dont elle dépend, et ce
 * qu'elle laisse derrière elle. Aucune de ces cinq choses n'est dans la méta.
 *
 * ── LA RÈGLE QUI TIENT TOUT CE FICHIER : MESURÉ OU NUL, JAMAIS DÉFAUT FLATTEUR ───────────
 *
 * Une capacité jamais exécutée n'a pas une fiabilité de 100 % : elle a une fiabilité INCONNUE.
 * `fiabilite.taux` vaut donc `null` tant que `appels === 0`, et un tri par fiabilité ne
 * remonte pas les capacités jamais essayées au sommet. C'est le même principe que
 * `receiptData.resultCount: null` ailleurs dans le runtime — zéro est une affirmation, null est
 * une absence de mesure, et les confondre fabrique de la preuve à partir d'un trou.
 *
 * La même règle vaut pour le COÛT. Un appel de capacité n'est pas facturé aujourd'hui ; ce qui
 * est facturé, c'est le fournisseur derrière (recherche web, modèle d'un worker). La fiche
 * classe donc la DÉPENSE — rien, un quota, une facture — et ne remplit un montant que lorsqu'il
 * a été mesuré. Inventer « 0,003 $ » ferait un tableau de bord crédible et faux.
 *
 * ── POURQUOI CE MODULE EST PUR ───────────────────────────────────────────────────────────
 *
 * Il ne lit ni la base, ni les droits, ni le catalogue. Il COMPOSE : on lui donne la méta, le
 * résumé, le contrat d'entrée et les mesures observées, il rend une fiche. Le pont
 * (`platform/in-process/registre/`) va chercher ces matériaux là où ils vivent réellement —
 * `MissionStep` pour les mesures, le catalogue pour les droits de la personne. Un module pur se
 * teste sans Postgres, et surtout : il ne peut pas s'octroyer un droit qu'il ne connaît pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { EFFECT_RANK, type Effect, type LatencyClass, type Primitive } from "@/lib/missions/registry/capability-meta";
import type { Contrat } from "@/lib/missions/registry/result-contract";
import type { ChampEntree } from "@/lib/missions/ports";
import { classer, type Manque } from "@/lib/registre/manques";

/**
 * CE QUI A ÉTÉ OBSERVÉ D'UNE CAPACITÉ — le seul matériau qui autorise à parler de fiabilité.
 *
 * Rien ici n'est déclaré : tout se compte sur des étapes de mission réellement exécutées.
 * `echantillon` voyage avec les taux, parce qu'un taux sur trois appels n'est pas un taux.
 */
export interface Mesures {
  appels: number;
  succes: number;
  echecs: number;
  /** Les étapes qui ont dû être rejouées (`attempt > 1`) — un signal distinct de l'échec final. */
  reprises: number;
  /** Millisecondes, médiane observée. `null` quand aucune étape n'a de durée exploitable. */
  p50Ms: number | null;
  p90Ms: number | null;
  /** Le dernier message d'échec, tel quel — la matière du classement de manque. */
  dernierEchec: string | null;
  dernierEchecLe: string | null;
  dernierSuccesLe: string | null;
  /** Le coût mesuré, quand il y en a un (un worker facture ses jetons). `null` = non mesuré. */
  coutUsd: number | null;
}

export const AUCUNE_MESURE: Mesures = {
  appels: 0, succes: 0, echecs: 0, reprises: 0, p50Ms: null, p90Ms: null,
  dernierEchec: null, dernierEchecLe: null, dernierSuccesLe: null, coutUsd: null,
};

/** La nature de la dépense — pas un montant inventé. */
export type ClasseDepense = "NUL" | "QUOTA" | "FACTURE";

export const SENS_DEPENSE: Readonly<Record<ClasseDepense, string>> = {
  NUL: "une requête sur la base de l'entreprise : rien n'est facturé",
  QUOTA: "un service externe gratuit mais plafonné — le risque est l'épuisement du quota, pas la facture",
  FACTURE: "un fournisseur qui facture à l'appel — chaque exécution a un prix",
};

export type NiveauRisque = "AUCUN" | "FAIBLE" | "MOYEN" | "ELEVE" | "CRITIQUE";

export interface FicheCapacite {
  id: string;
  domaine: string;
  primitive: Primitive;
  /** Une phrase, à l'impératif, telle que le catalogue la publie. */
  resume: string;

  // ── CE QU'ELLE FAIT ──────────────────────────────────────────────────────────────────
  effet: Effect;
  rejouable: boolean;
  groupable: boolean;
  confirmation: "POLICY_ENGINE" | "ALWAYS" | "NEVER";
  /** DÉCLARÉE = quelqu'un l'a qualifiée ; DÉRIVÉE = le registre a deviné, prudemment. */
  qualification: "DECLAREE" | "DERIVEE";

  // ── CE QU'ELLE ACCEPTE ET CE QU'ELLE PROMET ──────────────────────────────────────────
  entrees: readonly ChampEntree[] | null;
  contrat: Contrat;

  // ── CE QU'ELLE COÛTE ─────────────────────────────────────────────────────────────────
  latence: { classeAnnoncee: LatencyClass; p50Ms: number | null; p90Ms: number | null; echantillon: number };
  depense: { classe: ClasseDepense; pourquoi: string; mesureUsd: number | null };

  // ── CE QU'ELLE VAUT (mesuré, ou rien) ────────────────────────────────────────────────
  fiabilite: {
    /** `null` = jamais exécutée. Ce n'est PAS zéro et ce n'est pas un. */
    taux: number | null;
    echantillon: number;
    reprises: number;
    dernierEchec: string | null;
    /** Le manque classé du dernier échec — la fiche PORTE le diagnostic, elle ne le cache pas. */
    manque: Manque | null;
  };

  // ── CE QU'ELLE RISQUE ────────────────────────────────────────────────────────────────
  risque: { niveau: NiveauRisque; raisons: string[] };

  // ── CE QU'ELLE NE GARANTIT PAS ───────────────────────────────────────────────────────
  limites: string[];

  // ── CE QU'ELLE LAISSE ET CE DONT ELLE DÉPEND ─────────────────────────────────────────
  evenements: string[];
  dependances: string[];

  /** Autorisée POUR CETTE PERSONNE — `null` quand la question n'a pas été posée à un catalogue. */
  autorisee: boolean | null;
}

/** Ce que le pont fournit pour composer une fiche : la méta, le résumé, le contrat, les mesures. */
export interface MatiereFiche {
  id: string;
  domaine: string;
  primitive: Primitive;
  resume?: string | null;
  effet: Effect;
  rejouable: boolean;
  groupable: boolean;
  confirmation: "POLICY_ENGINE" | "ALWAYS" | "NEVER";
  latence: LatencyClass;
  contrat: Contrat;
  declaree: boolean;
  entrees?: readonly ChampEntree[] | null;
  mesures?: Mesures | null;
  autorisee?: boolean | null;
}

/**
 * LES DOMAINES QUI DÉPENDENT D'UN TIERS — et ce que le tiers coûte.
 *
 * La table est courte parce qu'elle ne dit que ce qui est vrai de l'installation : Google est
 * un quota (le compte est gratuit, l'API est plafonnée), la recherche web est une facture (le
 * fournisseur compte les appels), tout le reste tape la base de l'entreprise.
 */
const TIERS: Record<string, { classe: ClasseDepense; depend: string }> = {
  mail: { classe: "QUOTA", depend: "un compte Google connecté (Gmail)" },
  calendar: { classe: "QUOTA", depend: "un compte Google connecté (Agenda)" },
  google: { classe: "QUOTA", depend: "un compte Google connecté" },
  web: { classe: "FACTURE", depend: "le fournisseur de recherche web" },
  messaging: { classe: "NUL", depend: "les abonnements push (VAPID) des destinataires" },
};

function depenseDe(m: MatiereFiche): { classe: ClasseDepense; pourquoi: string } {
  const tiers = TIERS[m.domaine];
  if (tiers) return { classe: tiers.classe, pourquoi: SENS_DEPENSE[tiers.classe] };
  return { classe: "NUL", pourquoi: SENS_DEPENSE.NUL };
}

/**
 * LE RISQUE — dérivé, et chaque cran porte sa raison.
 *
 * Il ne se confond pas avec l'effet : une lecture qui échoue une fois sur deux est risquée pour
 * une mission (elle la bloque) sans rien détruire. Le risque combine donc la GRAVITÉ de l'effet,
 * la réversibilité et ce qui a été MESURÉ.
 */
function risqueDe(m: MatiereFiche, mesures: Mesures): { niveau: NiveauRisque; raisons: string[] } {
  const raisons: string[] = [];
  let cran = 0;

  const rang = EFFECT_RANK[m.effet];
  if (rang >= EFFECT_RANK.SECURITY_ADMIN) { cran = 4; raisons.push("touche à la sécurité : jamais confiée à l'agent (policy/guard.ts)"); }
  else if (rang >= EFFECT_RANK.DESTRUCTIVE) { cran = 4; raisons.push("destructif : ce qu'elle défait ne se refait pas"); }
  else if (rang >= EFFECT_RANK.HR_SENSITIVE) { cran = 3; raisons.push("touche à des données de personnes"); }
  else if (rang >= EFFECT_RANK.FINANCIAL_COMMITMENT) { cran = 3; raisons.push("engage de l'argent"); }
  else if (rang >= EFFECT_RANK.EXTERNAL_COMMUNICATION) { cran = 3; raisons.push("sort de l'entreprise : un envoi ne se rappelle pas"); }
  else if (rang >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) { cran = 2; raisons.push("écrit, mais à l'intérieur et de façon réversible"); }
  else if (rang >= EFFECT_RANK.PREPARE) { cran = 1; raisons.push("prépare sans engager"); }

  if (!m.rejouable && rang >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) {
    raisons.push("non rejouable : sans clé d'idempotence, une reprise après panne referait l'effet");
  }
  if (!m.declaree && rang >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) {
    raisons.push("métadonnée DÉRIVÉE et non déclarée : ce qui est dit d'elle est une prudence, pas une connaissance");
  }
  // LA MESURE PEUT AGGRAVER, JAMAIS ADOUCIR. Une capacité qui a marché cent fois reste
  // destructive ; une capacité qui échoue la moitié du temps devient un risque de mission.
  if (mesures.appels >= 5) {
    const taux = mesures.succes / mesures.appels;
    if (taux < 0.5) { cran = Math.max(cran, 3); raisons.push(`échoue plus d'une fois sur deux (${mesures.succes}/${mesures.appels} mesurés)`); }
    else if (taux < 0.9) { cran = Math.max(cran, 2); raisons.push(`échoue parfois (${mesures.succes}/${mesures.appels} mesurés)`); }
  }
  const niveaux: NiveauRisque[] = ["AUCUN", "FAIBLE", "MOYEN", "ELEVE", "CRITIQUE"];
  return { niveau: niveaux[cran] ?? "AUCUN", raisons };
}

/**
 * LES LIMITES — la partie de la fiche qui dit ce qu'on ne sait pas.
 *
 * C'est elle qui rend le registre utile à un planificateur : « cette capacité n'a pas de contrat
 * de sortie » signifie que le moteur ne pourra pas distinguer un vrai résultat d'une phrase
 * d'excuse, et donc qu'il faut prévoir un contrôle ailleurs.
 */
function limitesDe(m: MatiereFiche, mesures: Mesures): string[] {
  const l: string[] = [];
  if (m.contrat === "LIBRE") l.push("aucun contrat de sortie : « elle a répondu » ne se distingue pas de « elle a réussi »");
  if (!m.entrees || m.entrees.length === 0) l.push("schéma d'entrée inconnu du registre : le compilateur ne peut pas vérifier ce que le planificateur écrit");
  if (!m.groupable) l.push("non groupable : une collection de trois cents exige trois cents étapes, pas un éventail");
  if (!m.rejouable) l.push("non rejouable : deux appels identiques produisent deux effets");
  if (!m.declaree) l.push("non déclarée : effet, latence et groupabilité sont DÉRIVÉS du nom, donc prudents et peut-être faux");
  if (mesures.appels === 0) l.push("jamais exécutée en mission : sa fiabilité est INCONNUE — ce n'est pas « bonne »");
  else if (mesures.appels < 5) l.push(`mesurée sur ${mesures.appels} appel(s) seulement : le taux affiché ne veut pas encore dire grand-chose`);
  if (mesures.p50Ms === null) l.push("latence jamais mesurée : la classe annoncée est une intention, pas une observation");
  return l;
}

/** Ce qu'une exécution laisse dans le journal — dérivé de ce que le moteur écrit réellement. */
function evenementsDe(m: MatiereFiche): string[] {
  const e = ["STEP_STARTED", "STEP_DONE", "STEP_FAILED"];
  if (m.confirmation !== "NEVER") e.push("APPROVAL_REQUESTED");
  if (EFFECT_RANK[m.effet] >= EFFECT_RANK.INTERNAL_REVERSIBLE_WRITE) e.push("AssistantActionIntent (reçu d'écriture)");
  return e;
}

function dependancesDe(m: MatiereFiche): string[] {
  const d: string[] = ["la base de l'entreprise (Postgres)"];
  const tiers = TIERS[m.domaine];
  if (tiers) d.unshift(tiers.depend);
  if (m.confirmation !== "NEVER") d.push("une personne, pour l'accord (§15 : jamais l'agent)");
  return d;
}

/** COMPOSE LA FICHE. Aucun défaut flatteur : ce qui n'a pas été mesuré reste `null`. */
export function composerFiche(m: MatiereFiche): FicheCapacite {
  const mesures = m.mesures ?? AUCUNE_MESURE;
  const depense = depenseDe(m);
  return {
    id: m.id,
    domaine: m.domaine,
    primitive: m.primitive,
    resume: (m.resume ?? "").trim() || `Capacité « ${m.id} » du domaine ${m.domaine}.`,
    effet: m.effet,
    rejouable: m.rejouable,
    groupable: m.groupable,
    confirmation: m.confirmation,
    qualification: m.declaree ? "DECLAREE" : "DERIVEE",
    entrees: m.entrees && m.entrees.length ? m.entrees : null,
    contrat: m.contrat,
    latence: { classeAnnoncee: m.latence, p50Ms: mesures.p50Ms, p90Ms: mesures.p90Ms, echantillon: mesures.appels },
    depense: { ...depense, mesureUsd: mesures.coutUsd },
    fiabilite: {
      taux: mesures.appels > 0 ? mesures.succes / mesures.appels : null,
      echantillon: mesures.appels,
      reprises: mesures.reprises,
      dernierEchec: mesures.dernierEchec,
      manque: mesures.dernierEchec ? classer(mesures.dernierEchec, { capacite: m.id }) : null,
    },
    risque: risqueDe(m, mesures),
    limites: limitesDe(m, mesures),
    evenements: evenementsDe(m),
    dependances: dependancesDe(m),
    autorisee: m.autorisee ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// INTERROGER LE REGISTRE — pendant une mission, pas dans le prompt.
// ═══════════════════════════════════════════════════════════════════════════════════════════

export interface Requete {
  /** Des mots de la demande : on marque sur le nom, le domaine et le résumé. */
  texte?: string;
  primitive?: Primitive;
  domaine?: string;
  /** Le plafond d'effet : ce qui est plus grave est ÉCARTÉ, avec sa raison. */
  effetMax?: Effect;
  groupable?: boolean;
  rejouable?: boolean;
  /** Exclut ce qui échoue trop. Les capacités NON MESURÉES ne sont pas écartées : elles sont dites. */
  fiabiliteMin?: number;
  /** N'inclut que ce que la personne a le droit d'appeler. */
  autoriseeSeulement?: boolean;
  /**
   * LE SEUIL DE PERTINENCE — un seul mot croisé dans un résumé n'est pas une capacité qui répond.
   *
   * Mesuré sur le catalogue réel : « faire signer électroniquement ce contrat via DocuSign »
   * trouvait une capacité parce qu'elle contient le mot « contrat » dans sa phrase de résumé. Le
   * registre répondait donc « quelque chose sait faire ça » là où RIEN ne sait signer — et un
   * faux positif ici est le pire des résultats, puisqu'il empêche de nommer le manque.
   *
   * 1 par défaut (tout ce qui marque) ; `detecterManque` exige 3, c'est-à-dire un marquage sur
   * le NOM de la capacité, ou plusieurs mots croisés.
   */
  pertinenceMin?: number;
  /**
   * COMBIEN DE MOTS DISTINCTS DOIVENT MARQUER — la garde qui manquait.
   *
   * Un seul mot suffit à atteindre trois points quand il tombe dans le NOM d'une capacité. Sur le
   * catalogue complet, « faire signer électroniquement ce contrat via DocuSign » trouvait ainsi
   * une capacité dont le nom contient « contrat » : le registre concluait qu'il savait signer.
   * Exiger deux mots distincts sépare « cette capacité parle du même sujet » de « cette capacité
   * fait ce qu'on demande ».
   */
  motsMin?: number;
  limite?: number;
}

export interface Ecartee { id: string; raison: string; nature: "PLAFOND" | "DROIT" | "FORME" | "FIABILITE" }

export interface Reponse {
  resultats: FicheCapacite[];
  /**
   * CE QUI A ÉTÉ ÉCARTÉ, ET POURQUOI. La distinction est tout l'intérêt : « la capacité existe
   * mais votre plafond l'exclut » et « rien ne sait faire ça » appellent deux réponses
   * opposées — la première est une décision, la seconde une dette.
   */
  ecartees: Ecartee[];
  /** Combien de fiches ont été examinées — sans lui, « zéro résultat » ne veut rien dire. */
  examinees: number;
}

const ACCENTS = /[\u0300-\u036f]/g;
const normaliser = (s: string): string => s.normalize("NFD").replace(ACCENTS, "").toLowerCase();

/**
 * LE MARQUAGE SE FAIT SUR DES MOTS ENTIERS, PAS SUR DES SOUS-CHAÎNES.
 *
 * Mesuré ici même : « faire signer le contrat PAR DocuSign » trouvait `send_email`, parce que
 * « par » est contenu dans « préparé ». Le registre répondait donc qu'une capacité savait faire
 * la signature électronique — le pire des résultats, puisqu'il empêche de nommer le manque.
 *
 * Un mot marque quand il ÉGALE un jeton, ou qu'il en est le préfixe (au moins quatre lettres) :
 * « document » trouve « documents », « électronique » trouve « électroniquement », « par » ne
 * trouve plus rien.
 */
const jetons = (s: string): string[] => normaliser(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function marque(mot: string, tokens: readonly string[]): boolean {
  for (const t of tokens) {
    if (t === mot) return true;
    if (mot.length >= 4 && t.startsWith(mot)) return true;
    if (t.length >= 4 && mot.startsWith(t)) return true;
  }
  return false;
}

/**
 * LA COUVERTURE — la PART de la demande qu'une seule capacité prend en charge.
 *
 * ── LE DÉFAUT MESURÉ, ET IL FAISAIT DIRE « IMPOSSIBLE » À ADAM ──────────────────────────
 *
 * Le barème de points mesure la FORCE d'un rapprochement : un mot trouvé dans le NOM vaut trois,
 * dans le domaine deux, dans le résumé un. C'est juste — mais cela ne mesure PAS la part de la
 * demande couverte, et les deux ne se remplacent pas.
 *
 * Conséquence constatée sur un défi réel : « chemin critique ». Les DEUX mots de la demande —
 * la demande ENTIÈRE — se trouvent dans le résumé de `calcul_ordonnancement`, qui calcule
 * précisément le chemin critique. Deux mots dans un résumé font 2 points ; il en fallait 3.
 * `chercher` la classait donc PREMIÈRE pendant que `manque`, sur la même phrase, répondait
 * « aucune capacité ne sait faire ça ». Adam a répondu à la personne que le moteur
 * d'ordonnancement n'était pas disponible. Il l'était.
 *
 * Deux constantes se contredisaient : MOTS_POUR_CONCLURE dit « deux mots distincts suffisent »,
 * PERTINENCE_POUR_CONCLURE rendait ces deux mots insuffisants s'ils venaient du résumé — la
 * règle des deux mots ne pouvait littéralement JAMAIS être satisfaite sans un mot dans le nom.
 *
 * ── POURQUOI LA COUVERTURE, ET PAS UN SEUIL PLUS BAS ────────────────────────────────────
 *
 * Descendre le seuil de points à 2 supprimait le faux absent mais ajoutait deux faux présents
 * (mesuré sur quatorze besoins de vérité connue). La couverture, elle, sépare ce que les points
 * confondent : une capacité qui répond à TOUTE la demande avec des mots faibles vaut mieux
 * qu'une capacité qui répond au tiers d'une demande de six mots avec un mot fort.
 *
 * Mesure sur les mêmes quatorze besoins — sept présents pour de vrai, sept absents pour de vrai :
 *   règle actuelle (3 points / 2 mots)   : 1 faux ABSENT, 3 faux présents
 *   seuil de points abaissé à 2          : 0 faux absent,  5 faux présents
 *   règle actuelle OU couverture ≥ 0,75  : 0 faux ABSENT,  3 faux présents
 *
 * Le faux ABSENT est la faute grave : c'est un verdict rendu avec autorité (« dette technique »)
 * qui fait dire « je ne peux pas » alors que le moteur existe. Un faux présent, lui, ne conclut
 * rien : il rend des CANDIDATS et dit au modèle de juger. Les deux erreurs ne se pèsent pas au
 * même poids, et la règle retenue supprime la grave sans en ajouter une seule autre.
 *
 * Le plancher de deux mots garde la couverture honnête : sur une demande d'UN seul mot, « toute
 * la demande » ne prouve rien — n'importe quel résumé qui cite ce mot couvrirait 100 %.
 */
export const COUVERTURE_FRANCHE = 0.75;
/** Sous deux mots marqués, une couverture de 100 % est un accident de vocabulaire. */
export const MOTS_POUR_COUVERTURE = 2;

function score(f: FicheCapacite, mots: readonly string[]): { points: number; motsMarques: number } {
  if (!mots.length) return { points: 1, motsMarques: 1 };
  const nom = jetons(f.id);
  const resume = jetons(f.resume);
  const domaine = jetons(f.domaine);
  let points = 0;
  let motsMarques = 0;
  for (const mot of mots) {
    if (marque(mot, nom)) { points += 3; motsMarques += 1; }
    else if (marque(mot, domaine)) { points += 2; motsMarques += 1; }
    else if (marque(mot, resume)) { points += 1; motsMarques += 1; }
  }
  return { points, motsMarques };
}

/**
 * INTERROGE LE REGISTRE. Rend les fiches qui répondent, ET celles qui auraient répondu si un
 * plafond, un droit ou une forme ne les avait pas exclues.
 *
 * Le tri met devant la pertinence, puis la fiabilité MESURÉE, puis la latence. Une capacité non
 * mesurée n'est ni favorisée ni punie : elle passe après celles qui ont fait leurs preuves et
 * avant celles qui ont échoué — c'est le seul rang honnête pour une inconnue.
 */
export function interroger(fiches: readonly FicheCapacite[], q: Requete = {}): Reponse {
  const mots = (q.texte ?? "").split(/[^\p{L}\p{N}]+/u).map(normaliser).filter((m) => m.length > 2);
  // LE SEUIL DE MOTS S'ADAPTE À LA LONGUEUR DE LA DEMANDE. Sur deux mots (« cherche document »),
  // en exiger deux reviendrait à n'accepter qu'un synonyme parfait ; sur six (« faire signer
  // électroniquement ce contrat via DocuSign »), un seul mot commun ne prouve rien. La règle :
  // à partir de trois mots significatifs, il en faut deux.
  const motsRequis = Math.min(q.motsMin ?? 1, Math.max(1, mots.length - 1));
  // LES ÉCARTÉES PORTENT LEUR SCORE. Sans lui, elles sortent dans l'ordre du catalogue —
  // c'est-à-dire dans un ordre qui n'a rien à voir avec la question posée (voir le tri plus bas).
  const ecartees: { e: Ecartee; s: number }[] = [];
  const retenues: { f: FicheCapacite; s: number }[] = [];

  for (const f of fiches) {
    if (q.primitive && f.primitive !== q.primitive) continue;
    if (q.domaine && normaliser(f.domaine) !== normaliser(q.domaine)) continue;

    const { points, motsMarques } = score(f, mots);
    // UNE CAPACITÉ QUI COUVRE LA DEMANDE ENTIÈRE ENTRE, MÊME SANS LE COMPTE DE POINTS.
    // Le seuil de points mesure la force du rapprochement, pas la part de la demande traitée ;
    // sans cette porte, « chemin critique » — deux mots sur deux dans le résumé de
    // `calcul_ordonnancement` — était déclaré ABSENT du registre. Elle ne change rien à la
    // recherche large (couvrir 75 % de la demande implique au moins un point).
    const franche = motsMarques >= MOTS_POUR_COUVERTURE && motsMarques / mots.length >= COUVERTURE_FRANCHE;
    if (!franche && points < Math.max(1, q.pertinenceMin ?? 1)) continue;
    if (motsMarques < motsRequis) continue;
    const s = points;

    if (q.effetMax && EFFECT_RANK[f.effet] > EFFECT_RANK[q.effetMax]) {
      ecartees.push({ s, e: { id: f.id, nature: "PLAFOND", raison: `effet ${f.effet}, au-dessus du plafond ${q.effetMax} de cette mission` } });
      continue;
    }
    if (q.autoriseeSeulement && f.autorisee === false) {
      ecartees.push({ s, e: { id: f.id, nature: "DROIT", raison: "cette personne n'a pas le droit d'appeler cette capacité" } });
      continue;
    }
    if (q.groupable === true && !f.groupable) {
      ecartees.push({ s, e: { id: f.id, nature: "FORME", raison: "non groupable : un déploiement en éventail serait refusé à la compilation" } });
      continue;
    }
    if (q.rejouable === true && !f.rejouable) {
      ecartees.push({ s, e: { id: f.id, nature: "FORME", raison: "non rejouable : un rejeu doublerait l'effet" } });
      continue;
    }
    if (q.fiabiliteMin !== undefined && f.fiabilite.taux !== null && f.fiabilite.taux < q.fiabiliteMin) {
      ecartees.push({ s, e: { id: f.id, nature: "FIABILITE", raison: `fiabilité mesurée ${(f.fiabilite.taux * 100).toFixed(0)} %, sous le seuil demandé` } });
      continue;
    }
    retenues.push({ f, s });
  }

  const rangLatence: Record<LatencyClass, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  // Une fiabilité inconnue vaut 0,5 POUR LE TRI SEULEMENT — jamais affichée comme une valeur.
  const pourLeTri = (f: FicheCapacite): number => (f.fiabilite.taux === null ? 0.5 : f.fiabilite.taux);
  retenues.sort((a, b) =>
    b.s - a.s
    || pourLeTri(b.f) - pourLeTri(a.f)
    || rangLatence[a.f.latence.classeAnnoncee] - rangLatence[b.f.latence.classeAnnoncee]
    || a.f.id.localeCompare(b.f.id));

  // ── LES ÉCARTÉES SE TRIENT COMME LES RETENUES, ET POUR LA MÊME RAISON ──────────────────
  //
  // DÉFAUT MESURÉ EN CONDITIONS RÉELLES. À « exécute une requête SQL sur la table User »
  // demandé par une déléguée, `sql_query` était correctement écartée pour DROIT — en
  // POSITION 20 sur 38, derrière dix-neuf exclusions sans rapport (read_hr_overview,
  // person_report, read_stock…) qui ne devaient leur rang qu'à l'ordre du catalogue. L'appelant
  // n'en montre que dix : la SEULE exclusion qui répondait à la question était invisible.
  //
  // Adam a donc répondu « aucune capacité SQL n'est disponible » — la phrase que tout le §44
  // existe pour empêcher. Le mécanisme fonctionnait ; c'est l'ordre d'affichage qui le
  // rendait inutile. Une exclusion pertinente cachée derrière un tri arbitraire ne vaut pas
  // mieux qu'une exclusion non calculée.
  ecartees.sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));

  return {
    resultats: retenues.slice(0, q.limite ?? 20).map((r) => r.f),
    ecartees: ecartees.map((x) => x.e),
    examinees: fiches.length,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DÉTECTION DE MANQUE **AVANT** L'ÉCHEC.
 *
 * `manques.ts` classe un échec qui a eu lieu. Ici on répond à la question posée plus tôt : « rien
 * ne sait faire ça » se sait AVANT de tenter, et se dit précisément — ce qui évite la phrase la
 * plus coûteuse du produit, « je ne peux pas », qui ne dit ni pourquoi ni ce qui manque.
 *
 * Les trois réponses possibles sont trois choses différentes :
 *   — une capacité existe et est autorisée ⇒ pas de manque ;
 *   — une capacité existe mais le plafond ou le droit l'écarte ⇒ PERMISSION, et ce n'est PAS une
 *     dette : la sécurité a fonctionné ;
 *   — rien ne correspond ⇒ CAPACITE_ABSENTE, et c'est du code à écrire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const PERTINENCE_POUR_CONCLURE = 3;
/** Deux mots distincts au moins : un seul mot commun ne fait pas une capacité qui répond. */
export const MOTS_POUR_CONCLURE = 2;

export function detecterManque(besoin: string, fiches: readonly FicheCapacite[], q: Requete = {}): Manque | null {
  const r = interroger(fiches, { pertinenceMin: PERTINENCE_POUR_CONCLURE, motsMin: MOTS_POUR_CONCLURE, ...q, texte: q.texte ?? besoin });
  if (r.resultats.length > 0) return null;

  const bloquantes = r.ecartees.filter((e) => e.nature === "PLAFOND" || e.nature === "DROIT");
  if (bloquantes.length > 0) {
    const noms = bloquantes.slice(0, 3).map((e) => e.id).join(", ");
    return classer(`droit ou plafond : ${bloquantes[0]!.raison} (${noms})`, { capacite: bloquantes[0]!.id });
  }
  const autres = r.ecartees.filter((e) => e.nature === "FORME" || e.nature === "FIABILITE");
  if (autres.length > 0) {
    return classer(`aucune capacité utilisable pour « ${besoin} » : ${autres[0]!.raison}`, { capacite: autres[0]!.id });
  }
  // ── LA LIMITE DE CETTE DÉTECTION, ET ELLE EST DITE ────────────────────────────────────
  //
  // Le marquage est LEXICAL. Sur un catalogue de deux cents capacités aux descriptions riches,
  // beaucoup de demandes croisent deux mots quelque part : « enregistrer la conversation »
  // rencontre `recall_conversation` sans que celle-ci sache téléphoner. La détection préalable
  // est donc un SIGNAL, pas un verdict — d'où une confiance délibérément moyenne, et un
  // `interroger` qui rend les candidats pour que le modèle tranche (c'est lui qui décide QUOI ;
  // le code décide COMMENT). Le verdict SÛR, lui, vient d'ailleurs : un refus de droit, un refus
  // de compilation, un échec d'exécution — trois choses que le code CONSTATE.
  const m = classer(`aucune capacité ne sait faire « ${besoin} » (${r.examinees} examinées)`, { capacite: null, etape: besoin });
  return { ...m, confiance: 0.6 };
}

/**
 * L'ÉTAT DU REGISTRE — ce qu'on sait, et surtout la part qu'on ne sait pas.
 *
 * Ce sommaire existe pour être DÉSAGRÉABLE : il affiche combien de capacités n'ont jamais été
 * mesurées et combien n'ont aucun contrat de sortie. Un registre qui ne dirait que ses forces
 * laisserait croire que l'inconnu est petit.
 */
export function sommaireRegistre(fiches: readonly FicheCapacite[]): {
  total: number;
  declarees: number;
  mesurees: number;
  jamaisExecutees: number;
  sansContrat: number;
  sansSchemaEntree: number;
  parPrimitive: Record<string, number>;
  parDomaine: Record<string, number>;
  fragiles: { id: string; taux: number; echantillon: number }[];
  aRisque: { id: string; niveau: NiveauRisque }[];
} {
  const parPrimitive: Record<string, number> = {};
  const parDomaine: Record<string, number> = {};
  const fragiles: { id: string; taux: number; echantillon: number }[] = [];
  const aRisque: { id: string; niveau: NiveauRisque }[] = [];
  let declarees = 0, mesurees = 0, sansContrat = 0, sansSchemaEntree = 0;

  for (const f of fiches) {
    parPrimitive[f.primitive] = (parPrimitive[f.primitive] ?? 0) + 1;
    parDomaine[f.domaine] = (parDomaine[f.domaine] ?? 0) + 1;
    if (f.qualification === "DECLAREE") declarees += 1;
    if (f.fiabilite.echantillon > 0) mesurees += 1;
    if (f.contrat === "LIBRE") sansContrat += 1;
    if (!f.entrees) sansSchemaEntree += 1;
    if (f.fiabilite.taux !== null && f.fiabilite.echantillon >= 3 && f.fiabilite.taux < 0.9) {
      fragiles.push({ id: f.id, taux: f.fiabilite.taux, echantillon: f.fiabilite.echantillon });
    }
    if (f.risque.niveau === "ELEVE" || f.risque.niveau === "CRITIQUE") aRisque.push({ id: f.id, niveau: f.risque.niveau });
  }
  fragiles.sort((a, b) => a.taux - b.taux);
  return {
    total: fiches.length,
    declarees,
    mesurees,
    jamaisExecutees: fiches.length - mesurees,
    sansContrat,
    sansSchemaEntree,
    parPrimitive,
    parDomaine,
    fragiles,
    aRisque,
  };
}
