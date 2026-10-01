"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { hasGlobalView, type SessionUser } from "@/lib/rbac";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { parseQuantity } from "@/lib/promo/stock";
import { demandeLesDevis } from "@/lib/promo-material/circuit";
import { libelleArticleDemande, validerArticleDemande, type FamillePromo } from "@/lib/promo-material/achats";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DEMANDE D'ACHAT OU DE LOCATION — des articles piochés dans le catalogue (§118.165).
 *
 * « Le demandeur pioche dans le catalogue : par article, le ou les produits liés et des
 * commentaires, autant d'articles qu'il veut sur les trois familles — pour que l'assistante de
 * direction sache clairement quels devis chercher. »
 *
 * QUI : le demandeur, la Direction en suppléance — la règle de `demandeLesDevis`, la même que
 * celle qui demande ensuite les devis (§118.5). QUAND : tant que les devis ne sont pas demandés
 * (validation de la demande, puis « devis à demander »). Après, la liste est ce que l'assistante
 * fait chiffrer ; la retoucher pendant qu'elle cherche les devis la ferait chiffrer autre chose
 * que ce qui est demandé, sans qu'elle le sache.
 *
 * Aucun de ces gestes n'est offert à Adam (EXCLUDED, raison écrite au registre des actions) :
 * Adam est en pause de développement, et la demande se compose en piochant dans le catalogue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PATH = "/promo-material";
const chemin = (id: string) => `${PATH}/${id}`;

/** Les étapes où la liste des articles se compose encore. */
const ETATS_COMPOSABLES = new Set(["REVIEW_REQUEST", "QUOTE_TO_REQUEST"]);

type Dossier = { id: string; reference: string; title: string; circuitVersion: number; circuitState: string | null; requesterId: string | null };

async function chargerDossier(id: string | null): Promise<Dossier | null> {
  if (!id) return null;
  return prisma.promoMaterial.findUnique({
    where: { id },
    select: { id: true, reference: true, title: true, circuitVersion: true, circuitState: true, requesterId: true },
  });
}

const acteur = (user: SessionUser) => ({ id: user.id, role: user.role, secondaryRole: user.secondaryRole, vueGlobale: hasGlobalView(user.role) });

/** Le refus commun ; `null` = la liste peut changer. */
function refusComposition(user: SessionUser, pm: Dossier | null): string | null {
  if (!pm) return "Dossier introuvable.";
  if (pm.circuitVersion !== 2) return "Ce dossier suit l'ancien circuit : sa demande ne se compose pas depuis le catalogue.";
  if (!demandeLesDevis(acteur(user), pm)) return "Seul le demandeur (ou la Direction) compose la liste des articles de ce dossier.";
  if (!ETATS_COMPOSABLES.has(pm.circuitState ?? "")) {
    return "Les devis sont déjà demandés : la liste des articles ne se modifie plus — l'assistante fait chiffrer ce qui a été demandé. Si un article change, dites-le sur la discussion du dossier.";
  }
  return null;
}

async function audit(user: SessionUser, id: string, summary: string) {
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Matériel promotionnel", entityType: "PROMO_MATERIAL", entityId: id, summary });
}

/**
 * AJOUTER OU CORRIGER UN ARTICLE DEMANDÉ — l'article du catalogue, ses produits, la quantité
 * souhaitée, les actions attendues du fournisseur, un commentaire.
 *
 * Les PRODUITS sont remplacés en bloc, dans la même transaction : un article corrigé à moitié
 * porterait des produits que personne n'a choisis.
 */
export async function enregistrerArticleDemandePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusComposition(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };

  const requestItemId = fdStr(formData, "requestItemId");
  const existant = requestItemId
    ? await prisma.promoRequestItem.findFirst({ where: { id: requestItemId, promoMaterialId: pm.id }, select: { id: true } })
    : null;
  if (requestItemId && !existant) return { ok: false, error: "Cet article n'appartient pas à ce dossier." };

  const catalogueId = fdStr(formData, "catalogueId");
  const catalogue = catalogueId
    ? await prisma.promoCatalogueArticle.findUnique({
        where: { id: catalogueId },
        select: { id: true, reference: true, nom: true, famille: true, unite: true, exigeProduit: true, actif: true },
      })
    : null;
  const produitIds = formData.getAll("produitIds").map(String).filter(Boolean);
  const brutQuantite = fdStr(formData, "quantite");
  const quantite = brutQuantite ? parseQuantity(brutQuantite) : null;
  const v = validerArticleDemande({
    catalogue: catalogue ? { ...catalogue, famille: catalogue.famille as FamillePromo } : null,
    produitIds,
    quantite,
    quantiteIllisible: Boolean(brutQuantite) && quantite == null,
    actions: formData.getAll("actions").map(String).filter(Boolean),
    commentaire: fdStr(formData, "commentaire"),
  });
  if (!v.ok) return { ok: false, error: v.error };
  if (v.article.produitIds.length) {
    const trouves = await prisma.product.count({ where: { id: { in: v.article.produitIds } } });
    if (trouves !== v.article.produitIds.length) return { ok: false, error: "Un des produits choisis est introuvable." };
  }

  const donnees = {
    catalogueId: catalogue!.id,
    quantite: v.article.quantite != null ? new Prisma.Decimal(v.article.quantite) : null,
    actions: v.article.actions,
    commentaire: v.article.commentaire,
    updatedById: user.id,
  };
  const produits = v.article.produitIds.map((productId) => ({ productId }));
  const article = await prisma.$transaction(async (tx) => {
    if (existant) {
      await tx.promoRequestItemProduct.deleteMany({ where: { itemId: existant.id } });
      return tx.promoRequestItem.update({ where: { id: existant.id }, data: { ...donnees, produits: { create: produits } }, select: { id: true } });
    }
    const rang = await tx.promoRequestItem.count({ where: { promoMaterialId: pm.id } });
    return tx.promoRequestItem.create({
      data: { ...donnees, promoMaterialId: pm.id, position: rang, createdById: user.id, produits: { create: produits } },
      select: { id: true },
    });
  });

  const nomsProduits = v.article.produitIds.length
    ? (await prisma.product.findMany({ where: { id: { in: v.article.produitIds } }, select: { id: true, canonicalName: true } })).map((p) => ({ id: p.id, nom: p.canonicalName }))
    : [];
  const libelle = libelleArticleDemande({ reference: catalogue!.reference, nom: catalogue!.nom, produits: nomsProduits, quantite: v.article.quantite, unite: catalogue!.unite });
  await audit(user, pm.id, `Article demandé ${existant ? "corrigé" : "ajouté"} — ${libelle}`);
  revalidatePath(chemin(pm.id));
  return { ok: true, id: article.id, message: `${existant ? "Article corrigé" : "Article ajouté à la demande"} : ${libelle}.` };
}

/** RETIRER UN ARTICLE DEMANDÉ — tant que les devis ne sont pas demandés. */
export async function retirerArticleDemandePromo(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const pm = await chargerDossier(fdStr(formData, "promoMaterialId"));
  const refus = refusComposition(user, pm);
  if (refus || !pm) return { ok: false, error: refus ?? "Dossier introuvable." };
  const requestItemId = fdStr(formData, "requestItemId");
  const article = requestItemId
    ? await prisma.promoRequestItem.findFirst({
        where: { id: requestItemId, promoMaterialId: pm.id },
        select: { id: true, catalogue: { select: { reference: true, nom: true } } },
      })
    : null;
  if (!article) return { ok: false, error: "Cet article n'appartient pas à ce dossier." };
  await prisma.promoRequestItem.delete({ where: { id: article.id } });
  await audit(user, pm.id, `Article demandé retiré — ${article.catalogue.reference} ${article.catalogue.nom}`);
  revalidatePath(chemin(pm.id));
  return { ok: true, message: `${article.catalogue.reference} ${article.catalogue.nom} retiré de la demande.` };
}
