import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { transcribeAudio } from "@/lib/ai";
import { managesReports } from "@/lib/queries/field-reports";

export const dynamic = "force-dynamic";

/** Reçoit l'audio d'un rapport, le stocke (chiffré) et le transcrit (Whisper). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "MEDICAL", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const report = await prisma.fieldReport.findUnique({ where: { id: params.id }, select: { delegateId: true } });
  if (!report) return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 });
  if (!(managesReports(user) || report.delegateId === user.id)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Audio manquant." }, { status: 400 });
  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? "25");
  if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ error: `Audio trop volumineux (max ${maxMb} Mo).` }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId } = await putBlob(buf);
  await prisma.fieldReport.update({ where: { id: params.id }, data: { audioBlobId: blobId } });

  const tr = await transcribeAudio(buf, file.name || "audio.webm", file.type || "audio/webm");
  if (tr.ok && tr.text) {
    await prisma.fieldReport.update({ where: { id: params.id }, data: { transcript: tr.text } });
    return NextResponse.json({ configured: true, transcript: tr.text });
  }
  return NextResponse.json({ configured: tr.configured, error: tr.error });
}
