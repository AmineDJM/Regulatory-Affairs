import { randomUUID } from "node:crypto";
import type { DocumentCategory, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { mirrorDocumentsToDrive, type MirrorFile } from "@/lib/drive/document-mirror";

/**
 * JOINDRE DES FICHIERS À UN OBJET, DÈS SA CRÉATION.
 *
 * Le même bloc était recopié dans cinq actions. Le sortir ici évite qu'une correction (limite
 * de taille, garde de type, chemin de stockage) ne soit appliquée qu'à quatre d'entre elles.
 *
 * Deux comportements assumés :
 *   • **une écriture de fichier qui échoue ne perd pas la demande** — on enregistre quand même
 *     la fiche du document, avec sa trace. Perdre un formulaire entier parce que le stockage a
 *     hoqueté serait bien pire qu'un document à re-téléverser.
 *   • **un fichier refusé arrête tout** — un fichier trop lourd ou d'un type interdit est une
 *     erreur de saisie : mieux vaut le dire tout de suite que de créer une demande incomplète.
 */
export interface AttachResult {
  saved: number;
  /** Message d'erreur si un fichier a été refusé — l'appelant doit alors s'arrêter. */
  error?: string;
}

/**
 * Contrôle les fichiers SANS rien écrire — pour les appelants qui doivent refuser une saisie
 * AVANT d'agir (une décision de workflow, par exemple : enregistrer l'avis puis refuser la
 * pièce jointe laisserait la décision prise et sa justification perdue).
 *
 * Renvoie le message d'erreur du premier fichier refusé, ou `null` si tout passe.
 */
export async function validateAttachments(files: File[]): Promise<string | null> {
  const list = files.filter((f) => f instanceof File && f.size > 0);
  if (list.length === 0) return null;
  const maxMb = (await getAppSettings()).maxUploadMb;
  for (const file of list) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return invalid;
  }
  return null;
}

export async function attachFiles(input: {
  files: File[];
  entityType: EntityType;
  entityId: string;
  uploadedById: string;
  category?: DocumentCategory;
  /** Rattache la pièce à une étape / une case précise (colonne `stepKey`). */
  stepKey?: string | null;
}): Promise<AttachResult> {
  const files = input.files.filter((f) => f instanceof File && f.size > 0);
  if (files.length === 0) return { saved: 0 };

  const maxMb = (await getAppSettings()).maxUploadMb;
  let saved = 0;
  const toMirror: MirrorFile[] = [];

  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return { saved, error: invalid };

    const key = `${input.entityType}/${input.entityId}/${randomUUID()}__${file.name}`;
    let content: Buffer | null = null;
    try {
      content = Buffer.from(await file.arrayBuffer());
      await saveFile(key, content);
    } catch (err) {
      // On garde la fiche : la demande vaut mieux qu'un échec total pour un fichier.
      console.error("[attach] écriture du fichier impossible, métadonnées conservées", key, err);
    }
    if (content) toMirror.push({ name: file.name, data: content, mime: file.type || null });
    await prisma.document.create({
      data: {
        name: file.name,
        category: input.category ?? "OTHER",
        entityType: input.entityType,
        entityId: input.entityId,
        stepKey: input.stepKey ?? null,
        fileKey: key,
        mimeType: file.type || null,
        sizeBytes: file.size,
        confidentiality: "INTERNAL",
        uploadedById: input.uploadedById,
      },
    });
    saved++;
  }

  // Une pièce jointe à une demande est un fichier comme un autre : elle doit se retrouver dans le
  // Drive de celui qui l'a déposée, là où il ira la chercher. En arrière-plan — la demande est
  // déjà enregistrée, et une copie ratée ne doit jamais la faire échouer.
  if (toMirror.length > 0) {
    void mirrorDocumentsToDrive({
      ownerId: input.uploadedById, entityType: input.entityType, entityId: input.entityId, files: toMirror,
    }).catch((e) => console.error("[attach] miroir Drive échoué (non bloquant)", e));
  }

  return { saved };
}
