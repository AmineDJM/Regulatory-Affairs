import type { CurrentUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";

/**
 * CATALOGUE DES OPS DE DOMAINE — la couche SYSTÉMIQUE qui ferme les trous de parité en série.
 *
 * Une « op » = un geste métier de l'écran (bouton, menu, décision) exposé au Chief à travers un
 * OUTIL DE DOMAINE (`drive_operation`, `task_operation`, `finance_operation`…) : l'outil reçoit
 * `{ op, ...entrées humaines }`, la proposition résout et montre, l'exécution appelle L'ACTION
 * CANONIQUE de l'écran. Ce fichier ne contient QUE les MÉTADONNÉES (pur, sans Prisma ni actions
 * serveur) : le registre ZERO-GAP l'importe pour la découverte, les alias et la reclassification
 * AUTOMATIQUE de l'inventaire (chaque op déclare les server actions qu'elle couvre — les ajouter
 * ici fait passer leurs clés de GAP à NATIVE sans toucher la classification à la main).
 *
 * Les implémentations (résolution + exécution) vivent dans `impl-<domaine>.ts`, importées par
 * l'orchestrateur seulement.
 */

export type OpRisk = "NORMAL" | "SENSITIVE" | "CRITICAL";

export interface OpMeta {
  /** Outil de domaine porteur (`drive_operation`…). */
  tool: string;
  /** Valeur du champ `op` de l'outil. */
  op: string;
  /** Module d'écran, en français. */
  module: string;
  /** Le libellé du geste tel qu'il se lit à l'écran. */
  uiLabel: string;
  /** Formulations naturelles (repliées par le matcher du registre). */
  aliases: string[];
  risk: OpRisk;
  /** Effet, qui est touché, réversibilité — la sémantique. */
  summary: string;
  /** Pré-filtre synchrone (l'action canonique revérifie toujours). */
  gate: (user: CurrentUser) => boolean;
  gateNote?: string;
  /** Clés d'inventaire `fichier:fonction` que cette op rend NATIVE. */
  covers: string[];
}

const isSA = (u: CurrentUser) => u.role === "SUPER_ADMIN";

export const OPS_CATALOG: OpMeta[] = [
  // ───────────────────────────── DRIVE (écritures) ─────────────────────────────
  {
    tool: "drive_operation", op: "create_folder", module: "Drive",
    uiLabel: "Nouveau dossier",
    aliases: ["crée un dossier dans le drive", "nouveau dossier drive"],
    risk: "NORMAL",
    summary: "Crée un dossier (à la racine personnelle, dans un dossier parent ou une catégorie). Réversible (corbeille Drive).",
    gate: (u) => userCan(u, "DRIVE", "CREATE") || userCan(u, "DRIVE", "VIEW"),
    gateNote: "éditeur du dossier parent, ou droit Créer à la racine",
    covers: ["drive-actions:createFolder"],
  },
  {
    tool: "drive_operation", op: "rename", module: "Drive",
    uiLabel: "Renommer",
    aliases: ["renomme le fichier", "renomme le dossier drive"],
    risk: "NORMAL",
    summary: "Renomme un fichier ou dossier du Drive (accès éditeur requis). Réversible en renommant à nouveau.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:renameNode"],
  },
  {
    tool: "drive_operation", op: "move", module: "Drive",
    uiLabel: "Déplacer",
    aliases: ["déplace le fichier", "range ce fichier dans", "mets ce document dans le dossier"],
    risk: "NORMAL",
    summary: "Déplace un élément (et son sous-arbre) vers un autre dossier — la catégorie de destination s'applique à tout le sous-arbre.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:moveNode", "drive-actions:moveNodes"],
  },
  {
    tool: "drive_operation", op: "share", module: "Drive",
    uiLabel: "Partager",
    aliases: ["partage le dossier avec", "donne accès au fichier", "partage ce document"],
    risk: "NORMAL",
    summary: "Partage un élément avec des collègues (lecture ou modification) — chacun est notifié.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:shareNode", "drive-actions:shareNodeWithMany", "drive-actions:shareNodesWithMany"],
  },
  {
    tool: "drive_operation", op: "unshare", module: "Drive",
    uiLabel: "Retirer le partage",
    aliases: ["retire le partage", "coupe l'accès au dossier de"],
    risk: "NORMAL",
    summary: "Retire l'accès d'une personne à un élément partagé.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:unshareNode"],
  },
  {
    tool: "drive_operation", op: "trash", module: "Drive",
    uiLabel: "Mettre à la corbeille",
    aliases: ["mets à la corbeille", "corbeille ce fichier"],
    risk: "NORMAL",
    summary: "Met un élément (et son contenu) à la corbeille Drive — RESTAURABLE.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:trashNode", "drive-actions:trashNodes"],
  },
  {
    tool: "drive_operation", op: "restore", module: "Drive",
    uiLabel: "Restaurer (corbeille Drive)",
    aliases: ["restaure de la corbeille drive", "sors ce fichier de la corbeille"],
    risk: "NORMAL",
    summary: "Restaure un élément de la corbeille Drive (avec son sous-arbre) ; si son parent a disparu, il revient à la racine.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:restoreNode"],
  },
  {
    tool: "drive_operation", op: "delete", module: "Drive",
    uiLabel: "Supprimer définitivement (Drive)",
    aliases: ["supprime définitivement du drive", "efface le fichier pour de bon"],
    risk: "CRITICAL",
    summary: "Suppression RÉELLE d'un élément du Drive : fichiers et versions effacés, AUCUN retour possible.",
    gate: (u) => userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:deleteNode"],
  },
  {
    tool: "drive_operation", op: "create_office", module: "Drive / Bureautique",
    uiLabel: "Nouveau document (Word/Excel/PowerPoint)",
    aliases: ["crée un document word", "nouveau document bureautique", "crée une feuille excel"],
    risk: "NORMAL",
    summary: "Crée un document bureautique vierge (docx/xlsx/pptx) dans le Drive, éditable dans l'app.",
    gate: (u) => userCan(u, "DRIVE", "CREATE") || userCan(u, "DRIVE", "VIEW"),
    covers: ["drive-actions:createOfficeNode"],
  },
  {
    tool: "drive_operation", op: "to_pdf", module: "Drive / Bureautique",
    uiLabel: "Convertir en PDF",
    aliases: ["convertis en pdf", "fais un pdf de ce document"],
    risk: "NORMAL",
    summary: "Produit un PDF à côté du document bureautique (l'original reste intact).",
    gate: (u) => userCan(u, "DRIVE", "CREATE"),
    covers: ["drive-actions:convertNodeToPdf"],
  },

  // ─────────────────────── TÂCHES — côté « moi » (répondre/faire) ───────────────────────
  {
    tool: "task_operation", op: "accept", module: "Espace de travail",
    uiLabel: "Accepter la demande de tâche",
    aliases: ["accepte la tâche", "j'accepte la demande de tâche"],
    risk: "NORMAL",
    summary: "Accepte une demande de tâche qui vous est adressée — accepter, c'est commencer (le demandeur est notifié).",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:respondTaskRequest"],
  },
  {
    tool: "task_operation", op: "refuse", module: "Espace de travail",
    uiLabel: "Refuser la demande de tâche",
    aliases: ["refuse la tâche", "décline la demande de tâche"],
    risk: "NORMAL",
    summary: "Refuse une demande de tâche (motif facultatif) — le demandeur est notifié avec le motif.",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: [],
  },
  {
    tool: "task_operation", op: "submit_work", module: "Espace de travail",
    uiLabel: "Valider mon travail",
    aliases: ["valide mon travail sur la tâche", "marque la tâche comme faite avec compte rendu", "j'ai terminé la tâche"],
    risk: "NORMAL",
    summary: "Marque la tâche FAITE avec un compte rendu (toujours modifiable ensuite) — le demandeur est notifié.",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:submitTaskWork"],
  },
  {
    tool: "task_operation", op: "reopen", module: "Espace de travail",
    uiLabel: "Rouvrir la tâche",
    aliases: ["rouvre la tâche", "la tâche n'est pas finie"],
    risk: "NORMAL",
    summary: "Rouvre une tâche marquée faite (retour En cours).",
    gate: (u) => userCan(u, "WORKSPACE", "UPDATE") || userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:reopenTaskWork"],
  },
  {
    tool: "task_operation", op: "comment", module: "Espace de travail",
    uiLabel: "Commenter la tâche",
    aliases: ["commente la tâche", "ajoute un message sur la tâche"],
    risk: "NORMAL",
    summary: "Ajoute un message au fil d'échange de la tâche (visible des personnes de la tâche).",
    gate: (u) => userCan(u, "WORKSPACE", "VIEW"),
    covers: ["task-actions:addTaskComment"],
  },
];

/** Index par outil → op (généré une fois). */
export const OPS_BY_TOOL: Record<string, Record<string, OpMeta>> = {};
for (const m of OPS_CATALOG) {
  (OPS_BY_TOOL[m.tool] ??= {})[m.op] = m;
}

/** Toutes les clés d'inventaire couvertes par le catalogue (reclassées NATIVE par le registre). */
export function catalogCoveredKeys(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of OPS_CATALOG) for (const k of m.covers) out.set(k, `${m.tool}:${m.op}`);
  return out;
}

export const opGlobalView = hasGlobalView;
export const opIsSA = isSA;
