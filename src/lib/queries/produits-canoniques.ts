import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { regulatoryVisibleWhere } from "@/lib/queries/regulatory-rows";
import { manquesIdentite, type TraitIdentite } from "@/lib/products/identity";
import { tupleDuDossier } from "@/lib/products/canonique";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE DES PRODUITS CANONIQUES — ce qu'une personne en voit (§118.178).
 *
 * ── UNE CLAUSE, TROIS LECTEURS ───────────────────────────────────────────────────────────
 *
 * La liste du catalogue, la fiche d'un produit et la porte par enregistrement
 * (`canAccessEntity("PRODUCT")`) lisent la MÊME clause (§118.177 : une liste, une clause). Deux
 * écritures de « qui voit ce produit ? » finiraient par répondre différemment, et c'est la plus
 * large qui fuirait.
 *
 * ── UN PRODUIT SE VOIT PAR SES DOSSIERS ──────────────────────────────────────────────────
 *
 * L'identité d'un produit (DCI, dosage, forme) dit exactement ce qu'un dossier verrouillé au
 * pipeline étudie : la montrer à qui ne voit pas ce dossier révélerait le projet. On voit donc
 * un produit quand on voit AU MOINS UN de ses dossiers, par la clause même de l'écran Regulatory
 * (`regulatoryVisibleWhere` : entité, portée par ligne, verrou, gamme). Le Super Admin voit tout,
 * y compris les produits SANS dossier — ce sont des orphelins à traiter, et lui seul les traite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function clauseProduitsVisibles(user: SessionUser): Promise<Prisma.ProductWhereInput> {
  if (user.role === "SUPER_ADMIN") return {};
  return { regulatoryProfiles: { some: await regulatoryVisibleWhere(user) } };
}

export interface DossierDuProduit { id: string; reference: string; status: string; brandName: string | null; companyName: string | null }

export interface LigneProduitCanonique {
  id: string;
  code: string;
  canonicalName: string;
  dci: string;
  lifecycle: string;
  isActive: boolean;
  /** Les dossiers que CETTE personne voit. */
  dossiers: DossierDuProduit[];
  /** Ceux qu'elle ne voit pas : comptés, jamais nommés. */
  dossiersMasques: number;
  produitsBu: { id: string; name: string; bu: string | null }[];
  aliases: string[];
}

export interface DossierSansProduit { id: string; reference: string; dci: string; manques: TraitIdentite[] }

export interface CatalogueCanonique {
  produits: LigneProduitCanonique[];
  /** Le total réel : la liste est bornée, et une coupe silencieuse se lirait comme une exhaustivité. */
  total: number;
  /** Dossiers visibles, à l'identité complète, pas encore rattachés — un clic les rattache. */
  rattachables: DossierSansProduit[];
  /** Dossiers visibles qu'on ne rattache pas seul — et ce qui manque. */
  incomplets: DossierSansProduit[];
  /** Produits de BU actifs sans produit canonique — et pourquoi. */
  produitsBuSansProduit: { id: string; name: string; raison: string }[];
}

const BORNE = 1000;

const SELECT_DOSSIER_VISIBLE = {
  id: true, reference: true, status: true, brandName: true,
  company: { select: { shortName: true, name: true } },
} as const;

function dossierDuProduit(d: { id: string; reference: string; status: string; brandName: string | null; company: { shortName: string | null; name: string } | null }): DossierDuProduit {
  return { id: d.id, reference: d.reference, status: d.status, brandName: d.brandName, companyName: d.company ? d.company.shortName ?? d.company.name : null };
}

export async function chargerCatalogueCanonique(user: SessionUser): Promise<CatalogueCanonique> {
  const [clause, dossiersVisibles] = await Promise.all([clauseProduitsVisibles(user), regulatoryVisibleWhere(user)]);

  const [produits, total, sansProduit, promoSansProduit] = await Promise.all([
    prisma.product.findMany({
      where: clause,
      orderBy: [{ canonicalName: "asc" }],
      take: BORNE,
      select: {
        id: true, code: true, canonicalName: true, dci: true, lifecycle: true, isActive: true,
        regulatoryProfiles: { where: dossiersVisibles, select: SELECT_DOSSIER_VISIBLE, orderBy: { reference: "asc" } },
        _count: { select: { regulatoryProfiles: true } },
        promoProfiles: { select: { id: true, name: true, businessUnit: { select: { name: true } } }, orderBy: { name: "asc" } },
        aliases: { select: { label: true }, orderBy: { label: "asc" } },
      },
    }),
    prisma.product.count({ where: clause }),
    prisma.regulatoryProduct.findMany({
      where: { AND: [dossiersVisibles, { productId: null }] },
      select: { id: true, reference: true, dci: true, dosage: true, dosageUnit: true, pharmaceuticalForm: true, packaging: true },
      orderBy: { reference: "asc" },
      take: 2000,
    }),
    prisma.promoProduct.findMany({
      where: { productId: null, isActive: true },
      select: {
        id: true, name: true,
        regulatoryProduct: { select: { id: true, reference: true, productId: true, dci: true, dosage: true, dosageUnit: true, pharmaceuticalForm: true, packaging: true } },
      },
      orderBy: { name: "asc" },
      take: 1000,
    }),
  ]);

  const rattachables: DossierSansProduit[] = [];
  const incomplets: DossierSansProduit[] = [];
  for (const d of sansProduit) {
    const manques = manquesIdentite(tupleDuDossier(d));
    (manques.length ? incomplets : rattachables).push({ id: d.id, reference: d.reference, dci: d.dci, manques });
  }

  // Le dossier d'un produit de BU n'est NOMMÉ que si la personne le voit : un produit de BU peut
  // porter un dossier passé depuis au pipeline, et la raison affichée ne doit pas le révéler.
  const idsVisibles = new Set((await prisma.regulatoryProduct.findMany({
    where: { AND: [dossiersVisibles, { id: { in: promoSansProduit.map((p) => p.regulatoryProduct?.id).filter((x): x is string => Boolean(x)) } }] },
    select: { id: true },
  })).map((d) => d.id));

  const produitsBuSansProduit = promoSansProduit.map((p) => {
    const d = p.regulatoryProduct;
    if (!d) return { id: p.id, name: p.name, raison: "Aucun dossier Regulatory rattaché : rattachez-le à son dossier dans la liste « À rapprocher »." };
    if (!idsVisibles.has(d.id)) return { id: p.id, name: p.name, raison: "Son dossier ne vous est pas visible." };
    const manques = manquesIdentite(tupleDuDossier(d));
    if (manques.length) return { id: p.id, name: p.name, raison: `Le dossier ${d.reference} est incomplet — complétez-le pour que le produit soit identifié.` };
    return { id: p.id, name: p.name, raison: `Le dossier ${d.reference} n'est pas encore rattaché à son produit — un clic le fait, ci-dessus.` };
  });

  return {
    produits: produits.map((p) => ({
      id: p.id, code: p.code, canonicalName: p.canonicalName, dci: p.dci, lifecycle: p.lifecycle, isActive: p.isActive,
      dossiers: p.regulatoryProfiles.map(dossierDuProduit),
      dossiersMasques: Math.max(0, p._count.regulatoryProfiles - p.regulatoryProfiles.length),
      produitsBu: p.promoProfiles.map((x) => ({ id: x.id, name: x.name, bu: x.businessUnit?.name ?? null })),
      aliases: p.aliases.map((a) => a.label),
    })),
    total,
    rattachables,
    incomplets,
    produitsBuSansProduit,
  };
}

export interface FicheProduitCanonique {
  id: string;
  code: string;
  canonicalName: string;
  identityKey: string;
  dci: string;
  dosage: string | null;
  dosageUnit: string | null;
  form: string | null;
  packaging: string | null;
  channel: string;
  lifecycle: string;
  isActive: boolean;
  dossiers: DossierDuProduit[];
  dossiersMasques: number;
  produitsBu: { id: string; name: string; bu: string | null; isActive: boolean }[];
  /** Les produits à l'étude du Business Development — seulement pour qui voit ses projets. */
  produitsBd: { id: string; dci: string; brandName: string | null; sourcing: string }[];
  produitsBdMasques: number;
  aliases: { id: string; label: string; source: string; auteur: string | null; createdAt: Date }[];
  historique: { id: string; summary: string | null; acteur: string | null; createdAt: Date }[];
}

/** La fiche d'UN produit — `null` quand il n'existe pas OU que la personne ne le voit pas. */
export async function chargerProduitCanonique(user: SessionUser, id: string): Promise<FicheProduitCanonique | null> {
  const [clause, dossiersVisibles] = await Promise.all([clauseProduitsVisibles(user), regulatoryVisibleWhere(user)]);
  const p = await prisma.product.findFirst({
    where: { AND: [{ id }, clause] },
    select: {
      id: true, code: true, canonicalName: true, identityKey: true, dci: true, dosage: true, dosageUnit: true,
      form: true, packaging: true, channel: true, lifecycle: true, isActive: true,
      regulatoryProfiles: { where: dossiersVisibles, select: SELECT_DOSSIER_VISIBLE, orderBy: { reference: "asc" } },
      _count: { select: { regulatoryProfiles: true } },
      promoProfiles: { select: { id: true, name: true, isActive: true, businessUnit: { select: { name: true } } }, orderBy: { name: "asc" } },
      bdProfiles: { select: { id: true, dci: true, brandName: true, sourcing: true }, orderBy: { dci: "asc" } },
      aliases: { select: { id: true, label: true, source: true, createdAt: true, createdBy: { select: { name: true } } }, orderBy: { label: "asc" } },
    },
  });
  if (!p) return null;

  const historique = await prisma.auditLog.findMany({
    where: { entityType: "PRODUCT", entityId: p.id },
    select: { id: true, summary: true, createdAt: true, actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Un produit À L'ÉTUDE se lit dans le registre des projets BD : qui n'y a pas accès sait qu'il
  // en existe, pas lesquels.
  const peutVoirBd = userCan(user, "BD_PROJECTS", "VIEW");

  return {
    id: p.id, code: p.code, canonicalName: p.canonicalName, identityKey: p.identityKey, dci: p.dci,
    dosage: p.dosage, dosageUnit: p.dosageUnit, form: p.form, packaging: p.packaging,
    channel: String(p.channel), lifecycle: p.lifecycle, isActive: p.isActive,
    dossiers: p.regulatoryProfiles.map(dossierDuProduit),
    dossiersMasques: Math.max(0, p._count.regulatoryProfiles - p.regulatoryProfiles.length),
    produitsBu: p.promoProfiles.map((x) => ({ id: x.id, name: x.name, bu: x.businessUnit?.name ?? null, isActive: x.isActive })),
    produitsBd: peutVoirBd ? p.bdProfiles.map((x) => ({ id: x.id, dci: x.dci, brandName: x.brandName, sourcing: String(x.sourcing) })) : [],
    produitsBdMasques: peutVoirBd ? 0 : p.bdProfiles.length,
    aliases: p.aliases.map((a) => ({ id: a.id, label: a.label, source: a.source, auteur: a.createdBy?.name ?? null, createdAt: a.createdAt })),
    historique: historique.map((h) => ({ id: h.id, summary: h.summary, acteur: h.actor?.name ?? null, createdAt: h.createdAt })),
  };
}
