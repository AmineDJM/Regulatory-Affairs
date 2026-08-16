import type { MailFolder, WellKnownFolder } from "./provider";

/**
 * L'ORDRE DES DOSSIERS — celui de toutes les messageries du monde.
 *
 * Réception, Envoyés, Brouillons, Archives, Indésirables, Corbeille, puis les dossiers personnels
 * par ordre alphabétique. Ce n'est pas un choix esthétique : quiconque a déjà utilisé une boîte
 * mail sait où regarder, et changer cet ordre oblige à lire une liste qu'on avait cessé de lire.
 *
 * Module PUR — testé.
 */

/** Les noms Graph des dossiers connus → notre vocabulaire stable. */
const GRAPH_WELL_KNOWN: Record<string, WellKnownFolder> = {
  inbox: "inbox",
  sentitems: "sent",
  drafts: "drafts",
  archive: "archive",
  deleteditems: "trash",
  junkemail: "junk",
};

export function wellKnownFromGraph(name: string | null | undefined): WellKnownFolder | null {
  if (!name) return null;
  return GRAPH_WELL_KNOWN[name.toLowerCase().replace(/\s+/g, "")] ?? null;
}

/** Le libellé français d'un dossier connu ; un dossier personnel garde SON nom. */
export const FOLDER_LABEL: Record<WellKnownFolder, string> = {
  inbox: "Boîte de réception",
  sent: "Envoyés",
  drafts: "Brouillons",
  archive: "Archives",
  junk: "Indésirables",
  trash: "Corbeille",
};

export const FOLDER_ICON: Record<WellKnownFolder, string> = {
  inbox: "Inbox",
  sent: "Send",
  drafts: "FileEdit",
  archive: "Archive",
  junk: "ShieldAlert",
  trash: "Trash2",
};

const ORDER: WellKnownFolder[] = ["inbox", "sent", "drafts", "archive", "junk", "trash"];

/** Le nom à afficher — traduit pour les dossiers connus, tel quel pour les autres. */
export function folderLabel(f: Pick<MailFolder, "name" | "wellKnown">): string {
  return f.wellKnown ? FOLDER_LABEL[f.wellKnown] : f.name;
}

/**
 * Trie les dossiers pour l'affichage : les connus dans l'ordre attendu, puis les personnels par
 * ordre naturel (« Dossier 2 » avant « Dossier 10 »).
 */
export function sortFolders(folders: readonly MailFolder[]): MailFolder[] {
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const rank = (f: MailFolder) => (f.wellKnown ? ORDER.indexOf(f.wellKnown) : ORDER.length);
  return [...folders].sort((a, b) => {
    const d = rank(a) - rank(b);
    return d !== 0 ? d : collator.compare(folderLabel(a), folderLabel(b));
  });
}

/**
 * Le compteur affiché à côté d'un dossier.
 *
 * Les non-lus PARTOUT sauf dans Brouillons, où c'est le TOTAL qui a du sens : un brouillon n'est
 * ni lu ni non lu, et afficher « 0 » à côté de trois brouillons en attente les rend invisibles.
 */
export function folderBadge(f: Pick<MailFolder, "wellKnown" | "unread" | "total">): number {
  if (f.wellKnown === "drafts") return f.total;
  return f.unread;
}

/** Le dossier à ouvrir par défaut : la réception, ou à défaut le premier de la liste. */
export function defaultFolderId(folders: readonly MailFolder[]): string | null {
  return folders.find((f) => f.wellKnown === "inbox")?.id ?? folders[0]?.id ?? null;
}
