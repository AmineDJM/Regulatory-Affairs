"use server";

import { requireUser } from "@/lib/session";
import { balayerQualite } from "@/lib/quality/engine";
import { corrigerConstat, ignorerConstat, rouvrirConstat, type IssueDecision } from "@/lib/quality/decide";
import { hasGlobalView } from "@/lib/rbac";

/**
 * LES GESTES SUR UN CONSTAT — depuis l'écran d'administration ou la boîte de décision. La session
 * d'abord ; les droits par module et l'audit vivent dans `lib/quality/decide.ts`.
 */
export async function agirQualite(constatId: string, geste: "corriger" | "ignorer" | "rouvrir", motif?: string | null): Promise<IssueDecision> {
  const user = await requireUser();
  if (typeof constatId !== "string" || !constatId) return { ok: false, message: "Constat inconnu." };
  if (geste === "corriger") return corrigerConstat(user, constatId);
  if (geste === "ignorer") return ignorerConstat(user, constatId, motif ?? "");
  if (geste === "rouvrir") return rouvrirConstat(user, constatId);
  return { ok: false, message: "Geste inconnu." };
}

/** Lancer un balayage à la main (vue globale seulement) — le battement le fait déjà chaque nuit. */
export async function lancerBalayageQualite(mode: "FULL" | "LIGHT" = "FULL"): Promise<{ ok: boolean; message: string; constats?: number; nouveaux?: number; corriges?: number; resolus?: number; ms?: number }> {
  const user = await requireUser();
  if (!hasGlobalView(user)) return { ok: false, message: "Réservé à la direction et au Super Admin." };
  const r = await balayerQualite({ mode: mode === "LIGHT" ? "LIGHT" : "FULL" });
  return { ok: true, message: `Balayage ${r.mode} : ${r.constats} constat(s), ${r.nouveaux} nouveau(x), ${r.corriges} corrigé(s) seul(s), ${r.resolus} disparu(s), ${r.erreurs} règle(s) en erreur, ${r.ms} ms.`, constats: r.constats, nouveaux: r.nouveaux, corriges: r.corriges, resolus: r.resolus, ms: r.ms };
}
