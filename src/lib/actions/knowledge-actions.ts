"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { relancerTravauxMorts, RELANCE_MAX } from "@/lib/knowledge/rattrapage";
import type { ActionResult } from "@/lib/actions/types";

/**
 * RELANCER DEPUIS LA BOÎTE MORTE (Administration › Couche de connaissance) — Super Admin.
 *
 * `cle` désigne UN groupe (étape, cause, type de fichier) tel que l'écran le montre ; vide, la
 * relance porte sur toute la boîte, bornée à `RELANCE_MAX` par clic (un second clic reprend la
 * suite). Les identifiants ne viennent jamais du formulaire : ils sont recalculés depuis la base
 * (`relancerTravauxMorts`), et l'écriture est conditionnelle à `DEAD` — rejouer le clic ne relance
 * rien deux fois.
 */
export async function relancerBoiteMorte(formData: FormData): Promise<ActionResult & { relances?: number }> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const cleBrute = formData.get("cle");
  const cle = typeof cleBrute === "string" && cleBrute.trim() ? cleBrute.trim() : null;

  const r = await relancerTravauxMorts({ cle });
  if (r.relances === 0) {
    return {
      ok: false,
      error: cle
        ? "Rien à relancer : ce groupe n'est plus dans la boîte morte (déjà relancé, ou rechargez l'écran)."
        : "Rien à relancer : la boîte morte est vide.",
    };
  }
  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Administration",
    summary: `Couche de connaissance : ${r.relances} travaux relancés depuis la boîte morte${cle ? ` (groupe « ${cle} »)` : ""} ; ${r.etapesReparees} étapes réparées.`,
  });
  revalidatePath("/admin/connaissance");
  const suite = r.borne
    ? ` La relance est bornée à ${RELANCE_MAX} travaux par clic : relancez encore pour la suite.`
    : "";
  return {
    ok: true,
    relances: r.relances,
    message: `${r.relances} travaux remis en file, essais remis à zéro.${suite} Il en reste ${r.restants} en boîte morte.`,
  };
}
