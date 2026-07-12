/**
 * MIGRATION DES BLOBS EXISTANTS Postgres → R2/S3 (récupère l'espace disque de la base).
 *
 * Une fois `REG_S3_*` configuré (et la base repartie), ce script déplace le contenu chiffré des
 * blobs encore stockés EN BASE vers le bucket, et met `data = NULL` (garde storageKey). Les nouveaux
 * fichiers vont déjà directement dans R2 ; ce script vide le stock HISTORIQUE. Sûr à ré-exécuter
 * (idempotent : ne touche que les lignes non encore migrées). Mémoire bornée à UN blob à la fois.
 *
 *   npm run blobs:migrate-r2
 *
 * ⚠️ Après coup, lancer un `VACUUM FULL "FileBlob";` (ou pg_repack) pour rendre l'espace au disque —
 * mettre `data` à NULL retire la donnée mais l'espace n'est récupéré qu'au VACUUM FULL.
 */
import { prisma } from "../src/lib/prisma";
import { objectStorageConfigured, putObject } from "../src/lib/regulatory/intelligence/upload/object-storage";

async function main() {
  if (!objectStorageConfigured()) {
    console.error("REG_S3_* non configuré — impossible de migrer. Configurez le bucket d'abord.");
    process.exit(1);
  }
  let migrated = 0;
  let freedBytes = 0;
  for (;;) {
    // On récupère seulement des IDs (pas les octets) pour ne pas charger 200 blobs en mémoire.
    const ids = await prisma.fileBlob.findMany({
      where: { storageKey: null, NOT: { data: null } },
      select: { id: true },
      take: 200,
    });
    if (ids.length === 0) break;
    for (const { id } of ids) {
      const row = await prisma.fileBlob.findUnique({ where: { id }, select: { sha256: true, data: true } });
      if (!row?.data) continue;
      const cipher = Buffer.from(row.data); // déjà chiffré au repos
      const key = `blobs/${row.sha256.slice(0, 2)}/${row.sha256}`;
      await putObject(key, cipher);
      await prisma.fileBlob.update({ where: { id }, data: { storageKey: key, data: null } });
      migrated += 1;
      freedBytes += cipher.length;
      if (migrated % 25 === 0) {
        console.log(`… ${migrated} blobs migrés (${(freedBytes / 1048576).toFixed(0)} Mo retirés de la base)`);
      }
    }
  }
  console.log(`✓ Terminé — ${migrated} blob(s) déplacé(s) vers R2, ${(freedBytes / 1048576).toFixed(0)} Mo de contenu retirés de la base.`);
  if (migrated > 0) console.log('Lancez maintenant `VACUUM FULL "FileBlob";` pour rendre l\'espace au disque.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Échec de la migration des blobs :", e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
