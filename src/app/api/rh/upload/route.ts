import { NextRequest, NextResponse } from "next/server";
import { HrDocumentCategory } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { mirrorEmployeeContractToDrive } from "@/lib/hr-drive-mirror";
import { resolveVisibility, shouldMirrorToDrive, visibilityLabel } from "@/lib/hr/document-visibility";

export const dynamic = "force-dynamic";

/** Upload d'un document RH pour un employé (contrat, bulletin, attestation…). RH uniquement. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "RH", "UPDATE")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  const employeeId = (form.get("employeeId") as string) || "";
  if (!employeeId) return NextResponse.json({ error: "Employé manquant." }, { status: 400 });
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, userId: true, fullName: true } });
  if (!employee) return NextResponse.json({ error: "Employé introuvable." }, { status: 404 });

  const err = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const catRaw = (form.get("category") as string) || "OTHER";
  const category = (Object.values(HrDocumentCategory) as string[]).includes(catRaw) ? (catRaw as HrDocumentCategory) : "OTHER";
  const requestId = (form.get("requestId") as string) || null;

  // QUI VERRA CETTE PIÈCE. Le défaut suit la NATURE du document : ce qu'on remet au salarié
  // (bulletin, attestations) lui est visible, ce que les RH conservent (contrat, avenant, pièce
  // d'identité, diplôme) reste aux RH. Le champ du formulaire, s'il est envoyé, l'emporte —
  // remettre son contrat signé à quelqu'un est un geste normal, mais c'est alors une décision,
  // pas un défaut. Absent = « rien coché », ce qui n'est PAS « décoché ».
  const visRaw = form.get("visibleToEmployee");
  const visibleToEmployee = resolveVisibility(
    category,
    visRaw == null ? undefined : visRaw === "1" || visRaw === "true" || visRaw === "on",
  );

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId, size } = await putBlob(buf);

  const doc = await prisma.employeeDocument.create({
    data: {
      employeeId,
      category,
      name: (form.get("name") as string) || file.name,
      blobId,
      mime: file.type || "application/octet-stream",
      size,
      period: (form.get("period") as string) || null,
      visibleToEmployee,
      uploadedById: user.id,
      requestId: requestId || undefined,
    },
    select: { id: true, name: true },
  });

  // Si le document répond à une demande : la marquer « prête » et prévenir l'employé.
  if (requestId) {
    await prisma.hrDocumentRequest.update({ where: { id: requestId }, data: { status: "READY", handledById: user.id } }).catch(() => undefined);
    if (employee.userId) {
      await notifyUser({ userId: employee.userId, type: "GENERIC", title: "Votre document RH est prêt", body: doc.name, link: "/mon-dossier" });
    }
  }

  // Contrat / avenant : AUSSI enregistré dans le Drive (« RH — Contrats / <employé> »), en
  // arrière-plan et best-effort — ne bloque jamais le dépôt RH. MAIS uniquement s'il est
  // partagé : cet arbre du Drive se lit en vue globale, et y recopier une pièce qu'on vient de
  // réserver aux RH lèverait la restriction sans que rien ne le signale.
  if (shouldMirrorToDrive(category, visibleToEmployee)) {
    void mirrorEmployeeContractToDrive({ ownerId: user.id, employeeName: employee.fullName, filename: doc.name, data: buf, mime: file.type || undefined })
      .catch((e) => console.error("[rh upload] miroir contrat → Drive échoué", e));
  }

  await recordAudit({
    actorId: user.id, action: "UPLOAD", module: "RH", entityType: "EMPLOYEE", entityId: employeeId,
    summary: `Document RH « ${doc.name} » — ${visibilityLabel(visibleToEmployee)}`,
  });
  return NextResponse.json({ id: doc.id });
}
