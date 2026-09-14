import { prisma } from "@/lib/prisma";
import { scopeMedicalDoctors, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere, getMyCompanies, companyLabel } from "@/lib/company";
import { canonicalWilaya } from "@/lib/medical/wilaya";
import { cleCellule } from "@/lib/grille/couleurs";
import type { AnnuaireRow, CustomColumnVue } from "@/lib/medical/directory-grid";
import type { DirectoryRow, EtablissementRow, ContactRow, DirectoryPerson } from "@/lib/annuaires/types";

/**
 * ═══════════════════════════════════════════════════════════
 * LES CHARGEURS DES ANNUAIRES — une seule lecture par annuaire, pour deux écrans.
 *
 * Le module « Annuaires » (pôle Administration, décision de la Direction 09/2026) CENTRALISE ce
 * qui vivait dans trois modules : la feuille des praticiens (Promotion médicale), les
 * établissements (Promotion médicale), les partenaires et les personnes (Mon espace). Les pages
 * d'origine restent — un délégué corrige sa feuille sans passer par l'Administration — et le
 * concentrateur les redit sous un même toit.
 *
 * Deux écrans qui chargent SÉPARÉMENT le même annuaire divergent, toujours (§118.5) : la portée
 * d'un délégué, l'accès par annuaire nommé, le comptage dans la portée de la personne… chaque
 * règle recopiée est une règle qui prend du retard d'un côté. Ces chargeurs sont donc les SEULS
 * lecteurs, et les deux pages n'en font que l'affichage. Un test de point d'appel (§118.49)
 * exige que chaque page les importe.
 *
 * Ce module ne DÉCIDE aucun droit : il applique les portées canoniques (`scopeMedicalDoctors`,
 * `companyScopedWhere`, l'accès par annuaire) et c'est la page — `requireModule`, `userCan` —
 * qui ouvre ou ferme la porte.
 * ═══════════════════════════════════════════════════════════
 */

// ── LA FEUILLE DES PRATICIENS ───────────────────────────────────────────────────────────────

/** Médecins = tout grade sauf PHARMACIEN ; pharmaciens = ce grade seul ; `null` = tous. */
export type FiltreGrade = "medecins" | "pharmaciens" | null;

export interface FeuillePraticiens {
  rows: AnnuaireRow[];
  couleurs: Record<string, string>;
  customColumns: CustomColumnVue[];
  specialties: string[];
  directories: DirectoryRow[];
  generalCount: number;
  openDirectoryId: string | null;
  /** Le libellé de l'annuaire ouvert, pour l'import (« « Infectiologues » », « l'annuaire général »). */
  directoryName: string;
  companies: { id: string; label: string }[];
  /** Les personnes désignables pour l'accès d'un annuaire — vides si la personne ne gère pas. */
  people: { id: string; name: string }[];
}

export async function chargerFeuillePraticiens(
  user: SessionUser,
  opts: { annuaire?: string | null; grade?: FiltreGrade; canManage: boolean },
): Promise<FeuillePraticiens | null> {
  // L'annuaire ouvert : « general » = ceux qui ne sont rangés nulle part, un identifiant = cet
  // annuaire, absent = tous les praticiens du périmètre.
  const generalOnly = opts.annuaire === "general";
  const openDirectoryId = opts.annuaire && opts.annuaire !== "general" ? opts.annuaire : null;
  const directoryWhere = generalOnly ? { directoryId: null } : openDirectoryId ? { directoryId: openDirectoryId } : {};
  // LE GRADE : la Direction distingue médecins et pharmaciens ; c'est le même annuaire, filtré.
  const gradeWhere = opts.grade === "pharmaciens"
    ? { title: "PHARMACIEN" as const }
    : opts.grade === "medecins"
      ? { title: { not: "PHARMACIEN" as const } }
      : {};

  const scope = await companyScopedWhere(user.id, scopeMedicalDoctors(user));

  // L'ACCÈS PAR ANNUAIRE. Liste d'accès vide = ouvert à tout le module ; des noms = fermé à tous
  // les autres, hors vue globale. On tranche AVANT de charger les praticiens : un annuaire fermé
  // ne doit fuir ni par sa pastille, ni par ses praticiens dans la vue « Tous ».
  const privileged = user.role === "SUPER_ADMIN" || hasGlobalView(user.role);
  const allDirectories = await prisma.medicalDirectory.findMany({
    select: {
      id: true, name: true, companyId: true, createdById: true,
      company: { select: { name: true, shortName: true } },
      access: { select: { userId: true } },
    },
    orderBy: { name: "asc" },
  });
  const canOpenDirectory = (d: { createdById: string | null; access: { userId: string }[] }) =>
    privileged || d.access.length === 0 || d.createdById === user.id || d.access.some((a) => a.userId === user.id);
  const visibleDirectoryRows = allDirectories.filter(canOpenDirectory);
  const hiddenIds = allDirectories.filter((d) => !canOpenDirectory(d)).map((d) => d.id);
  // Ouvrir un annuaire fermé par son adresse ne marche pas plus que par sa pastille.
  if (openDirectoryId && !visibleDirectoryRows.some((d) => d.id === openDirectoryId)) return null;
  // La vue « Tous » exclut les praticiens des annuaires fermés — sans quoi la restriction ne
  // serait qu'une pastille masquée.
  const hiddenWhere = hiddenIds.length > 0 && !openDirectoryId && !generalOnly
    ? { OR: [{ directoryId: null }, { directoryId: { notIn: hiddenIds } }] }
    : {};

  // LES CLAUSES SE COMPOSENT EN `AND`, JAMAIS PAR ÉTALEMENT. La portée d'un délégué est un `OR`
  // (`{ OR: [{ delegateId }] }`) et l'exclusion des annuaires fermés en est un autre : étalées
  // dans le même objet, la seconde ÉCRASAIT la première — un délégué voyait TOUS les praticiens
  // dès qu'un annuaire fermé existait. Trouvé par le banc du chargeur avec un acteur sans vue
  // globale (§118.104) ; la page d'origine portait ce défaut depuis l'accès par annuaire.
  const whereFeuille = { AND: [scope, directoryWhere, hiddenWhere, gradeWhere] };

  const [doctors, specialtyRefs, directoryCounts, generalCount, myCompanies, colonnesSurMesure, people] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: whereFeuille,
      orderBy: [{ name: "asc" }],
      include: {
        specialtyRef: { select: { name: true } },
        // Les couleurs de la feuille voyagent avec les lignes : une requête, pas une par cellule.
        cellStyles: { select: { field: true, color: true } },
      },
    }),
    prisma.medicalSpecialty.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    // Les comptes se calculent DANS LA PORTÉE de la personne : afficher « 300 » à un délégué qui
    // n'en voit que douze donnerait un chiffre faux et ferait croire à un problème d'accès.
    prisma.medicalDoctor.groupBy({ by: ["directoryId"], where: { AND: [scope, gradeWhere, { directoryId: { not: null } }] }, _count: { _all: true } }),
    prisma.medicalDoctor.count({ where: { AND: [scope, gradeWhere, { directoryId: null }] } }),
    getMyCompanies(user.id),
    // LES COLONNES PROPRES à l'annuaire ouvert. Elles existaient en base sans aucun écran
    // (§118.14) : la feuille les affiche et les édite désormais, à côté du tronc commun.
    openDirectoryId
      ? prisma.medicalDirectoryColumn.findMany({
          where: { directoryId: openDirectoryId },
          orderBy: { position: "asc" },
          select: { id: true, key: true, label: true, kind: true, options: true },
        })
      : Promise.resolve([]),
    opts.canManage
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const countByDirectory = new Map(directoryCounts.map((c) => [c.directoryId as string, c._count._all]));
  const directories: DirectoryRow[] = visibleDirectoryRows.map((d) => ({
    id: d.id, name: d.name, companyId: d.companyId,
    companyLabel: d.company ? d.company.shortName ?? d.company.name : null,
    doctorCount: countByDirectory.get(d.id) ?? 0,
    accessUserIds: d.access.map((a) => a.userId),
  }));

  const couleurs: Record<string, string> = {};
  for (const d of doctors) for (const s of d.cellStyles) couleurs[cleCellule(d.id, s.field)] = s.color;
  const customColumns: CustomColumnVue[] = colonnesSurMesure.map((c) => ({
    id: c.id, key: c.key, label: c.label,
    kind: (["TEXT", "NUMBER", "DATE", "CHOICE"].includes(c.kind) ? c.kind : "TEXT") as CustomColumnVue["kind"],
    options: (c.options ?? "").split("|").map((o) => o.trim()).filter(Boolean),
  }));

  const rows: AnnuaireRow[] = doctors.map((d) => ({
    id: d.id,
    lastName: d.lastName,
    firstName: d.firstName,
    address: d.address,
    wilaya: d.wilaya,
    potential: d.potential,
    postalCode: d.postalCode,
    phone: d.phone,
    // La saisie libre l'emporte à l'affichage sur le référentiel, comme à l'édition.
    specialty: d.specialty ?? d.specialtyRef?.name ?? null,
    title: d.title,
    email: d.email,
    sector: d.sector,
    custom: d.custom && typeof d.custom === "object" && !Array.isArray(d.custom) ? (d.custom as Record<string, unknown>) : {},
  }));

  // Saisie assistée de la spécialité : le référentiel structuré ET les libellés déjà employés.
  const specialties = [...new Set([
    ...specialtyRefs.map((s) => s.name),
    ...rows.map((r) => r.specialty).filter((s): s is string => Boolean(s)),
  ])].sort((a, b) => a.localeCompare(b, "fr"));

  return {
    rows, couleurs, customColumns, specialties, directories, generalCount, openDirectoryId,
    directoryName: openDirectoryId
      ? `« ${visibleDirectoryRows.find((d) => d.id === openDirectoryId)?.name ?? "cet annuaire"} »`
      : "l'annuaire général",
    companies: myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) })),
    people,
  };
}

// ── LES ÉTABLISSEMENTS ─────────────────────────────────────────────────────────────────────

export interface FeuilleEtablissements {
  rows: EtablissementRow[];
  couleurs: Record<string, string>;
}

/**
 * `MedicalInstitution` n'a AUCUNE fonction de portée : c'est un référentiel, comme les
 * spécialités. Ce qui EST cloisonné, ce sont les PRATICIENS — le compte affiché par établissement
 * se calcule donc dans la portée de la personne (`scopeMedicalDoctors`).
 */
export async function chargerEtablissements(user: SessionUser): Promise<FeuilleEtablissements> {
  const [institutions, doctorCounts, sectorCounts] = await Promise.all([
    prisma.medicalInstitution.findMany({
      orderBy: [{ name: "asc" }],
      include: { cellStyles: { select: { field: true, color: true } } },
    }),
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
  const couleurs: Record<string, string> = {};
  for (const i of institutions) for (const s of i.cellStyles) couleurs[cleCellule(i.id, s.field)] = s.color;
  const rows: EtablissementRow[] = institutions.map((i) => ({
    id: i.id,
    name: i.name,
    type: String(i.type),
    sector: String(i.sector),
    // Une wilaya héritée en texte libre (« ALGER ») est montrée sous son nom officiel quand il
    // se reconnaît ; sinon telle quelle — le formulaire la signale et demande de choisir.
    wilaya: i.wilaya ? canonicalWilaya(i.wilaya) ?? i.wilaya : null,
    region: i.region,
    address: i.address,
    phone: i.phone,
    email: i.email,
    notes: i.notes,
    isActive: i.isActive,
    doctorCount: parDoctor.get(i.id) ?? 0,
    sectorCount: parSecteur.get(i.id) ?? 0,
  }));
  return { rows, couleurs };
}

// ── LES PARTENAIRES ET LES PERSONNES ───────────────────────────────────────────────────────

export interface AnnuairePartenaires {
  contacts: ContactRow[];
  companies: { id: string; label: string }[];
}

/** Les contacts EXTERNES de la société — agence, livreur, transitaire —, dans le périmètre d'entité. */
export async function chargerPartenaires(user: SessionUser): Promise<AnnuairePartenaires> {
  const [contacts, myCompanies] = await Promise.all([
    prisma.companyContact.findMany({
      where: await companyScopedWhere(user.id, {}),
      include: { company: { select: { name: true, shortName: true } } },
      orderBy: [{ name: "asc" }],
    }),
    getMyCompanies(user.id),
  ]);
  return {
    contacts: contacts.map((c) => ({
      id: c.id, name: c.name, kind: c.kind, contactName: c.contactName,
      phone: c.phone, phoneAlt: c.phoneAlt, email: c.email, website: c.website,
      address: c.address, city: c.city, wilaya: c.wilaya,
      rc: c.rc, nif: c.nif, rib: c.rib, notes: c.notes,
      isActive: c.isActive, companyId: c.companyId,
      companyLabel: c.company ? c.company.shortName ?? c.company.name : null,
    })),
    companies: myCompanies.map((c) => ({ id: c.id, label: companyLabel(c) })),
  };
}

/**
 * LES PERSONNES — lues depuis le registre RH, qui reste la source de leur identité. L'annuaire
 * n'ajoute que les moyens de les joindre.
 */
export async function chargerPersonnes(): Promise<DirectoryPerson[]> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, position: true, department: true, userId: true,
      email: true, phone: true,
      company: { select: { name: true, shortName: true } },
      user: { select: { email: true } },
      directoryEntry: {
        select: {
          id: true, aliases: true,
          endpoints: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { channel: "asc" }],
            select: { id: true, channel: true, value: true, label: true, confidence: true, isPrimary: true },
          },
        },
      },
    },
  });
  return employees.map((e) => {
    const endpoints = e.directoryEntry?.endpoints ?? [];
    const inDirectory = new Set(endpoints.map((p) => p.value.toLowerCase()));
    // Les adresses des fiches ERP ne sont montrées que si l'annuaire ne les porte pas déjà :
    // afficher deux fois la même adresse ferait douter qu'il s'agisse de la même.
    const erpEmails = [e.email, e.user?.email]
      .filter((m): m is string => Boolean(m))
      .map((m) => m.toLowerCase())
      .filter((m, i, all) => all.indexOf(m) === i && !inDirectory.has(m));
    return {
      key: e.id,
      name: e.fullName,
      jobTitle: e.position,
      department: e.department,
      company: e.company?.shortName ?? e.company?.name ?? null,
      userId: e.userId,
      employeeId: e.id,
      entryId: e.directoryEntry?.id ?? null,
      aliases: e.directoryEntry?.aliases ?? [],
      endpoints: endpoints.map((p) => ({
        id: p.id, channel: p.channel, value: p.value, label: p.label,
        confidence: p.confidence, isPrimary: p.isPrimary,
      })),
      erpEmails,
    };
  });
}

// ── LES AUTRES ANNUAIRES — ce que le concentrateur NOMME sans le redire ─────────────────────

export interface AutreAnnuaire {
  cle: string;
  titre: string;
  description: string;
  href: string;
  /** Le nombre de fiches, ou `null` quand la personne n'a pas le droit de le voir. */
  compte: number | null;
}

/**
 * Les annuaires qui ont leur propre écran ailleurs : on les NOMME et on y mène, on ne les
 * redessine pas ici — un second écran des fournisseurs ferait deux écrans qui divergent.
 * Le compte n'est calculé que si la personne a le module : le nombre de fabricants référencés
 * n'est pas une information pour qui n'a pas Regulatory.
 */
export async function chargerAutresAnnuaires(droits: {
  regulatorySuppliers: boolean; courriers: boolean; stocks: boolean; specialites: boolean;
}): Promise<AutreAnnuaire[]> {
  const [fournisseurs, partenairesCourrier, lieux, specialites] = await Promise.all([
    droits.regulatorySuppliers ? prisma.supplier.count() : Promise.resolve(null),
    droits.courriers ? prisma.mailPartner.count() : Promise.resolve(null),
    droits.stocks ? prisma.stockAnnex.count() : Promise.resolve(null),
    droits.specialites ? prisma.medicalSpecialty.count() : Promise.resolve(null),
  ]);
  return [
    {
      cle: "specialites", titre: "Spécialités médicales",
      description: "Le référentiel des spécialités auquel se rattachent les praticiens.",
      href: "/medical", compte: specialites,
    },
    {
      cle: "fournisseurs", titre: "Fournisseurs Regulatory",
      description: "Les fabricants référencés dans les dossiers d'enregistrement, et leurs comptes du portail externe.",
      href: "/admin/suppliers", compte: fournisseurs,
    },
    {
      cle: "courriers", titre: "Partenaires du registre des courriers",
      description: "Expéditeurs et destinataires du carnet entrant / sortant de l'assistante de direction.",
      href: "/courriers", compte: partenairesCourrier,
    },
    {
      cle: "stocks", titre: "Lieux de stock",
      description: "Hôpitaux et annexes où l'on tient un état de stock PCH.",
      href: "/stocks", compte: lieux,
    },
  ];
}
