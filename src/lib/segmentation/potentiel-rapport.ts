/**
 * LE POTENTIEL SAISI DANS LE RAPPORT DE VISITE (cahier des charges §18, §36-37, §77) — une seule saisie qui alimente
 * l'historique du praticien, sa segmentation, l'avancement du cycle et le cockpit. Facultatif : un rapport sans
 * potentiel reste un rapport. Le praticien, l'établissement, la BU et le territoire ne sont jamais redemandés — la
 * visite les connaît.
 *
 * Module PUR — testé sans base.
 */

export type PotentielLu =
  | { ok: true; valeur: null }
  | { ok: true; valeur: { potentiel: number | null; sur10: number | null; productId: string | null } }
  | { ok: false; error: string };

const nombre = (v: FormDataEntryValue | null): number | null | "illisible" => {
  const s = typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "illisible";
};

export function lirePotentielDuRapport(fd: FormData): PotentielLu {
  const potentiel = nombre(fd.get("potentielPatients"));
  const sur10 = nombre(fd.get("potentielSur10"));
  if (potentiel === "illisible" || sur10 === "illisible") return { ok: false, error: "Potentiel : une valeur numérique positive est attendue." };
  if (sur10 !== null && sur10 > 10) return { ok: false, error: "Potentiel : « sur 10 patients » s'écrit entre 0 et 10." };
  if (potentiel === null && sur10 === null) return { ok: true, valeur: null };
  const p = fd.get("potentielProduitId");
  return { ok: true, valeur: { potentiel, sur10, productId: typeof p === "string" && p.trim() ? p.trim() : null } };
}
