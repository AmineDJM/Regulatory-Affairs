"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { addLink, removeLink, linkRevalidatePaths } from "@/lib/links/store";
import { linkCandidates, type LinkCandidateGroup } from "@/lib/queries/link-candidates";
import { isLinkType } from "@/lib/links/graph";
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

/**
 * CE À QUOI ON PEUT RELIER, CHARGÉ À L'OUVERTURE DU TIROIR.
 *
 * Ces listes remplissent un menu déroulant : jusqu'à cinq requêtes de deux cents lignes, payées
 * par CHAQUE affichage de fiche — alors que la plupart des visites n'ouvrent jamais « Relier
 * à… ». La fiche d'un courrier mettait une seconde de plus à s'ouvrir pour un tiroir qu'on
 * n'ouvre pas. On les charge donc au clic, comme l'annuaire des demandes de pièce.
 *
 * Ce n'est PAS un contrôle d'accès : les listes sont cloisonnées par entité, et l'écriture
 * revérifie les deux bouts (`links/store.ts`). C'est une commodité de saisie, rien de plus.
 */
export async function linkCandidatesFor(type: string, id: string): Promise<LinkCandidateGroup[]> {
  const user = await requireUser();
  if (!isLinkType(type) || !id) return [];
  return linkCandidates(user.id, { type, id });
}
