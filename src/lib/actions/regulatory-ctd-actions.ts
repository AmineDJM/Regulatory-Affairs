"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { CTD_INITIALE_LIBELLE } from "@/lib/regulatory/ctd-initiale";
import { PHRASE_AUCUNE_CTD, mettreLaCtdALaCorbeille, peutGererLaCtd, renommerUnDossierDeLaCtd } from "@/lib/regulatory/ctd-initiale-corbeille";

/**
 * LA CTD INITIALE D'UN DOSSIER — la retirer, la remplacer, renommer un de ses dossiers (§118.213).
 *
 * LA PORTE EST CELLE DU DÉPÔT DE DOCUMENTS DU DOSSIER, ET ELLE N'EST JAMAIS PLUS LARGE (`peutGererLaCtd`,
 * lue aussi par l'écran) : téléverser sur CE dossier — portée de ligne, gamme, verrou confidentiel —
 * ET le modifier ou y supprimer. Qui peut seulement déposer ajoute des fichiers, il ne retire pas.
 *
 * Le retrait est RÉVERSIBLE (corbeille, restaurable par le Super Admin) et se dit : le nombre de
 * fichiers retirés est celui lu AU MOMENT de retirer, pas celui que l'écran montrait.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Combien de fichiers ont été retirés / touchés — lu à l'écriture. */
  fichiers?: number;
  message?: string;
}

const REFUS = `Vous ne pouvez pas modifier la ${CTD_INITIALE_LIBELLE} de ce dossier (téléverser ET modifier le dossier sont requis).`;

/**
 * SUPPRIME la CTD initiale (réversible : corbeille). Rien à supprimer = une phrase qui le dit.
 *
 * Le corps est écrit ICI, pas dans un délégué local partagé avec `remplacerCtdInitiale` : la dérivation des
 * contrats ne suit pas un délégué local pour ce que l'action ÉCRIT ni pour sa garde, et la carte de
 * confirmation aurait annoncé « aucune écriture en base » sur un geste qui met une soumission à la corbeille (§118.137).
 */
export async function supprimerCtdInitiale(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { ok: false, error: "Dossier manquant." };
  if (!(await peutGererLaCtd(user, productId))) return { ok: false, error: REFUS };
  const r = await mettreLaCtdALaCorbeille(productId, user.id, "SUPPRIMEE");
  if (!r.ok) return r;
  revalidatePath(`/regulatory/${productId}`);
  return {
    ok: true, fichiers: r.fichiers,
    message: `${r.fichiers} fichier${r.fichiers > 1 ? "s" : ""} de la ${CTD_INITIALE_LIBELLE} mis à la corbeille (restaurables par le Super Admin).`,
  };
}

/**
 * REMPLACE la CTD initiale : l'ensemble précédent part d'un bloc à la corbeille, et la nouvelle se
 * dépose ensuite depuis l'écran. Sans CTD à remplacer, c'est un simple premier dépôt : le geste réussit
 * sans rien retirer — l'écran n'a pas à deviner s'il doit passer par « ajouter » ou « remplacer ».
 */
export async function remplacerCtdInitiale(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { ok: false, error: "Dossier manquant." };
  if (!(await peutGererLaCtd(user, productId))) return { ok: false, error: REFUS };
  const r = await mettreLaCtdALaCorbeille(productId, user.id, "REMPLACEE");
  if (!r.ok) {
    // « Rien à retirer » n'est pas un échec d'un remplacement : c'est un premier dépôt.
    if (r.error === PHRASE_AUCUNE_CTD) return { ok: true, fichiers: 0, message: "Aucune CTD à retirer : la nouvelle sera la première." };
    return r;
  }
  revalidatePath(`/regulatory/${productId}`);
  return {
    ok: true, fichiers: r.fichiers,
    message: `${r.fichiers} fichier${r.fichiers > 1 ? "s" : ""} de la ${CTD_INITIALE_LIBELLE} précédente mis à la corbeille (restaurables par le Super Admin).`,
  };
}

/** RENOMME un dossier de la CTD (un segment) : ses fichiers et ses sous-dossiers suivent. */
export async function renommerDossierCtd(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = String(formData.get("productId") ?? "");
  const dossier = String(formData.get("dossier") ?? "");
  const nouveauNom = String(formData.get("nouveauNom") ?? "");
  if (!productId || !dossier) return { ok: false, error: "Dossier manquant." };
  if (!(await peutGererLaCtd(user, productId))) return { ok: false, error: REFUS };
  const r = await renommerUnDossierDeLaCtd(productId, dossier, nouveauNom, user.id);
  if (!r.ok) return r;
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true, fichiers: r.fichiers, message: r.fichiers === 0 ? "Rien à renommer." : `Dossier renommé « ${r.nouveau} » (${r.fichiers} fichier${r.fichiers > 1 ? "s" : ""}).` };
}
