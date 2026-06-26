import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { canAccessConversation } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * Sert une pièce jointe déchiffrée. Accès strictement contrôlé : on ne télécharge
 * que si l'on est membre actif de la conversation portant le message.
 * `?dl=1` force le téléchargement.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const attachment = await prisma.messageAttachment.findUnique({
    where: { id: params.id },
    select: {
      blobId: true,
      name: true,
      mime: true,
      message: { select: { conversationId: true, deletedAt: true } },
    },
  });
  if (!attachment || attachment.message.deletedAt) return new NextResponse(null, { status: 404 });
  if (!(await canAccessConversation(user.id, attachment.message.conversationId))) {
    return new NextResponse(null, { status: 403 });
  }

  const bytes = await getBlob(attachment.blobId);
  if (!bytes) return new NextResponse(null, { status: 404 });

  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const filename = encodeURIComponent(attachment.name);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mime || "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
