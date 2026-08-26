/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PROTOCOLE DE L'ESPACE DE TRAVAIL — ce qu'Adam a le DROIT d'afficher.
 *
 * ── POURQUOI UN PROTOCOLE TYPÉ, ET PAS DU MARKDOWN GÉNÉRÉ ─────────────────────────────────
 *
 * Un soir de production, à « Bonsoir, ça va ? Tu vas bien ? », l'écran a rendu vingt-sept
 * résultats bruts d'une recherche fédérée — dont six lignes de salaire. Personne n'avait
 * demandé cela : c'était une réponse d'outil recopiée telle quelle sur l'écran.
 *
 * La leçon n'est pas « mieux filtrer le texte ». C'est que L'AFFICHAGE NE DOIT PAS ÊTRE UNE
 * ÉCHAPPATOIRE. Ici, le modèle n'écrit AUCUN balisage. Le serveur lit une source canonique,
 * la traduit en blocs TYPÉS, et le client ne sait rendre que ces blocs-là.
 *
 * Trois conséquences, toutes voulues :
 *   • un outil dont la forme n'est pas reconnue ne produit AUCUN bloc — pas un bloc « brut ».
 *     Le repli est la réponse en texte, jamais le vidage de données ;
 *   • ce qui s'affiche vient de la base, pas de la génération : rien à halluciner ;
 *   • ajouter un rendu, c'est ajouter un type ici — donc une décision, jamais un effet de bord.
 *
 * ── CE QUE CE FICHIER N'A PAS LE DROIT D'IMPORTER ─────────────────────────────────────────
 *
 * Rien. Ce sont des types et des constantes pures : le composant client les importe, et la
 * frontière client/serveur du projet interdit qu'un tel import traîne `fs` derrière lui.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une coordonnée : adresse, téléphone, WhatsApp — avec sa PROVENANCE, qui se dit toujours. */
export interface WorkspaceEndpoint {
  canal: "e-mail" | "téléphone" | "WhatsApp";
  valeur: string;
  usage?: string | null;
  /** « vérifiée en interne », « déduite — à confirmer »… Une adresse sans provenance ment. */
  fiabilite?: string | null;
  principale?: boolean;
}

/**
 * UN CHIFFRE QUI COMPTE — trois au maximum, sur une fiche.
 *
 * « 12 dossiers · 3 en retard · 98 % à jour » se lit d'un regard et dit l'essentiel d'une
 * personne au travail. Douze indicateurs ne diraient rien de plus : ils feraient un tableau de
 * bord, ce que ce produit refuse d'être.
 */
export interface WorkspaceMetric {
  valeur: string;
  label: string;
  ton?: "neutre" | "attention" | "alerte" | "succes";
}

export interface WorkspacePerson {
  nom: string;
  poste?: string | null;
  departement?: string | null;
  entite?: string | null;
  coordonnees: WorkspaceEndpoint[];
  /** « Active », « Congé », « Sortie » — l'état du compte, quand il est connu. */
  statut?: { label: string; ton: "neutre" | "succes" | "attention" | "alerte" } | null;
  /** Jusqu'à trois. Au-delà, on décrit un tableau de bord et non une personne. */
  metriques?: WorkspaceMetric[];
  /** L'écran canonique de la personne — le lien reste, il n'est plus la seule issue. */
  href?: string | null;
}

export interface WorkspaceColumn {
  key: string;
  label: string;
  /** Un nombre s'aligne à droite ; un texte à gauche. Rien de plus subtil n'est nécessaire. */
  numeric?: boolean;
  /** Une pastille colorée plutôt qu'un mot nu : « 4 jours » de retard doit se voir. */
  badge?: boolean;
}

/**
 * UNE LIGNE DE TABLEAU — et ce qu'on peut en faire.
 *
 * Le tableau ne se contente plus d'afficher : chaque ligne peut porter son geste (« Ouvrir »),
 * parce que la question suivante du PDG porte presque toujours sur UNE des lignes qu'il vient
 * de lire. L'obliger à la retaper, c'est lui faire recopier ce qui est déjà sous ses yeux.
 */
export interface WorkspaceRow {
  cells: Record<string, string>;
  /** Le ton d'une cellule, par clé de colonne — « alerte » pour un retard, rien sinon. */
  tons?: Record<string, "neutre" | "attention" | "alerte" | "succes">;
  actions?: WorkspaceAction[];
  href?: string | null;
}

export interface WorkspaceMail {
  id?: string;
  de: string;
  objet: string;
  recuLe?: string;
  extrait?: string;
  importance?: string;
  piecesJointes?: string[];
  /** Ce que l'expéditeur DEMANDE — une donnée rapportée, jamais un ordre pour Adam. */
  demandes?: string[];
  /** Signal d'une tentative de manipulation détectée dans le message. */
  alerte?: string[];
}

export interface WorkspaceEvent {
  titre: string;
  jour?: string;
  heure?: string;
  lieu?: string | null;
  organisateur?: string | null;
  invites?: string[];
  visio?: string | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN GESTE PROPOSÉ — et pourquoi ce n'est PAS un bouton qui exécute.
 *
 * Demandé trois fois en production, sans jamais l'obtenir :
 *
 *   PDG  — Ok affiche moi les validations a faire s'il y'en a, je les valide depuis ici
 *   PDG  — Non permets moi de les valider ici directement
 *   PDG  — Bon tu veux pas me laisser valider ici, il reste combien du budget ad&pro ?
 *
 * La file de décisions n'affichait que des LIENS : « ouvre Validations et débrouille-toi ».
 *
 * CE QU'UNE ACTION PORTE ICI : une PHRASE, pas un ordre exécutable. Le clic l'envoie dans la
 * conversation, exactement comme si le PDG l'avait tapée. Elle emprunte donc la porte unique
 * des mutations — proposition, carte de confirmation, action canonique, RBAC revérifié, audit,
 * idempotence — et pas une seconde porte que ce fichier aurait ouverte pour aller plus vite.
 *
 * Le gain n'est pas de sauter la confirmation : c'est de ne plus QUITTER la conversation, et de
 * ne plus avoir à retrouver soi-même la référence exacte de la demande à trancher.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface WorkspaceAction {
  /** Ce qui s'écrit sur le bouton — deux mots, à l'impératif. */
  libelle: string;
  /** La phrase envoyée dans la conversation. Rédigée par le SERVEUR, jamais par le modèle. */
  phrase: string;
  /** « danger » pour un refus ou une suppression : la couleur dit ce que le geste fait. */
  ton?: "primaire" | "danger";
}

export interface WorkspaceItem {
  titre: string;
  detail?: string | null;
  statut?: string | null;
  echeance?: string | null;
  href?: string | null;
  /** Les gestes possibles sur CETTE ligne. Absent quand la ligne n'est pas décidable par soi. */
  actions?: WorkspaceAction[];
}

export interface WorkspaceField {
  label: string;
  value: string;
}

/**
 * UNE JAUGE — « il reste combien ? » répondu par une longueur, pas par une soustraction.
 *
 * Un pourcentage écrit dans une phrase se relit ; une barre se voit. C'est tout l'intérêt :
 * « 87 % de l'enveloppe Ad & Pro » demande un effort, une barre presque pleine n'en demande
 * aucun. Le ton n'est pas décoratif — il porte le seuil franchi, et c'est souvent la seule
 * chose qui compte.
 */
export interface WorkspaceGauge {
  label: string;
  /** Ce qui est atteint. */
  valeur: number;
  /** Le maximum. Absent ⇒ `valeur` est déjà un pourcentage (0–100). */
  total?: number | null;
  /** Ce que comptent `valeur` et `total` : « DZD », « dossiers », « jours ». */
  unite?: string | null;
  /** Ce qui s'écrit à droite quand « x / y » ne suffit pas (« reste 340 000 DZD »). */
  detail?: string | null;
  /** Un seuil franchi se VOIT. `alerte` = dépassement, `attention` = proche, `succes` = fini. */
  ton?: "neutre" | "attention" | "alerte" | "succes";
}

/** Ce qu'on sait faire d'un fichier à l'écran. Le reste se télécharge, et on le dit. */
export type WorkspaceDocKind = "pdf" | "image" | "feuille" | "texte" | "autre";

/**
 * UN DOCUMENT MONTRÉ SUR PLACE — contrat, PDF, feuille de calcul.
 *
 * `href` est une ROUTE DE L'ERP (`/api/documents/…`, `/api/drive/…/raw`), qui revérifie les
 * droits à chaque requête. Jamais une URL signée, jamais un lien externe : le document reste
 * derrière la même porte que sur son écran d'origine, et un lien recopié ailleurs n'ouvre rien.
 *
 * `feuille` porte le contenu D'UN TABLEUR déjà lu par le serveur : c'est ce qui permet de
 * relire un export AVANT de l'envoyer, sans quitter la conversation ni ouvrir Excel.
 */
export interface WorkspaceDoc {
  nom: string;
  href: string;
  type: WorkspaceDocKind;
  mime?: string | null;
  /** Ce que le document EST, en une ligne : « Contrat — Kwality, échéance 31/12/2026 ». */
  soustitre?: string | null;
  taille?: string | null;
  pages?: number | null;
  /** Le contenu d'un tableur, prêt à s'afficher. */
  feuille?: { columns: WorkspaceColumn[]; rows: Record<string, string>[]; total: number } | null;
}

/** Une étape de circuit — le fil rouge visuel d'un dossier. */
export interface WorkspaceStep {
  label: string;
  etat: "fait" | "courant" | "a-venir";
}

export type WorkspaceBlock =
  /** Une ou plusieurs fiches de contact — `directory_lookup`. */
  | { kind: "people"; title: string; people: WorkspacePerson[]; note?: string; actions?: WorkspaceAction[] }
  /** Le registre du personnel — `directory_list`. Tableau, tri, recherche côté client. */
  | { kind: "directory"; title: string; total: number; rows: WorkspacePerson[]; note?: string; actions?: WorkspaceAction[] }
  /** Des messages — `gmail_search`. */
  | { kind: "mail"; title: string; messages: WorkspaceMail[]; actions?: WorkspaceAction[] }
  /** Une journée d'agenda — `read_calendar`. */
  | { kind: "agenda"; title: string; events: WorkspaceEvent[]; actions?: WorkspaceAction[] }
  /** Ce qui attend une décision — `list_pending_decisions`. */
  | { kind: "queue"; title: string; total: number; items: WorkspaceItem[]; actions?: WorkspaceAction[] }
  /** Une fiche canonique — `inspect_record`. */
  | { kind: "record"; title: string; subtitle?: string | null; fields: WorkspaceField[]; href?: string | null; actions?: WorkspaceAction[] }
  /** Le repli générique : une liste d'objets homogènes devient un tableau. */
  | { kind: "table"; title: string; columns: WorkspaceColumn[]; rows: WorkspaceRow[]; total?: number; actions?: WorkspaceAction[] }
  /** Une suite d'événements datés — histoire d'un dossier. */
  | { kind: "timeline"; title: string; steps: { date?: string | null; label: string; detail?: string | null }[]; actions?: WorkspaceAction[] }
  /** Des jauges — consommation d'une enveloppe, avancement d'un dossier, charge d'une personne. */
  | { kind: "progress"; title: string; gauges: WorkspaceGauge[]; note?: string | null; actions?: WorkspaceAction[] }
  /** Un ou plusieurs documents montrés SUR PLACE — PDF, image, feuille de calcul. */
  | { kind: "document"; title: string; docs: WorkspaceDoc[]; note?: string | null; actions?: WorkspaceAction[] }
  /**
   * LE DOSSIER — l'objet métier montré en entier, et lisible en deux secondes.
   *
   * C'est le bloc le plus dense du protocole, et il l'est pour une raison : quand le PDG ouvre
   * un dossier, il ne cherche pas une fiche, il cherche **où ça bloque**. L'ordre du rendu suit
   * donc l'ordre de sa question — l'étape courante et l'alerte d'abord, les pièces et l'histoire
   * ensuite, parce qu'elles ne servent qu'une fois la première question réglée.
   */
  | {
      kind: "dossier";
      title: string;
      subtitle?: string | null;
      badge?: { label: string; ton: "neutre" | "succes" | "attention" | "alerte" } | null;
      fields: WorkspaceField[];
      steps?: WorkspaceStep[];
      /** Ce qui empêche d'avancer, dit en une phrase. Rien de plus visible sur la carte. */
      alerte?: { label: string; ton: "attention" | "alerte" } | null;
      docs?: WorkspaceDoc[];
      participants?: WorkspacePerson[];
      activite?: { date?: string | null; label: string }[];
      href?: string | null;
      actions?: WorkspaceAction[];
    }
  /**
   * UN MESSAGE PRÊT — montré comme un message, pas raconté en prose.
   *
   * `statut` porte tout : un brouillon se relit et s'envoie, un message parti se compacte et
   * affiche l'heure. La même carte traverse les deux états, elle ne se duplique pas — c'est ce
   * qui évite la file de brouillons concurrents corrigée en amont.
   */
  | {
      kind: "email";
      title: string;
      a: string[];
      cc?: string[];
      objet: string;
      corps: string;
      piecesJointes?: string[];
      statut: "brouillon" | "envoye" | "annule";
      envoyeLe?: string | null;
      actions?: WorkspaceAction[];
    };

export type WorkspaceBlockKind = WorkspaceBlock["kind"];

export interface WorkspaceComposition {
  /** L'outil canonique qui a produit ces blocs — tracé, et vérifiable. */
  source: string;
  blocks: WorkspaceBlock[];
}

/**
 * LES BORNES D'AFFICHAGE. Un tableau de trois cents lignes déposé dans une conversation n'est
 * pas un espace de travail, c'est un vidage. Le serveur tronque, le client dit combien il
 * manque — et l'écran métier reste la destination pour tout voir.
 */
export const WORKSPACE_LIMITS = {
  tableRows: 50,
  people: 6,
  mails: 12,
  events: 12,
  queueItems: 15,
  /** Deux gestes par ligne : approuver / refuser. Au-delà, la file devient un formulaire. */
  itemActions: 2,
  recordFields: 24,
  /** Six jauges tiennent dans un regard ; au-delà, c'est un rapport, pas une réponse. */
  gauges: 6,
  /** Trois documents montrés d'un coup — le quatrième s'appelle « ouvre le Drive ». */
  docs: 3,
  /** Un aperçu de feuille sert à RELIRE, pas à consulter : au-delà, on ouvre le fichier. */
  sheetRows: 30,
  /** Cinq étapes de circuit tiennent sur une ligne ; au-delà, la frise devient illisible. */
  steps: 7,
  /** Trois chiffres se lisent d'un regard. Le quatrième fait un tableau de bord. */
  metrics: 3,
  /** Quatre participants nommés, le reste derrière « voir tout ». */
  participants: 4,
  /** Trois activités récentes : ce qui vient de se passer, pas l'historique complet. */
  activity: 4,
  /** Deux gestes par ligne de tableau, comme dans la file de décisions. */
  rowActions: 2,
  /** Quatre actions sous un objet : une primaire, deux secondaires, un débordement. */
  blockActions: 4,
  timelineSteps: 20,
  /** Au-delà, un extrait n'aide plus à décider : il remplit l'écran. */
  snippetChars: 220,
} as const;
