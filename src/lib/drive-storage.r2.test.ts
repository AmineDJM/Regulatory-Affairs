import { describe, it, expect, vi, afterAll } from "vitest";

/**
 * Vérifie la mécanique du stockage objet (R2/S3) du backend de blobs SANS bucket réel : un magasin
 * en mémoire remplace le client objet. Preuve que, stockage objet configuré, le contenu CHIFFRÉ
 * part dans l'objet (la base ne garde que les métadonnées → son disque ne gonfle plus), et que
 * l'aller-retour déchiffré est identique. La validation « live » se fait avec un vrai bucket.
 */
// Seuil volontairement BAS dans le double : envoyer 32 Mo dans un test pour vérifier un aiguillage
// coûterait des secondes et de la mémoire pour prouver exactement la même chose. Il est déclaré
// dans `vi.hoisted` car la fabrique de `vi.mock` est remontée en tête de fichier.
const { store, calls, THRESHOLD } = vi.hoisted(() => ({
  store: new Map<string, Buffer>(),
  calls: { put: 0, stream: 0 },
  THRESHOLD: 1024,
}));

vi.mock("./storage/object-storage", () => ({
  objectStorageConfigured: () => true,
  MULTIPART_THRESHOLD_BYTES: THRESHOLD,
  putObject: async (key: string, body: Buffer) => { calls.put += 1; store.set(key, Buffer.from(body)); },
  putObjectStream: async (key: string, source: AsyncIterable<Buffer>) => {
    calls.stream += 1;
    const parts: Buffer[] = [];
    for await (const p of source) parts.push(Buffer.from(p));
    store.set(key, Buffer.concat(parts));
  },
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

  it("un petit contenu part en UN envoi ; un gros part EN PARTIES — et se relit à l'identique", async () => {
    // Un PUT unique attend un seul flux du début à la fin ; au-delà du seuil, les parties partent
    // en parallèle. L'aller-retour doit rester identique au bit près : c'est ce qui autorise
    // l'aiguillage — sinon on aurait deux formats de stockage au lieu d'un.
    calls.put = 0; calls.stream = 0;

    const small = Buffer.from("court", "utf8");
    const put1 = await putBlob(small);
    expect(calls.put).toBe(1);
    expect(calls.stream).toBe(0);
    expect(Buffer.compare((await getBlob(put1.blobId))!, small)).toBe(0);
    await releaseBlob(put1.blobId);

    const big = Buffer.alloc(THRESHOLD * 3, 0);
    big.write(`gros-${Date.now()}`, "utf8"); // unique : sinon la déduplication court-circuite l'écriture
    const put2 = await putBlob(big);
    expect(calls.stream).toBe(1);
    expect(calls.put).toBe(1); // toujours le seul envoi du petit
    expect(Buffer.compare((await getBlob(put2.blobId))!, big)).toBe(0);
    await releaseBlob(put2.blobId);
  });
});
