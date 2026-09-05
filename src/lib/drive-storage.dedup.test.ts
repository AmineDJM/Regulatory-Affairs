import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { putBlob, releaseBlob } from "./drive-storage";

/**
 * LA COURSE DE DÉDUPLICATION — deux écritures du même contenu AU MÊME INSTANT.
 *
 * Avant : `putBlob` cherchait l'empreinte, ne la trouvait pas, créait la ligne — et le second
 * appel parallèle tombait sur l'index unique `sha256` (P2002). Observé dans la suite complète
 * (ingestion d'un dossier CTD de mille fichiers) et possible en production dès que deux
 * personnes déposent la même pièce en même temps. Attendu : les deux appels réussissent, UNE
 * seule ligne existe, et son compteur de références vaut le nombre d'appels.
 */
async function dbOk(): Promise<boolean> {
  try { await prisma.$queryRaw`SELECT 1`; return true; } catch { return false; }
}

describe("drive-storage — écritures parallèles du même contenu", () => {
  const ids = new Set<string>();
  afterAll(async () => {
    for (const id of ids) await prisma.fileBlob.deleteMany({ where: { id } }).catch(() => undefined);
  });

  it("N appels simultanés du même contenu rendent le même blob, refCount = N, aucun P2002", async () => {
    if (!(await dbOk())) return;
    const plain = Buffer.concat([Buffer.from("course-dedup-"), crypto.randomBytes(2048)]);
    const N = 6;
    const results = await Promise.all(Array.from({ length: N }, () => putBlob(plain)));
    const blobIds = new Set(results.map((r) => r.blobId));
    expect(blobIds.size).toBe(1);
    const [id] = [...blobIds];
    ids.add(id);
    expect(results.filter((r) => !r.deduplicated).length).toBe(1);
    const row = await prisma.fileBlob.findUnique({ where: { id }, select: { refCount: true, sha256: true } });
    expect(row?.refCount).toBe(N);
    expect(row?.sha256).toBe(results[0].sha256);
    // Le déréférencement reste symétrique : N releases → plus de ligne.
    for (let i = 0; i < N; i += 1) await releaseBlob(id);
    expect(await prisma.fileBlob.findUnique({ where: { id } })).toBeNull();
    ids.delete(id);
  });
});
