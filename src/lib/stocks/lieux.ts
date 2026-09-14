import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LIEUX DE STOCK « HÔPITAL » SONT DES ÉTABLISSEMENTS DE L'ANNUAIRE (§118.134).
 *
 * Un relevé d'hôpital vise un `StockAnnex` ; un secteur vise des `MedicalInstitution`. Pour que la
 * portée d'un KAM se calcule, le lieu doit désigner l'établissement — c'est `StockAnnex.institutionId`.
 *
 * ── DEUX ÉCRITURES, ET CE QU'ELLES NE FONT PAS ────────────────────────────────────────────
 *
 * `assurerLieuDeStock` crée le lieu d'un établissement la première fois qu'on relève son stock :
 * l'annuaire EST la configuration, personne n'a à recopier un hôpital dans une seconde liste.
 * Elle ne devine JAMAIS un rattachement : si un lieu hérité porte déjà exactement ce nom, elle
 * REFUSE et nomme le geste — rattacher depuis l'écran, par un Super Admin. Joindre l'historique
 * d'un lieu à un établissement sur la foi d'un nom serait un faux succès silencieux : deux
 * établissements peuvent s'appeler « EPH » quelque chose, et c'est le relevé d'un hôpital qu'on
 * lirait sous un autre (§104.7).
 *
 * `rattacherLieuDeStock` est ce geste humain : il joint un lieu HÉRITÉ (sans établissement) à
 * l'établissement choisi, et aligne le nom du lieu sur celui de l'annuaire quand ce nom est libre
 * — le nom du lieu est ce que les demandes, les récurrences et Adam affichent, et deux noms pour
 * le même hôpital finissent par diverger (§118.5). Quand le nom est pris par un autre lieu, il
 * garde le sien et le résultat le DIT.
 *
 * Ce module écrit ; il ne décide PAS qui a le droit d'écrire — les gardes vivent chez ses
 * appelants (l'action, avec la portée de la personne).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type ResultatLieu =
  | { ok: true; annexId: string; name: string; cree: boolean; renomme?: boolean; note?: string }
  | { ok: false; error: string };

/** Le lieu de stock d'un établissement — celui qui existe, ou celui qu'on crée à l'instant. */
export async function assurerLieuDeStock(institutionId: string): Promise<ResultatLieu> {
  const etab = await prisma.medicalInstitution.findUnique({
    where: { id: institutionId },
    select: { id: true, name: true, isActive: true, stockLocation: { select: { id: true, name: true } } },
  });
  if (!etab) return { ok: false, error: "Établissement introuvable dans l'annuaire des établissements." };
  if (etab.stockLocation) return { ok: true, annexId: etab.stockLocation.id, name: etab.stockLocation.name, cree: false };
  if (!etab.isActive) return { ok: false, error: `« ${etab.name} » est inactif dans l'annuaire : réactivez-le avant d'en relever le stock.` };

  const homonyme = await prisma.stockAnnex.findUnique({ where: { name: etab.name }, select: { id: true, kind: true, institutionId: true } });
  if (homonyme) {
    // Un lieu porte déjà ce nom. S'il est hérité (hôpital sans établissement), c'est presque
    // sûrement le même — mais « presque » ne suffit pas pour joindre un historique : un humain
    // rattache, et le refus nomme ce geste.
    if (homonyme.kind !== "ANNEX" && !homonyme.institutionId) {
      return {
        ok: false,
        error: `Un lieu de stock « ${etab.name} » existe déjà sans rattachement à l'annuaire : rattachez-le à cet établissement depuis l'écran des stocks (Super Admin) plutôt que d'en créer un second.`,
      };
    }
    return { ok: false, error: `Un lieu de stock nommé « ${etab.name} » existe déjà (${homonyme.kind === "ANNEX" ? "une annexe PCH" : "un autre établissement"}).` };
  }

  const cree = await prisma.stockAnnex.create({
    data: { name: etab.name, kind: "HOSPITAL", institutionId: etab.id },
    select: { id: true, name: true },
  });
  return { ok: true, annexId: cree.id, name: cree.name, cree: true };
}

/** Joindre un lieu HÉRITÉ à un établissement de l'annuaire — le geste humain que `assurerLieuDeStock` refuse de deviner. */
export async function rattacherLieuDeStock(annexId: string, institutionId: string): Promise<ResultatLieu> {
  const [lieu, etab] = await Promise.all([
    prisma.stockAnnex.findUnique({ where: { id: annexId }, select: { id: true, name: true, kind: true, institutionId: true } }),
    prisma.medicalInstitution.findUnique({
      where: { id: institutionId },
      select: { id: true, name: true, stockLocation: { select: { id: true, name: true } } },
    }),
  ]);
  if (!lieu) return { ok: false, error: "Lieu de stock introuvable." };
  if (lieu.kind === "ANNEX") return { ok: false, error: `« ${lieu.name} » est une annexe PCH, pas un hôpital : une annexe ne se rattache pas à l'annuaire des établissements.` };
  if (!etab) return { ok: false, error: "Établissement introuvable dans l'annuaire des établissements." };
  if (lieu.institutionId === etab.id) return { ok: true, annexId: lieu.id, name: lieu.name, cree: false };
  if (lieu.institutionId) return { ok: false, error: `« ${lieu.name} » est déjà rattaché à un autre établissement.` };
  if (etab.stockLocation) {
    return { ok: false, error: `« ${etab.name} » a déjà son lieu de stock (« ${etab.stockLocation.name} ») : on ne rattache pas deux lieux au même établissement.` };
  }

  // Le NOM suit l'annuaire quand il est libre ; sinon le lieu garde le sien, et on le dit.
  const nomPris = lieu.name !== etab.name
    ? await prisma.stockAnnex.findUnique({ where: { name: etab.name }, select: { id: true } })
    : null;
  const renomme = lieu.name !== etab.name && !nomPris;
  await prisma.stockAnnex.update({
    where: { id: lieu.id },
    data: { institutionId: etab.id, ...(renomme ? { name: etab.name } : {}) },
  });
  return {
    ok: true, annexId: lieu.id, name: renomme ? etab.name : lieu.name, cree: false, renomme,
    note: nomPris ? `Le lieu garde le nom « ${lieu.name} » : « ${etab.name} » est déjà porté par un autre lieu de stock.` : undefined,
  };
}

/** Un établissement renommé dans l'annuaire renomme son lieu de stock — sauf si le nom est pris. Rend vrai si le lieu a suivi. */
export async function suivreRenommageEtablissement(institutionId: string, nouveauNom: string): Promise<boolean> {
  const lieu = await prisma.stockAnnex.findUnique({ where: { institutionId }, select: { id: true, name: true } });
  if (!lieu || lieu.name === nouveauNom) return false;
  const pris = await prisma.stockAnnex.findUnique({ where: { name: nouveauNom }, select: { id: true } });
  if (pris) return false;
  await prisma.stockAnnex.update({ where: { id: lieu.id }, data: { name: nouveauNom } });
  return true;
}
