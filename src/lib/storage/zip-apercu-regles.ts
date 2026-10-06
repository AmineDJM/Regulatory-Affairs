import { createHash } from "crypto";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * APERÇU D'UNE ENTRÉE D'ARCHIVE — les règles PURES (testées) : quand passer par le cache, sous quelle clé,
 * et comment lire l'en-tête `Range` du navigateur.
 *
 * « Je ne veux pas ce ressenti d'expérience » (Direction, 06/10) — un PDF de 488 Mo dans une archive CTD mettait
 * de longues secondes à s'afficher : l'application le décompressait et le poussait d'un seul tenant, sans plage,
 * et le lecteur PDF du navigateur attendait le DERNIER octet pour peindre la première page.
 *
 * Désormais : une grosse entrée compressée est extraite UNE FOIS dans le bucket, puis servie par le bucket lui-même,
 * qui sait répondre aux plages — le lecteur PDF peint la première page tout de suite, la vidéo se positionne à
 * l'instant. Une entrée STOCKÉE (non compressée) est déjà une tranche de l'archive : elle se sert par plages, sans
 * cache.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** En deçà, l'entrée se sert d'un bloc depuis l'application : la mettre en cache coûterait plus qu'elle ne rapporte. */
export const SEUIL_CACHE_APERCU = 8 * 1024 * 1024;

/** Préfixe des entrées extraites dans le bucket — à part des blobs, pour une règle de cycle de vie dédiée. */
export const PREFIXE_CACHE_APERCU = "apercus-zip/";

/** Le strict nécessaire de l'entrée pour décider et nommer (sous-ensemble d'`EntreeZip`). */
export interface EntreeAApercevoir {
  chemin: string;
  taille: number;
  tailleCompressee: number;
  decalage: number;
  methode: number;
  crc32: number;
}

/**
 * Passe-t-elle par le cache du bucket ? Seulement si l'archive est elle-même un objet DIRECT du bucket (en clair,
 * chiffrée au repos par le fournisseur) : l'entrée extraite garde le même régime. Une archive chiffrée par
 * l'application ne laisse JAMAIS de copie en clair dans le bucket.
 */
export function passeParLeCache(cleArchive: string | null, entree: Pick<EntreeAApercevoir, "methode" | "taille">): boolean {
  return cleArchive !== null && entree.methode === 8 && entree.taille > SEUIL_CACHE_APERCU;
}

/** Une entrée stockée d'une archive du bucket se sert par plages, directement dans l'archive. */
export function serviePlages(cleArchive: string | null, entree: Pick<EntreeAApercevoir, "methode">): boolean {
  return cleArchive !== null && entree.methode === 0;
}

const empreinte = (s: string, n: number) => createHash("sha256").update(s).digest("hex").slice(0, n);

/**
 * Clé du cache : l'archive (sa clé d'objet, unique par dépôt) + l'IDENTITÉ de l'entrée (chemin, tailles, position,
 * CRC). Une nouvelle version de l'archive est un nouvel objet → une nouvelle clé : jamais d'aperçu périmé.
 * L'extension (bornée) n'est là que pour la lisibilité du bucket.
 */
export function cleCacheApercu(cleArchive: string, entree: EntreeAApercevoir): string {
  const identite = [entree.chemin, entree.taille, entree.tailleCompressee, entree.decalage, entree.methode, entree.crc32].join("\u0000");
  const ext = /\.([a-z0-9]{1,8})$/i.exec(entree.chemin)?.[1]?.toLowerCase();
  return `${PREFIXE_CACHE_APERCU}${empreinte(cleArchive, 32)}/${empreinte(identite, 40)}${ext ? `.${ext}` : ""}`;
}

/**
 * Lit `Range: bytes=…` (UNE plage ; plusieurs → on sert le tout, ce que la norme permet).
 *  - `null` : pas d'en-tête, ou syntaxe qu'on ignore → réponse entière (200) ;
 *  - `"hors-limites"` : plage insatisfiable → 416 ;
 *  - sinon les bornes INCLUSES, ramenées dans le fichier.
 */
export function lirePlage(entete: string | null, taille: number): { debut: number; fin: number } | "hors-limites" | null {
  if (!entete) return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(entete);
  if (!m) return null;
  const [, a, b] = m;
  if (a === "" && b === "") return null;
  if (a === "") {
    // Suffixe : les N derniers octets.
    const n = Number(b);
    if (n === 0) return "hors-limites";
    if (taille === 0) return "hors-limites";
    return { debut: Math.max(0, taille - n), fin: taille - 1 };
  }
  const debut = Number(a);
  if (debut >= taille) return "hors-limites";
  const fin = b === "" ? taille - 1 : Math.min(Number(b), taille - 1);
  if (fin < debut) return null;
  return { debut, fin };
}
