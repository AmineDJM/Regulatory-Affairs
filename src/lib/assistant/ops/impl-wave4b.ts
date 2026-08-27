import { prisma } from "@/lib/prisma";
import {
  createDoctor, updateDoctor, deleteDoctor, createVisit, updateVisit, deleteVisit,
  deleteInstitution, createSpecialty, updateSpecialty, deleteSpecialty,
} from "@/lib/actions/medical-actions";
import { addDirectoryDoctor, saveDirectoryCell, deleteDirectoryDoctors } from "@/lib/actions/medical-directory-actions";
import {
  createMedicalDirectory, updateMedicalDirectory, deleteMedicalDirectory,
  moveDoctorsToDirectory, setDirectoryAccess,
  createDirectoryColumn, updateDirectoryColumn, deleteDirectoryColumn,
} from "@/lib/actions/medical-directory-crud-actions";
import {
  createDelegatePlan, updateDelegatePlan, deleteDelegatePlan, duplicateDelegatePlan,
} from "@/lib/actions/delegate-plan-actions";
import {
  createProductRange, updateProductRange, deleteProductRange,
  setProductsRange, setUserRanges, removeProductFromRange,
} from "@/lib/actions/product-range-actions";
import {
  createMarketResearch, updateMarketResearch, setMarketResearchParticipants, deleteMarketResearch,
  addResearchRow, updateResearchRow, deleteResearchRow,
  addResearchPlayer, updateResearchPlayer, deleteResearchPlayer, prefillResearchRow,
} from "@/lib/actions/market-research-actions";
import {
  generatePresentation, regeneratePresentation, renamePresentation, deletePresentation,
} from "@/lib/actions/market-presentation-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate } from "./helpers";
import { resolveRegProduct, matchLabel, fold } from "./impl-regulatory";

/**
 * OPS VAGUE 4b — ANNUAIRE MÉDICAL (praticiens en FUSION intégrale, cellules type feuille,
 * suppressions en lot bornées par la portée, visites PATCH par champs soumis, établissements,
 * spécialités, annuaires nommés avec accès désignés, plans de tournée), GAMMES (ADMIN — clé de
 * lecture de la plateforme), ÉTUDES DE MARCHÉ (lignes, acteurs, pré-remplissage marché) et
 * PRÉSENTATIONS IA versionnées. Toujours par les ACTIONS CANONIQUES.
 */

const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

const resolvePerson = (raw: string, label = "la personne") =>
  resolveOne(raw, label,
    (q) => prisma.user.findMany({ where: { name: { contains: q, mode: "insensitive" }, isActive: true }, select: { id: true, name: true }, take: 6 }),
    (u) => u.name);

const resolveDoctor = (raw: string) =>
  resolveOne(raw, "le praticien (champ « doctor » — son nom)",
    (q) => prisma.medicalDoctor.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, specialty: true, institution: true }, take: 6,
    }),
    (d) => `${d.name}${d.specialty ? ` (${d.specialty})` : ""}${d.institution ? ` — ${d.institution}` : ""}`);

const resolveInstitution = (raw: string) =>
  resolveOne(raw, "l'établissement (champ « institution »)",
    (q) => prisma.medicalInstitution.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (i) => i.name);

const resolveSpecialty = (raw: string) =>
  resolveOne(raw, "la spécialité (champ « specialty »)",
    (q) => prisma.medicalSpecialty.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (s) => s.name);

const resolveDirectory = (raw: string) =>
  resolveOne(raw, "l'annuaire (champ « directory »)",
    (q) => prisma.medicalDirectory.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (d) => d.name);

/**
 * UNE COLONNE PROPRE À UN ANNUAIRE, retrouvée par son libellé.
 *
 * L'annuaire est demandé D'ABORD : deux annuaires peuvent avoir une colonne « Statut », et
 * modifier celle du mauvais annuaire ne produit aucune erreur — juste une grille fausse ailleurs.
 */
async function resolveDirectoryColumn(directoryRaw: string, columnRaw: string) {
  const dir = await resolveDirectory(directoryRaw);
  if ("error" in dir) return dir;
  if (!columnRaw) return { error: "Précisez la colonne (champ « column »)." };
  const found = await prisma.medicalDirectoryColumn.findMany({
    where: { directoryId: dir.id, label: { contains: columnRaw, mode: "insensitive" } },
    select: { id: true, label: true }, take: 6,
  });
  if (found.length === 0) return { error: `Aucune colonne « ${columnRaw} » dans l'annuaire « ${dir.name} ».` };
  if (found.length > 1) {
    return { error: `Plusieurs colonnes correspondent à « ${columnRaw} » : ${found.map((c) => c.label).join(", ")}. Précisez.` };
  }
  return { id: found[0].id, label: found[0].label, directoryName: dir.name };
}

const resolveResearch = (raw: string) =>
  resolveOne(raw, "l'étude de marché (champ « research » — son titre)",
    (q) => prisma.marketResearch.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    (r) => r.title);

const resolvePresentation = (raw: string) =>
  resolveOne(raw, "la présentation (champ « presentation » — son titre)",
    (q) => prisma.marketResearchPresentation.findMany({ where: { title: { contains: q, mode: "insensitive" } }, select: { id: true, title: true, researchId: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    (p) => p.title);

async function resolveResearchRow(researchId: string, researchTitle: string, raw: string) {
  const rows = await prisma.marketResearchRow.findMany({
    where: { researchId }, select: { id: true, product: true }, orderBy: { sortOrder: "asc" }, take: 40,
  });
  if (rows.length === 0) return { error: `L'étude « ${researchTitle} » n'a aucune ligne.` } as const;
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez la ligne (champ « row ») parmi : ${rows.slice(0, 12).map((r) => r.product).join(" ; ")}.` } as const;
  }
  const hits = rows.filter((r) => fold(r.product).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune ligne « ${raw} » dans « ${researchTitle} » — lignes : ${rows.slice(0, 12).map((r) => r.product).join(" ; ")}.` } as const;
  return { error: `Plusieurs lignes correspondent : ${hits.map((r) => r.product).join(" ; ")} — préciser.` } as const;
}

async function resolvePlayer(rowId: string, rowLabel: string, raw: string) {
  const players = await prisma.marketResearchPlayer.findMany({
    where: { rowId }, select: { id: true, name: true, rank: true }, orderBy: { rank: "asc" }, take: 20,
  });
  if (players.length === 0) return { error: `La ligne « ${rowLabel} » n'a aucun acteur.` } as const;
  const q = fold(raw);
  if (!q) {
    if (players.length === 1) return players[0];
    return { error: `Précisez l'acteur (champ « player ») parmi : ${players.map((p) => p.name).join(" ; ")}.` } as const;
  }
  const hits = players.filter((p) => fold(p.name).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucun acteur « ${raw} » sur « ${rowLabel} » — acteurs : ${players.map((p) => p.name).join(" ; ")}.` } as const;
  return { error: `Plusieurs acteurs correspondent : ${hits.map((p) => p.name).join(" ; ")} — préciser.` } as const;
}

const resolveCompany = (raw: string) =>
  resolveOne(raw, "l'entité (champ « entity »)",
    (q) => prisma.company.findMany({ where: { name: { contains: q, mode: "insensitive" }, isActive: true }, select: { id: true, name: true }, take: 4 }),
    (c) => c.name);

const resolveRange = (raw: string) =>
  resolveOne(raw, "la gamme (champ « range »)",
    (q) => prisma.productRange.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, companyId: true, company: { select: { name: true } } }, take: 6,
    }),
    (r) => `${r.company.name} › ${r.name}`);

const TITLE_FR: [string, string][] = [
  ["PROFESSEUR", "Professeur"], ["MAITRE_CONFERENCES", "Maître de conférences"],
  ["MAITRE_ASSISTANT", "Maître assistant"], ["PRATICIEN_SPECIALISTE", "Praticien spécialiste"],
  ["ASSISTANT", "Assistant"], ["RESIDENT", "Résident"], ["GENERALISTE", "Généraliste"],
  ["PHARMACIEN", "Pharmacien"], ["AUTRE", "Autre"],
];
const SECTOR_FR: [string, string][] = [["HOSPITAL", "Hospitalier"], ["LIBERAL", "Libéral"], ["BOTH", "Les deux"]];
const SEGMENT_FR: [string, string][] = [
  ["VERY_HIGH", "Très élevé"], ["HIGH", "Élevé"], ["MEDIUM", "Moyen"], ["LOW", "Faible"], ["VERY_LOW", "Très faible"],
];
const VISIT_STATUS_FR: [string, string][] = [
  ["PLANNED", "Planifiée"], ["COMPLETED", "Réalisée"], ["CANCELLED", "Annulée"], ["POSTPONED", "Reportée"],
];

function enumIn(raw: string, entries: [string, string][]): string | null | { error: string } {
  const q = raw.trim();
  if (!q) return null;
  return matchLabel(q, entries);
}

interface VisitHit { id: string; date: Date; doctorName: string }

async function resolveVisit(raw: string, dateRaw: string): Promise<VisitHit | { error: string }> {
  const doctor = await resolveDoctor(raw);
  if ("error" in doctor) return doctor;
  const date = isoDate(dateRaw);
  const rows = await prisma.medicalVisit.findMany({
    where: {
      doctorId: doctor.id,
      ...(date ? { date: { gte: new Date(`${date}T00:00:00Z`), lt: new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000) } } : {}),
    },
    select: { id: true, date: true, status: true },
    orderBy: { date: "desc" }, take: 6,
  });
  if (rows.length === 0) return { error: `Aucune visite pour ${doctor.name}${date ? ` le ${date}` : ""}.` };
  if (rows.length > 1) return { error: `Plusieurs visites pour ${doctor.name} : ${rows.map((v) => `${day(v.date)} (${VISIT_STATUS_FR.find(([c]) => c === v.status)?.[1] ?? v.status})`).join(" ; ")} — préciser la date (champ « date »).` };
  return { id: rows[0].id, date: rows[0].date, doctorName: doctor.name };
}

interface PlanHit { id: string; label: string }

async function resolvePlan(raw: string, dateRaw: string): Promise<PlanHit | { error: string }> {
  const date = isoDate(dateRaw);
  const person = raw ? await resolvePerson(raw, "le délégué (champ « person »)") : null;
  if (person && "error" in person) return person;
  const rows = await prisma.medicalDelegatePlan.findMany({
    where: {
      ...(person ? { delegateId: person.id } : {}),
      ...(date ? { weekStart: { gte: new Date(`${date}T00:00:00Z`), lt: new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000) } } : {}),
    },
    select: { id: true, weekStart: true, region: true, delegate: { select: { name: true } } },
    orderBy: { weekStart: "desc" }, take: 6,
  });
  const label = (p: (typeof rows)[number]) => `${day(p.weekStart)} — ${p.delegate?.name ?? "sans délégué"}${p.region ? ` (${p.region})` : ""}`;
  if (rows.length === 0) return { error: `Aucun plan de tournée${person ? ` pour ${person.name}` : ""}${date ? ` au ${date}` : ""}.` };
  if (rows.length > 1) return { error: `Plusieurs plans correspondent : ${rows.map(label).join(" ; ")} — préciser la date de début (champ « date ») et/ou le délégué.` };
  return { id: rows[0].id, label: label(rows[0]) };
}

// ─────────────────────────── ANNUAIRE MÉDICAL ───────────────────────────

export const MEDICAL_OPS_IMPL: Record<string, OpImpl> = {
  create_doctor: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "doctor") || opStr(input, "name");
      if (!name) return { error: "Précisez le nom du praticien (champ « doctor »)." };
      const title = enumIn(opStr(input, "title"), TITLE_FR);
      if (title && typeof title === "object") return title;
      const sector = enumIn(opStr(input, "sector"), SECTOR_FR);
      if (sector && typeof sector === "object") return sector;
      let delegateId: string | null = null; let delegateName: string | null = null;
      if (opStr(input, "person")) {
        const delegate = await resolvePerson(opStr(input, "person"), "le délégué (champ « person »)");
        if ("error" in delegate) return delegate;
        delegateId = delegate.id; delegateName = delegate.name;
      }
      return {
        title: `Nouveau praticien « ${name} »`,
        fields: fieldsOf([
          ["Praticien", name],
          ["Grade", title ? TITLE_FR.find(([c]) => c === title)?.[1] ?? null : null],
          ["Spécialité", opStr(input, "specialty") || null],
          ["Secteur", sector ? SECTOR_FR.find(([c]) => c === sector)?.[1] ?? null : null],
          ["Établissement", opStr(input, "institution") || null],
          ["Ville", opStr(input, "city") || null], ["Wilaya / région", opStr(input, "region") || null],
          ["Téléphone", opStr(input, "phone") || null], ["E-mail", opStr(input, "email") || null],
          ["Délégué", delegateName],
        ]),
        args: {
          name, title: (title as string | null), specialty: opStr(input, "specialty") || null,
          sector: (sector as string | null), institution: opStr(input, "institution") || null,
          city: opStr(input, "city") || null, region: opStr(input, "region") || null,
          phone: opStr(input, "phone") || null, email: opStr(input, "email") || null,
          targetProducts: opStr(input, "products") || null, comments: opStr(input, "notes") || null,
          delegateId,
        },
        successMessage: `Praticien « ${name} » ajouté à l'annuaire.`,
        link: "/medical", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd2(createDoctor, args, "La création du praticien a été refusée.", { revalidate: ["/medical"] }),
  },

  update_doctor: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveDoctor(opStr(input, "doctor") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const d = await prisma.medicalDoctor.findUnique({ where: { id: hit.id } });
      if (!d) return { error: "Praticien introuvable." };
      const title = enumIn(opStr(input, "title"), TITLE_FR);
      if (title && typeof title === "object") return title;
      const sector = enumIn(opStr(input, "sector"), SECTOR_FR);
      if (sector && typeof sector === "object") return sector;
      const influence = enumIn(opStr(input, "influence"), SEGMENT_FR);
      if (influence && typeof influence === "object") return influence;
      const potential = enumIn(opStr(input, "potential"), SEGMENT_FR);
      if (potential && typeof potential === "object") return potential;
      const affinity = enumIn(opStr(input, "affinity"), SEGMENT_FR);
      if (affinity && typeof affinity === "object") return affinity;
      let delegateId = d.delegateId; let delegateChange: string | null = null;
      if (opStr(input, "person")) {
        const delegate = await resolvePerson(opStr(input, "person"), "le délégué (champ « person »)");
        if ("error" in delegate) return delegate;
        delegateId = delegate.id; delegateChange = delegate.name;
      }
      const changes: string[] = [];
      const pick = (key: string, current: string | null, label: string): string | null => {
        const v = opStr(input, key);
        if (v) { changes.push(label); return v; }
        return current;
      };
      const name = pick("newName", d.name, "nom") ?? d.name;
      const specialty = pick("specialty", d.specialty, "spécialité");
      const institution = pick("institution", d.institution, "établissement");
      const city = pick("city", d.city, "ville");
      const region = pick("region", d.region, "wilaya/région");
      const phone = pick("phone", d.phone, "téléphone");
      const email = pick("email", d.email, "e-mail");
      const targetProducts = pick("products", d.targetProducts, "produits cibles");
      const comments = pick("notes", d.comments, "commentaires");
      if (title && title !== d.title) changes.push("grade");
      if (sector && sector !== d.sector) changes.push("secteur");
      if (influence) changes.push("influence");
      if (potential) changes.push("potentiel");
      if (affinity) changes.push("affinité");
      if (delegateChange) changes.push(`délégué → ${delegateChange}`);
      if (changes.length === 0) return { error: "Rien à changer : donnez newName, title, specialty, sector, institution, city, region, phone, email, influence, potential, affinity, products, notes ou person." };
      return {
        title: `Modifier la fiche de ${d.name}`,
        fields: [
          { label: "Praticien", value: d.name },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique (segmentation, entité, délégué compris)" },
        ],
        args: {
          id: hit.id, name, title: (title as string | null) ?? d.title,
          specialty, sector: (sector as string | null) ?? d.sector, institution,
          city, region, phone, email,
          influence: (influence as string | null) ?? d.influence,
          potential: (potential as string | null) ?? d.potential,
          affinity: (affinity as string | null) ?? d.affinity,
          targetProducts, comments, companyId: d.companyId, delegateId,
        },
        successMessage: `Fiche de ${name} mise à jour (${changes.join(", ")}).`,
        link: "/medical", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateDoctor, args, "La modification du praticien a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_doctor: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveDoctor(opStr(input, "doctor") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const visits = await prisma.medicalVisit.count({ where: { doctorId: hit.id } });
      return {
        title: `SUPPRIMER le praticien ${hit.name}`,
        fields: [{ label: "Praticien", value: hit.name }, { label: "Visites emportées", value: String(visits) }],
        warnings: [`Suppression définitive de la fiche ET de ses ${visits} visite(s) — il est aussi retiré des listes d'invités de congrès.`],
        confirmText: hit.name,
        args: { id: hit.id },
        successMessage: `Praticien ${hit.name} supprimé (visites comprises).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteDoctor, args, "La suppression du praticien a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_doctors: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "doctor") || opStr(input, "people");
      if (!raw) return { error: "Précisez les praticiens à supprimer (champ « doctor », noms séparés par des virgules)." };
      const ids: string[] = []; const names: string[] = [];
      for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
        const hit = await resolveDoctor(part);
        if ("error" in hit) return hit;
        ids.push(hit.id); names.push(hit.name);
      }
      return {
        title: `SUPPRIMER ${names.length} fiche(s) de l'annuaire`,
        fields: [{ label: "Praticiens", value: names.join(", ") }],
        warnings: ["Suppression en lot — chaque ligne est revérifiée INDIVIDUELLEMENT : une fiche hors de votre portée est laissée en place, jamais tout ou rien."],
        confirmText: `${names.length} fiches`,
        args: { ids: ids.join(",") },
        successMessage: `${names.length} fiche(s) traitée(s) — le résultat précise les lignes hors portée.`,
        revalidate: ["/medical"],
      };
    },
    async execute(args) {
      const r = await deleteDirectoryDoctors((args.ids ?? "").split(",").filter(Boolean));
      if (!r.ok) return { ok: false, error: r.error ?? "La suppression en lot a été refusée." };
      return { ok: true, message: r.message, revalidate: ["/medical"] };
    },
  },

  add_doctor_row: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const lastName = opStr(input, "lastName") || opStr(input, "doctor") || opStr(input, "name");
      if (!lastName) return { error: "Précisez au moins le nom (champ « lastName »)." };
      const wilaya = opStr(input, "region");
      return {
        title: `Ajouter la ligne « ${[opStr(input, "firstName"), lastName].filter(Boolean).join(" ")} » à la feuille`,
        fields: fieldsOf([
          ["Nom", lastName], ["Prénom", opStr(input, "firstName") || null],
          ["Spécialité", opStr(input, "specialty") || null], ["Wilaya", wilaya || null],
        ]),
        warnings: ["La fiche naît minimale (feuille de l'annuaire) — le reste se remplit cellule par cellule."],
        args: { lastName, firstName: opStr(input, "firstName") || "", specialty: opStr(input, "specialty") || "", wilaya },
        successMessage: "Ligne ajoutée à l'annuaire.",
        link: "/medical/annuaire", revalidate: ["/medical"],
      };
    },
    async execute(args) {
      const r = await addDirectoryDoctor({
        lastName: args.lastName ?? "", firstName: args.firstName ?? "",
        specialty: args.specialty ?? "", wilaya: args.wilaya ?? "",
      });
      if (!r.ok) return { ok: false, error: r.error ?? "L'ajout de la ligne a été refusé." };
      return { ok: true, revalidate: ["/medical"] };
    },
  },

  set_doctor_cell: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveDoctor(opStr(input, "doctor") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const field = opStr(input, "field");
      const value = opStr(input, "value");
      if (!field) return { error: "Précisez la colonne (champ « field ») : lastName, firstName, address, city, wilaya, postalCode, phone, email, title, sector, specialty, potential." };
      return {
        title: `Cellule « ${field} » de ${hit.name}`,
        fields: [
          { label: "Praticien", value: hit.name },
          { label: "Colonne", value: field },
          { label: "Valeur", value: value || "— (effacée)" },
        ],
        warnings: ["Écriture d'UNE cellule, comme dans la feuille — les menus fermés n'acceptent que leurs options (même validation que l'écran)."],
        args: { id: hit.id, field, value },
        successMessage: `Cellule « ${field} » de ${hit.name} mise à jour.`,
        link: "/medical/annuaire", revalidate: ["/medical"],
      };
    },
    async execute(args) {
      const r = await saveDirectoryCell({ id: args.id ?? "", field: args.field ?? "", value: args.value ?? "" });
      if (!r.ok) return { ok: false, error: r.error ?? "L'écriture de la cellule a été refusée." };
      return { ok: true, revalidate: ["/medical"] };
    },
  },

  create_visit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doctor = await resolveDoctor(opStr(input, "doctor") || opStr(input, "name"));
      if ("error" in doctor) return doctor;
      const status = enumIn(opStr(input, "status"), VISIT_STATUS_FR);
      if (status && typeof status === "object") return status;
      let delegateId: string | null = null; let delegateName: string | null = null;
      if (opStr(input, "person")) {
        const delegate = await resolvePerson(opStr(input, "person"), "le délégué (champ « person »)");
        if ("error" in delegate) return delegate;
        delegateId = delegate.id; delegateName = delegate.name;
      }
      return {
        title: `Visite chez ${doctor.name}`,
        fields: fieldsOf([
          ["Praticien", doctor.name],
          ["Date", isoDate(opStr(input, "date")) ?? "aujourd'hui"],
          ["Délégué", delegateName],
          ["Région", opStr(input, "region") || null],
          ["Objectif", opStr(input, "notes") || null],
          ["Produits présentés", opStr(input, "products") || null],
        ]),
        args: {
          doctorId: doctor.id, date: isoDate(opStr(input, "date")), delegateId,
          region: opStr(input, "region") || null, objective: opStr(input, "notes") || null,
          presentedProducts: opStr(input, "products") || null, status: (status as string | null),
        },
        successMessage: `Visite chez ${doctor.name} enregistrée.`,
        link: "/medical", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd2(createVisit, args, "La création de la visite a été refusée.", { revalidate: ["/medical"] }),
  },

  update_visit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const visit = await resolveVisit(opStr(input, "doctor") || opStr(input, "name"), opStr(input, "date"));
      if ("error" in visit) return visit;
      const status = enumIn(opStr(input, "status"), VISIT_STATUS_FR);
      if (status && typeof status === "object") return status;
      // L'action n'écrit QUE les champs soumis : rien à rejouer, on n'envoie que le demandé.
      const updates = fieldsOf([
        ["Statut", status ? VISIT_STATUS_FR.find(([c]) => c === status)?.[1] ?? null : null],
        ["Compte rendu", opStr(input, "report") || null],
        ["Retour du médecin", opStr(input, "feedback") || null],
        ["Actions de suivi", opStr(input, "followUp") || null],
        ["Objectif", opStr(input, "notes") || null],
        ["Produits présentés", opStr(input, "products") || null],
      ]);
      if (updates.length === 0) return { error: "Rien à changer : donnez status (planifiée/réalisée/annulée/reportée), report, feedback, followUp, notes ou products." };
      return {
        title: `Visite chez ${visit.doctorName} du ${day(visit.date)}`,
        fields: [{ label: "Visite", value: `${visit.doctorName} — ${day(visit.date)}` }, ...updates],
        args: {
          id: visit.id, status: (status as string | null),
          report: opStr(input, "report") || null, doctorFeedback: opStr(input, "feedback") || null,
          followUpActions: opStr(input, "followUp") || null, objective: opStr(input, "notes") || null,
          presentedProducts: opStr(input, "products") || null,
        },
        successMessage: `Visite chez ${visit.doctorName} mise à jour.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateVisit, args, "La mise à jour de la visite a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_visit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const visit = await resolveVisit(opStr(input, "doctor") || opStr(input, "name"), opStr(input, "date"));
      if ("error" in visit) return visit;
      return {
        title: `Supprimer la visite chez ${visit.doctorName} du ${day(visit.date)}`,
        fields: [{ label: "Visite", value: `${visit.doctorName} — ${day(visit.date)}` }],
        warnings: ["Suppression définitive de la visite (le délégué auteur, ou le droit Supprimer sur l'Annuaire)."],
        args: { id: visit.id },
        successMessage: "Visite supprimée.",
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteVisit, args, "La suppression de la visite a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_institution: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const inst = await resolveInstitution(opStr(input, "institution") || opStr(input, "name"));
      if ("error" in inst) return inst;
      const doctors = await prisma.medicalDoctor.count({ where: { institutionId: inst.id } });
      return {
        title: `Supprimer l'établissement « ${inst.name} »`,
        fields: [{ label: "Établissement", value: inst.name }, { label: "Praticiens rattachés", value: String(doctors) }],
        warnings: ["Les praticiens rattachés passent « Sans établissement » — AUCUNE fiche n'est supprimée."],
        args: { id: inst.id },
        successMessage: `Établissement « ${inst.name} » supprimé (praticiens conservés).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteInstitution, args, "La suppression de l'établissement a été refusée.", { revalidate: ["/medical"] }),
  },

  create_specialty: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "specialty") || opStr(input, "name");
      if (!name) return { error: "Précisez le nom de la spécialité (champ « specialty »)." };
      return {
        title: `Nouvelle spécialité « ${name} »`,
        fields: fieldsOf([["Spécialité", name], ["Couleur", opStr(input, "color") || null], ["Notes", opStr(input, "notes") || null]]),
        args: { name, color: opStr(input, "color") || null, notes: opStr(input, "notes") || null },
        successMessage: `Spécialité « ${name} » créée.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(createSpecialty, args, "La création de la spécialité a été refusée.", { revalidate: ["/medical"] }),
  },

  update_specialty: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const spec = await resolveSpecialty(opStr(input, "specialty") || opStr(input, "name"));
      if ("error" in spec) return spec;
      const current = await prisma.medicalSpecialty.findUnique({ where: { id: spec.id }, select: { color: true, notes: true } });
      const newName = opStr(input, "newName") || spec.name;
      // FUSION : l'action REMPLACE couleur et notes — l'existant est rejoué si non fourni.
      return {
        title: `Modifier la spécialité « ${spec.name} »`,
        fields: fieldsOf([
          ["Spécialité", newName !== spec.name ? `${spec.name} → ${newName}` : spec.name],
          ["Couleur", opStr(input, "color") || current?.color || null],
        ]),
        warnings: ["Le libellé dénormalisé est resynchronisé sur TOUS les praticiens de la spécialité."],
        args: { id: spec.id, name: newName, color: opStr(input, "color") || current?.color || null, notes: opStr(input, "notes") || current?.notes || null },
        successMessage: `Spécialité « ${newName} » mise à jour.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateSpecialty, args, "La modification de la spécialité a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_specialty: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const spec = await resolveSpecialty(opStr(input, "specialty") || opStr(input, "name"));
      if ("error" in spec) return spec;
      const doctors = await prisma.medicalDoctor.count({ where: { specialtyId: spec.id } });
      return {
        title: `Supprimer la spécialité « ${spec.name} »`,
        fields: [{ label: "Spécialité", value: spec.name }, { label: "Praticiens concernés", value: String(doctors) }],
        warnings: ["Les praticiens passent « Sans spécialité » — AUCUNE fiche n'est supprimée."],
        args: { id: spec.id },
        successMessage: `Spécialité « ${spec.name} » supprimée (praticiens conservés).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteSpecialty, args, "La suppression de la spécialité a été refusée.", { revalidate: ["/medical"] }),
  },

  create_directory: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "directory") || opStr(input, "name");
      if (!name) return { error: "Précisez le nom de l'annuaire (champ « directory »)." };
      return {
        title: `Créer l'annuaire « ${name} »`,
        fields: fieldsOf([["Annuaire", name], ["Description", opStr(input, "notes") || null]]),
        warnings: ["Un annuaire RANGE, il n'autorise pas : le cloisonnement par entité et la portée du délégué restent les seules règles d'accès."],
        args: { name, description: opStr(input, "notes") || null },
        successMessage: `Annuaire « ${name} » créé.`,
        link: "/medical/annuaire", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd2(createMedicalDirectory, args, "La création de l'annuaire a été refusée.", { revalidate: ["/medical"] }),
  },

  update_directory: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dir = await resolveDirectory(opStr(input, "directory") || opStr(input, "name"));
      if ("error" in dir) return dir;
      const newName = opStr(input, "newName");
      const description = opStr(input, "notes");
      if (!newName && !description) return { error: "Rien à changer : donnez newName et/ou notes (description)." };
      return {
        title: `Modifier l'annuaire « ${dir.name} »`,
        fields: fieldsOf([
          ["Annuaire", newName ? `${dir.name} → ${newName}` : dir.name],
          ["Description", description || null],
        ]),
        args: { id: dir.id, name: newName || null, ...(description ? { description } : {}) },
        successMessage: `Annuaire « ${newName || dir.name} » mis à jour.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateMedicalDirectory, args, "La modification de l'annuaire a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_directory: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dir = await resolveDirectory(opStr(input, "directory") || opStr(input, "name"));
      if ("error" in dir) return dir;
      const count = await prisma.medicalDoctor.count({ where: { directoryId: dir.id } });
      return {
        title: `Supprimer l'annuaire « ${dir.name} »`,
        fields: [{ label: "Annuaire", value: dir.name }, { label: "Praticiens rangés dedans", value: String(count) }],
        warnings: [`Les ${count} praticien(s) repassent dans l'annuaire général — AUCUNE fiche n'est supprimée.`],
        args: { id: dir.id },
        successMessage: `Annuaire « ${dir.name} » supprimé (praticiens rendus au général).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteMedicalDirectory, args, "La suppression de l'annuaire a été refusée.", { revalidate: ["/medical"] }),
  },

  // ── LES COLONNES PROPRES À UN ANNUAIRE ────────────────────────────────────────────────
  // Le tronc commun ne prévoit pas « Dernier congrès » ni « Numéro d'officine ». Les ajouter au
  // tronc les imposerait à TOUS les annuaires ; ces trois gestes les tiennent annuaire par
  // annuaire. La valeur vit dans `MedicalDoctor.custom` — aucune migration pour un champ de plus.

  create_directory_column: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dir = await resolveDirectory(opStr(input, "directory"));
      if ("error" in dir) return dir;
      const label = opStr(input, "label") || opStr(input, "name");
      if (!label) return { error: "Précisez le nom de la colonne (champ « label »)." };
      const kindRaw = (opStr(input, "kind") || "TEXT").toUpperCase();
      const kind = ["TEXT", "NUMBER", "DATE", "CHOICE"].includes(kindRaw) ? kindRaw : "TEXT";
      const options = opStr(input, "options");
      if (kind === "CHOICE" && !options) {
        return { error: "Une colonne à choix a besoin de ses options (champ « options », séparées par |)." };
      }
      return {
        title: `Ajouter la colonne « ${label} » à l'annuaire « ${dir.name} »`,
        fields: fieldsOf([
          ["Annuaire", dir.name], ["Colonne", label], ["Type", kind],
          ["Options", kind === "CHOICE" ? options : null],
        ]),
        warnings: ["La colonne n'existe que dans CET annuaire — les autres ne la voient pas."],
        args: { directoryId: dir.id, label, kind, ...(options ? { options } : {}) },
        successMessage: `Colonne « ${label} » ajoutée.`,
        link: "/medical/annuaire", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(createDirectoryColumn, args, "L'ajout de la colonne a été refusé.", { revalidate: ["/medical"] }),
  },

  update_directory_column: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const col = await resolveDirectoryColumn(opStr(input, "directory"), opStr(input, "column") || opStr(input, "label"));
      if ("error" in col) return col;
      const newLabel = opStr(input, "newName") || opStr(input, "newLabel");
      const kindRaw = opStr(input, "kind").toUpperCase();
      const kind = ["TEXT", "NUMBER", "DATE", "CHOICE"].includes(kindRaw) ? kindRaw : "";
      const options = opStr(input, "options");
      if (!newLabel && !kind && !options) return { error: "Rien à changer : donnez newName, kind et/ou options." };
      return {
        title: `Modifier la colonne « ${col.label} »`,
        fields: fieldsOf([
          ["Annuaire", col.directoryName],
          ["Colonne", newLabel ? `${col.label} → ${newLabel}` : col.label],
          ["Type", kind || null], ["Options", options || null],
        ]),
        warnings: ["Renommer NE PERD PAS les valeurs déjà saisies : la clé technique reste la même."],
        args: { id: col.id, ...(newLabel ? { label: newLabel } : {}), ...(kind ? { kind } : {}), ...(options ? { options } : {}) },
        successMessage: `Colonne « ${newLabel || col.label} » modifiée.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateDirectoryColumn, args, "La modification de la colonne a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_directory_column: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const col = await resolveDirectoryColumn(opStr(input, "directory"), opStr(input, "column") || opStr(input, "label"));
      if ("error" in col) return col;
      return {
        title: `Retirer la colonne « ${col.label} » de l'annuaire « ${col.directoryName} »`,
        fields: [{ label: "Annuaire", value: col.directoryName }, { label: "Colonne", value: col.label }],
        warnings: [
          "La colonne disparaît de la grille. LES VALEURS DÉJÀ SAISIES SONT CONSERVÉES : recréer "
          + "la colonne sous le même nom les retrouve.",
        ],
        args: { id: col.id },
        successMessage: `Colonne « ${col.label} » retirée (valeurs conservées).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteDirectoryColumn, args, "Le retrait de la colonne a été refusé.", { revalidate: ["/medical"] }),
  },

  move_doctors_to_directory: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "doctor") || opStr(input, "people");
      if (!raw) return { error: "Précisez les praticiens (champ « doctor », noms séparés par des virgules)." };
      const ids: string[] = []; const names: string[] = [];
      for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
        const hit = await resolveDoctor(part);
        if ("error" in hit) return hit;
        ids.push(hit.id); names.push(hit.name);
      }
      const dirRaw = opStr(input, "directory");
      const toGeneral = /^(g[ée]n[ée]ral|aucun|sortir)/i.test(dirRaw);
      let directoryId: string | null = null; let dirName = "Annuaire général";
      if (!toGeneral) {
        if (!dirRaw) return { error: "Précisez l'annuaire de destination (champ « directory » — « général » pour les en sortir)." };
        const dir = await resolveDirectory(dirRaw);
        if ("error" in dir) return dir;
        directoryId = dir.id; dirName = dir.name;
      }
      return {
        title: `Ranger ${names.length} praticien(s) dans « ${dirName} »`,
        fields: [{ label: "Praticiens", value: names.join(", ") }, { label: "Destination", value: dirName }],
        warnings: ["Ranger n'ouvre l'accès à personne — seules les fiches de votre périmètre bougent."],
        args: { doctorIds: ids.join(","), directoryId },
        successMessage: `${names.length} praticien(s) rangé(s) dans « ${dirName} ».`,
        revalidate: ["/medical"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      for (const id of (args.doctorIds ?? "").split(",").filter(Boolean)) fd.append("doctorId", id);
      if (args.directoryId) fd.set("directoryId", args.directoryId);
      const r = await moveDoctorsToDirectory(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le rangement a été refusé." };
      return { ok: true, message: r.message, revalidate: ["/medical"] };
    },
  },

  set_directory_access: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dir = await resolveDirectory(opStr(input, "directory") || opStr(input, "name"));
      if ("error" in dir) return dir;
      const raw = opStr(input, "people");
      const opening = /^(tous|tout le monde|ouvre|aucune?)/i.test(raw);
      const ids: string[] = []; const names: string[] = [];
      if (!opening && raw) {
        for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
          const person = await resolvePerson(part, "la personne (champ « people »)");
          if ("error" in person) return person;
          ids.push(person.id); names.push(person.name);
        }
      }
      if (!opening && ids.length === 0) return { error: "Donnez les personnes (champ « people », virgules) — ou « tous » pour lever la restriction." };
      return {
        title: opening ? `Ouvrir l'annuaire « ${dir.name} » à tout le module` : `Restreindre « ${dir.name} » à ${names.length} personne(s)`,
        fields: [
          { label: "Annuaire", value: dir.name },
          { label: "Accès", value: opening ? "Ouvert à tout le module (restriction levée)" : names.join(", ") },
        ],
        warnings: opening ? [] : ["La liste REMPLACE la précédente — celui qui restreint se garde sa propre porte (ajouté d'office)."],
        args: { id: dir.id, userIds: ids.join(",") },
        successMessage: opening ? `Annuaire « ${dir.name} » ouvert à tout le module.` : `Accès de « ${dir.name} » réglé (${names.length} personne(s)).`,
        revalidate: ["/medical"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      for (const id of (args.userIds ?? "").split(",").filter(Boolean)) fd.append("userId", id);
      const r = await setDirectoryAccess(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le réglage de l'accès a été refusé." };
      return { ok: true, message: r.message, revalidate: ["/medical"] };
    },
  },

  create_plan: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const weekStart = isoDate(opStr(input, "date"));
      if (!weekStart) return { error: "Précisez la date de début de période (champ « date », AAAA-MM-JJ)." };
      let delegateId: string | null = null; let delegateName: string | null = null;
      if (opStr(input, "person")) {
        const delegate = await resolvePerson(opStr(input, "person"), "le délégué (champ « person »)");
        if ("error" in delegate) return delegate;
        delegateId = delegate.id; delegateName = delegate.name;
      }
      return {
        title: `Plan de tournée${delegateName ? ` — ${delegateName}` : ""} (début ${weekStart})`,
        fields: fieldsOf([
          ["Délégué", delegateName ?? "moi-même"],
          ["Début de période", weekStart],
          ["Région", opStr(input, "region") || null],
          ["Produit cible", opStr(input, "products") || null],
          ["Visites cibles", opStr(input, "quantity") || null],
          ["Médecins clés cibles", opStr(input, "keyTargets") || null],
        ]),
        args: {
          weekStart, delegateId, region: opStr(input, "region") || null,
          productTarget: opStr(input, "products") || null,
          visitsTarget: opStr(input, "quantity") || null,
          keyDoctorsTarget: opStr(input, "keyTargets") || null,
          managerComment: opStr(input, "notes") || null,
        },
        successMessage: `Plan de tournée créé (début ${weekStart}).`,
        link: "/medical", revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(createDelegatePlan, args, "La création du plan a été refusée.", { revalidate: ["/medical"] }),
  },

  update_plan: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const plan = await resolvePlan(opStr(input, "person"), opStr(input, "date"));
      if ("error" in plan) return plan;
      const p = await prisma.medicalDelegatePlan.findUnique({ where: { id: plan.id } });
      if (!p) return { error: "Plan introuvable." };
      // FUSION : l'action REMPLACE région / produit / cibles (absentes → 0) — tout est rejoué.
      const changes: string[] = [];
      const region = opStr(input, "region") ? (changes.push("région"), opStr(input, "region")) : p.region;
      const productTarget = opStr(input, "products") ? (changes.push("produit cible"), opStr(input, "products")) : p.productTarget;
      const visitsTarget = opStr(input, "quantity") ? (changes.push("visites cibles"), opStr(input, "quantity")) : String(p.visitsTarget);
      const keyDoctorsTarget = opStr(input, "keyTargets") ? (changes.push("médecins clés"), opStr(input, "keyTargets")) : String(p.keyDoctorsTarget);
      const achievedVisits = opStr(input, "achieved") ? (changes.push("visites réalisées"), opStr(input, "achieved")) : null;
      const managerComment = opStr(input, "notes") ? (changes.push("commentaire manager"), opStr(input, "notes")) : p.managerComment;
      if (changes.length === 0) return { error: "Rien à changer : donnez region, products, quantity (visites cibles), keyTargets, achieved ou notes." };
      return {
        title: `Modifier le plan ${plan.label}`,
        fields: [
          { label: "Plan", value: plan.label },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique" },
        ],
        args: { id: plan.id, region, productTarget, visitsTarget, keyDoctorsTarget, achievedVisits, managerComment },
        successMessage: `Plan ${plan.label} mis à jour (${changes.join(", ")}).`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(updateDelegatePlan, args, "La modification du plan a été refusée.", { revalidate: ["/medical"] }),
  },

  delete_plan: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const plan = await resolvePlan(opStr(input, "person"), opStr(input, "date"));
      if ("error" in plan) return plan;
      return {
        title: `Supprimer le plan ${plan.label}`,
        fields: [{ label: "Plan", value: plan.label }],
        warnings: ["Suppression définitive du plan de tournée (propriétaire ou manager)."],
        args: { id: plan.id },
        successMessage: `Plan ${plan.label} supprimé.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(deleteDelegatePlan, args, "La suppression du plan a été refusée.", { revalidate: ["/medical"] }),
  },

  duplicate_plan: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const plan = await resolvePlan(opStr(input, "person"), opStr(input, "date"));
      if ("error" in plan) return plan;
      const newStart = isoDate(opStr(input, "newDate"));
      return {
        title: `Dupliquer le plan ${plan.label}`,
        fields: [
          { label: "Plan source", value: plan.label },
          { label: "Nouvelle période", value: newStart ?? "le mois suivant (défaut)" },
        ],
        warnings: ["Région, cibles et produit sont repris — l'avancement repart à zéro."],
        args: { id: plan.id, weekStart: newStart },
        successMessage: `Plan dupliqué${newStart ? ` (début ${newStart})` : " sur le mois suivant"}.`,
        revalidate: ["/medical"],
      };
    },
    execute: (args) => runFd(duplicateDelegatePlan, args, "La duplication du plan a été refusée.", { revalidate: ["/medical"] }),
  },
};

// ─────────────────────────── GAMMES (ADMIN) ───────────────────────────

export const RANGE_OPS_IMPL: Record<string, OpImpl> = {
  create_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "range") || opStr(input, "name");
      if (!name) return { error: "Précisez le nom de la gamme (champ « range »)." };
      const company = await resolveCompany(opStr(input, "entity"));
      if ("error" in company) return company;
      return {
        title: `Créer la gamme ${company.name} › ${name}`,
        fields: fieldsOf([
          ["Entité", company.name], ["Gamme", name],
          ["Description", opStr(input, "notes") || null], ["Couleur", opStr(input, "color") || null],
        ]),
        warnings: ["Une gamme est une CLÉ DE LECTURE de la plateforme : le rattachement des personnes en découle."],
        args: { companyId: company.id, name, description: opStr(input, "notes") || null, color: opStr(input, "color") || null },
        successMessage: `Gamme ${company.name} › ${name} créée.`,
        revalidate: ["/admin/gammes"],
      };
    },
    execute: (args) => runFd2(createProductRange, args, "La création de la gamme a été refusée.", { revalidate: ["/admin/gammes"] }),
  },

  update_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const range = await resolveRange(opStr(input, "range") || opStr(input, "name"));
      if ("error" in range) return range;
      const current = await prisma.productRange.findUnique({ where: { id: range.id }, select: { description: true, color: true, isActive: true } });
      const newName = opStr(input, "newName");
      const modeRaw = opStr(input, "mode");
      const deactivate = /d[ée]sactiv/i.test(modeRaw);
      const activate = /^activ|r[ée]activ/i.test(modeRaw);
      if (!newName && !opStr(input, "notes") && !opStr(input, "color") && !deactivate && !activate) {
        return { error: "Rien à changer : donnez newName, notes (description), color, ou mode (activer / désactiver)." };
      }
      return {
        title: `Modifier la gamme « ${range.name} »`,
        fields: fieldsOf([
          ["Gamme", newName ? `${range.name} → ${newName}` : range.name],
          ["État", deactivate ? "Désactivée" : activate ? "Réactivée" : null],
          ["Le reste", "rejoué à l'identique (description, couleur)"],
        ]),
        args: {
          id: range.id, name: newName || null,
          description: opStr(input, "notes") || current?.description || null,
          color: opStr(input, "color") || current?.color || null,
          isActive: deactivate ? "false" : activate ? "true" : null,
        },
        successMessage: `Gamme « ${newName || range.name} » mise à jour.`,
        revalidate: ["/admin/gammes"],
      };
    },
    execute: (args) => runFd(updateProductRange, args, "La modification de la gamme a été refusée.", { revalidate: ["/admin/gammes"] }),
  },

  delete_range: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const range = await resolveRange(opStr(input, "range") || opStr(input, "name"));
      if ("error" in range) return range;
      const counts = await prisma.productRange.findUnique({
        where: { id: range.id }, select: { _count: { select: { products: true, userAccess: true } } },
      });
      return {
        title: `Supprimer la gamme « ${range.name} »`,
        fields: [
          { label: "Gamme", value: range.name },
          { label: "Effet", value: `${counts?._count.products ?? 0} produit(s) rendus « sans gamme », ${counts?._count.userAccess ?? 0} rattachement(s) levés` },
        ],
        warnings: ["AUCUN dossier n'est supprimé : les produits restent, simplement sans gamme — les rattachements de personnes tombent avec elle."],
        args: { id: range.id },
        successMessage: `Gamme « ${range.name} » supprimée (produits conservés).`,
        revalidate: ["/admin/gammes"],
      };
    },
    execute: (args) => runFd(deleteProductRange, args, "La suppression de la gamme a été refusée.", { revalidate: ["/admin/gammes"] }),
  },

  set_products_range: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "products") || opStr(input, "reference");
      if (!raw) return { error: "Précisez le ou les produits (champ « products », références REG-… ou DCI, virgules)." };
      const ids: string[] = []; const names: string[] = [];
      for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
        const product = await resolveRegProduct(user, part);
        if ("error" in product) return product;
        ids.push(product.id); names.push(product.reference);
      }
      const rangeRaw = opStr(input, "range");
      const removing = /^(aucune?|sans gamme|sortir|retirer)$/i.test(rangeRaw);
      let rangeId: string | null = null; let rangeName = "Sans gamme";
      if (!removing) {
        if (!rangeRaw) return { error: "Précisez la gamme (champ « range » — « aucune » pour les sortir)." };
        const range = await resolveRange(rangeRaw);
        if ("error" in range) return range;
        rangeId = range.id; rangeName = range.name;
      }
      return {
        title: `Ranger ${names.length} produit(s) dans « ${rangeName} »`,
        fields: [{ label: "Produits", value: names.join(", ") }, { label: "Gamme", value: rangeName }],
        warnings: removing ? [] : ["Un produit ne relève que d'une gamme DE SON ENTITÉ — un produit d'une autre société est refusé."],
        args: { rangeId, productIds: ids.join(",") },
        successMessage: `${names.length} produit(s) rangé(s) dans « ${rangeName} ».`,
        revalidate: ["/admin/gammes"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      if (args.rangeId) fd.set("rangeId", args.rangeId);
      for (const id of (args.productIds ?? "").split(",").filter(Boolean)) fd.append("productId", id);
      const r = await setProductsRange(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le rangement a été refusé." };
      return { ok: true, message: r.message, revalidate: ["/admin/gammes"] };
    },
  },

  set_user_ranges: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const person = await resolvePerson(opStr(input, "person"), "la personne (champ « person »)");
      if ("error" in person) return person;
      const raw = opStr(input, "range") || opStr(input, "ranges");
      const detaching = /^(aucune?|toutes? lev[ée]es?|d[ée]tache)/i.test(raw);
      const ids: string[] = []; const names: string[] = [];
      if (!detaching && raw) {
        for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
          const range = await resolveRange(part);
          if ("error" in range) return range;
          ids.push(range.id); names.push(range.name);
        }
      }
      if (!detaching && ids.length === 0) return { error: "Donnez les gammes (champ « range », virgules) — ou « aucune » pour tout détacher." };
      return {
        title: detaching ? `Détacher ${person.name} de toutes les gammes` : `Rattacher ${person.name} à ${names.length} gamme(s)`,
        fields: [
          { label: "Personne", value: person.name },
          { label: "Gammes", value: detaching ? "— (elle relève de ses seules entités)" : names.join(", ") },
        ],
        warnings: ["La liste REMPLACE la précédente — le rattachement gouverne ce que la personne VOIT."],
        args: { userId: person.id, rangeIds: ids.join(",") },
        successMessage: detaching ? `${person.name} détaché(e) de toutes les gammes.` : `${person.name} rattaché(e) à ${names.length} gamme(s).`,
        revalidate: ["/admin/gammes"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("userId", args.userId ?? "");
      for (const id of (args.rangeIds ?? "").split(",").filter(Boolean)) fd.append("rangeId", id);
      const r = await setUserRanges(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le rattachement a été refusé." };
      return { ok: true, message: r.message, revalidate: ["/admin/gammes"] };
    },
  },

  remove_product_from_range: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const product = await resolveRegProduct(user, opStr(input, "products") || opStr(input, "reference"));
      if ("error" in product) return product;
      return {
        title: `Sortir ${product.reference} de sa gamme`,
        fields: [{ label: "Produit", value: `${product.reference} — ${product.dci}` }],
        warnings: ["Le dossier reste exactement où il est, simplement sans gamme."],
        args: { productId: product.id },
        successMessage: `${product.reference} sorti de sa gamme.`,
        revalidate: ["/admin/gammes"],
      };
    },
    execute: (args) => runFd(removeProductFromRange, args, "Le retrait a été refusé.", { revalidate: ["/admin/gammes"] }),
  },
};

// ─────────────────────────── ÉTUDES DE MARCHÉ & PRÉSENTATIONS ───────────────────────────

const RESEARCH_REVALIDATE = ["/business-development/etudes"];

export const BD4_OPS_IMPL: Record<string, OpImpl> = {
  create_research: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "research") || opStr(input, "name");
      if (!title) return { error: "Précisez le titre de l'étude (champ « research »)." };
      const molecules = opStr(input, "molecules").split(/[;,\n]/).map((m) => m.trim()).filter(Boolean);
      return {
        title: `Nouvelle étude de marché « ${title} »`,
        fields: fieldsOf([
          ["Étude", title],
          ["Molécules initiales", molecules.length ? molecules.join(", ") : null],
          ["Notes", opStr(input, "notes") || null],
        ]),
        args: { title, molecules: molecules.join("\n") || null, notes: opStr(input, "notes") || null },
        successMessage: `Étude « ${title} » créée${molecules.length ? ` (${molecules.length} molécule·s)` : ""}.`,
        link: "/business-development/etudes", revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd2(createMarketResearch, args, "La création de l'étude a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  update_research: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const current = await prisma.marketResearch.findUnique({ where: { id: research.id }, select: { notes: true, sources: true } });
      const statusRaw = fold(opStr(input, "status"));
      const status = /final|termin/.test(statusRaw) ? "FINAL" : /brouillon|draft/.test(statusRaw) ? "DRAFT" : null;
      const newName = opStr(input, "newName");
      if (!newName && !status && !opStr(input, "notes") && !opStr(input, "sources")) {
        return { error: "Rien à changer : donnez newName, status (brouillon / finale), notes ou sources." };
      }
      // FUSION : notes et sources sont REMPLACÉES par l'action — l'existant est rejoué.
      return {
        title: `Modifier l'étude « ${research.title} »`,
        fields: fieldsOf([
          ["Étude", newName ? `${research.title} → ${newName}` : research.title],
          ["Statut", status ? (status === "FINAL" ? "Finale" : "Brouillon") : null],
        ]),
        args: {
          id: research.id, title: newName || null, status,
          notes: opStr(input, "notes") || current?.notes || null,
          sources: opStr(input, "sources") || current?.sources || null,
        },
        successMessage: `Étude « ${newName || research.title} » mise à jour.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(updateMarketResearch, args, "La modification de l'étude a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  set_research_participants: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const raw = opStr(input, "people");
      const clearing = /^(aucune?|personne|vide)$/i.test(raw);
      const ids: string[] = []; const names: string[] = [];
      if (!clearing && raw) {
        for (const part of raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
          const person = await resolvePerson(part, "le participant (champ « people »)");
          if ("error" in person) return person;
          ids.push(person.id); names.push(person.name);
        }
      }
      if (!clearing && ids.length === 0) return { error: "Donnez les participants (champ « people », virgules) — ou « aucun » pour vider la liste." };
      return {
        title: `Participants de « ${research.title} »`,
        fields: [
          { label: "Étude", value: research.title },
          { label: "Participants", value: clearing ? "— (liste vidée)" : names.join(", ") },
        ],
        warnings: ["La liste REMPLACE la précédente."],
        args: { id: research.id, participantIds: ids.join(",") },
        successMessage: clearing ? "Participants retirés." : `${names.length} participant(s) sur « ${research.title} ».`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      for (const id of (args.participantIds ?? "").split(",").filter(Boolean)) fd.append("participantIds", id);
      const r = await setMarketResearchParticipants(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le réglage des participants a été refusé." };
      return { ok: true, revalidate: RESEARCH_REVALIDATE };
    },
  },

  delete_research: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const [rows, presentations] = await Promise.all([
        prisma.marketResearchRow.count({ where: { researchId: research.id } }),
        prisma.marketResearchPresentation.count({ where: { researchId: research.id } }),
      ]);
      return {
        title: `SUPPRIMER l'étude « ${research.title} »`,
        fields: [
          { label: "Étude", value: research.title },
          { label: "Emporte avec elle", value: `${rows} ligne(s), leurs acteurs, ${presentations} présentation(s)` },
        ],
        warnings: ["Suppression définitive EN CASCADE : lignes, acteurs et présentations IA disparaissent avec l'étude."],
        confirmText: research.title,
        args: { id: research.id },
        successMessage: `Étude « ${research.title} » supprimée (cascade comprise).`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(deleteMarketResearch, args, "La suppression de l'étude a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  add_research_row: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const product = opStr(input, "row") || opStr(input, "products");
      if (!product) return { error: "Précisez le produit / la molécule (champ « row »)." };
      return {
        title: `Ajouter « ${product} » à l'étude « ${research.title} »`,
        fields: [{ label: "Étude", value: research.title }, { label: "Produit", value: product }],
        args: { researchId: research.id, product },
        successMessage: `Ligne « ${product} » ajoutée à « ${research.title} ».`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(addResearchRow, args, "L'ajout de la ligne a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  update_research_row: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      const row = await prisma.marketResearchRow.findUnique({ where: { id: hit.id } });
      if (!row) return { error: "Ligne introuvable." };
      const changes: string[] = [];
      const num = (key: string, current: unknown, label: string): string | null => {
        const v = opStr(input, key);
        if (v) { changes.push(label); return v; }
        return current == null ? null : String(Number(current));
      };
      const therapeuticClass = opStr(input, "therapeuticClass") ? (changes.push("classe"), opStr(input, "therapeuticClass")) : row.therapeuticClass;
      const product = opStr(input, "newName") ? (changes.push("produit"), opStr(input, "newName")) : row.product;
      const marketVolume = num("quantity", row.marketVolume, "volume marché");
      const marketValueUsd = num("amount", row.marketValueUsd, "valeur marché (USD)");
      const avgPrice = num("price", row.avgPricePerBoxUsd, "prix moyen / boîte");
      const comment = opStr(input, "notes") ? (changes.push("commentaire"), opStr(input, "notes")) : row.comment;
      if (changes.length === 0) return { error: "Rien à changer : donnez newName, therapeuticClass, quantity (volume), amount (valeur USD), price ou notes." };
      return {
        title: `Modifier la ligne « ${row.product} » (${research.title})`,
        fields: [
          { label: "Ligne", value: `${row.product} — ${research.title}` },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique" },
        ],
        args: { id: hit.id, researchId: research.id, therapeuticClass, product, marketVolume, marketValueUsd, avgPricePerBoxUsd: avgPrice, comment },
        successMessage: `Ligne « ${product} » mise à jour (${changes.join(", ")}).`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(updateResearchRow, args, "La modification de la ligne a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  delete_research_row: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      return {
        title: `Retirer « ${hit.product} » de l'étude « ${research.title} »`,
        fields: [{ label: "Ligne", value: `${hit.product} — ${research.title}` }],
        warnings: ["La ligne et ses acteurs disparaissent — l'étude reste."],
        args: { id: hit.id, researchId: research.id },
        successMessage: `Ligne « ${hit.product} » retirée.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(deleteResearchRow, args, "Le retrait de la ligne a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  add_research_player: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      const name = opStr(input, "player");
      if (!name) return { error: "Précisez le nom de l'acteur (champ « player » — laboratoire)." };
      return {
        title: `Ajouter l'acteur « ${name} » sur « ${hit.product} »`,
        fields: [{ label: "Ligne", value: `${hit.product} — ${research.title}` }, { label: "Acteur", value: name }],
        args: { rowId: hit.id, researchId: research.id, name },
        successMessage: `Acteur « ${name} » ajouté sur « ${hit.product} ».`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(addResearchPlayer, args, "L'ajout de l'acteur a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  update_research_player: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      const player = await resolvePlayer(hit.id, hit.product, opStr(input, "player"));
      if ("error" in player) return player;
      const current = await prisma.marketResearchPlayer.findUnique({ where: { id: player.id }, select: { marketShareValue: true, status: true } });
      const statusRaw = fold(opStr(input, "mode"));
      const status = /import/.test(statusRaw) ? "IMPORT" : /fabri|local|manufact/.test(statusRaw) ? "MANUFACTURING" : null;
      const share = opStr(input, "amount");
      const newName = opStr(input, "newName");
      if (!newName && !share && !status) return { error: "Rien à changer : donnez newName, amount (part de marché) ou mode (importation / fabrication)." };
      // FUSION : part et statut sont REMPLACÉS par l'action — l'existant est rejoué.
      return {
        title: `Modifier l'acteur « ${player.name} » (${hit.product})`,
        fields: fieldsOf([
          ["Acteur", newName ? `${player.name} → ${newName}` : player.name],
          ["Part de marché", share || (current?.marketShareValue != null ? String(Number(current.marketShareValue)) : null)],
          ["Origine", status ? (status === "IMPORT" ? "Importation" : "Fabrication locale") : null],
        ]),
        args: {
          id: player.id, researchId: research.id, name: newName || null,
          marketShareValue: share || (current?.marketShareValue != null ? String(Number(current.marketShareValue)) : null),
          status: status ?? current?.status ?? null,
        },
        successMessage: `Acteur « ${newName || player.name} » mis à jour.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(updateResearchPlayer, args, "La modification de l'acteur a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  delete_research_player: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      const player = await resolvePlayer(hit.id, hit.product, opStr(input, "player"));
      if ("error" in player) return player;
      return {
        title: `Retirer l'acteur « ${player.name} » de « ${hit.product} »`,
        fields: [{ label: "Acteur", value: `${player.name} — ${hit.product}` }],
        args: { id: player.id, researchId: research.id },
        successMessage: `Acteur « ${player.name} » retiré.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(deleteResearchPlayer, args, "Le retrait de l'acteur a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  prefill_research_row: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      const hit = await resolveResearchRow(research.id, research.title, opStr(input, "row"));
      if ("error" in hit) return hit;
      return {
        title: `Pré-remplir « ${hit.product} » depuis l'intelligence marché`,
        fields: [{ label: "Ligne", value: `${hit.product} — ${research.title}` }],
        warnings: ["Apports : marché (volume / valeur), prix moyen, et les acteurs détectés (fabricants / importateurs) — les acteurs ne sont ajoutés QUE si la ligne n'en a pas encore."],
        args: { id: hit.id, researchId: research.id },
        successMessage: `Ligne « ${hit.product} » pré-remplie depuis l'intelligence marché.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(prefillResearchRow, args, "Le pré-remplissage a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  generate_presentation: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const research = await resolveResearch(opStr(input, "research") || opStr(input, "name"));
      if ("error" in research) return research;
      return {
        title: `Générer une présentation IA de « ${research.title} »`,
        fields: fieldsOf([
          ["Étude", research.title],
          ["Titre de la présentation", opStr(input, "presentation") || `${research.title} — Présentation (défaut)`],
          ["Consigne", opStr(input, "notes") || null],
        ]),
        warnings: ["Analyse IA ancrée sur TOUTE l'étude (v1 stockée comme source de vérité) — le .pptx se reconstruit à la demande au téléchargement."],
        args: { researchId: research.id, title: opStr(input, "presentation") || null, instruction: opStr(input, "notes") || null },
        successMessage: `Présentation IA de « ${research.title} » générée (v1).`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd2(generatePresentation, args, "La génération de la présentation a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  regenerate_presentation: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const presentation = await resolvePresentation(opStr(input, "presentation") || opStr(input, "name"));
      if ("error" in presentation) return presentation;
      const instruction = opStr(input, "notes");
      if (!instruction) return { error: "Donnez la consigne de réorientation (champ « notes ») — c'est elle qui justifie une nouvelle version." };
      return {
        title: `Relancer « ${presentation.title} » avec consigne`,
        fields: [
          { label: "Présentation", value: presentation.title },
          { label: "Consigne", value: instruction },
        ],
        warnings: ["Une NOUVELLE VERSION historisée est créée — les précédentes restent consultables."],
        args: { presentationId: presentation.id, instruction },
        successMessage: `Nouvelle version de « ${presentation.title} » générée.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd2(regeneratePresentation, args, "La relance de la présentation a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },

  rename_presentation: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const presentation = await resolvePresentation(opStr(input, "presentation") || opStr(input, "name"));
      if ("error" in presentation) return presentation;
      const newName = opStr(input, "newName");
      if (!newName) return { error: "Précisez le nouveau titre (champ « newName »)." };
      return {
        title: `Renommer « ${presentation.title} » → « ${newName} »`,
        fields: [{ label: "Présentation", value: `${presentation.title} → ${newName}` }],
        args: { id: presentation.id, title: newName },
        successMessage: `Présentation renommée « ${newName} ».`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(renamePresentation, args, "Le renommage a été refusé.", { revalidate: RESEARCH_REVALIDATE }),
  },

  delete_presentation: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const presentation = await resolvePresentation(opStr(input, "presentation") || opStr(input, "name"));
      if ("error" in presentation) return presentation;
      const versions = await prisma.marketResearchPresentationVersion.count({ where: { presentationId: presentation.id } });
      return {
        title: `Supprimer la présentation « ${presentation.title} »`,
        fields: [{ label: "Présentation", value: presentation.title }, { label: "Versions emportées", value: String(versions) }],
        warnings: ["Toutes les versions historisées disparaissent — l'étude, elle, reste (une nouvelle présentation peut être régénérée)."],
        args: { id: presentation.id },
        successMessage: `Présentation « ${presentation.title} » supprimée.`,
        revalidate: RESEARCH_REVALIDATE,
      };
    },
    execute: (args) => runFd(deletePresentation, args, "La suppression de la présentation a été refusée.", { revalidate: RESEARCH_REVALIDATE }),
  },
};
