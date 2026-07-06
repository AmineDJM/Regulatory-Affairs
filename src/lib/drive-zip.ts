import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";

/**
 * Construction d'archives ZIP pour le Drive : télécharger **un dossier** (contenu
 * récursif) ou **plusieurs éléments** (fichiers et/ou dossiers) en une seule archive.
 * L'accès est vérifié par l'appelant sur chaque élément de tête ; les descendants
 * héritent de l'accès (les partages se résolvent en remontant l'arbre — voir
 * `resolveDriveAccess`).
 */

// Garde-fou mémoire : le ZIP est monté en mémoire (JSZip). Au-delà, on invite à
// télécharger par sous-dossiers.
const MAX_ZIP_BYTES = 800 * 1024 * 1024;

interface Collected { path: string; blobId: string; size: number }

/** Nettoie un nom pour un chemin d'archive (pas de séparateurs). */
const safeName = (name: string) => name.replace(/[\\/]/g, "_").trim() || "sans-nom";

/** Parcourt récursivement un dossier et collecte ses fichiers (chemins relatifs). */
async function collectFolder(folderId: string, prefix: string, acc: Collected[]): Promise<void> {
  const children = await prisma.driveNode.findMany({
    where: { parentId: folderId, isTrashed: false },
    select: {
      id: true, name: true, type: true, size: true,
      versions: { orderBy: { version: "desc" }, take: 1, select: { blobId: true } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  for (const c of children) {
    const nm = safeName(c.name);
    if (c.type === "FOLDER") {
      await collectFolder(c.id, `${prefix}${nm}/`, acc);
    } else {
      const blobId = c.versions[0]?.blobId;
      if (blobId) acc.push({ path: `${prefix}${nm}`, blobId, size: c.size });
    }
  }
}

export interface ZipResult { buffer: Buffer; count: number; filename: string }
export interface ZipError { error: string; status: number }

/**
 * Construit un ZIP à partir de nœuds de tête (déjà autorisés). Un fichier est ajouté à
 * la racine ; un dossier est ajouté récursivement sous son nom. Noms de tête dédupliqués.
 */
export async function buildDriveZip(nodes: { id: string; name: string; type: string }[]): Promise<ZipResult | ZipError> {
  const acc: Collected[] = [];
  const used = new Map<string, number>();
  const uniqueRoot = (name: string) => {
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    if (!n) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
  };

  for (const node of nodes) {
    const root = uniqueRoot(safeName(node.name));
    if (node.type === "FOLDER") {
      await collectFolder(node.id, `${root}/`, acc);
    } else {
      const f = await prisma.driveNode.findUnique({
        where: { id: node.id },
        select: { size: true, versions: { orderBy: { version: "desc" }, take: 1, select: { blobId: true } } },
      });
      const blobId = f?.versions[0]?.blobId;
      if (blobId) acc.push({ path: root, blobId, size: f?.size ?? 0 });
    }
  }

  if (acc.length === 0) return { error: "Aucun fichier à télécharger.", status: 404 };
  const total = acc.reduce((s, x) => s + x.size, 0);
  if (total > MAX_ZIP_BYTES) return { error: "Sélection trop volumineuse pour une archive. Téléchargez par sous-dossiers.", status: 413 };

  const zip = new JSZip();
  for (const item of acc) {
    const bytes = await getBlob(item.blobId);
    if (bytes) zip.file(item.path, bytes);
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const base = nodes.length === 1 ? safeName(nodes[0].name).replace(/\.[^.]+$/, "") : `Drive-${new Date().toISOString().slice(0, 10)}`;
  return { buffer, count: acc.length, filename: `${base}.zip` };
}
