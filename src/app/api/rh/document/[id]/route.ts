import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";

export const dynamic = "force-dynamic";

/**
 * Sert un document RH déchiffré. Accès : l'employé propriétaire (compte lié, et
 * document marqué visible) OU un gestionnaire RH. `?dl=1` force le téléchargement.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const doc = await prisma.employeeDocument.findUnique({
    where: { id: params.id },
    select: { blobId: true, name: true, mime: true, visibleToEmployee: true, employee: { select: { userId: true } } },
  });
  if (!doc) return new NextResponse(null, { status: 404 });

  const isOwner = doc.employee.userId === user.id && doc.visibleToEmployee;
  const isHr = userCan(user, "RH", "VIEW");
  if (!isOwner && !isHr) return new NextResponse(null, { status: 403 });

  const bytes = await getBlob(doc.blobId);
  if (!bytes) return new NextResponse(null, { status: 404 });

  const dl = req.nextUrl.searchParams.get("dl") === "1";
  const filename = encodeURIComponent(doc.name);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
