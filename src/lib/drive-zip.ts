import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { getObjectStream } from "@/lib/storage/object-storage";
import { LIMITE_ZIP_OCTETS, type EntreeZip } from "@/lib/compression/zip-ecriture";

/**
 * Archives ZIP du Drive : télécharger **un dossier** (contenu récursif) ou **plusieurs éléments**
 * (fichiers et/ou dossiers) en une seule archive. L'accès est vérifié par l'appelant sur chaque
 * élément de tête ; les descendants héritent de l'accès (les partages se résolvent en remontant
 * l'arbre — voir `resolveDriveAccess`).
 *
 * EN FLUX (§118.214) : ce module ne monte plus l'archive en mémoire. Il COLLECTE d'abord ce qui
 * va dedans (des métadonnées seulement), puis un générateur lit UN fichier à la fois — la mémoire
 * vaut le plus gros fichier, plus la taille de l'archive. L'ancien plafond de 800 Mo (JSZip tenait
 * tout) devient la limite du format ZIP sans Zip64 : 4 Go.
 */

export interface ItemZip { chemin: string; blobId: string; taille: number; date: Date }
export interface ZipErreur { error: string; status: number }

/** Nettoie un nom pour un chemin d'archive (pas de séparateurs). */
const safeName = (name: string) => name.replace(/[\\/]/g, "_").trim() || "sans-nom";

/** Parcourt récursivement un dossier et collecte ses fichiers (chemins relatifs). */
async function collectFolder(folderId: string, prefix: string, acc: ItemZip[]): Promise<void> {
  const children = await prisma.driveNode.findMany({
    where: { parentId: folderId, isTrashed: false },
    select: {
      id: true, name: true, type: true, size: true, updatedAt: true,
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
      if (blobId) acc.push({ chemin: `${prefix}${nm}`, blobId, taille: c.size, date: c.updatedAt });
    }
  }
}

/**
 * Ce qui va dans l'archive : un fichier à la racine, un dossier récursivement sous son nom. Noms de
 * tête dédupliqués. Rend aussi le nom de l'archive.
 */
export async function collecterPourZip(nodes: { id: string; name: string; type: string }[]): Promise<{ items: ItemZip[]; total: number; filename: string } | ZipErreur> {
  const items: ItemZip[] = [];
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
      await collectFolder(node.id, `${root}/`, items);
    } else {
      const f = await prisma.driveNode.findUnique({
        where: { id: node.id },
        select: { size: true, updatedAt: true, versions: { orderBy: { version: "desc" }, take: 1, select: { blobId: true } } },
      });
      const blobId = f?.versions[0]?.blobId;
      if (blobId) items.push({ chemin: root, blobId, taille: f?.size ?? 0, date: f?.updatedAt ?? new Date() });
    }
  }

  if (items.length === 0) return { error: "Aucun fichier à télécharger.", status: 404 };
  const total = items.reduce((s, x) => s + x.taille, 0);
  if (total > LIMITE_ZIP_OCTETS) return { error: "Sélection trop volumineuse pour une archive (4 Go au plus). Téléchargez par sous-dossiers.", status: 413 };
  const base = nodes.length === 1 ? safeName(nodes[0].name).replace(/\.[^.]+$/, "") : `Drive-${new Date().toISOString().slice(0, 10)}`;
  return { items, total, filename: `${base}.zip` };
}

async function* octetsDuFlux(flux: ReadableStream<Uint8Array>): AsyncGenerator<Buffer> {
  const lecteur = flux.getReader();
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) return;
      yield Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    }
  } finally { lecteur.releaseLock(); }
}

/**
 * Les entrées de l'archive, LUES UNE À LA FOIS. Un fichier dont le contenu n'est plus lisible n'est
 * pas écarté en silence (l'ancienne version l'omettait sans un mot) : il est LISTÉ dans un fichier
 * « LISEZ-MOI.txt » ajouté à la fin de l'archive. Un fichier déposé en direct (volumineux, en clair
 * dans le bucket) passe en flux, sans jamais être tenu entier en mémoire.
 */
export async function* entreesDeDrive(items: ItemZip[]): AsyncGenerator<EntreeZip> {
  const blobs = await prisma.fileBlob.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.blobId))] } },
    select: { id: true, iv: true, storageKey: true },
  });
  const direct = new Map(blobs.filter((b) => b.storageKey && b.iv.length === 0).map((b) => [b.id, b.storageKey as string]));
  const existants = new Set(blobs.map((b) => b.id));
  const manquants: string[] = [];
  for (const it of items) {
    if (!existants.has(it.blobId)) { manquants.push(it.chemin); continue; }
    const cle = direct.get(it.blobId);
    if (cle) {
      yield { chemin: it.chemin, date: it.date, contenu: { flux: octetsDuFlux(await getObjectStream(cle)), taille: it.taille } };
      continue;
    }
    const octets = await getBlob(it.blobId);
    if (!octets) { manquants.push(it.chemin); continue; }
    yield { chemin: it.chemin, date: it.date, contenu: octets };
  }
  if (manquants.length > 0) {
    const texte = `Ces fichiers n'ont pas pu être inclus (contenu illisible ou absent du stockage) :\n\n${manquants.map((m) => `- ${m}`).join("\n")}\n\nSignalez-le à l'administrateur.\n`;
    yield { chemin: "LISEZ-MOI.txt", contenu: Buffer.from(texte, "utf8") };
  }
}
