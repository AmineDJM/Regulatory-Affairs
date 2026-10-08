import { busPch, fraicheurPch } from "@/lib/ventes-pch/requetes";
import { decalerMois, periodeDe, periodePrecedente, typePeriode } from "@/lib/ventes-pch/calculs";

/** Les paramètres d'adresse communs aux écrans de « Ventes PCH » : BU, type de période, mois de référence. */
export interface ParamsVentesPch { bu?: string; p?: string; m?: string; dr?: string; etab?: string; produit?: string }

/**
 * LE CONTEXTE D'UN ÉCRAN : la BU choisie (puce), la période (mois / trimestre / année / 12 mois) qui contient le mois de
 * référence — par défaut le DERNIER mois reçu, pas le mois civil en cours (les fichiers arrivent après coup) — et la
 * période précédente de même longueur.
 */
export async function contexteVentesPch(sp: ParamsVentesPch) {
  const [fraicheur, bus] = await Promise.all([fraicheurPch(), busPch()]);
  const now = new Date();
  const courant = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const defaut = fraicheur.dernierMois ?? courant;
  const ref = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : defaut;
  const type = typePeriode(sp.p);
  const periode = periodeDe(type, ref);
  const precedente = periodePrecedente(periode);
  const buId = sp.bu && bus.some((b) => b.id === sp.bu) ? sp.bu : null;
  const fin = [defaut, ref].sort().at(-1)!;
  const moisDisponibles = Array.from({ length: 36 }, (_, i) => decalerMois(fin, -i));
  return { fraicheur, bus, buId, type, ref, periode, precedente, moisDisponibles };
}
