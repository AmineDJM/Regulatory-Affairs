/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTRAT DE PLATEFORME — la seule chose qu'Adam sait de l'ERP.
 *
 * ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ──────────────────────────────────────────
 *
 * C'EST la frontière. Adam parle à la plateforme par QUATRE verbes, et rien d'autre :
 *
 *     query      — lire l'état métier canonique
 *     command    — demander une action (la plateforme décide si elle est permise, et l'exécute)
 *     authorize  — « cette personne a-t-elle le droit de … ? »
 *     events     — être prévenu quand quelque chose change
 *
 * CE N'EST PAS un miroir de l'ERP. L'audit de départ comptait 447 imports d'Adam vers
 * 173 modules internes. Envelopper les 173 aurait produit exactement ce que la mission
 * interdit : « une nouvelle couche abstraite inutile au-dessus du système existant ». Le
 * contrat est donc SÉMANTIQUE et étroit — il décrit ce dont Adam a besoin, pas ce que l'ERP
 * contient. Il grandit quand un besoin réel apparaît, jamais par symétrie.
 *
 * ── ZÉRO IMPORT ──────────────────────────────────────────────────────────────────────────
 *
 * Ce fichier n'importe RIEN — ni Prisma, ni `@/lib/*`, ni un type généré. C'est la propriété
 * qui rend le contrat portable : le jour où Adam devient un service à part, ce fichier part
 * avec lui sans modification, et l'ERP en publie l'implémentation derrière HTTP.
 *
 * Un type Prisma qui traverserait cette frontière (`User`, `Employee`, `$Enums`…) recréerait
 * le couplage qu'on retire — et personne ne s'en apercevrait avant la migration suivante.
 * `boundary.test.ts` échoue si cela arrive.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LA VERSION DU CONTRAT — pas une décoration.
 *
 * Adam et la plateforme peuvent évoluer séparément TANT QUE ce numéro est compatible. Il
 * s'incrémente en MAJEUR quand un champ requis disparaît ou change de sens ; en MINEUR quand on
 * ajoute quelque chose d'optionnel. L'adaptateur l'annonce, Adam le vérifie au démarrage.
 */
export const PLATFORM_CONTRACT_VERSION = "1.0.0";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// IDENTITÉ
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * QUI PARLE — la vue d'Adam sur une personne. Volontairement plus pauvre que le `CurrentUser`
 * de l'ERP : Adam n'a pas besoin de la session, du mot de passe à changer, ni de l'objet d'accès
 * complet. Moins il en sait, moins il dépend.
 *
 * LES CAPACITÉS SONT RÉSOLUES PAR LA PLATEFORME, JAMAIS CALCULÉES PAR ADAM. C'est ce qui
 * permet à Adam de filtrer sa liste d'outils SANS aller-retour (latence nulle) tout en gardant
 * la décision canonique là où elle doit être. La règle qui rend cela sûr n'a pas changé d'un
 * pouce : **la liste présentée au modèle est une suggestion, l'exécution revérifie toujours**.
 * Une capacité périmée coûte donc un refus poli, jamais une action indue.
 */
export interface Principal {
  id: string;
  displayName: string;
  /** Adresse de connexion — sert à identifier, jamais à autoriser. */
  email: string;
  /**
   * Le rôle canonique, en chaîne OPAQUE. Adam le transmet et l'affiche ; il ne raisonne pas
   * dessus. Raisonner sur le rôle, c'est réimplémenter le RBAC de l'ERP dans Adam — et le voir
   * diverger au premier changement de politique.
   */
  role: string;
  /**
   * Ce que cette personne peut faire, résolu à l'instant du tour. Forme `MODULE:NIVEAU`
   * (« RH:VIEW », « FINANCE:EDIT ») plus quelques capacités transverses (« platform:global-view »).
   */
  capabilities: ReadonlySet<string>;
}

export const can = (p: Principal, capability: string): boolean => p.capabilities.has(capability);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LECTURES
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * UNE PERSONNE, telle qu'Adam la voit. Pas une ligne `Employee`, pas un `User` : le sous-ensemble
 * dont l'annuaire, la messagerie et les missions ont besoin.
 */
export interface PersonView {
  id: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  /** Coordonnées AVEC leur provenance — une adresse sans provenance est un piège. */
  endpoints: readonly ContactEndpoint[];
}

export interface ContactEndpoint {
  channel: "email" | "phone" | "whatsapp";
  value: string;
  label: string | null;
  /** « vérifiée en interne », « déduite — à confirmer »… La confiance se transporte. */
  confidence: string;
  primary: boolean;
}

/** Une fiche métier quelconque — dossier réglementaire, facture, contrat… */
export interface RecordView {
  id: string;
  type: string;
  title: string;
  /** Champs scalaires prêts à afficher, dans l'ordre où ils comptent. */
  fields: readonly { label: string; value: string }[];
  /** Lien interne vers l'écran canonique. */
  href: string | null;
  updatedAt: string | null;
}

/**
 * LES LECTURES QU'ADAM SAIT DEMANDER — une union fermée, et c'est le point.
 *
 * Fermée signifie : ajouter une lecture est une DÉCISION, prise en sachant ce qu'elle expose.
 * Une méthode générique `runAnyQuery(sql)` aurait été plus « souple » et aurait rouvert la porte
 * que cette frontière existe pour fermer.
 */
export type PlatformQuery =
  | { kind: "person.search"; text: string; limit?: number }
  | { kind: "person.list"; department?: string; limit?: number }
  | { kind: "record.get"; type: string; id: string }
  | { kind: "record.search"; text: string; types?: readonly string[]; limit?: number }
  | { kind: "pending-decisions.list"; limit?: number }
  /**
   * UN DOCUMENT À MONTRER — désigné par son nœud Drive, sa pièce jointe, ou son nom.
   *
   * Première lecture non-personne à passer par ce contrat, et elle y est pour une raison
   * précise : afficher un fichier demande la base, le stockage, les droits du Drive ET ceux du
   * dossier porteur. Laissée dans un outil d'Adam, elle aurait franchi la frontière sept fois.
   * Ici, c'est l'ERP qui ouvre le fichier — Adam ne reçoit qu'une vue, et un lien qui revérifie.
   */
  | { kind: "document.show"; driveNodeId?: string; documentId?: string; name?: string };

export type PlatformQueryResult =
  | { kind: "person.search" | "person.list"; people: readonly PersonView[]; total: number }
  | { kind: "record.get"; record: RecordView | null }
  | { kind: "record.search"; records: readonly RecordView[]; total: number }
  | { kind: "pending-decisions.list"; items: readonly PendingDecision[]; total: number }
  /**
   * `document` absent ⇒ `refusal` dit POURQUOI, en français, prêt à être lu tel quel.
   *
   * On distingue le refus de l'absence : « ce fichier ne vous est pas ouvert » et « aucun
   * fichier de ce nom » appellent deux réactions différentes, et les confondre en un `null`
   * ferait dire à Adam « je n'ai rien trouvé » là où il aurait fallu dire « je n'ai pas le droit ».
   */
  | { kind: "document.show"; document: DocumentView | null; refusal?: string };

/** Le contenu d'un tableur, déjà lu — c'est ce qui permet de relire un export avant l'envoi. */
export interface DocumentSheet {
  columns: readonly { key: string; label: string; numeric?: boolean }[];
  rows: readonly Record<string, string>[];
  /** Le nombre de lignes DU FICHIER, pas de l'aperçu. */
  total: number;
}

export interface DocumentView {
  name: string;
  /**
   * Une ROUTE INTERNE de l'ERP, jamais une URL signée ni un lien externe : les droits sont
   * revérifiés à chaque requête, et un lien recopié ailleurs n'ouvre rien.
   */
  href: string;
  kind: "pdf" | "image" | "feuille" | "texte" | "autre";
  /** Taille lisible (« 2,4 Mo »), `null` si inconnue. */
  size: string | null;
  subtitle: string | null;
  sheet: DocumentSheet | null;
}

export interface PendingDecision {
  id: string;
  title: string;
  detail: string | null;
  status: string | null;
  waitingSince: string | null;
  href: string | null;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// COMMANDES
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * UNE DEMANDE D'ACTION — « Adam peut décider de ce que veut le PDG ; l'ERP décide si l'action
 * est autorisée et l'exécute correctement ».
 *
 * `actionId` est l'identifiant STABLE d'une action canonique du registre ERP, pas un nom de
 * fonction. C'est ce qui permet de renommer l'implémentation sans casser Adam.
 *
 * `idempotencyKey` est OBLIGATOIRE, et ce n'est pas du zèle : un « oui » redit, un rejeu de
 * webhook et une reprise de tâche décrivent la même action. Sans clé, le troisième la referait.
 */
export interface PlatformCommand {
  actionId: string;
  args: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  /** D'où vient la demande — tracé dans l'audit de l'ERP. */
  origin: "text" | "voice" | "nudge" | "schedule";
}

export type CommandOutcome =
  | { ok: true; message: string; link?: string | null; createdId?: string | null; replayed?: boolean }
  /** Refus MÉTIER ou de DROIT — la plateforme a décidé, Adam le dit tel quel. */
  | { ok: false; refused: true; reason: string }
  /** Panne — l'action n'a pas eu lieu et pourrait réussir plus tard. La distinction compte. */
  | { ok: false; refused: false; error: string };

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * CE QUI A CHANGÉ DANS LA PLATEFORME — le canal qui remplace l'interrogation permanente.
 *
 * FAIT, PAS ORDRE. Un événement décrit quelque chose qui EST ARRIVÉ (« le dossier X est passé à
 * l'étape 5 »), au passé, et n'attend rien en retour. Adam en fait ce qu'il veut : rafraîchir une
 * projection, prévenir le PDG, ou rien. Un bus qui transporterait des ordres recréerait le
 * couplage dans l'autre sens.
 *
 * `subject` est le couple type+id de l'entité concernée ; `at` est l'horloge de la PLATEFORME
 * (celle qui fait foi), `seq` un compteur monotone par processus qui permet de repérer un trou.
 */
export interface DomainEvent {
  /** Verbe au passé, préfixé par le domaine : « regulatory.stage-changed », « hr.employee-added ». */
  type: string;
  subject: { type: string; id: string };
  at: string;
  seq: number;
  /** Qui a provoqué le changement — `null` quand c'est le système (import, tâche planifiée). */
  actorId: string | null;
  /** Charge utile MINIMALE : de quoi décider s'il faut relire, pas une copie de la ligne. */
  data: Readonly<Record<string, unknown>>;
}

export type EventHandler = (event: DomainEvent) => void;
export type Unsubscribe = () => void;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LE PORT
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LA PLATEFORME, VUE D'ADAM. Quatre verbes, et rien de plus.
 *
 * Aujourd'hui l'implémentation est en-processus : un appel de fonction, zéro sérialisation, zéro
 * réseau — donc AUCUN coût de latence par rapport à l'existant. Demain, la même interface peut
 * être servie par HTTP sans qu'Adam le sache. C'est tout l'intérêt d'avoir séparé le code sans
 * séparer le déploiement : on gagne l'indépendance sans payer le réseau.
 */
export interface PlatformPort {
  readonly contractVersion: string;

  /** LIT l'état canonique. Ne modifie jamais rien. */
  query(principal: Principal, query: PlatformQuery): Promise<PlatformQueryResult>;

  /** DEMANDE une action. La plateforme vérifie les droits, exécute, audite, et répond. */
  command(principal: Principal, command: PlatformCommand): Promise<CommandOutcome>;

  /**
   * « Cette personne peut-elle … ? » — la réponse FAIT FOI, contrairement aux capacités portées
   * par le `Principal`, qui sont un instantané destiné au filtrage rapide.
   */
  authorize(principal: Principal, capability: string): Promise<boolean>;

  /** S'abonne aux changements. Rend une fonction de désabonnement. */
  subscribe(handler: EventHandler): Unsubscribe;
}
