import {
  createMultipartUpload, completeMultipartUpload, abortMultipartUpload, presignUploadPartUrl,
  listParts, headObjectSize, type PartieRecue,
} from "@/lib/storage/object-storage";

/**
 * TÉLÉVERSEMENT DIRECT NAVIGATEUR → BUCKET, EN PLUSIEURS PARTIES — le cœur partagé.
 *
 * Le serveur ne voit jamais les octets : il OUVRE l'envoi, SIGNE une adresse par partie, puis
 * FINALISE. Entre les deux, le navigateur pousse les parties au bucket, plusieurs à la fois. Ni
 * la mémoire de l'application, ni sa bande passante, ni Postgres ne sont sur le chemin : c'est
 * ce qui rend possible une archive CTD de plusieurs gigaoctets sur une instance à 512 Mo.
 *
 * Trois propriétés, et chacune a son banc :
 *   • la REPRISE se lit dans le BUCKET (`ListParts`), pas dans le navigateur — après une coupure,
 *     seules les parties manquantes repartent, même si l'onglet a tout oublié ;
 *   • la FINALISATION prend ses empreintes au bucket et refuse un envoi incomplet ou dont une
 *     partie n'a pas la taille attendue — jamais un fichier tronqué déclaré « reçu » ;
 *   • la TAILLE finale est revérifiée (HEAD) avant qu'une fiche soit créée.
 *
 * Le client S3 est INJECTABLE : la logique se teste sans réseau.
 */

const MO = 1024 * 1024;

/** Taille d'une partie : 32 Mo (5 Mio minimum imposé par S3, 10 000 parties au plus). */
export const TAILLE_PARTIE = Math.max(5 * MO, Number(process.env.S3_DIRECT_PART_MB ?? 32) * MO);

/** Parties en vol à la fois côté navigateur. Au-delà, on sature surtout la mémoire du poste. */
export const PARTIES_EN_PARALLELE = (() => {
  const n = Number(process.env.S3_DIRECT_CONCURRENCY ?? 6);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 16) : 6;
})();

/** En deçà, le chemin habituel (le serveur reçoit le fichier) reste plus simple et aussi rapide. */
export const SEUIL_DIRECT_OCTETS = Math.max(1, Number(process.env.S3_DIRECT_THRESHOLD_MB ?? 20)) * MO;

/** Durée de validité d'une adresse de partie : assez pour une liaison lente, sans être un passe-droit. */
export const VALIDITE_URL_S = 6 * 3600;

export interface ClientS3Direct {
  ouvrir(cle: string, type: string): Promise<string>;
  parties(cle: string, uploadId: string): Promise<PartieRecue[]>;
  signerPartie(cle: string, uploadId: string, numero: number): string | null;
  recoller(cle: string, uploadId: string, etags: string[]): Promise<void>;
  abandonner(cle: string, uploadId: string): Promise<void>;
  taille(cle: string): Promise<number | null>;
}

export const CLIENT_S3: ClientS3Direct = {
  ouvrir: createMultipartUpload,
  parties: listParts,
  signerPartie: (cle, uploadId, numero) => presignUploadPartUrl(cle, uploadId, numero, VALIDITE_URL_S),
  recoller: completeMultipartUpload,
  abandonner: abortMultipartUpload,
  taille: headObjectSize,
};

/** Nombre de parties d'un fichier. Pur. */
export function nombreDeParties(total: number, taillePartie: number): number {
  return Math.max(1, Math.ceil(total / taillePartie));
}

/** Taille attendue de la partie `numero` (1-indexée). Pur. */
export function tailleAttendue(numero: number, total: number, taillePartie: number): number {
  const n = nombreDeParties(total, taillePartie);
  return numero < n ? taillePartie : total - taillePartie * (n - 1);
}

/**
 * Les parties DÉJÀ BONNES : présentes ET de la taille attendue. Une partie arrivée tronquée (une
 * coupure en plein envoi que le bucket aurait gardée) n'est pas comptée : elle repart. Pur.
 */
export function partiesValides(recues: PartieRecue[], total: number, taillePartie: number): Map<number, PartieRecue> {
  const n = nombreDeParties(total, taillePartie);
  const ok = new Map<number, PartieRecue>();
  for (const p of recues) {
    if (p.numero < 1 || p.numero > n) continue;
    if (p.taille !== tailleAttendue(p.numero, total, taillePartie)) continue;
    ok.set(p.numero, p);
  }
  return ok;
}

export interface PlanEnvoi {
  taillePartie: number;
  nbParties: number;
  /** Numéros des parties déjà reçues par le bucket — elles ne repartent pas. */
  recues: number[];
  /** Adresse signée de chaque partie MANQUANTE. */
  urls: Record<number, string>;
  enParallele: number;
}

/** Ouvre un envoi neuf. Rend l'identifiant S3 et le plan (toutes les parties à envoyer). */
export async function ouvrirEnvoi(
  cle: string, total: number, type: string, client: ClientS3Direct = CLIENT_S3,
): Promise<{ uploadId: string; plan: PlanEnvoi }> {
  if (!Number.isFinite(total) || total <= 0) throw new Error("Fichier vide (0 octet).");
  if (nombreDeParties(total, TAILLE_PARTIE) > 10_000) throw new Error("Fichier trop volumineux pour un envoi en parties (10 000 parties au plus).");
  const uploadId = await client.ouvrir(cle, type || "application/octet-stream");
  const plan = await planDeReprise(cle, uploadId, total, TAILLE_PARTIE, client, []);
  return { uploadId, plan };
}

/**
 * Le plan d'une REPRISE : ce que le bucket a déjà, et une adresse fraîche pour chaque partie
 * manquante. `connues` évite un aller-retour quand on sait l'envoi neuf.
 */
export async function planDeReprise(
  cle: string, uploadId: string, total: number, taillePartie: number,
  client: ClientS3Direct = CLIENT_S3, connues?: PartieRecue[],
): Promise<PlanEnvoi> {
  const n = nombreDeParties(total, taillePartie);
  const valides = partiesValides(connues ?? (await client.parties(cle, uploadId)), total, taillePartie);
  const urls: Record<number, string> = {};
  for (let i = 1; i <= n; i++) {
    if (valides.has(i)) continue;
    const url = client.signerPartie(cle, uploadId, i);
    if (!url) throw new Error("Stockage objet non configuré : impossible de signer l'envoi.");
    urls[i] = url;
  }
  return { taillePartie, nbParties: n, recues: [...valides.keys()].sort((a, b) => a - b), urls, enParallele: PARTIES_EN_PARALLELE };
}

export type IssueFinalisation =
  | { ok: true; taille: number }
  | { ok: false; erreur: string; manquantes?: number[]; reprendre: boolean };

/**
 * FINALISE : toutes les parties sont-elles là, à la bonne taille ? Alors on recolle avec les
 * empreintes LUES AU BUCKET, et l'on vérifie la taille de l'objet obtenu. Sinon on nomme ce qui
 * manque, et l'envoi reste reprenable — rien n'est abandonné sur un simple trou.
 *
 * Rejouable : un recollage déjà fait répond `NoSuchUpload` ; on vérifie alors l'objet lui-même.
 */
export async function finaliserEnvoi(
  cle: string, uploadId: string, total: number, taillePartie: number, client: ClientS3Direct = CLIENT_S3,
): Promise<IssueFinalisation> {
  const n = nombreDeParties(total, taillePartie);
  let recues: PartieRecue[] | null = null;
  try {
    recues = await client.parties(cle, uploadId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/NoSuchUpload|404/.test(msg)) return { ok: false, erreur: `Le stockage ne répond pas (${msg}).`, reprendre: true };
  }
  if (recues) {
    const valides = partiesValides(recues, total, taillePartie);
    const manquantes: number[] = [];
    for (let i = 1; i <= n; i++) if (!valides.has(i)) manquantes.push(i);
    if (manquantes.length > 0) {
      return {
        ok: false, reprendre: true, manquantes,
        erreur: `Envoi incomplet : ${manquantes.length} partie(s) sur ${n} manquent ou sont tronquées. Reprenez l'envoi — seules ces parties repartiront.`,
      };
    }
    try {
      await client.recoller(cle, uploadId, Array.from({ length: n }, (_, i) => valides.get(i + 1)!.etag));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/NoSuchUpload/i.test(msg)) return { ok: false, erreur: `Recollage des parties impossible (${msg}).`, reprendre: true };
    }
  }
  const taille = await client.taille(cle).catch(() => null);
  if (taille === null) return { ok: false, erreur: "Le fichier n'est pas arrivé dans le stockage — renvoyez-le.", reprendre: false };
  if (taille !== total) {
    return { ok: false, erreur: `Taille reçue incohérente (${taille} octets au lieu de ${total}) — le fichier n'a pas été enregistré.`, reprendre: false };
  }
  return { ok: true, taille };
}

export { VARIABLES_STOCKAGE, refusSansStockageObjet } from "@/lib/storage/phrases-stockage";
