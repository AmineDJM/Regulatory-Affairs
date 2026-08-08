/**
 * MÉMOIRE DES ENVOIS EN COURS — pour qu'un téléversement survive à la fermeture de l'application.
 *
 * Un navigateur fermé n'envoie plus rien : aucune astuce ne fait transiter des octets depuis un
 * onglet qui n'existe plus. Ce qu'on peut garantir, en revanche, c'est que **rien n'est perdu et
 * que personne n'a à recommencer** : la session d'envoi vit déjà côté serveur (les parties déjà
 * reçues y sont conservées), il ne manquait que le FICHIER côté navigateur — jusqu'ici détenu par
 * la page, donc perdu avec elle. On le range donc dans IndexedDB, qui survit à la fermeture.
 *
 * Résultat : on part, on revient, et l'envoi REPART TOUT SEUL là où il s'était arrêté, sans
 * ressélectionner le fichier. Combiné à la reprise côté serveur, seules les parties manquantes
 * repassent sur le réseau.
 *
 * Pourquoi IndexedDB et pas localStorage : un `File` y est stocké tel quel (clonage structuré),
 * sans le convertir en base64 — un ZIP de 800 Mo ne tiendrait de toute façon pas ailleurs.
 */

const DB_NAME = "amd-ctd-uploads";
const STORE = "pending";
const DB_VERSION = 1;

export interface PendingUpload {
  /** Clé : un envoi en cours par dossier. */
  dossierId: string;
  file: File;
  fileName: string;
  size: number;
  savedAt: number;
}

/**
 * Au-delà de ce délai, une reprise n'a plus de sens : la session serveur a été récupérée par le
 * ménage automatique, et le fichier local ne servirait qu'à occuper de la place.
 */
const MAX_AGE_MS = 24 * 3600_000;

function available(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "dossierId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Exécute une transaction en absorbant toute erreur : la persistance est un CONFORT, jamais un blocage. */
async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  if (!available()) return null;
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null; // navigation privée, quota, permissions… : on continue sans mémoire
  }
}

/** Mémorise le fichier d'un envoi qui vient de démarrer. */
export async function rememberUpload(dossierId: string, file: File): Promise<void> {
  const entry: PendingUpload = { dossierId, file, fileName: file.name, size: file.size, savedAt: Date.now() };
  await withStore("readwrite", (s) => s.put(entry) as IDBRequest<IDBValidKey>);
}

/** Oublie un envoi terminé, abandonné ou définitivement en échec. */
export async function forgetUpload(dossierId: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(dossierId) as unknown as IDBRequest<undefined>);
}

/**
 * Les envois à reprendre au démarrage de l'application. Les entrées périmées sont purgées au
 * passage : un fichier de plusieurs centaines de Mo n'a pas à occuper le disque indéfiniment.
 */
export async function listPendingUploads(): Promise<PendingUpload[]> {
  const all = await withStore<PendingUpload[]>("readonly", (s) => s.getAll() as IDBRequest<PendingUpload[]>);
  if (!all) return [];
  const fresh: PendingUpload[] = [];
  for (const e of all) {
    if (!e?.file || Date.now() - e.savedAt > MAX_AGE_MS) await forgetUpload(e.dossierId);
    else fresh.push(e);
  }
  return fresh;
}
