"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { addLink, removeLink, linkRevalidatePaths } from "@/lib/links/store";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * « RELIER À… » — la porte de l'écran, pour TOUTES les natures.
 *
 * Le geste est le même partout : un contrat né d'un marché, un bon qui exécute ce contrat, une
 * facture qui couvre un ou plusieurs bons, une assurance rattachée à son contrat, un courrier qui
 * parle de n'importe lequel d'entre eux. Une action par écran aurait multiplié les contrôles à
 * tenir à jour — et le jour où l'on en oublie un, le lien s'écrit sans droits.
 *
 * Toute la décision est dans `lib/links/` : `graph.ts` pour le flux (pur, testé), `store.ts` pour
 * les droits et l'écriture. Ici on lit le formulaire, on résout la session, on rafraîchit.
 */

export async function addEntityLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const fromType = fdStr(formData, "fromType");
  const fromId = fdStr(formData, "fromId");
  const toType = fdStr(formData, "toType");
  const toId = fdStr(formData, "toId");
  if (!fromType || !fromId || !toType || !toId) return { ok: false, error: "Les deux objets à relier sont requis." };

  const r = await addLink(user, { type: fromType, id: fromId }, { type: toType, id: toId });
  if (!r.ok) return r;
  for (const p of linkRevalidatePaths(r.ends)) revalidatePath(p);
  return { ok: true, id: r.id };
}

export async function removeEntityLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant du lien manquant." };

  const r = await removeLink(user, id);
  if (!r.ok) return r;
  // Les deux bouts viennent de la LIGNE relue avant suppression, jamais du formulaire : sinon la
  // fiche d'en face garderait la pastille disparue jusqu'au prochain passage.
  for (const p of linkRevalidatePaths(r.ends)) revalidatePath(p);
  return { ok: true };
}
