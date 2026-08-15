"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { readDirectoryWorkbook } from "@/lib/medical/directory-workbook";
import { parseDirectorySheet, type DirectoryImportRow } from "@/lib/medical/directory-sheet";
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
    summary: `Import de l'annuaire — ${created} créé(s), ${updated} mis à jour, ${parsed.skipped} ignoré(s)${unknownCols.length ? ` · colonnes non reconnues : ${unknownCols.join(", ")}` : ""}`,
  });

  revalidatePath("/medical");
  revalidatePath("/medical/annuaire");

  const parts = [`${created} fiche(s) créée(s)`, `${updated} mise(s) à jour`];
  if (parsed.skipped > 0) parts.push(`${parsed.skipped} ligne(s) sans nom ignorée(s)`);
  if (unknownCols.length) parts.push(`colonne(s) non reconnue(s) : ${unknownCols.join(", ")}`);
  return { ok: true, message: parts.join(" · ") };
}
