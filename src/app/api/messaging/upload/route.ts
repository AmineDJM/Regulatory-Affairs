import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { putBlob } from "@/lib/drive-storage";
import { validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { canAccessConversation, signBlob } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/**
 * Upload d'une pièce jointe de messagerie. Stocke le contenu chiffré (FileBlob,
 * déduplication par SHA-256) et renvoie une signature HMAC liant le blob à notre
 * route — `sendMessage` n'accepte que des pièces jointes ainsi signées.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Mot de passe à changer." }, { status: 403 });
  if (!userCan(user, "MESSAGING", "UPLOAD")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });

  const conversationId = (form.get("conversationId") as string) || null;
  if (!conversationId || !(await canAccessConversation(user.id, conversationId))) {
    return NextResponse.json({ error: "Conversation non autorisée." }, { status: 403 });
  }

  const err = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId, size } = await putBlob(buf);
  const mime = file.type || "application/octet-stream";

  return NextResponse.json({
    blobId,
    sig: signBlob(blobId),
    name: file.name,
    mime,
    size,
  });
}
