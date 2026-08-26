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

export interface WorkspacePerson {
  nom: string;
  poste?: string | null;
  departement?: string | null;
  entite?: string | null;
  coordonnees: WorkspaceEndpoint[];
}

export interface WorkspaceColumn {
  key: string;
  label: string;
  /** Un nombre s'aligne à droite ; un texte à gauche. Rien de plus subtil n'est nécessaire. */
  numeric?: boolean;
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

export interface WorkspaceItem {
  titre: string;
  detail?: string | null;
  statut?: string | null;
  echeance?: string | null;
  href?: string | null;
}

export interface WorkspaceField {
  label: string;
  value: string;
}

export type WorkspaceBlock =
  /** Une ou plusieurs fiches de contact — `directory_lookup`. */
  | { kind: "people"; title: string; people: WorkspacePerson[]; note?: string }
  /** Le registre du personnel — `directory_list`. Tableau, tri, recherche côté client. */
  | { kind: "directory"; title: string; total: number; rows: WorkspacePerson[]; note?: string }
  /** Des messages — `gmail_search`. */
  | { kind: "mail"; title: string; messages: WorkspaceMail[] }
  /** Une journée d'agenda — `read_calendar`. */
  | { kind: "agenda"; title: string; events: WorkspaceEvent[] }
  /** Ce qui attend une décision — `list_pending_decisions`. */
  | { kind: "queue"; title: string; total: number; items: WorkspaceItem[] }
  /** Une fiche canonique — `inspect_record`. */
  | { kind: "record"; title: string; subtitle?: string | null; fields: WorkspaceField[]; href?: string | null }
  /** Le repli générique : une liste d'objets homogènes devient un tableau. */
  | { kind: "table"; title: string; columns: WorkspaceColumn[]; rows: Record<string, string>[]; total?: number }
  /** Une suite d'événements datés — histoire d'un dossier. */
  | { kind: "timeline"; title: string; steps: { date?: string | null; label: string; detail?: string | null }[] };

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
  recordFields: 24,
  timelineSteps: 20,
  /** Au-delà, un extrait n'aide plus à décider : il remplit l'écran. */
  snippetChars: 220,
} as const;
