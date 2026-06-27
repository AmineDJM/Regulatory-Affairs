import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { saveFile } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import { onlyofficeConfigured, readEditToken, readDocEditToken, verifyJwt } from "@/lib/onlyoffice";

/**
 * Callback du Document Server : à l'enregistrement (status 2 ou 6), il fournit l'URL
 * du document édité ; on le récupère et on crée une **nouvelle version**.
 * Gère le Drive (FileVersion) ET les documents (modèle Document). Double sécurité :
 * notre jeton signé (lié au nœud/document + utilisateur) + le JWT OnlyOffice (si activé).
 * Doit toujours répondre `{ error: 0 }` en cas de succès.
 */
export async function POST(req: NextRequest) {
  if (!onlyofficeConfigured()) return NextResponse.json({ error: 1 });

  const token = req.nextUrl.searchParams.get("token");
  const driveTok = readEditToken(token);
  const docTok = readDocEditToken(token);
  if (!driveTok && !docTok) return NextResponse.json({ error: 1 });

  let body: { status?: number; url?: string } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 1 });
  }

  // Si le JWT OnlyOffice est activé, le corps est signé (champ `token` ou en-tête Authorization).
  const bodyToken =
    (typeof body.token === "string" && body.token) ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bodyToken) {
    const verified = verifyJwt<{ payload?: Record<string, unknown> } & Record<string, unknown>>(bodyToken);
    if (!verified) return NextResponse.json({ error: 1 });
    body = (verified.payload ?? verified) as typeof body;
  }

  const status = body.status;
  // 2 = prêt à enregistrer ; 6 = enregistrement forcé. Les autres états n'enregistrent rien.
  if (!((status === 2 || status === 6) && typeof body.url === "string")) {
    return NextResponse.json({ error: 0 });
  }

  try {
    const res = await fetch(body.url);
    if (!res.ok) return NextResponse.json({ error: 1 });
    const buf = Buffer.from(await res.arrayBuffer());

    // ─── Document (pièce d'un dossier / Regulatory / etc.) ───
    if (docTok) {
      const docId = req.nextUrl.searchParams.get("docId");
      if (!docId || docId !== docTok.docId) return NextResponse.json({ error: 1 });
      const doc = await prisma.document.findUnique({ where: { id: docId }, select: { fileKey: true, entityType: true, entityId: true, name: true } });
      if (!doc) return NextResponse.json({ error: 1 });
      const key = doc.fileKey || `${doc.entityType}/${doc.entityId}/${randomUUID()}__${doc.name}`;
      await saveFile(key, buf);
      await prisma.document.update({ where: { id: docId }, data: { fileKey: key, sizeBytes: buf.length, version: { increment: 1 } } });
      await recordAudit({ actorId: docTok.userId, action: "UPLOAD", module: "Documents", entityType: doc.entityType, entityId: doc.entityId, summary: `Édition Office enregistrée — ${doc.name}` });
      return NextResponse.json({ error: 0 });
    }

    // ─── Drive (DriveNode + FileVersion) ───
    const id = req.nextUrl.searchParams.get("id");
    if (!driveTok || !id || id !== driveTok.nodeId) return NextResponse.json({ error: 1 });
    const { blobId, size } = await putBlob(buf);
    const last = await prisma.fileVersion.findFirst({ where: { nodeId: id }, orderBy: { version: "desc" }, select: { version: true, mimeType: true } });
    const version = (last?.version ?? 0) + 1;
    await prisma.fileVersion.create({
      data: { nodeId: id, blobId, version, size, mimeType: last?.mimeType ?? "application/octet-stream", createdById: driveTok.userId },
    });
    await prisma.driveNode.update({ where: { id }, data: { size } });
    await recordAudit({ actorId: driveTok.userId, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: id, summary: `Édition Office enregistrée (v${version})` });
    return NextResponse.json({ error: 0 });
  } catch (e) {
    console.error("[onlyoffice] save failed", e);
    return NextResponse.json({ error: 1 });
  }
}
