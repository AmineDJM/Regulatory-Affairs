import { randomUUID } from "crypto";
import type { Confidentiality, DocumentCategory, EntityType } from "@prisma/client";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { saveFile, deleteFileByKey, validateDocumentUpload } from "@/lib/storage";
import { sha256 } from "@/lib/drive-storage";
import { getAppSettings } from "@/lib/settings";
import { ENTITY_TYPE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { mirrorDocumentsToDrive } from "@/lib/drive/document-mirror";

export interface PersistDocInput {
  entityType: EntityType;
  entityId: string;
  category: DocumentCategory;
  confidentiality: Confidentiality;
  stepKey: string | null;
  file: File;
  /** Limite de taille (Mo) déjà résolue — évite de relire les réglages pour chaque fichier d'un lot. */
  maxUploadMb?: number;
  /** Contenu déjà lu (évite une 2ᵉ lecture quand l'appelant a besoin du binaire — ex. miroir Drive). */
  buffer?: Buffer;
  /**
   * Miroir Drive : `false` quand l'appelant s'en charge lui-même (route de lot, qui groupe les
   * fichiers d'un même envoi en une seule descente d'arborescence, ou miroir Regulatory par
   * produit). Par défaut le miroir part d'ici — un chemin de téléversement oublié serait un
   * fichier absent du Drive, et c'est précisément ce qu'on corrige.
   */
  mirrorToDrive?: boolean;
}

/**
 * Enregistre un fichier téléversé comme **Document** : blob chiffré (dédupliqué),
 * métadonnées (catégorie, confidentialité, étape), versionnage par nom, audit.
 * Logique **partagée** par la route d'upload en lot (`/api/documents/upload`) et
 * l'action serveur historique (`uploadDocument`). Accepte tout type de fichier sauf
 * les exécutables (voir `validateDocumentUpload`).
 */
export async function persistUploadedDocument(
  userId: string,
  input: PersistDocInput,
): Promise<{ ok: boolean; error?: string; documentId?: string }> {
  const { entityType, entityId, category, confidentiality, stepKey, file } = input;
  if (!file || file.size === 0) return { ok: false, error: "Fichier vide." };

  const maxMb = input.maxUploadMb ?? (await getAppSettings()).maxUploadMb;
  const invalid = validateDocumentUpload(file.name, file.size, maxMb);
  if (invalid) return { ok: false, error: invalid };

  const key = `${entityType}/${entityId}/${randomUUID()}__${file.name}`;
  const content: Buffer = input.buffer ?? Buffer.from(await file.arrayBuffer());

  // UNE RELANCE N'EST PAS UNE VERSION 2 (audit du 04/10, constat 13). Une requête dont la réponse
  // s'est perdue en route est renvoyée par le navigateur ; le serveur, lui, avait bien enregistré
  // la première. Même pièce (même nom, mêmes octets), même personne, même fiche, il y a moins de
  // dix minutes : c'est le même dépôt, on rend la fiche existante.
  const deja = await depotIdentiqueRecent(userId, entityType, entityId, file.name, content);
  if (deja) return { ok: true, documentId: deja };

  // PAS DE FICHE SANS FICHIER (audit du 04/10, constat 1). La version d'avant avalait l'échec
  // d'écriture, créait la fiche quand même et l'écran disait « téléversé » : la personne
  // découvrait des semaines plus tard un document « indisponible », l'original jeté entre-temps.
  // Un échec d'écriture est DIT, et rien n'est créé — renvoyer le fichier suffit.
  try {
    await saveFile(key, content);
  } catch (err) {
    console.error("[upload] écriture du fichier impossible — aucune fiche créée", err);
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `« ${file.name} » n'a pas pu être enregistré (${detail}). Aucun document n'a été créé : renvoyez le fichier.` };
  }

  // Versionnage : incrémente selon les documents existants de même nom sur l'entité.
  // Toute erreur d'écriture est CAPTURÉE et renvoyée telle quelle (jamais une 500 opaque) : le
  // widget de téléversement affiche alors la vraie cause, et un fichier fautif ne fait pas échouer
  // le lot entier.
  let documentId: string;
  try {
    const previous = await prisma.document.count({ where: { entityType, entityId, name: file.name } });
    // L'identifiant est RENDU : un appelant qui rattache la pièce à un objet métier (une pièce de
    // dossier de paiement, par exemple) ne doit pas avoir à la retrouver « la plus récente », ce
    // qui se trompe dès que deux fichiers partent en même temps.
    const created = await prisma.document.create({
      data: {
        name: file.name,
        category,
        entityType,
        entityId,
        stepKey,
        fileKey: key,
        mimeType: file.type || null,
        sizeBytes: file.size,
        version: previous + 1,
        confidentiality,
        uploadedById: userId,
      },
      select: { id: true },
    });
    documentId = created.id;
  } catch (err) {
    console.error("[upload] document.create failed", { name: file.name, entityType, entityId }, err);
    // Le fichier écrit n'a pas de fiche : on le rend, sinon il reste payé et invisible.
    await deleteFileByKey(key).catch(() => undefined);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Enregistrement impossible : ${msg}` };
  }

  await recordAudit({
    actorId: userId,
    action: "UPLOAD",
    module: ENTITY_TYPE_LABELS[entityType] ?? ENTITY_MODULE[entityType],
    entityType,
    entityId,
    summary: `Document « ${file.name} » téléversé`,
  }).catch((e) => console.error("[upload] audit failed (non-bloquant)", e));

  // MIROIR DRIVE, en arrière-plan : le document est déjà enregistré, c'est ce que la personne
  // voit. La copie se termine côté serveur — on ne fait pas attendre un téléversement pour elle.
  if (input.mirrorToDrive !== false) {
    const data = content;
    void mirrorDocumentsToDrive({ ownerId: userId, entityType, entityId, files: [{ name: file.name, data, mime: file.type || null }] })
      .catch((e) => console.error("[upload] miroir Drive échoué (non bloquant)", e));
  }
  return { ok: true, documentId };
}

/** Fenêtre dans laquelle un renvoi identique est lu comme une relance, pas comme une version. */
export const RELANCE_FENETRE_MS = 10 * 60_000;

/**
 * Le même dépôt, déjà enregistré ? Même personne, même fiche, même nom, mêmes octets, il y a
 * moins de dix minutes. Les octets comptent : renvoyer un fichier CORRIGÉ sous le même nom reste
 * une nouvelle version, et c'est voulu.
 */
async function depotIdentiqueRecent(
  userId: string, entityType: EntityType, entityId: string, name: string, content: Buffer,
): Promise<string | null> {
  const recents = await prisma.document.findMany({
    where: { entityType, entityId, name, uploadedById: userId, fileKey: { not: null }, createdAt: { gte: new Date(Date.now() - RELANCE_FENETRE_MS) } },
    orderBy: { createdAt: "desc" }, take: 5, select: { id: true, fileKey: true },
  });
  if (recents.length === 0) return null;
  const empreinte = sha256(content);
  for (const d of recents) {
    const stored = await prisma.storedFile.findUnique({ where: { key: d.fileKey! }, select: { blobId: true } });
    if (!stored) continue;
    const blob = await prisma.fileBlob.findUnique({ where: { id: stored.blobId }, select: { sha256: true } });
    if (blob?.sha256 === empreinte) return d.id;
  }
  return null;
}

/**
 * LES PIÈCES JOINTES D'UN FORMULAIRE DE CRÉATION — rattachées à l'objet qui vient de naître.
 *
 * Un document légal ou un courrier se saisit avec sa pièce en main : la personne l'a sous les
 * yeux, c'est le seul moment où elle est certaine de laquelle il s'agit. La renvoyer sur la
 * fiche pour l'y déposer ensuite, c'est la moitié des dossiers qui restent sans pièce.
 *
 * NE FAIT JAMAIS ÉCHOUER LA CRÉATION. L'objet existe déjà quand cette fonction s'exécute :
 * refuser tout parce qu'un fichier sur trois est trop gros ferait perdre la saisie entière.
 * Les échecs sont RENDUS, à afficher — jamais avalés en silence.
 */
export async function attachFormFiles(
  userId: string,
  entityType: EntityType,
  entityId: string,
  formData: FormData,
  fieldName = "attachment",
): Promise<{ attached: number; failed: { name: string; error: string }[] }> {
  // Un champ fichier laissé vide envoie un fichier SANS NOM de zéro octet : ce n'est pas une
  // pièce. Un fichier NOMMÉ de zéro octet, si — et il est dit, plus écarté en silence (constat 13).
  const all = formData.getAll(fieldName).filter((v): v is File => v instanceof File && (v.size > 0 || v.name !== ""));
  const failed: { name: string; error: string }[] = all
    .filter((f) => f.size === 0)
    .map((f) => ({ name: f.name, error: "Fichier vide (0 octet) — rien à enregistrer." }));
  const files = all.filter((f) => f.size > 0);
  if (files.length === 0) return { attached: 0, failed };

  // La limite est lue UNE fois pour le lot : chaque fichier n'a pas à relire les réglages.
  const maxUploadMb = (await getAppSettings()).maxUploadMb;
  let attached = 0;
  for (const file of files) {
    const r = await persistUploadedDocument(userId, {
      entityType, entityId, category: "OTHER", confidentiality: "INTERNAL", stepKey: null, file, maxUploadMb,
    });
    if (r.ok) attached += 1;
    else failed.push({ name: file.name, error: r.error ?? "Échec." });
  }
  return { attached, failed };
}
