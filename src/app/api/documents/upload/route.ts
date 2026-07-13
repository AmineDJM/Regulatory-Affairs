import { NextRequest, NextResponse } from "next/server";
import type { Confidentiality, DocumentCategory, EntityType } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { canAccessEntity } from "@/lib/entity-access";
import { getAppSettings } from "@/lib/settings";
import { persistUploadedDocument } from "@/lib/documents";
import { mirrorRegulatoryUpload } from "@/lib/regulatory-drive-mirror";

/**
 * Téléversement de documents **en lot** (fichiers ET dossiers) pour un objet métier :
 * `POST /api/documents/upload` (multipart). Route en **flux** (pas la limite des Server
 * Actions) → gros volumes acceptés ; le client envoie les fichiers **en parallèle** pour
 * la vitesse. Un lot = une catégorie / confidentialité / étape ; nombre de fichiers non
 * limité (borne de **taille par fichier** réglable en Administration).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const form = await req.formData();
  const entityType = String(form.get("entityType") ?? "") as EntityType;
  const entityId = String(form.get("entityId") ?? "");
  const category = (String(form.get("category") ?? "OTHER") || "OTHER") as DocumentCategory;
  const confidentiality = (String(form.get("confidentiality") ?? "INTERNAL") || "INTERNAL") as Confidentiality;
  const stepKey = form.get("stepKey") ? String(form.get("stepKey")) : null;
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!entityType || !entityId) return NextResponse.json({ error: "Entité manquante." }, { status: 400 });
  if (!(await canAccessEntity(user, entityType, entityId, "UPLOAD"))) {
    return NextResponse.json({ error: "Vous n'êtes pas autorisé à téléverser ici." }, { status: 403 });
  }
  if (files.length === 0) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });

  // Une seule lecture des réglages pour tout le lot.
  const maxUploadMb = (await getAppSettings()).maxUploadMb;
  // Regulatory : tout document officiellement téléversé est AUSSI répliqué dans le Drive, sous le
  // dossier du produit (miroir automatique, plus d'option manuelle). On garde le binaire pour ça.
  const isRegulatory = entityType === "REGULATORY_PRODUCT";
  const toMirror: { name: string; data: Buffer; mime?: string }[] = [];
  let created = 0;
  const errors: { name: string; error: string }[] = [];
  for (const file of files) {
    // Lecture unique du binaire : réutilisée par l'enregistrement ET le miroir Drive (Regulatory).
    const buffer = Buffer.from(await file.arrayBuffer());
    const r = await persistUploadedDocument(user.id, { entityType, entityId, category, confidentiality, stepKey, file, maxUploadMb, buffer });
    if (r.ok) {
      created++;
      if (isRegulatory) toMirror.push({ name: file.name, data: buffer, mime: file.type || undefined });
    } else {
      errors.push({ name: file.name, error: r.error ?? "Échec du téléversement." });
    }
  }

  // Miroir Drive automatique (best-effort — n'échoue jamais le téléversement).
  if (isRegulatory && toMirror.length > 0) {
    await mirrorRegulatoryUpload({ productId: entityId, ownerId: user.id, files: toMirror });
  }

  return NextResponse.json({ ok: errors.length === 0, created, errors });
}
