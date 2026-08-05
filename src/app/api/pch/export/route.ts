import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { buildTenderWorkbook, tenderExportFilename } from "@/lib/pch-tender-export";
import { recordAudit } from "@/lib/audit";

/**
 * EXPORT EXCEL d'un appel d'offres PCH — le tableau de réponse.
 *
 * Deux feuilles : les **produits demandés** (avec la nature de l'unité, le conditionnement, le
 * nombre de boîtes à fournir et le prix de référence des réceptions PCH) et l'**analyse de
 * marché** (taille, ville / hôpital, concurrents, production locale ou importée).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "PCH", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Appel d'offres non précisé." }, { status: 400 });

  const tender = await prisma.pchTender.findUnique({
    where: { id },
    select: {
      reference: true, title: true, client: true, awardDate: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!tender) return NextResponse.json({ error: "Appel d'offres introuvable." }, { status: 404 });

  const buffer = buildTenderWorkbook(
    {
      reference: tender.reference,
      title: tender.title ?? "",
      buyer: tender.client,
      submissionDeadline: tender.awardDate?.toISOString() ?? null,
    },
    tender.lines.map((l) => ({
      designation: l.designation,
      dci: l.dci,
      dosage: l.dosage,
      form: l.form,
      unitLabel: l.unitLabel,
      quantityUnits: l.quantityUnits,
      unitsPerBox: l.unitsPerBox,
      refPriceDzd: l.refPriceDzd == null ? null : toNumber(l.refPriceDzd),
      refPriceSource: l.refPriceSource,
      haveProduct: l.haveProduct,
      ourProduct: l.ourProduct,
      unitPriceDzd: l.unitPriceDzd == null ? null : toNumber(l.unitPriceDzd),
      registeredNomenclature: l.registeredNomenclature,
      registeredOurs: l.registeredOurs,
      status: l.status,
      marketEstimateDzd: l.marketEstimateDzd == null ? null : toNumber(l.marketEstimateDzd),
      competitorCount: l.competitorCount,
      marketOrigin: l.marketOrigin,
      marketVillePct: l.marketVillePct == null ? null : toNumber(l.marketVillePct),
      marketHopitalPct: l.marketHopitalPct == null ? null : toNumber(l.marketHopitalPct),
      marketHhi: l.marketHhi,
      competitorsTop: l.competitorsTop,
      note: l.note,
    })),
  );

  await recordAudit({ actorId: user.id, action: "EXPORT", module: "PCH", summary: `Export Excel appel d'offres « ${tender.reference} » (${tender.lines.length} produit(s))` });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tenderExportFilename(tender.reference)}"`,
      "Cache-Control": "no-store",
    },
  });
}
