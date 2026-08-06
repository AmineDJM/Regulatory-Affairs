import { randomUUID } from "node:crypto";
import type { DocumentCategory, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";

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

  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return { saved, error: invalid };

    const key = `${input.entityType}/${input.entityId}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      // On garde la fiche : la demande vaut mieux qu'un échec total pour un fichier.
      console.error("[attach] écriture du fichier impossible, métadonnées conservées", key, err);
    }
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

  return { saved };
}
