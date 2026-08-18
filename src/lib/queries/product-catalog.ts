import { prisma } from "@/lib/prisma";
import { scopeRegulatory, type SessionUser } from "@/lib/rbac";
import { currentCompanyWhereFor } from "@/lib/company";
import { bestMatches, isConfident, type MatchProposal } from "@/lib/products/catalog-match";

/**
 * L'ÉTAT DU RAPPROCHEMENT DES CATALOGUES.
 *
 * Trois modules tiennent leur liste de produits, et rien ne dit qu'ils parlent des mêmes. Cette
 * requête met la question à plat : ce qui est déjà rattaché au dossier réglementaire, ce qui ne
 * l'est pas, et — pour chaque produit orphelin — les dossiers qui LUI RESSEMBLENT, avec le motif.
 *
 * Elle ne rattache rien. Le classement est fait par un module pur et testé ; la décision revient à
 * quelqu'un qui sait qu'un 500 mg et un 1 g sont deux produits.
 */

export interface DossierOption {
  id: string;
  reference: string | null;
  dci: string;
  brandName: string | null;
  dosage: string | null;
  form: string | null;
  /** Ce qu'on lit dans une liste : « AMOXICILLINE 500 mg — Comprimé (REG-2026-014) ». */
  label: string;
}

export interface OrphanProduct {
  /** De quel catalogue vient ce produit — c'est ce qui dit à quelle table écrire. */
  kind: "BD" | "PROMO";
  id: string;
  label: string;
  detail: string;
  proposals: { dossier: DossierOption; score: number; reason: string; confident: boolean }[];
}

export interface CatalogReconciliation {
  dossiers: DossierOption[];
  orphans: OrphanProduct[];
  linked: { kind: "BD" | "PROMO"; id: string; label: string; dossier: DossierOption }[];
}

const dossierLabel = (d: { reference: string | null; dci: string; dosage: string | null; form: string | null }) =>
  [d.dci, d.dosage, d.form && `— ${d.form}`, d.reference && `(${d.reference})`].filter(Boolean).join(" ");

/** Les propositions d'un produit orphelin, mises en forme pour l'écran. */
function proposalsFor(
  target: { dci: string | null; dosage?: string | null; form?: string | null },
  dossiers: DossierOption[],
): OrphanProduct["proposals"] {
  return bestMatches(target, dossiers, 4).map((m: MatchProposal<DossierOption>) => ({
    dossier: m.candidate,
    score: m.score,
    reason: m.reason,
    confident: isConfident(m.score),
  }));
}

export async function getCatalogReconciliation(user: SessionUser): Promise<CatalogReconciliation> {
  const [products, bd, promo] = await Promise.all([
    // La portée réglementaire s'applique : on ne propose pas de rattacher à un dossier qu'on
    // n'aurait pas le droit de voir.
    prisma.regulatoryProduct.findMany({
      where: { ...scopeRegulatory(user), ...await currentCompanyWhereFor(user.id) },
      select: { id: true, reference: true, dci: true, brandName: true, dosage: true, pharmaceuticalForm: true },
      orderBy: [{ dci: "asc" }, { dosage: "asc" }],
      take: 2000,
    }),
    prisma.bdProduct.findMany({
      select: { id: true, dci: true, brandName: true, dosage: true, form: true, regulatoryProductId: true },
      orderBy: { dci: "asc" }, take: 1000,
    }),
    prisma.promoProduct.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, regulatoryProductId: true },
      orderBy: { name: "asc" }, take: 1000,
    }),
  ]);

  const dossiers: DossierOption[] = products.map((p) => ({
    id: p.id, reference: p.reference, dci: p.dci, brandName: p.brandName,
    dosage: p.dosage, form: p.pharmaceuticalForm,
    label: dossierLabel({ reference: p.reference, dci: p.dci, dosage: p.dosage, form: p.pharmaceuticalForm }),
  }));
  const byId = new Map(dossiers.map((d) => [d.id, d]));

  const orphans: OrphanProduct[] = [];
  const linked: CatalogReconciliation["linked"] = [];

  for (const p of bd) {
    const label = [p.dci, p.dosage, p.form].filter(Boolean).join(" ");
    if (p.regulatoryProductId && byId.has(p.regulatoryProductId)) {
      linked.push({ kind: "BD", id: p.id, label, dossier: byId.get(p.regulatoryProductId)! });
      continue;
    }
    orphans.push({
      kind: "BD", id: p.id, label,
      detail: p.brandName ? `Nom commercial : ${p.brandName}` : "Business Development — produit à l'étude",
      proposals: proposalsFor({ dci: p.dci, dosage: p.dosage, form: p.form }, dossiers),
    });
  }

  for (const p of promo) {
    if (p.regulatoryProductId && byId.has(p.regulatoryProductId)) {
      linked.push({ kind: "PROMO", id: p.id, label: p.name, dossier: byId.get(p.regulatoryProductId)! });
      continue;
    }
    orphans.push({
      kind: "PROMO", id: p.id, label: p.name,
      detail: p.code ? `Code : ${p.code}` : "Planning promotionnel — produit promu",
      // Le planning ne tient qu'un NOM : dosage et forme sont à extraire du libellé, ce que le
      // module de rapprochement sait faire.
      proposals: proposalsFor({ dci: p.name }, dossiers),
    });
  }

  // Ce qui a une proposition SÛRE d'abord : c'est là qu'un clic suffit.
  orphans.sort((a, b) => Number(b.proposals[0]?.confident ?? false) - Number(a.proposals[0]?.confident ?? false)
    || (b.proposals[0]?.score ?? 0) - (a.proposals[0]?.score ?? 0));

  return { dossiers, orphans, linked };
}
