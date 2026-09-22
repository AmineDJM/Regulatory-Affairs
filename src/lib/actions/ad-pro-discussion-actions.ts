"use server";

import type { EntityType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canAccessEntity } from "@/lib/entity-access";
import { entityHref } from "@/lib/entity-href";
import { AD_PRO_ENTITY_TYPE } from "@/lib/ad-pro/unified";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SECTION DISCUSSION D'UNE DEMANDE Ad & Pro — UN écrivain pour les SEPT natures.
 *
 * « Toutes ces demandes peuvent se faire sur les postes mais aussi dans une section discussion
 * en bas de toutes les demandes Ad&Pro […] c'est une section discussion. »
 *
 * ── CE QUI N'EST PAS RÉÉCRIT, ET POURQUOI ───────────────────────────────────────────────
 *
 * Le modèle `Comment` est CANONIQUE et le composant `CommentThread` tourne déjà sur cinq écrans
 * du dépôt — dont `/promo-material/[id]`, une des sept natures du pôle. Les six autres n'avaient
 * pas de fil : une porte gardée à côté de six portes fermées (§118.71). Un second modèle aurait
 * fait DEUX vérités sur ce qu'est un échange attaché à un dossier, et c'est celle du pôle qui
 * aurait pris du retard (§118.5). D'où : le modèle canonique, un seul écrivain, sept écrans.
 *
 * ── LA PORTE EST PAR ENREGISTREMENT, JAMAIS PAR MODULE ──────────────────────────────────
 *
 * `addPromoComment`, l'écrivain d'à côté, garde sur `userCan(user, "PROMO_MATERIAL", "VIEW")`.
 * C'est trop large ici : une demande Ad & Pro est souvent confidentielle à son cercle, et un
 * droit de MODULE ouvrirait le fil de la demande d'un autre service (§118.109). `canAccessEntity`
 * répond par ENREGISTREMENT — c'est la même porte que la fiche elle-même, donc quelqu'un qui ne
 * peut pas lire la demande ne peut pas lire ni écrire son fil.
 *
 * ── LA MODÉRATION N'EST PAS ICI, ET C'EST LA MOITIÉ QUI COMPTE ──────────────────────────
 *
 * Éditer et supprimer le message d'un autre EXISTENT déjà, canoniquement
 * (`actions/comment-actions.ts`) : elles lisent l'entité DANS LA LIGNE du commentaire — donc la
 * bonne source, pas le formulaire — gardent sur `canModerateEntity` (par enregistrement),
 * auditent, et revalident le chemin que le composant leur donne. `/promo-material` les emploie.
 *
 * Deux jumelles avaient été écrites ici avant de mesurer, et elles étaient FAUSSES : le composant
 * envoie `id` et `path` sur le chemin de modération, pas `commentId` ni l'entité — elles auraient
 * refusé « Message non précisé » à chaque geste, en silence et pour toujours (§118.127a). Le
 * remède n'est pas de corriger les noms de champs : c'est de ne pas écrire la seconde vérité
 * (§118.5). Seul l'ÉCRIVAIN manquait, parce que lui seul doit borner l'entité au pôle.
 *
 * ── UNE NATURE INCONNUE EST REFUSÉE, PAS DEVINÉE ────────────────────────────────────────
 *
 * L'entité arrive du formulaire, donc du navigateur : on ne l'accepte que si elle figure dans le
 * registre CANONIQUE des natures du pôle (`AD_PRO_ENTITY_TYPE`). Sans ce filtre, cette action
 * deviendrait un écrivain de commentaires GÉNÉRIQUE sur n'importe quelle entité de l'ERP, gardé
 * par une porte pensée pour Ad & Pro — exactement la porte dérobée que §118.7 ferme.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const ENTITES_AD_PRO: ReadonlySet<string> = new Set(Object.values(AD_PRO_ENTITY_TYPE));

/** L'entité visée est-elle bien une demande du pôle ? Sinon on refuse, on ne devine pas. */
function entiteDuPole(brut: string | null): EntityType | null {
  return brut && ENTITES_AD_PRO.has(brut) ? (brut as EntityType) : null;
}

/** Le chemin à revalider — celui que l'ERP donne déjà à cette entité, jamais un second. */
function chemin(entite: EntityType, id: string): string | null {
  return entityHref(entite, id);
}

export async function addAdProComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entite = entiteDuPole(fdStr(formData, "entityType"));
  const id = fdStr(formData, "entityId");
  const body = fdStr(formData, "body");
  if (!entite || !id) return { ok: false, error: "Demande Ad & Pro non précisée." };
  if (!body) return { ok: false, error: "Le message est vide." };
  // LA MÊME PORTE QUE LA FICHE : écrire dans le fil d'une demande qu'on ne peut pas lire serait
  // une porte à côté de la porte gardée.
  if (!(await canAccessEntity(user, entite, id, "VIEW"))) {
    return { ok: false, error: "Cette demande ne vous est pas ouverte." };
  }
  await prisma.comment.create({ data: { entityType: entite, entityId: id, body, authorId: user.id } });
  const path = chemin(entite, id);
  if (path) revalidatePath(path);
  return { ok: true };
}
