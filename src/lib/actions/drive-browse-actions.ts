"use server";

import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getDriveListing, getDriveSpacesForUser } from "@/lib/queries/drive";

/**
 * PARCOURIR LE DRIVE DEPUIS UN FORMULAIRE — l'explorateur qui s'ouvre en place.
 *
 * Créer un document légal ou un courrier, c'est presque toujours désigner un fichier qui EXISTE
 * DÉJÀ dans le Drive. Le renvoyer chercher son identifiant dans un autre onglet, c'est perdre
 * son formulaire à moitié rempli — on ouvre donc l'explorateur par-dessus.
 *
 * La lecture passe par `getDriveListing`, exactement comme l'écran du Drive : l'explorateur d'un
 * formulaire ne doit jamais montrer un fichier que la navigation cacherait. Il ne fait que LIRE.
 */

export interface BrowseNode {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string | null;
  size: number | null;
  /** ISO — une `Date` ne traverse pas proprement la frontière serveur/client. */
  updatedAt: string;
}

export interface BrowseResult {
  ok: boolean;
  error?: string;
  /** Catégories partagées auxquelles la personne a droit, plus son Drive personnel. */
  spaces: { id: string; name: string }[];
  spaceId: string | null;
  folder: { id: string; name: string } | null;
  breadcrumb: { id: string; name: string }[];
  nodes: BrowseNode[];
}

const EMPTY: BrowseResult = { ok: false, spaces: [], spaceId: null, folder: null, breadcrumb: [], nodes: [] };

export async function browseDrive(input: { folderId?: string | null; spaceId?: string | null }): Promise<BrowseResult> {
  const user = await requireUser();
  if (!userCan(user, "DRIVE", "VIEW")) return { ...EMPTY, error: "Accès au Drive non autorisé." };

  const folderId = input.folderId ?? null;
  const spaceId = input.spaceId ?? null;

  const [listing, spaces] = await Promise.all([
    getDriveListing(user, folderId, false, spaceId),
    getDriveSpacesForUser(user),
  ]);
  // `null` = dossier inconnu, corbeillé, ou hors de la catégorie demandée. On le dit plutôt que
  // de renvoyer une liste vide, qui laisserait croire à un dossier réellement vide.
  if (!listing) return { ...EMPTY, spaces: spaces.map((s) => ({ id: s.id, name: s.name })), error: "Dossier introuvable ou inaccessible." };

  return {
    ok: true,
    spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
    spaceId,
    folder: listing.folder,
    breadcrumb: listing.breadcrumb,
    nodes: listing.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      isFolder: n.type === "FOLDER",
      mimeType: n.mimeType,
      size: n.size,
      updatedAt: n.updatedAt.toISOString(),
    })),
  };
}
