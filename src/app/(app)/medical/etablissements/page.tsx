import { requireModule } from "@/lib/session";
import { userCan, scopeMedicalDoctors } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { INSTITUTION_TYPE, INSTITUTION_SECTOR, MEDICAL_TABS } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { EtablissementsTable, type EtablissementRow } from "./etablissements-table";

export const dynamic = "force-dynamic";

/**
 * ÉTABLISSEMENTS — l'annuaire des hôpitaux, cliniques et cabinets.
 *
 * `MedicalInstitution` et ses trois écritures existaient depuis toujours ; leurs seuls
 * importeurs étaient `assistant.ts` et le catalogue d'ops — Adam savait s'en servir, AUCUN écran
 * ne le pouvait (§118.14). C'est cette porte-là.
 *
 * ── PORTÉE : LE RÉFÉRENTIEL N'EST PAS CLOISONNÉ, ET C'EST DÉJÀ TRANCHÉ ─────────────────────
 *
 * `MedicalInstitution` n'a AUCUNE fonction de portée dans `rbac.ts`, et les huit lecteurs du
 * dépôt l'interrogent sans clause (recherche globale, fabric d'entités, bénéficiaires de
 * congrès, `getMedicalData`). C'est un référentiel d'ÉTABLISSEMENTS, comme les spécialités : le
 * nom d'un CHU n'est pas une donnée confidentielle. En inventer une portée ICI donnerait une
 * troisième vérité qui divergerait des huit autres (§118.5, §118.85).
 *
 * Ce qui EST cloisonné, ce sont les PRATICIENS : le compte affiché par établissement se calcule
 * donc dans la portée de la personne (`scopeMedicalDoctors`). Afficher « 300 » à un délégué qui
 * n'en voit que douze donnerait un chiffre faux et ferait croire à un problème d'accès.
 */
export default async function EtablissementsPage() {
  const user = await requireModule("MEDICAL");
  const canCreate = userCan(user, "MEDICAL", "CREATE");
  const canEdit = userCan(user, "MEDICAL", "UPDATE");
  const canDelete = userCan(user, "MEDICAL", "DELETE");

  const [institutions, doctorCounts, sectorCounts] = await Promise.all([
    prisma.medicalInstitution.findMany({ orderBy: [{ name: "asc" }] }),
    // LE COMPTE DE PRATICIENS DANS LA PORTÉE DE LA PERSONNE, jamais le total absolu —
    // `scopeMedicalDoctors`, la même fonction que partout ailleurs.
    prisma.medicalDoctor.groupBy({
      by: ["institutionId"],
      where: { ...scopeMedicalDoctors(user), institutionId: { not: null } },
      _count: { _all: true },
    }),
    // DANS COMBIEN DE SECTEURS COMMERCIAUX il entre : c'est ce que la suppression ampute.
    prisma.salesSectorInstitution.groupBy({ by: ["institutionId"], _count: { _all: true } }),
  ]);

  const parDoctor = new Map(doctorCounts.map((c) => [c.institutionId as string, c._count._all]));
  const parSecteur = new Map(sectorCounts.map((c) => [c.institutionId, c._count._all]));

  const rows: EtablissementRow[] = institutions.map((i) => ({
    id: i.id,
    name: i.name,
    type: String(i.type),
    sector: String(i.sector),
    wilaya: i.wilaya,
    city: i.city,
    region: i.region,
    address: i.address,
    phone: i.phone,
    email: i.email,
    notes: i.notes,
    isActive: i.isActive,
    doctorCount: parDoctor.get(i.id) ?? 0,
    sectorCount: parSecteur.get(i.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Établissements"
        description="CHU, EPH, EHS, cliniques, polycliniques, cabinets — le référentiel auquel se rattachent les praticiens et sur lequel se découpent les secteurs de la force de vente."
      />
      <ModuleTabs tabs={await visibleTabs(user, MEDICAL_TABS)} />
      <EtablissementsTable
        rows={rows}
        // Les libellés viennent du référentiel commun : les réécrire ici en ferait deux jeux de
        // mots pour un seul énuméré, qui divergent à la première retouche (§118.5).
        types={Object.entries(INSTITUTION_TYPE).map(([value, label]) => ({ value, label }))}
        sectors={Object.entries(INSTITUTION_SECTOR).map(([value, d]) => ({ value, label: d.label }))}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
