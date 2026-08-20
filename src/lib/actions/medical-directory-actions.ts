"use server";

import { revalidatePath } from "next/cache";
import type { Priority, SegmentLevel } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { readDirectoryWorkbook } from "@/lib/medical/directory-workbook";
import { parseDirectorySheet, type DirectoryImportRow } from "@/lib/medical/directory-sheet";
import { unresolvedHint } from "@/lib/medical/wilaya";
import { inferWilayas } from "@/lib/medical/wilaya-ai";
import {
  isAnnuaireField, validateAnnuaireValue, composeDoctorName, type AnnuaireField,
} from "@/lib/medical/directory-grid";
import type { ActionResult } from "@/lib/actions/types";

/**
 * IMPORT D'UN ANNUAIRE — n'importe quel fichier, restructuré à notre format.
 *
 * Le fichier arrive tel qu'il existe : les en-têtes du délégué, l'ordre du partenaire, les
 * grades écrits à la main. La reconnaissance (module pur `directory-sheet`) fait le travail de
 * remise en forme ; cette action ne fait qu'écrire — et surtout, elle RAPPORTE.
 *
 * Rapporter est la moitié du travail. Un import qui annonce « terminé » sans dire combien de
 * lignes il a laissées de côté, ni quelle colonne il n'a pas su lire, produit un annuaire
 * incomplet dont plus personne ne se méfie ensuite.
 *
 * DOUBLONS : un praticien déjà présent (même nom, même établissement) est MIS À JOUR, pas
 * recréé. Réimporter un fichier corrigé est le geste normal — et il ne doit pas doubler
 * l'annuaire.
 */
export async function importDirectorySheet(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé à alimenter l'annuaire." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier Excel ou CSV." };

  let sheet: unknown[][];
  try {
    sheet = readDirectoryWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "Fichier illisible : attendu un classeur Excel (.xlsx, .xls) ou un CSV." };
  }
  if (sheet.length < 2) return { ok: false, error: "Le fichier ne contient aucune ligne sous l'en-tête." };

  const parsed = parseDirectorySheet(sheet);
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error: parsed.matched.includes("name")
        ? "Aucune ligne exploitable : les fiches sans nom ne peuvent pas être importées."
        : "Colonne « Nom » introuvable : nommez-la Nom, Praticien, Médecin ou Nom et prénom.",
    };
  }

  // Les délégués sont rattachés PAR LEUR NOM tel qu'il figure dans le fichier — un annuaire
  // venu de l'extérieur ne connaît pas nos identifiants. Un nom inconnu laisse la fiche non
  // attribuée plutôt que de la rattacher au hasard.
  const delegateNames = [...new Set(parsed.rows.map((r) => r.delegate).filter((n): n is string => Boolean(n)))];
  const delegates = delegateNames.length
    ? await prisma.user.findMany({ where: { name: { in: delegateNames } }, select: { id: true, name: true } })
    : [];
  const delegateByName = new Map(delegates.map((d) => [d.name.toLowerCase(), d.id]));

  // LA WILAYA EN RENFORT D'IA — pour ce que la reconnaissance ne peut pas savoir : « Rouiba »,
  // « Bab Ezzouar », « El Harrach » sont des communes d'Alger, mais rien dans leur nom ne le
  // dit. UN SEUL appel pour tout le fichier, et chaque réponse revalidée contre les 58 wilayas :
  // une hallucination ne doit jamais entrer dans un champ à liste fermée.
  const needAi = parsed.rows.filter((r) => !r.wilaya);
  if (needAi.length > 0) {
    const hintOf = (r: DirectoryImportRow) => unresolvedHint({ city: r.city, address: r.address, institution: r.institution });
    const guessed = await inferWilayas(needAi.map(hintOf));
    if (guessed.size > 0) {
      for (const r of needAi) {
        const w = guessed.get(hintOf(r));
        if (w) r.wilaya = w;
      }
    }
  }
  const aiFilled = needAi.filter((r) => r.wilaya).length;

  const companyId = await companyIdForNew(user.id);
  const key = (r: { name: string; institution: string | null }) =>
    `${r.name.toLowerCase()}|${(r.institution ?? "").toLowerCase()}`;

  // On relit les fiches existantes portant l'un des noms du fichier : c'est la seule façon de
  // reconnaître un doublon sans charger tout l'annuaire.
  const existing = await prisma.medicalDoctor.findMany({
    where: { name: { in: [...new Set(parsed.rows.map((r) => r.name))] } },
    select: { id: true, name: true, institution: true },
  });
  const existingByKey = new Map(existing.map((d) => [key(d), d.id]));

  const dataOf = (r: DirectoryImportRow) => ({
    // NOM / PRÉNOM / ADRESSE / WILAYA / CODE POSTAL sont les colonnes de la GRILLE. Ils étaient
    // absents de cette écriture : le fichier les portait, l'import les lisait — et l'écran
    // restait vide. C'était le défaut principal de l'import.
    lastName: r.lastName,
    firstName: r.firstName,
    address: r.address,
    wilaya: r.wilaya,
    postalCode: r.postalCode,
    title: r.title as never,
    specialty: r.specialty,
    sector: r.sector as never,
    institution: r.institution,
    city: r.city,
    region: r.region,
    phone: r.phone,
    email: r.email,
    influence: r.influence as never,
    potential: r.potential as never,
    affinity: r.affinity as never,
    targetProducts: r.targetProducts,
    comments: r.comments,
    delegateId: r.delegate ? delegateByName.get(r.delegate.toLowerCase()) ?? null : null,
  });

  let created = 0;
  let updated = 0;
  for (const row of parsed.rows) {
    const id = existingByKey.get(key(row));
    if (id) {
      await prisma.medicalDoctor.update({ where: { id }, data: { ...dataOf(row), updatedById: user.id } });
      updated += 1;
    } else {
      const doc = await prisma.medicalDoctor.create({
        data: { name: row.name, companyId, ...dataOf(row), createdById: user.id, updatedById: user.id },
        select: { id: true, name: true, institution: true },
      });
      // Un même fichier peut lister deux fois la même personne : la seconde occurrence doit
      // mettre à jour la fiche qu'on vient de créer, pas en créer une jumelle.
      existingByKey.set(key(doc), doc.id);
      created += 1;
    }
  }

  const unknownCols = parsed.unknown.map((u) => u.header);
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    summary: `Import de l'annuaire — ${created} créé(s), ${updated} mis à jour, ${parsed.skipped} ignoré(s)${aiFilled > 0 ? ` · ${aiFilled} wilaya(s) déduite(s) par l'assistant` : ""}${unknownCols.length ? ` · colonnes non reconnues : ${unknownCols.join(", ")}` : ""}`,
  });

  revalidatePath("/medical");
  revalidatePath("/medical/annuaire");

  const parts = [`${created} fiche(s) créée(s)`, `${updated} mise(s) à jour`];
  if (parsed.skipped > 0) parts.push(`${parsed.skipped} ligne(s) sans nom ignorée(s)`);
  if (unknownCols.length) parts.push(`colonne(s) non reconnue(s) : ${unknownCols.join(", ")}`);
  return { ok: true, message: parts.join(" · ") };
}

/** L'échelle de potentiel tient à jour l'ancien champ de priorité (lecteurs hérités). */
const segToPriority: Record<SegmentLevel, Priority> = {
  VERY_HIGH: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", VERY_LOW: "LOW",
};

/**
 * ÉCRITURE D'UNE SEULE CELLULE — l'annuaire édité comme une vraie feuille.
 *
 * Chaque correction (une wilaya, un grade, un numéro) part seule : on clique, on tape, on passe à
 * la cellule suivante. Le champ est validé par le module pur (les menus déroulants n'acceptent que
 * leurs options), la portée est la MÊME que partout ailleurs (`canAccessEntity` — un délégué ne
 * touche que ses praticiens), et le nom d'affichage se recompose quand on change le nom ou le
 * prénom, pour que le reste de l'outil (visites, congrès) reste cohérent.
 */
export async function saveDirectoryCell(input: { id: string; field: string; value: string }): Promise<ActionResult> {
  const user = await requireUser();
  const { id, field, value } = input;
  if (!id) return { ok: false, error: "Fiche introuvable." };
  if (!isAnnuaireField(field)) return { ok: false, error: "Colonne inconnue." };
  if (!(await canAccessEntity(user, "DOCTOR", id, "UPDATE"))) return { ok: false, error: "Non autorisé à modifier cette fiche." };

  const checked = validateAnnuaireValue(field as AnnuaireField, value);
  if (!checked.ok) return { ok: false, error: checked.error };
  const v = checked.value;

  const before = await prisma.medicalDoctor.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  if (!before) return { ok: false, error: "Fiche introuvable." };

  const data: Record<string, unknown> = { updatedById: user.id };
  switch (field as AnnuaireField) {
    case "lastName":
    case "firstName": {
      data[field] = v;
      const first = field === "firstName" ? v : before.firstName;
      const last = field === "lastName" ? v : before.lastName;
      const name = composeDoctorName(first, last);
      if (name) data.name = name; // un nom vide n'écrase pas le libellé existant
      break;
    }
    case "specialty":
      // La saisie libre prend le pas sur le référentiel : ce qu'on tape doit s'afficher.
      data.specialty = v;
      data.specialtyId = null;
      break;
    case "potential":
      data.potential = v;
      data.prescriptionPotential = segToPriority[v as SegmentLevel];
      break;
    default:
      data[field] = v; // address, city, wilaya, postalCode, phone, email, title, sector
  }

  await prisma.medicalDoctor.update({ where: { id }, data });
  revalidatePath("/medical/annuaire");
  revalidatePath("/medical");
  return { ok: true };
}

/**
 * AJOUTER UNE LIGNE — un praticien de plus dans la feuille.
 *
 * Un annuaire vivant se complète à la main, pas seulement par import. On exige au moins un nom
 * (une fiche sans nom n'est pas une fiche) ; le reste se remplit ensuite, cellule par cellule.
 */
export async function addDirectoryDoctor(input: {
  lastName: string; firstName: string; specialty: string; wilaya: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "CREATE")) return { ok: false, error: "Non autorisé à alimenter l'annuaire." };

  const lastName = input.lastName.replace(/\s+/g, " ").trim();
  const firstName = input.firstName.replace(/\s+/g, " ").trim();
  const name = composeDoctorName(firstName, lastName);
  if (!name) return { ok: false, error: "Le nom (ou le prénom) est obligatoire." };

  const wilaya = validateAnnuaireValue("wilaya", input.wilaya);
  if (!wilaya.ok) return { ok: false, error: wilaya.error };
  const specialty = input.specialty.replace(/\s+/g, " ").trim() || null;

  // Un délégué est propriétaire des fiches qu'il crée (portée au niveau ligne).
  const delegateId = user.role === "MEDICAL_DELEGATE" ? user.id : null;
  const companyId = await companyIdForNew(user.id);

  const created = await prisma.medicalDoctor.create({
    data: {
      name, lastName: lastName || null, firstName: firstName || null,
      specialty, wilaya: wilaya.value, delegateId, companyId,
      createdById: user.id, updatedById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Promotion médicale",
    entityType: "DOCTOR", entityId: created.id, summary: `Annuaire — fiche « ${name} »`,
  });
  revalidatePath("/medical/annuaire");
  revalidatePath("/medical");
  return { ok: true, id: created.id };
}

/**
 * SUPPRIMER DES FICHES DE L'ANNUAIRE — une, ou plusieurs d'un coup.
 *
 * Un annuaire se nettoie par lots : des doublons d'import, un cabinet fermé, une liste
 * périmée. Les supprimer une par une, personne ne le fait — on garde alors des fiches fausses,
 * ce qui est pire qu'une fiche manquante.
 *
 * Chaque ligne est revérifiée INDIVIDUELLEMENT : un délégué ne supprime que ses praticiens, et
 * une sélection qui déborde ne supprime que ce qu'elle avait le droit de supprimer — jamais
 * tout ou rien, jamais plus que le droit.
 */
export async function deleteDirectoryDoctors(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "MEDICAL", "DELETE")) {
    return { ok: false, error: "Suppression réservée (droit Supprimer sur l'Annuaire)." };
  }
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { ok: false, error: "Aucune ligne sélectionnée." };

  const allowed: string[] = [];
  for (const id of unique) {
    if (await canAccessEntity(user, "DOCTOR", id, "DELETE")) allowed.push(id);
  }
  if (allowed.length === 0) return { ok: false, error: "Aucune de ces fiches ne vous appartient." };

  const { count } = await prisma.medicalDoctor.deleteMany({ where: { id: { in: allowed } } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Promotion médicale",
    summary: `Annuaire — ${count} fiche(s) supprimée(s)`,
  });
  revalidatePath("/medical/annuaire");
  revalidatePath("/medical");

  const skipped = unique.length - allowed.length;
  return {
    ok: true,
    message: skipped > 0
      ? `${count} fiche(s) supprimée(s) · ${skipped} hors de votre portée, laissée(s) en place`
      : `${count} fiche(s) supprimée(s)`,
  };
}
