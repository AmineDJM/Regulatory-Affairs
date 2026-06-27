import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { onlyofficeConfigured, readEditToken, verifyJwt } from "@/lib/onlyoffice";

/**
 * Callback du Document Server : à l'enregistrement (status 2 ou 6), il fournit l'URL
 * du document édité ; on le récupère et on crée une **nouvelle version** dans le Drive.
 * Double sécurité : notre jeton signé (lié au nœud + utilisateur) + le JWT OnlyOffice
 * (si activé). Doit toujours répondre `{ error: 0 }` en cas de succès.
 */
export async function POST(req: NextRequest) {
  if (!onlyofficeConfigured()) return NextResponse.json({ error: 1 });

  const edit = readEditToken(req.nextUrl.searchParams.get("token"));
  const id = req.nextUrl.searchParams.get("id");
  if (!edit || !id || id !== edit.nodeId) return NextResponse.json({ error: 1 });

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
    // En-tête Authorization → données réelles sous `payload` ; dans le corps → à plat.
    body = (verified.payload ?? verified) as typeof body;
  }

  const status = body.status;
  // 2 = prêt à enregistrer ; 6 = enregistrement forcé. Les autres états n'enregistrent rien.
  if ((status === 2 || status === 6) && typeof body.url === "string") {
    try {
      const res = await fetch(body.url);
      if (!res.ok) return NextResponse.json({ error: 1 });
      const buf = Buffer.from(await res.arrayBuffer());
      const { blobId, size } = await putBlob(buf);
      const last = await prisma.fileVersion.findFirst({
        where: { nodeId: id },
        orderBy: { version: "desc" },
        select: { version: true, mimeType: true },
      });
      const version = (last?.version ?? 0) + 1;
      await prisma.fileVersion.create({
        data: { nodeId: id, blobId, version, size, mimeType: last?.mimeType ?? "application/octet-stream", createdById: edit.userId },
      });
      await prisma.driveNode.update({ where: { id }, data: { size } });
      await recordAudit({ actorId: edit.userId, action: "UPLOAD", module: "Drive", entityType: "DRIVE_NODE", entityId: id, summary: `Édition Office enregistrée (v${version})` });
    } catch (e) {
      console.error("[onlyoffice] save failed", e);
      return NextResponse.json({ error: 1 });
    }
  }

  return NextResponse.json({ error: 0 });
}
