import { prisma } from "@/lib/prisma";
import { scopeMedicalDoctors, type SessionUser } from "@/lib/rbac";
import { cleDeSpecialite, lienDeSpecialiteValide } from "@/lib/annuaires/specialites";
import type { LibelleHerite, SpecialiteRow } from "@/lib/annuaires/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RÉFÉRENTIEL DES SPÉCIALITÉS, TEL QUE L'ÉCRAN LE MONTRE (§118.180).
 *
 * Deux listes. Les spécialités du référentiel, avec le nombre de praticiens qui s'y RATTACHENT ;
 * et les libellés HÉRITÉS — une spécialité écrite en texte sur une fiche, sans lien, ou avec un lien
 * que son texte contredit —, regroupés par leur écriture (casse, accents, espaces mis à part), avec
 * ce qu'ils désignent déjà dans le référentiel quand c'est le cas.
 *
 * Les comptes se font DANS LA PORTÉE de la personne (`scopeMedicalDoctors`) : un délégué lit les
 * praticiens de son panel, pas ceux du voisin — un chiffre de l'annuaire entier, affiché à qui ne
 * peut en voir que douze, ferait croire à un problème d'accès. Le référentiel lui-même n'est pas
 * cloisonné : le nom d'une spécialité n'est pas une donnée confidentielle.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Au-delà, la liste dit ce qu'elle tait au lieu de se lire comme exhaustive (§118.60). */
const LIBELLES_MAX = 200;

export async function chargerSpecialites(user: SessionUser): Promise<{
  specialites: SpecialiteRow[];
  heritees: LibelleHerite[];
  heriteesTotal: number;
}> {
  const scope = scopeMedicalDoctors(user);
  // UNE lecture, par COUPLE (lien, texte) : c'est le couple qui dit si le lien vaut. Le nombre de
  // couples distincts est celui des écritures d'une spécialité, pas celui des fiches.
  const [referentiel, couples] = await Promise.all([
    prisma.medicalSpecialty.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, color: true, notes: true,
        // LES BU QUI LA VISENT (§118.183) : c'est ce qui dit, avant le clic, pourquoi un retrait sera
        // refusé — et ce qu'une fusion fera suivre. Le nom d'une gamme n'est pas confidentiel.
        businessUnits: { select: { principale: true, businessUnit: { select: { name: true } } } },
      },
    }),
    prisma.medicalDoctor.groupBy({
      by: ["specialtyId", "specialty"],
      where: { AND: [scope, { OR: [{ specialtyId: { not: null } }, { specialty: { not: null } }] }] },
      _count: { _all: true },
    }),
  ]);
  const nomDe = new Map(referentiel.map((s) => [s.id, s.name]));
  const parId = new Map<string, number>();
  const textes: { specialty: string | null; n: number }[] = [];
  for (const c of couples) {
    const nom = c.specialtyId ? nomDe.get(c.specialtyId) : undefined;
    // UN LIEN QUE LE TEXTE CONTREDIT NE COMPTE PAS (`lienDeSpecialiteValide`) : la fiche se lit comme
    // son texte, exactement comme la feuille la montre — deux comptes différents pour la même fiche
    // feraient chercher un écart qui n'existe pas (§118.51).
    if (c.specialtyId && nom && lienDeSpecialiteValide(c.specialty, nom)) {
      parId.set(c.specialtyId, (parId.get(c.specialtyId) ?? 0) + c._count._all);
    } else if (c.specialty) {
      textes.push({ specialty: c.specialty, n: c._count._all });
    }
  }
  const parCle = new Map<string, { id: string; name: string }[]>();
  for (const s of referentiel) parCle.set(cleDeSpecialite(s.name), [...(parCle.get(cleDeSpecialite(s.name)) ?? []), s]);

  const groupes = new Map<string, { ecritures: Map<string, number>; total: number }>();
  for (const t of textes) {
    const brut = (t.specialty ?? "").replace(/\s+/g, " ").trim();
    const cle = cleDeSpecialite(brut);
    if (!cle) continue;
    const g = groupes.get(cle) ?? { ecritures: new Map<string, number>(), total: 0 };
    g.ecritures.set(brut, (g.ecritures.get(brut) ?? 0) + t.n);
    g.total += t.n;
    groupes.set(cle, g);
  }
  const heritees: LibelleHerite[] = [...groupes.entries()]
    .map(([cle, g]) => {
      const ecritures = [...g.ecritures.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
      const designees = parCle.get(cle) ?? [];
      return {
        libelle: ecritures[0][0],
        variantes: ecritures.slice(1).map(([e]) => e),
        praticiens: g.total,
        designe: designees.length === 1 ? designees[0] : null,
      };
    })
    .sort((a, b) => b.praticiens - a.praticiens || a.libelle.localeCompare(b.libelle, "fr"));

  return {
    specialites: referentiel.map((s) => ({
      id: s.id, name: s.name, color: s.color, notes: s.notes, praticiens: parId.get(s.id) ?? 0,
      bu: s.businessUnits
        .map((l) => ({ nom: l.businessUnit.name, principale: l.principale }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    })),
    heritees: heritees.slice(0, LIBELLES_MAX),
    heriteesTotal: heritees.length,
  };
}
