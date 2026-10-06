import { prisma } from "@/lib/prisma";
import { complementDeFiche, type EtablissementPourDeduction } from "./etablissement-deduit";

/**
 * LE RATTACHEMENT AUTOMATIQUE, côté base — la règle pure (`etablissement-deduit.ts`) appliquée aux fiches :
 * l'établissement déduit de la wilaya et de la spécialité quand la fiche n'en a pas, le service de la spécialité
 * quand elle a un établissement sans service. Écriture CONDITIONNELLE : un choix fait entre la lecture et
 * l'écriture (une autre personne, un autre onglet) n'est jamais écrasé. « À trancher » n'écrit rien.
 */

export async function etablissementsPourDeduction(): Promise<EtablissementPourDeduction[]> {
  return prisma.medicalInstitution.findMany({ select: { id: true, name: true, wilaya: true, type: true, isActive: true, services: { select: { id: true, name: true } } } });
}

export async function completerRattachement(ids: readonly string[], auteurId: string, etabs?: EtablissementPourDeduction[]): Promise<{ etablissements: number; services: number }> {
  if (ids.length === 0) return { etablissements: 0, services: 0 };
  const referentiel = etabs ?? (await etablissementsPourDeduction());
  const fiches = await prisma.medicalDoctor.findMany({
    where: { id: { in: [...ids] }, archivedAt: null, OR: [{ institutionId: null }, { serviceId: null }] },
    select: { id: true, institutionId: true, institution: true, serviceId: true, wilaya: true, specialty: true, specialtyRef: { select: { name: true } } },
  });
  let etablissements = 0, services = 0;
  for (const f of fiches) {
    const c = complementDeFiche({ institutionId: f.institutionId, institutionTexte: f.institution, serviceId: f.serviceId, wilaya: f.wilaya, specialite: f.specialtyRef?.name ?? f.specialty }, referentiel);
    if (!c) continue;
    if (!f.institutionId) {
      const { count } = await prisma.medicalDoctor.updateMany({
        where: { id: f.id, institutionId: null },
        data: { institutionId: c.institutionId, institution: c.institutionNom, serviceId: c.serviceId, updatedById: auteurId },
      });
      etablissements += count;
      if (count && c.serviceId) services += 1;
    } else {
      const { count } = await prisma.medicalDoctor.updateMany({ where: { id: f.id, institutionId: c.institutionId, serviceId: null }, data: { serviceId: c.serviceId, updatedById: auteurId } });
      services += count;
    }
  }
  return { etablissements, services };
}
