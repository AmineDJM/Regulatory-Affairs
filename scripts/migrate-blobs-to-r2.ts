/**
 * MIGRATION DES BLOBS EXISTANTS Postgres → stockage objet (récupère l'espace disque de la base).
 *
 * Une fois `S3_*` configuré (Supabase Storage, R2, MinIO…), ce script déplace le contenu chiffré
 * des blobs encore stockés EN BASE vers le bucket, puis libère la place côté Postgres. Les NOUVEAUX
 * fichiers vont déjà directement dans le bucket ; ce script vide le stock HISTORIQUE.
 *
 * Deux formes de stockage en base cohabitent, et les DEUX sont migrées :
 *   • `FileBlob.data` — un seul bytea (petits fichiers, chemin historique) ;
 *   • `FileBlobChunk` — des tranches ordonnées (fichiers > 16 Mo). Ce sont justement les plus
 *     gros ; les oublier reviendrait à migrer le menu fretin et à laisser la base pleine.
 *
 * Sûr à ré-exécuter (idempotent : ne touche que les lignes non encore migrées). Mémoire bornée :
 * un blob à la fois, et les gros blobs sont poussés EN FLUX, tranche par tranche.
 *
 *   npm run blobs:migrate-r2
 *
 * ⚠️ Après coup, lancer un `VACUUM FULL "FileBlob", "FileBlobChunk";` (ou pg_repack) pour rendre
 * l'espace au disque — retirer la donnée ne suffit pas, Postgres ne rend l'espace qu'au VACUUM FULL.
 */
import { prisma } from "../src/lib/prisma";
import {
  objectStorageConfigured, putObject, putObjectStream, MULTIPART_THRESHOLD_BYTES,
} from "../src/lib/storage/object-storage";
import { describeConfig } from "../src/lib/storage/s3-config";

const blobKey = (sha256: string) => `blobs/${sha256.slice(0, 2)}/${sha256}`;
const mo = (bytes: number) => `${(bytes / 1048576).toFixed(0)} Mo`;

/** Les tranches d'un blob, rendues DANS L'ORDRE et une par une — jamais toutes en mémoire. */
async function* chunkStream(blobId: string): AsyncGenerator<Buffer> {
  const rows = await prisma.fileBlobChunk.findMany({
    where: { blobId }, orderBy: { idx: "asc" }, select: { idx: true },
  });
  for (const { idx } of rows) {
    const row = await prisma.fileBlobChunk.findFirst({
      where: { blobId, idx }, select: { data: true },
    });
    if (row?.data) yield Buffer.from(row.data);
  }
}

/** Déplace UN blob vers le bucket. Rend les octets retirés de la base, ou 0 si rien à faire. */
async function migrateOne(id: string): Promise<number> {
  const blob = await prisma.fileBlob.findUnique({
    where: { id }, select: { sha256: true, size: true, data: true, storageKey: true },
  });
  if (!blob || blob.storageKey) return 0;
  const key = blobKey(blob.sha256);

  // Contenu chiffré = taille du clair + 16 octets de tag GCM.
  const cipherSize = blob.size + 16;

  if (blob.data) {
    const cipher = Buffer.from(blob.data); // déjà chiffré au repos — le bucket ne voit que ça
    await putObject(key, cipher);
    await prisma.fileBlob.update({ where: { id }, data: { storageKey: key, data: null } });
    return cipher.length;
  }

  const chunkCount = await prisma.fileBlobChunk.count({ where: { blobId: id } });
  if (chunkCount === 0) return 0; // ni bytea ni tranches : rien à migrer (blob vide ou déjà nettoyé)

  if (cipherSize > MULTIPART_THRESHOLD_BYTES) {
    await putObjectStream(key, chunkStream(id));
  } else {
    const rows = await prisma.fileBlobChunk.findMany({ where: { blobId: id }, orderBy: { idx: "asc" }, select: { data: true } });
    await putObject(key, Buffer.concat(rows.map((r) => Buffer.from(r.data))));
  }
  // L'objet est écrit ET vérifié par le stockage : on peut retirer les tranches. L'ordre compte —
  // marquer d'abord `storageKey` ferait lire le bucket même si la suppression échoue ensuite.
  await prisma.fileBlob.update({ where: { id }, data: { storageKey: key } });
  await prisma.fileBlobChunk.deleteMany({ where: { blobId: id } });
  return cipherSize;
}

async function main() {
  if (!objectStorageConfigured()) {
    // On NOMME ce qui manque : « non configuré » envoyait relire un panneau de variables où tout
    // paraissait rempli. Aucun secret n'est affiché, seulement des noms de variables.
    const d = describeConfig(process.env as Record<string, string | undefined>);
    console.error("Stockage objet non configuré POUR CE PROCESSUS — impossible de migrer.");
    if (d.disabled) console.error("  Cause : S3_DISABLED est actif. Retirez-le (ou mettez 0) et redéployez.");
    else if (d.missing.length) console.error(`  Manquant : ${d.missing.join(", ")}`);
    console.error("  Détail complet (sans secrets) : npm run storage:check");
    process.exit(1);
  }

  const pending = await prisma.fileBlob.count({ where: { storageKey: null } });
  console.log(`${pending} blob(s) encore en base. Départ.`);

  let migrated = 0;
  let skipped = 0;
  let freedBytes = 0;
  // Parcours par CURSEUR d'identifiant croissant, jamais par `skip`. Les lignes migrées sortent du
  // filtre au fur et à mesure : une pagination par décalage repasserait indéfiniment sur les blobs
  // en échec, qui, eux, restent dans le filtre.
  let after: string | null = null;
  for (;;) {
    // On ne récupère que des IDs (pas les octets) : la boucle ne charge jamais 200 blobs.
    const ids: { id: string }[] = await prisma.fileBlob.findMany({
      where: { storageKey: null, ...(after ? { id: { gt: after } } : {}) },
      select: { id: true }, take: 200, orderBy: { id: "asc" },
    });
    if (ids.length === 0) break;
    after = ids[ids.length - 1].id;
    for (const { id } of ids) {
      try {
        const bytes = await migrateOne(id);
        if (bytes > 0) { migrated += 1; freedBytes += bytes; }
        else skipped += 1; // ni bytea ni tranches : rien à déplacer sur cette ligne
      } catch (err) {
        // Un blob illisible ou refusé ne doit pas arrêter la migration des 4 000 autres.
        skipped += 1;
        console.error(`  ! blob ${id} non migré :`, err instanceof Error ? err.message : err);
      }
      if ((migrated + skipped) % 25 === 0) {
        console.log(`… ${migrated} migrés (${mo(freedBytes)} retirés de la base)${skipped ? `, ${skipped} ignoré(s)` : ""}`);
      }
    }
  }

  console.log(`✓ Terminé — ${migrated} blob(s) déplacé(s) vers le bucket, ${mo(freedBytes)} retirés de la base.`);
  if (skipped > 0) console.log(`  ${skipped} blob(s) ignoré(s) ou en échec — relancez le script pour réessayer.`);
  if (migrated > 0) console.log('Lancez maintenant `VACUUM FULL "FileBlob", "FileBlobChunk";` pour rendre l\'espace au disque.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Échec de la migration des blobs :", e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
