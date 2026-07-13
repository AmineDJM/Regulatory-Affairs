import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getBudgetOverview, getEnvelopesGrandTotal } from "@/lib/queries/budget";
import { buildBudgetWorkbook, budgetExportFilename } from "@/lib/budget-export";
import { recordAudit } from "@/lib/audit";

/** Export Excel (.xlsx) du budget affiché + total des enveloppes, avec taux de consommation. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "BUDGETS", "VIEW")) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const env = sp.get("env");
  const from = sp.get("from") ? new Date(sp.get("from")!) : null;
  const to = sp.get("to") ? new Date(sp.get("to")!) : null;

  // getBudgetOverview applique déjà l'accès (une enveloppe non ouverte au spectateur → null).
  const overview = await getBudgetOverview(user, env, from, to);
  if (!overview) return NextResponse.json({ error: "Aucune enveloppe accessible." }, { status: 404 });
  const grandTotal = await getEnvelopesGrandTotal(user);

  const buffer = buildBudgetWorkbook(overview, grandTotal);
  await recordAudit({ actorId: user.id, action: "EXPORT", module: "Budgets", summary: `Export Excel « ${overview.envelope.name} »` });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${budgetExportFilename(overview.envelope.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
