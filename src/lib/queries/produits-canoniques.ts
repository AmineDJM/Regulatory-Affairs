import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { regulatoryVisibleWhere } from "@/lib/queries/regulatory-rows";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PRODUIT — ce qu'une personne en voit (§118.178 ; produit = dossier, Direction 08/10).
 *
 * ── UNE CLAUSE, PLUSIEURS LECTEURS ───────────────────────────────────────────────────────
 *
 * Les gestes du catalogue, la fiche d'un produit et la porte par enregistrement
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

const SELECT_DOSSIER_VISIBLE = {
  id: true, reference: true, status: true, brandName: true,
  company: { select: { shortName: true, name: true } },
} as const;

function dossierDuProduit(d: { id: string; reference: string; status: string; brandName: string | null; company: { shortName: string | null; name: string } | null }): DossierDuProduit {
  return { id: d.id, reference: d.reference, status: d.status, brandName: d.brandName, companyName: d.company ? d.company.shortName ?? d.company.name : null };
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
