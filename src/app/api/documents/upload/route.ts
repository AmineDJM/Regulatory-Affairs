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

  // Une seule lecture des réglages pour tout le lot (repli généreux si la lecture échoue).
  const maxUploadMb = await getAppSettings().then((s) => s.maxUploadMb).catch(() => 200);
  // Regulatory : tout document officiellement téléversé est AUSSI répliqué dans le Drive, sous le
  // dossier du produit (miroir automatique, plus d'option manuelle). On garde le binaire pour ça.
  const isRegulatory = entityType === "REGULATORY_PRODUCT";
  const toMirror: { name: string; data: Buffer; mime?: string }[] = [];
  let created = 0;
  const errors: { name: string; error: string }[] = [];
  for (const file of files) {
    // Chaque fichier est isolé : une erreur (lecture, stockage, base) devient une erreur DE CE
    // fichier avec sa cause exacte — jamais une 500 opaque qui ferait échouer tout le lot.
    try {
      // Lecture unique du binaire : réutilisée par l'enregistrement ET le miroir Drive (Regulatory).
      const buffer = Buffer.from(await file.arrayBuffer());
      const r = await persistUploadedDocument(user.id, { entityType, entityId, category, confidentiality, stepKey, file, maxUploadMb, buffer });
      if (r.ok) {
        created++;
        if (isRegulatory) toMirror.push({ name: file.name, data: buffer, mime: file.type || undefined });
      } else {
        errors.push({ name: file.name, error: r.error ?? "Échec du téléversement." });
      }
    } catch (err) {
      console.error("[documents upload] fichier en échec", { name: file.name, entityType, entityId }, err);
      errors.push({ name: file.name, error: err instanceof Error ? err.message : "Échec du téléversement." });
    }
  }

  // Miroir Drive automatique EN ARRIÈRE-PLAN : on NE bloque PAS la réponse dessus. Le document
  // est déjà enregistré (c'est ce que l'utilisateur voit) ; la copie Drive se termine juste après,
  // sur le serveur persistant (Render) → téléversement ressenti « instantané », l'utilisateur peut
  // enchaîner d'autres tâches. Best-effort : toute erreur est journalisée, jamais propagée.
  if (isRegulatory && toMirror.length > 0) {
    void mirrorRegulatoryUpload({ productId: entityId, ownerId: user.id, files: toMirror }).catch((e) => console.error("[documents upload] miroir Drive en arrière-plan a échoué", e));
  }

  return NextResponse.json({ ok: errors.length === 0, created, errors });
}
