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
): Promise<{ ok: boolean; error?: string; documentId?: string }> {
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
  return { ok: true, documentId };
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
  const files = formData
    .getAll(fieldName)
    .filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return { attached: 0, failed: [] };

  // La limite est lue UNE fois pour le lot : chaque fichier n'a pas à relire les réglages.
  const maxUploadMb = (await getAppSettings()).maxUploadMb;
  let attached = 0;
  const failed: { name: string; error: string }[] = [];
  for (const file of files) {
    const r = await persistUploadedDocument(userId, {
      entityType, entityId, category: "OTHER", confidentiality: "INTERNAL", stepKey: null, file, maxUploadMb,
    });
    if (r.ok) attached += 1;
    else failed.push({ name: file.name, error: r.error ?? "Échec." });
  }
  return { attached, failed };
}
