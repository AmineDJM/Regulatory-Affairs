import { describe, it, expect, vi, afterAll } from "vitest";

/**
 * Vérifie la mécanique du stockage objet (R2/S3) du backend de blobs SANS bucket réel : un magasin
 * en mémoire remplace le client objet. Preuve que, stockage objet configuré, le contenu CHIFFRÉ
 * part dans l'objet (la base ne garde que les métadonnées → son disque ne gonfle plus), et que
 * l'aller-retour déchiffré est identique. La validation « live » se fait avec un vrai bucket.
 */
const { store } = vi.hoisted(() => ({ store: new Map<string, Buffer>() }));

vi.mock("./regulatory/intelligence/upload/object-storage", () => ({
  objectStorageConfigured: () => true,
  putObject: async (key: string, body: Buffer) => { store.set(key, Buffer.from(body)); },
  getObject: async (key: string) => { const v = store.get(key); if (!v) throw new Error("404"); return v; },
  deleteObject: async (key: string) => { store.delete(key); },
}));

import { prisma } from "@/lib/prisma";
import { putBlob, getBlob, releaseBlob } from "./drive-storage";

describe("drive-storage — stockage objet R2 (magasin en mémoire, chiffrement conservé)", () => {
  let blobId = "";
  afterAll(async () => {
    if (blobId) await prisma.fileBlob.deleteMany({ where: { id: blobId } }).catch(() => undefined);
  });

  it("écrit le CHIFFRÉ dans l'objet (pas en base), relit à l'identique, release supprime l'objet", async () => {
    const plain = Buffer.from(`Dossier CTD confidentiel — éàü — ${Date.now()}`, "utf8");
    const put = await putBlob(plain);
    blobId = put.blobId;

    // La base ne contient PAS les octets : data NULL, storageKey renseigné, objet présent.
    const row = await prisma.fileBlob.findUnique({ where: { id: blobId }, select: { data: true, storageKey: true } });
    expect(row?.data).toBeNull();
    expect(row?.storageKey).toBeTruthy();
    expect(store.has(row!.storageKey!)).toBe(true);
    // L'objet stocke du chiffré (différent du clair).
    expect(Buffer.compare(store.get(row!.storageKey!)!, plain)).not.toBe(0);

    // Aller-retour déchiffré identique.
    const back = await getBlob(blobId);
    expect(back).not.toBeNull();
    expect(Buffer.compare(back!, plain)).toBe(0);

    // Déréférencement → suppression de la ligne ET de l'objet.
    await releaseBlob(blobId);
    expect(await prisma.fileBlob.findUnique({ where: { id: blobId } })).toBeNull();
    expect(store.has(row!.storageKey!)).toBe(false);
    blobId = "";
  });
});
