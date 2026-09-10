import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, anyRoleFilter } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getSfeConfig } from "@/lib/sfe";
import { PageHeader } from "@/components/shared/page-header";
import { PlanningTabs } from "../tabs";
import { BusinessUnitsManager } from "./bu-manager";

export const dynamic = "force-dynamic";

/**
 * LE MONTAGE DE LA FORCE DE VENTE — un seul écran, lu de haut en bas.
 *
 * Avant, il fallait quatre allers-retours entre « Catalogue » (la BU, ses produits) et
 * « Équipes & KAM » (une ÉQUIPE, son superviseur, ses membres) — deux objets pour une seule
 * réalité, et personne ne savait lequel faisait autorité. La BU est désormais l'unité : on la
 * crée, on lui donne un superviseur, un terrain, ses KAM et ses produits, ici.
 *
 * Les produits viennent des DOSSIERS REGULATORY : les saisir au clavier créait un second
 * référentiel qui divergeait du premier au premier changement de nom, et interdisait de remonter
 * du terrain au dossier.
 */
export default async function BusinessUnitsPage() {
  const user = await requireModule("SALES_PLANNING");
  const canConfigure = userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user);
  if (!canConfigure) redirect("/planning/pilotage");

  const [bus, companies, supervisors, allUsers, kamUsers, profiles, products, dossiers, config, secteurs, etablissements] = await Promise.all([
    prisma.businessUnit.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, code: true, color: true, companyId: true, headId: true,
        supervisorId: true, channel: true, isActive: true,
        // LE SOUS-DÉPARTEMENT de la gamme : c'est lui qui dit si son budget est ouvert.
        departmentId: true,
      },
    }),
    prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true, shortName: true }, orderBy: { sortOrder: "asc" } }),
    // Superviseurs candidats : National Sales / Direction / Manager promo médicale.
    prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(["NATIONAL_SALES", "DIRECTION", "MEDICAL_PROMOTION_MANAGER"]) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // KAM candidats : délégués médicaux + National Sales.
    prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]) }, select: { id: true, name: true, role: true, region: true }, orderBy: { name: "asc" } }),
    prisma.salesRepProfile.findMany(),
    prisma.promoProduct.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, code: true, channel: true, businessUnitId: true, managerId: true, isActive: true,
        regulatoryProduct: { select: { id: true, reference: true, dci: true } },
      },
    }),
    // LES DOSSIERS RÉGLEMENTAIRES, source des produits promus. Bornés aux dossiers vivants :
    // un dossier verrouillé n'a pas à entrer au catalogue promotionnel.
    prisma.regulatoryProduct.findMany({
      where: { isLocked: false },
      select: { id: true, reference: true, dci: true, brandName: true },
      orderBy: [{ dci: "asc" }],
      take: 400,
    }),
    getSfeConfig(),
    // LES SECTEURS de toutes les BU, avec leurs deux sélections. Chargés en une requête et
    // groupés à l'affichage, comme les KAM et les produits : une requête par BU dépliée ferait
    // N allers-retours pour un écran qu'on ouvre pour tout voir.
    prisma.salesSector.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true, name: true, city: true, color: true, isActive: true, businessUnitId: true,
        institutions: { select: { institutionId: true } },
        reps: { select: { repId: true } },
      },
    }),
    // LE RÉFÉRENTIEL DES ÉTABLISSEMENTS, à cocher. Bornée aux ACTIFS : un établissement qu'on a
    // retiré du service ne se propose plus au découpage — mais ceux DÉJÀ dans un secteur restent
    // affichés (le secteur porte leurs identifiants, la ligne les nomme).
    prisma.medicalInstitution.findMany({
      where: { isActive: true },
      select: { id: true, name: true, city: true, type: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const profileByRep = new Map(profiles.map((p) => [p.repId, p]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Prévisions & Force de vente"
        description="Une Business Unit, son superviseur, son terrain, ses KAM et ses produits — tout se monte ici, dans cet ordre."
      />
      <PlanningTabs active="business-units" canConfigure isSupervisor />
      <BusinessUnitsManager
        businessUnits={bus.map((b) => ({ ...b, channel: String(b.channel) }))}
        companies={companies.map((c) => ({ id: c.id, name: c.shortName || c.name }))}
        supervisors={supervisors}
        users={allUsers}
        config={{ daysPerMonth: config.capacity.daysPerMonth, visitsPerDay: config.capacity.visitsPerDay, fieldPct: config.capacity.fieldPct }}
        kams={kamUsers.map((u) => {
          const p = profileByRep.get(u.id);
          return {
            repId: u.id, name: u.name, role: u.role,
            businessUnitId: p?.businessUnitId ?? null,
            region: p?.region ?? u.region ?? null,
            capDaysPerMonth: p?.capDaysPerMonth ?? null,
            capVisitsPerDay: p?.capVisitsPerDay ?? null,
            capFieldPct: p?.capFieldPct ?? null,
            fteBudget: p ? Number(p.fteBudget) : 1,
            seniority: p?.seniority ?? null,
            isActive: p?.isActive ?? true,
            hasProfile: Boolean(p),
          };
        })}
        products={products.map((p) => ({
          id: p.id, name: p.name, code: p.code, channel: String(p.channel),
          businessUnitId: p.businessUnitId, managerId: p.managerId, isActive: p.isActive,
          dossier: p.regulatoryProduct ? `${p.regulatoryProduct.reference} — ${p.regulatoryProduct.dci}` : null,
        }))}
        dossiers={dossiers.map((d) => ({
          id: d.id,
          label: `${d.reference} — ${d.brandName ? `${d.brandName} (${d.dci})` : d.dci}`,
        }))}
        sectors={secteurs.map((x) => ({
          id: x.id, name: x.name, city: x.city, color: x.color, isActive: x.isActive,
          businessUnitId: x.businessUnitId,
          institutionIds: x.institutions.map((i) => i.institutionId),
          repIds: x.reps.map((r) => r.repId),
        }))}
        etablissements={etablissements.map((e) => ({ id: e.id, name: e.name, city: e.city, type: String(e.type) }))}
      />
    </div>
  );
}
