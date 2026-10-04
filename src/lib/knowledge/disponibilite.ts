import { lunaConfigured } from "@/lib/openai-luna";
import { interrupteurIaCoupe, REFUS_IA_COUPEE } from "@/lib/ai-settings";

/**
 * LE MODÈLE EST-IL JOIGNABLE ? La clé d'abord, puis l'interrupteur général (lu en base). La raison
 * voyage avec la réponse : l'écran la montre au lieu d'un « en attente » sans explication, et le
 * worker comme les rattrapages lisent la MÊME réponse — deux lectures finiraient par diverger, et
 * l'on mettrait en file des travaux que le worker refuse ensuite de prendre.
 */
export async function modeleDisponible(): Promise<{ ok: boolean; raison: string | null }> {
  if (!lunaConfigured()) return { ok: false, raison: "La clé du fournisseur de modèles n'est pas configurée." };
  if (await interrupteurIaCoupe()) return { ok: false, raison: REFUS_IA_COUPEE };
  return { ok: true, raison: null };
}
