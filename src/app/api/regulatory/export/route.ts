import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan, scopeRegulatory } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
import { buildRegulatoryWorkbook, regulatoryExportFilename, type RegulatoryExportRow } from "@/lib/regulatory/export";

/**
 * EXPORT EXCEL DES DOSSIERS REGULATORY.
 *
 * En POST, et non en simple lien : l'écran envoie la liste des dossiers **actuellement
 * affichés**, filtres compris. Exporter autre chose que ce qu'on a sous les yeux est la
 * meilleure façon de faire circuler un classeur dont personne ne sait ce qu'il contient.
 *
 * La PORTÉE reste maîtresse : les identifiants reçus sont recroisés avec `scopeRegulatory` et
 * l'entité courante. Un identifiant deviné ne sort donc rien — et un dossier VERROUILLÉ reste
 * invisible, ici comme ailleurs, puisque le verrou vit dans la portée.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "REGULATORY", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  // Liste facultative : sans elle, on exporte tout ce que la personne a le droit de voir.
  let ids: string[] | null = null;
  try {
    const body: unknown = await req.json();
    const raw = (body as { ids?: unknown })?.ids;
    if (Array.isArray(raw)) ids = raw.filter((x): x is string => typeof x === "string");
  } catch {
    /* corps absent ou illisible → export complet dans la portée */
  }

  const products = await prisma.regulatoryProduct.findMany({
    where: {
      ...scopeRegulatory(user),
      ...await currentCompanyWhereFor(user.id),
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    include: {
      responsible: { select: { name: true } },
      assistant: { select: { name: true } },
      supplier: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      variations: { select: { toStatus: true, status: true, decisionDate: true, createdAt: true } },
      steps: { select: { status: true } },
    },
  });

  const rows: RegulatoryExportRow[] = products.map((p) => {
    const stage = effectiveStage(p.manufacturingStatus, p.variations);
    const done = p.steps.filter((s) => s.status === "DONE").length;
    return {
      reference: p.reference,
      dci: p.dci,
      molecules: Array.isArray(p.molecules) ? (p.molecules as string[]) : null,
      brandName: p.brandName,
      dosage: p.dosage,
      dosageUnit: p.dosageUnit,
      pharmaceuticalForm: p.pharmaceuticalForm,
      packaging: p.packaging,
      therapeuticClass: p.therapeuticClass,
      category: p.category,
      channel: p.channel,
      supplier: p.supplier?.name ?? null,
      partnerLab: p.partnerLab,
      countryOfOrigin: p.countryOfOrigin,
      manufacturingStatus: stage.status,
      manufacturingSource: stage.source,
      status: p.status,
      priority: p.priority,
      responsible: p.responsible?.name ?? null,
      assistant: p.assistant?.name ?? null,
      company: p.company?.shortName || p.company?.name || null,
      targetSubmissionDate: p.targetSubmissionDate?.toISOString() ?? null,
      targetDate: p.targetDate?.toISOString() ?? null,
      stepsDone: done,
      stepsTotal: p.steps.length,
      deHolder: p.deHolder,
      manufacturer: p.manufacturer,
      manufacturingVariation: p.manufacturingVariation,
      comments: p.comments,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const buffer = await buildRegulatoryWorkbook(rows);
  await recordAudit({
    actorId: user.id, action: "EXPORT", module: "Regulatory",
    summary: `Export Excel de ${rows.length} dossier(s) réglementaire(s)`,
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${regulatoryExportFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
