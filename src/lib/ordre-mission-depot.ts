import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { putBlob } from "@/lib/drive-storage";
import { notifyUser } from "@/lib/notify";
import { recordAudit } from "@/lib/audit";
import { docxToPdf } from "@/lib/payslip/to-pdf";
import { nomOrdreMission, refusOrdreMission, remplirOrdreDeMission, type ChampsOrdreMission } from "@/lib/hr/ordre-mission/modele";

/**
 * HORS DU DOMAINE RH, À DESSEIN (comme hr-drive-mirror.ts) : c'est l'orchestration qui touche au stockage (drive-storage)
 * — le domaine garde le modèle et ses règles (hr/ordre-mission/modele.ts), sans fournisseur.
 *
 * L'ORDRE DE MISSION GÉNÉRÉ ET REMIS AU SALARIÉ (Direction, 06/10) — côté serveur : lire le modèle, le remplir, et le déposer comme la pièce qui RÉPOND à la demande (même chemin que « Joindre le document & marquer prêt ») :
 * le PDF, visible du salarié (le Word reste aux RH) ; la demande passe « prête », le salarié est
 * prévenu.
 */
const CHEMIN_MODELE = join(process.cwd(), "src", "lib", "hr", "ordre-mission", "modele-ordre-de-mission.docx");
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** La référence proposée : le numéro suivant de l'année, au format du document de la Direction (« 007/DPG/2026 »). */
export async function referenceOrdreMissionSuggeree(maintenant = new Date()): Promise<string> {
  const annee = maintenant.getFullYear();
  const deja = await prisma.employeeDocument.count({
    // Un ordre = un Word (le PDF l'accompagne) : on compte les Word, pour ne pas compter chaque ordre deux fois.
    where: { name: { startsWith: "Ordre de mission " }, mime: MIME_DOCX, createdAt: { gte: new Date(Date.UTC(annee, 0, 1)) } },
  });
  return `${String(deja + 1).padStart(3, "0")}/DPG/${annee}`;
}

export async function genererEtRemettreOrdreDeMission(
  acteurId: string, requestId: string, champs: ChampsOrdreMission,
): Promise<{ ok: true; message: string; employeeId: string } | { ok: false; error: string }> {
  const demande = await prisma.hrDocumentRequest.findUnique({
    where: { id: requestId },
    select: { id: true, type: true, status: true, employeeId: true, employee: { select: { fullName: true, userId: true } } },
  });
  if (!demande) return { ok: false, error: "Demande introuvable." };
  if (demande.type !== "MISSION_ORDER") return { ok: false, error: "Cette demande n'est pas un ordre de mission." };
  if (demande.status === "CANCELLED") return { ok: false, error: "Cette demande est annulée." };
  const refus = refusOrdreMission(champs);
  if (refus) return { ok: false, error: refus };

  const docx = await remplirOrdreDeMission(await readFile(CHEMIN_MODELE), champs);
  const nom = nomOrdreMission(champs.reference, champs.collaborateur);
  // LE PDF EST LA PIÈCE REMISE (Direction, 06/10 : « améliore le convertisseur en top qualité ») : le moteur de mise en page
  // reproduit le document à l'identique (en-tête, logo, pied, tabulations — vérifié contre l'export de Word). Le Word est
  // gardé par les RH pour une retouche ; sans PDF (conversion impossible), c'est le Word qui est remis — et la phrase le dit.
  const pdf = await docxToPdf(docx).catch(() => ({ ok: false as const, error: "conversion impossible" }));
  const w = await putBlob(docx);
  await prisma.employeeDocument.create({
    data: {
      employeeId: demande.employeeId, category: "OTHER", name: `${nom}.docx`, blobId: w.blobId, mime: MIME_DOCX, size: w.size,
      visibleToEmployee: !pdf.ok, uploadedById: acteurId, requestId: pdf.ok ? undefined : requestId,
    },
  });
  if (pdf.ok) {
    const p = await putBlob(pdf.pdf);
    await prisma.employeeDocument.create({
      data: {
        employeeId: demande.employeeId, category: "OTHER", name: `${nom}.pdf`, blobId: p.blobId, mime: "application/pdf", size: p.size,
        visibleToEmployee: true, uploadedById: acteurId, requestId,
      },
    });
  }
  await prisma.hrDocumentRequest.update({ where: { id: requestId }, data: { status: "READY", handledById: acteurId } });
  if (demande.employee.userId) {
    await notifyUser({ userId: demande.employee.userId, type: "GENERIC", title: "Votre ordre de mission est prêt", body: `N° ${champs.reference}`, link: "/mon-dossier" }).catch(() => undefined);
  }
  await recordAudit({
    actorId: acteurId, action: "CREATE", module: "RH", entityType: "EMPLOYEE", entityId: demande.employeeId,
    summary: `Ordre de mission N° ${champs.reference} généré pour ${demande.employee.fullName} — ${champs.destination.replace(/\s+/g, " ")}`,
  });
  return {
    ok: true, employeeId: demande.employeeId,
    message: pdf.ok
      ? `Ordre de mission N° ${champs.reference} généré et remis à ${demande.employee.fullName} en PDF (le Word reste aux RH) — il le retrouve dans « Mon dossier RH ».`
      : `Ordre de mission N° ${champs.reference} généré et remis à ${demande.employee.fullName} en Word — le PDF n'a pas pu être produit (${pdf.error}).`,
  };
}
