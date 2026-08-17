"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  linkProductToDossierFor, unlinkProductFromDossierFor, type CatalogKind,
} from "@/lib/products/link";
import type { ActionResult } from "@/lib/actions/types";

/**
 * RATTACHEMENT DES CATALOGUES — la porte de l'ÉCRAN.
 *
 * L'écriture vit dans `src/lib/products/link.ts`, partagée avec le registre d'opérations de
 * l'API des agents. Ici on ne fait que résoudre la session et rafraîchir l'écran.
 */

export async function linkProductToDossier(input: {
  kind: CatalogKind; id: string; regulatoryProductId: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const r = await linkProductToDossierFor(user, input);
  if (r.ok) revalidatePath("/regulatory/catalogue");
  return r;
}

/** Défaire un rattachement — un rapprochement faux doit se corriger aussi vite qu'il s'est fait. */
export async function unlinkProductFromDossier(input: { kind: CatalogKind; id: string }): Promise<ActionResult> {
  const user = await requireUser();
  const r = await unlinkProductFromDossierFor(user, input);
  if (r.ok) revalidatePath("/regulatory/catalogue");
  return r;
}
