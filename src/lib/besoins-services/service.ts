import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasGlobalView, hasRole, userCan, type SessionUser } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { anneeDuBesoin, peutEcrireBesoin, type BesoinLigne, type BesoinLu } from "./regles";

/**
 * LES BESOINS ANNUELS DES SERVICES — le côté BASE (la règle est dans `regles.ts`).
 *
 *   • `besoinsAEcrire` : ce que le rapport de visite propose au KAM quand le praticien visité est DÉCIDEUR d'une
 *     stratégie active de sa BU — les produits classés, et ce qui est déjà saisi pour l'an prochain ;
 *   • `ecrireBesoins` : l'écriture, dans la transaction du rapport (une ligne par produit × service × an, remplacée) ;
 *   • `chargerBesoins` : les lignes d'un périmètre, pour le cockpit marketing.
 */

export interface BesoinAEcrire {
  annee: number;
  /** « Infectiologie · EHS El Kettar » — le service, sinon l'établissement. */
  lieu: string;
  produits: { productId: string; nom: string; actuel: number | null }[];
}

/** Les décideurs de la tournée et ce qu'on peut leur demander — une lecture pour toutes les lignes. */
export async function besoinsAEcrire(doctorIds: readonly string[], businessUnitId: string | null, maintenant: Date = new Date()): Promise<Map<string, BesoinAEcrire>> {
  const out = new Map<string, BesoinAEcrire>();
  if (!businessUnitId || doctorIds.length === 0) return out;
  const fiches = await prisma.segmentationFiche.findMany({
    where: { doctorId: { in: [...new Set(doctorIds)] }, retireeLe: null, statut: "DECIDEUR", strategie: { statut: "ACTIVE", businessUnitId } },
    select: {
      doctorId: true,
      doctor: { select: { institutionId: true, serviceId: true, institutionRef: { select: { name: true } }, serviceRef: { select: { name: true } } } },
      strategie: { select: { produits: { where: { jusqua: null }, orderBy: { rang: "asc" }, select: { productId: true, product: { select: { canonicalName: true } } } } } },
    },
  });
  const avecLieu = fiches.filter((f) => f.doctor.institutionId);
  if (avecLieu.length === 0) return out;
  const annee = anneeDuBesoin(maintenant);
  const existants = await prisma.besoinAnnuelService.findMany({
    where: { annee, institutionId: { in: [...new Set(avecLieu.map((f) => f.doctor.institutionId!))] } },
    select: { productId: true, institutionId: true, serviceId: true, quantite: true },
  });
  for (const f of avecLieu) {
    if (out.has(f.doctorId)) continue;
    const d = f.doctor;
    const produits = f.strategie.produits.map((p) => ({
      productId: p.productId, nom: p.product.canonicalName,
      actuel: existants.find((e) => e.productId === p.productId && e.institutionId === d.institutionId && e.serviceId === (d.serviceId ?? null))?.quantite ?? null,
    }));
    if (produits.length === 0) continue;
    out.set(f.doctorId, { annee, lieu: [d.serviceRef?.name, d.institutionRef?.name].filter(Boolean).join(" · ") || "Établissement", produits });
  }
  return out;
}

/** L'écran propose-t-il la saisie ? (le serveur revérifie décideur par décideur — `droitBesoin`). */
export function proposeLaSaisie(user: SessionUser): boolean {
  return peutEcrireBesoin({
    superAdmin: user.role === "SUPER_ADMIN",
    vueGlobale: hasGlobalView(user),
    cockpitModifier: userCan(user, "MARKETING_COCKPIT", "UPDATE"),
    chefDeProduit: hasRole(user, "PRODUCT_MANAGER") && userCan(user, "MARKETING_COCKPIT", "VIEW"),
    saisitDesVisites: userCan(user, "MEDICAL", "CREATE"),
    decideurOuvert: true,
  });
}

/** Les faits du droit d'écrire un besoin, pour une personne et un décideur. */
export async function droitBesoin(user: SessionUser, decideurId: string | null): Promise<boolean> {
  const decideurOuvert = decideurId ? await canAccessEntity(user, "DOCTOR", decideurId, "UPDATE") : false;
  return peutEcrireBesoin({
    superAdmin: user.role === "SUPER_ADMIN",
    vueGlobale: hasGlobalView(user),
    cockpitModifier: userCan(user, "MARKETING_COCKPIT", "UPDATE"),
    chefDeProduit: hasRole(user, "PRODUCT_MANAGER") && userCan(user, "MARKETING_COCKPIT", "VIEW"),
    saisitDesVisites: userCan(user, "MEDICAL", "CREATE"),
    decideurOuvert,
  });
}

/** Écrit (remplace) une ligne de besoin — `serviceId` nul compris (l'index unique est NULLS NOT DISTINCT). */
export async function ecrireBesoin(
  tx: Prisma.TransactionClient,
  l: { productId: string; institutionId: string; serviceId: string | null; annee: number; quantite: number; decideurId: string | null; note?: string | null; auteurId: string },
): Promise<string> {
  const existant = await tx.besoinAnnuelService.findFirst({
    where: { productId: l.productId, institutionId: l.institutionId, serviceId: l.serviceId, annee: l.annee },
    select: { id: true },
  });
  const data = { quantite: l.quantite, decideurId: l.decideurId, saisiParId: l.auteurId, saisiLe: new Date(), ...(l.note !== undefined ? { note: l.note } : {}) };
  if (existant) {
    await tx.besoinAnnuelService.update({ where: { id: existant.id }, data });
    return existant.id;
  }
  const cree = await tx.besoinAnnuelService.create({
    data: { productId: l.productId, institutionId: l.institutionId, serviceId: l.serviceId, annee: l.annee, ...data },
    select: { id: true },
  });
  return cree.id;
}

/**
 * LES BESOINS DU RAPPORT DE VISITE — sur le service du décideur visité, pour l'an prochain. Seuls les produits que la
 * stratégie active de la BU classe sont écrits (le formulaire ne propose qu'eux) ; un praticien sans établissement
 * n'a pas de service à qui rattacher un besoin : rien n'est écrit.
 */
export async function ecrireBesoinsDuRapport(
  tx: Prisma.TransactionClient,
  input: { doctorId: string; besoins: readonly BesoinLu[]; auteurId: string; maintenant: Date },
): Promise<number> {
  if (input.besoins.length === 0) return 0;
  const doc = await tx.medicalDoctor.findUnique({ where: { id: input.doctorId }, select: { institutionId: true, serviceId: true } });
  if (!doc?.institutionId) return 0;
  const fiches = await tx.segmentationFiche.findMany({
    where: { doctorId: input.doctorId, retireeLe: null, statut: "DECIDEUR", strategie: { statut: "ACTIVE" } },
    select: { strategie: { select: { produits: { where: { jusqua: null }, select: { productId: true } } } } },
  });
  const classes = new Set(fiches.flatMap((f) => f.strategie.produits.map((p) => p.productId)));
  let n = 0;
  for (const b of input.besoins) {
    if (!classes.has(b.productId)) continue;
    await ecrireBesoin(tx, {
      productId: b.productId, institutionId: doc.institutionId, serviceId: doc.serviceId ?? null,
      annee: anneeDuBesoin(input.maintenant), quantite: b.quantite, decideurId: input.doctorId, auteurId: input.auteurId,
    });
    n++;
  }
  return n;
}

export interface BesoinCockpit extends BesoinLigne {
  id: string;
  decideurId: string | null;
  decideur: string | null;
  etablissement: string;
  service: string | null;
  produit: string;
  note: string | null;
  saisiLe: Date;
}

/** Les besoins des produits du périmètre, pour deux années (N et N+1). */
export async function chargerBesoins(productIds: readonly string[], annees: readonly number[]): Promise<BesoinCockpit[]> {
  if (productIds.length === 0) return [];
  const rows = await prisma.besoinAnnuelService.findMany({
    where: { productId: { in: [...productIds] }, annee: { in: [...annees] } },
    orderBy: [{ annee: "desc" }, { quantite: "desc" }],
    take: 2000,
  });
  const [etabs, services, docs, produits] = await Promise.all([
    prisma.medicalInstitution.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.institutionId))] } }, select: { id: true, name: true } }),
    prisma.medicalInstitutionService.findMany({ where: { id: { in: rows.flatMap((r) => (r.serviceId ? [r.serviceId] : [])) } }, select: { id: true, name: true } }),
    prisma.medicalDoctor.findMany({ where: { id: { in: rows.flatMap((r) => (r.decideurId ? [r.decideurId] : [])) } }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.productId))] } }, select: { id: true, canonicalName: true } }),
  ]);
  const nom = <T extends { id: string }>(l: T[], id: string | null, champ: (x: T) => string) => (id ? (l.find((x) => x.id === id) ? champ(l.find((x) => x.id === id)!) : null) : null);
  return rows.map((r) => ({
    id: r.id, productId: r.productId, institutionId: r.institutionId, serviceId: r.serviceId, annee: r.annee, quantite: r.quantite,
    decideurId: r.decideurId, decideur: nom(docs, r.decideurId, (x) => x.name),
    etablissement: nom(etabs, r.institutionId, (x) => x.name) ?? "Établissement",
    service: nom(services, r.serviceId, (x) => x.name),
    produit: nom(produits, r.productId, (x) => x.canonicalName) ?? "Produit",
    note: r.note, saisiLe: r.saisiLe,
  }));
}
