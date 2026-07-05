"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdNum, fdDate, fdBool, type ActionResult } from "@/lib/actions/types";

export async function createSale(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "SALES", "CREATE")) return { ok: false, error: "Non autorisé." };

  const product = fdStr(formData, "product");
  const client = fdStr(formData, "client");
  if (!product || !client) return { ok: false, error: "Produit et client sont obligatoires." };

  const quantity = fdNum(formData, "quantity") ?? 0;
  const unitPrice = fdNum(formData, "unitPrice") ?? 0;
  const revenue = fdNum(formData, "revenue") ?? quantity * unitPrice;

  const created = await prisma.sale.create({
    data: {
      date: fdDate(formData, "date") ?? new Date(),
      saleType: fdStr(formData, "saleType") === "SERVICE" ? "SERVICE" : "PRODUCT",
      product,
      serviceDescription: fdStr(formData, "serviceDescription"),
      dci: fdStr(formData, "dci"),
      dosage: fdStr(formData, "dosage"),
      pharmaceuticalForm: fdStr(formData, "pharmaceuticalForm"),
      client,
      institution: fdStr(formData, "institution"),
      companyId: fdStr(formData, "companyId") || null,
      isPch: fdBool(formData, "isPch"),
      quantity,
      unitPrice,
      revenue,
      estimatedMargin: fdNum(formData, "estimatedMargin"),
      // A sales user always owns their own lines; managers may leave it unset.
      salesUserId: user.role === "SALES_USER" ? user.id : fdStr(formData, "salesUserId") ?? user.id,
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Ventes",
    entityType: "SALE", entityId: created.id, summary: `Vente ${product} — ${client}`,
  });

  revalidatePath("/sales");
  return { ok: true, id: created.id };
}

/**
 * Bulk import of sales from pasted CSV.
 * Header: date,product,dci,dosage,form,client,institution,isPch,quantity,unitPrice
 */
export async function importSales(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "SALES", "CREATE")) return { ok: false, error: "Non autorisé." };

  const csv = fdStr(formData, "csv");
  if (!csv) return { ok: false, error: "Aucune donnée CSV." };

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: "CSV vide ou sans données." };

  // Skip header row.
  const rows = lines.slice(1);
  const data = [];
  for (const line of rows) {
    const cols = line.split(/[;,]/).map((c) => c.trim());
    if (cols.length < 6) continue;
    const [date, product, dci, dosage, form, client, institution, isPch, quantity, unitPrice] = cols;
    if (!product || !client) continue;
    const qty = Number(quantity) || 0;
    const price = Number(unitPrice) || 0;
    data.push({
      date: date ? new Date(date) : new Date(),
      product,
      dci: dci || null,
      dosage: dosage || null,
      pharmaceuticalForm: form || null,
      client,
      institution: institution || null,
      isPch: /^(1|true|oui|yes)$/i.test(isPch ?? ""),
      quantity: qty,
      unitPrice: price,
      revenue: qty * price,
      salesUserId: user.role === "SALES_USER" ? user.id : null,
      createdById: user.id,
    });
  }

  if (data.length === 0) return { ok: false, error: "Aucune ligne valide détectée." };

  await prisma.sale.createMany({ data });
  await recordAudit({
    actorId: user.id, action: "IMPORT", module: "Ventes",
    summary: `${data.length} ventes importées via CSV`,
  });

  revalidatePath("/sales");
  return { ok: true };
}
