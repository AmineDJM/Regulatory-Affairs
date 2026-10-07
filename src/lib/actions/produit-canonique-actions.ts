"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canAccessEntity } from "@/lib/entity-access";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { aliasKey } from "@/lib/products/identity";
import { addProductAlias } from "@/lib/products/resolve";
import { assurerProduitsDesDossiers, ensureProduitDuDossier, ligneDeBilan, type BilanProduitsDesDossiers } from "@/lib/products/canonique";
import { phraseProduitDuDossier } from "@/lib/products/produit-du-dossier";
import { clauseProduitsVisibles } from "@/lib/queries/produits-canoniques";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES GESTES DU CATALOGUE PRODUITS — UN catalogue (Direction, 08/10 : produit = dossier).
 *
 * Nommer un produit, lui donner un alias : chacun déclare QUEL produit est quoi, et relève donc du
 * réglementaire, qui tient le catalogue de référence (le même droit que le rapprochement des
 * produits BD / BU, `products/link.ts`). Vérifier TOUT le catalogue (chaque dossier a son produit)
 * est réservé au Super Admin : il touche tous les dossiers, y compris ceux qu'aucun autre rôle ne voit.
 *
 * Chaque geste relit le produit par la clause du catalogue (`clauseProduitsVisibles`) : on ne
 * renomme pas, par son identifiant, un produit dont on ne voit aucun dossier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

function revalider(produitId?: string | null) {
  revalidatePath("/produits");
  if (produitId) revalidatePath(`/produits/${produitId}`);
}

/** Le produit, s'il existe ET que la personne le voit. La même phrase pour les deux absences. */
async function produitVisible(user: Awaited<ReturnType<typeof requireUser>>, id: string) {
  return prisma.product.findFirst({
    where: { AND: [{ id }, await clauseProduitsVisibles(user)] },
    select: { id: true, code: true, canonicalName: true },
  });
}

/**
 * DONNE SON PRODUIT À UN DOSSIER — celui qu'on voit et qu'on peut modifier. Filet pour un dossier
 * d'avant ce lot dont le produit n'aurait pas encore été créé (le démarrage le fait aussi).
 */
export async function rattacherDossierCanonique(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée sur ce dossier." };
  }
  const r = await ensureProduitDuDossier(id, { acteurId: user.id });
  if (r.etat === "INTROUVABLE") return { ok: false, error: "Dossier introuvable." };
  if (r.etat === "VERROUILLE") return { ok: false, error: "Ce dossier est au pipeline (verrouillé) : il entrera au catalogue à l'ouverture du cadenas." };
  revalider(r.produitId);
  revalidatePath(`/regulatory/${id}`);
  return { ok: true, message: phraseProduitDuDossier(r) ?? `Produit ${r.code}.` };
}

/**
 * QUI VÉRIFIE TOUT LE CATALOGUE — le Super Admin, par son rôle PRINCIPAL : le geste touche tous les
 * dossiers, y compris ceux qu'aucun autre rôle ne voit, et son bilan les nomme. Nommé en prédicat
 * pour que la carte d'une action le DISE (§118.140 : une garde que la dérivation ne sait pas
 * nommer se lit « gardée par rien »).
 */
function peutVerifierToutLeCatalogue(user: { role: string }): boolean {
  return user.role === "SUPER_ADMIN";
}
const REFUS_GLOBAL = "Réservé au Super Admin : ce geste touche tous les dossiers, y compris ceux que vous ne voyez pas.";

/**
 * CHAQUE DOSSIER A SON PRODUIT — le même passage qu'au démarrage du serveur, à la demande.
 * Idempotent : rejoué, il ne fait que ce qui reste à faire, et rend le bilan (dont les produits
 * encore partagés par plusieurs dossiers, que rien ne scinde d'office).
 */
export async function verifierProduitsDesDossiers(): Promise<{ ok: true; bilan: BilanProduitsDesDossiers } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!peutVerifierToutLeCatalogue(user)) return { ok: false, error: REFUS_GLOBAL };
  const bilan = await assurerProduitsDesDossiers({ acteurId: user.id });
  console.info(ligneDeBilan(bilan));
  revalider();
  return { ok: true, bilan };
}

/** Le nom sous lequel l'entreprise connaît le produit. L'identité, elle, ne se renomme pas. */
export async function renommerProduitCanonique(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "UPDATE")) return { ok: false, error: "Seul le réglementaire nomme un produit du catalogue." };
  const id = fdStr(formData, "id");
  const nom = fdStr(formData, "canonicalName");
  if (!id) return { ok: false, error: "Produit introuvable." };
  if (!nom) return { ok: false, error: "Le nom ne peut pas être vide." };
  if (nom.length > 200) return { ok: false, error: "Nom trop long (200 caractères au plus)." };
  const p = await produitVisible(user, id);
  if (!p) return { ok: false, error: "Produit introuvable." };
  if (p.canonicalName === nom) return { ok: true };
  await prisma.product.update({ where: { id }, data: { canonicalName: nom } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "PRODUCT", entityId: id,
    field: "canonicalName", oldValue: p.canonicalName, newValue: nom,
    summary: `Produit ${p.code} renommé — « ${p.canonicalName} » → « ${nom} »`,
  });
  revalider(id);
  return { ok: true };
}

/**
 * UN ALIAS — « Keppra », le nom du marché PCH, une abréviation du terrain. C'est une décision
 * humaine : la résolution le place juste après la référence exacte. Un alias déjà porté par un
 * AUTRE produit est refusé, jamais volé — le voler ferait répondre sur le mauvais produit.
 */
export async function ajouterAliasProduitCanonique(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "UPDATE")) return { ok: false, error: "Seul le réglementaire donne un alias à un produit du catalogue." };
  const id = fdStr(formData, "id");
  const label = fdStr(formData, "label");
  if (!id) return { ok: false, error: "Produit introuvable." };
  if (!label || !aliasKey(label)) return { ok: false, error: "L'alias ne peut pas être vide." };
  if (label.length > 120) return { ok: false, error: "Alias trop long (120 caractères au plus)." };
  const p = await produitVisible(user, id);
  if (!p) return { ok: false, error: "Produit introuvable." };

  const ok = await addProductAlias(id, label, { source: "MANUAL", createdById: user.id });
  if (!ok) {
    const porteur = await prisma.productAlias.findUnique({ where: { key: aliasKey(label) }, select: { productId: true } });
    const autre = porteur ? await produitVisible(user, porteur.productId) : null;
    return {
      ok: false,
      error: autre
        ? `« ${label} » désigne déjà le produit ${autre.code} — ${autre.canonicalName}. Retirez-le là-bas d'abord.`
        : `« ${label} » désigne déjà un autre produit du catalogue.`,
    };
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "PRODUCT", entityId: id,
    summary: `Alias « ${label} » ajouté au produit ${p.code}`,
  });
  revalider(id);
  return { ok: true };
}

export async function retirerAliasProduitCanonique(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "UPDATE")) return { ok: false, error: "Seul le réglementaire retire un alias du catalogue." };
  const aliasId = fdStr(formData, "aliasId");
  if (!aliasId) return { ok: false, error: "Alias introuvable." };
  const alias = await prisma.productAlias.findUnique({ where: { id: aliasId }, select: { id: true, label: true, productId: true } });
  if (!alias) return { ok: false, error: "Alias introuvable." };
  const p = await produitVisible(user, alias.productId);
  if (!p) return { ok: false, error: "Alias introuvable." };
  await prisma.productAlias.delete({ where: { id: alias.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "PRODUCT", entityId: p.id,
    summary: `Alias « ${alias.label} » retiré du produit ${p.code}`,
  });
  revalider(p.id);
  return { ok: true };
}
