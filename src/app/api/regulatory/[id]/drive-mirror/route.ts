import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessEntity } from "@/lib/entity-access";
import { getAppSettings } from "@/lib/settings";
import { validateDriveUpload } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { mirrorToProductDrive, mimeFromName, type MirrorEntry } from "@/lib/regulatory-drive-mirror";
import { inspectZip, type ManifestEntry } from "@/lib/regulatory/intelligence/ingest/zip-inspector";

/**
 * Dépôt Regulatory → MIROIR DRIVE. Accepte, pour un produit donné :
 *  - `mode=files`  : un ou plusieurs fichiers seuls ;
 *  - `mode=folder` : un dossier entier (chemins relatifs conservés) ;
 *  - `mode=zip`    : une ou plusieurs archives ZIP (décompressées, arborescence conservée).
 * Recrée l'arborescence exacte dans le Drive sous un dossier nommé d'après le produit.
 */
const MIRROR_ZIP_MAX_MB = Number(process.env.REG_MIRROR_ZIP_MAX_MB ?? "1024");

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Mot de passe à changer." }, { status: 403 });

  const productId = params.id;
  // Autorisation : pouvoir DÉPOSER sur ce produit Regulatory (rôle + périmètre de ligne).
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPLOAD"))) {
    return NextResponse.json({ error: "Non autorisé sur ce dossier." }, { status: 403 });
  }
  const product = await prisma.regulatoryProduct.findUnique({
    where: { id: productId },
    select: { reference: true, dci: true, responsibleId: true, assistantId: true, assignedUsers: { select: { id: true } } },
  });
  if (!product) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });

  const form = await req.formData();
  const mode = String(form.get("mode") ?? "files");
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const paths = form.getAll("paths").map(String);
  if (files.length === 0) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

  const settings = await getAppSettings();
  const entries: MirrorEntry[] = [];
  const blockedFromZip: string[] = [];

  if (mode === "zip") {
    for (const file of files) {
      if (file.size > MIRROR_ZIP_MAX_MB * 1024 * 1024) {
        return NextResponse.json({ error: `Archive « ${file.name} » trop volumineuse (max ${MIRROR_ZIP_MAX_MB} Mo).` }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const collected: MirrorEntry[] = [];
      const insp = await inspectZip(buf, {
        maxArchiveBytes: MIRROR_ZIP_MAX_MB * 1024 * 1024,
        onStorableEntry: async (entry: ManifestEntry, data: Buffer) => {
          collected.push({ path: entry.path, data, mime: mimeFromName(entry.filename) });
        },
      });
      if (!insp.ok) return NextResponse.json({ error: `Archive « ${file.name} » : ${insp.rejection?.message ?? "illisible"}.` }, { status: 400 });
      for (const e of insp.entries) if (e.securityStatus !== "SAFE" && e.securityStatus !== "SUSPICIOUS") blockedFromZip.push(e.filename);
      entries.push(...collected);
    }
  } else {
    // files / folder : chaque fichier → une entrée ; le CHEMIN = relatif (dossier) ou nom (fichiers).
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const err = validateDriveUpload(file.name, file.size, settings.maxDriveUploadMb);
      if (err) return NextResponse.json({ error: `« ${file.name} » : ${err}` }, { status: 400 });
      const rel = mode === "folder" ? (paths[i] || file.name) : file.name;
      entries.push({ path: rel, data: Buffer.from(await file.arrayBuffer()), mime: file.type || mimeFromName(file.name) });
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "Aucun fichier exploitable (tous refusés ou vides)." }, { status: 400 });
  }

  // Garde capacité globale du Drive (stockage physique dédupliqué).
  const totalBytes = entries.reduce((s, e) => s + e.data.length, 0);
  const physical = await prisma.fileBlob.aggregate({ _sum: { size: true } });
  if ((physical._sum.size ?? 0) + totalBytes > settings.driveCapacityGb * 1024 ** 3) {
    return NextResponse.json({ error: "Capacité globale du Drive atteinte. Contactez le Super Admin." }, { status: 400 });
  }

  const productName = `${product.reference} — ${product.dci}`.trim();
  const stakeholders = [product.responsibleId, product.assistantId, ...product.assignedUsers.map((u) => u.id)]
    .filter((v): v is string => Boolean(v));

  let result;
  try {
    result = await mirrorToProductDrive({
      productName,
      ownerId: user.id,
      entries,
      subfolder: mode === "zip" && files.length === 1 ? files[0].name.replace(/\.zip$/i, "") : undefined,
      shareUserIds: stakeholders,
    });
  } catch (err) {
    console.error("[reg drive-mirror] échec", err);
    return NextResponse.json({ error: "Le miroir Drive a échoué. Réessayez." }, { status: 500 });
  }

  await recordAudit({
    actorId: user.id, action: "UPLOAD", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId,
    summary: `Dépôt Drive « ${productName} » — ${result.created} fichier(s) ajouté(s)${result.updated ? `, ${result.updated} mis à jour` : ""}${result.skipped ? `, ${result.skipped} ignoré(s)` : ""} (${mode}).`,
  });

  return NextResponse.json({
    ok: true,
    folderId: result.productFolderId,
    href: `/drive/${result.productFolderId}`,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    blocked: blockedFromZip,
  });
}
