import { randomUUID } from "crypto";
import type { Confidentiality, DocumentCategory, EntityType } from "@prisma/client";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { saveFile, validateDocumentUpload } from "@/lib/storage";
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
): Promise<{ ok: boolean; error?: string }> {
  const { entityType, entityId, category, confidentiality, stepKey, file } = input;
  if (!file || file.size === 0) return { ok: false, error: "Fichier vide." };

  const maxMb = input.maxUploadMb ?? (await getAppSettings()).maxUploadMb;
  const invalid = validateDocumentUpload(file.name, file.size, maxMb);
  if (invalid) return { ok: false, error: invalid };

  const key = `${entityType}/${entityId}/${randomUUID()}__${file.name}`;
  let content: Buffer | null = null;
  try {
    content = input.buffer ?? Buffer.from(await file.arrayBuffer());
    await saveFile(key, content);
  } catch (err) {
    // Stockage indisponible : on garde la métadonnée pour ne pas casser la bibliothèque ;
    // le binaire pourra être ré-attaché plus tard.
    console.error("[upload] storage write failed, recording metadata only", err);
  }

  // Versionnage : incrémente selon les documents existants de même nom sur l'entité.
  // Toute erreur d'écriture est CAPTURÉE et renvoyée telle quelle (jamais une 500 opaque) : le
  // widget de téléversement affiche alors la vraie cause, et un fichier fautif ne fait pas échouer
  // le lot entier.
  try {
    const previous = await prisma.document.count({ where: { entityType, entityId, name: file.name } });
    await prisma.document.create({
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
    });
  } catch (err) {
    console.error("[upload] document.create failed", { name: file.name, entityType, entityId }, err);
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
  if (input.mirrorToDrive !== false && content) {
    const data = content;
    void mirrorDocumentsToDrive({ ownerId: userId, entityType, entityId, files: [{ name: file.name, data, mime: file.type || null }] })
      .catch((e) => console.error("[upload] miroir Drive échoué (non bloquant)", e));
  }
  return { ok: true };
}
