"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { espaceRegulatory, synchroniserDossierDrive, NOM_ESPACE_REGULATORY } from "@/lib/regulatory/drive-dossier";

export interface ResultatRangementDrive {
  ok: boolean;
  error?: string;
  message?: string;
  /** Dossiers traités par CET appel. */
  dossiers?: number;
  dossiersCrees?: number;
  fichiers?: number;
  versions?: number;
  dejaPresents?: number;
  sansFichier?: number;
  /** Reprendre après ce dossier (appel suivant) ; `null` quand tout est fait. */
  curseur?: string | null;
  restants?: number;
}

/** Un appel s'arrête après ce temps : le bouton relance, la suite reprend au curseur. */
const BUDGET_MS = 40_000;

/**
 * « RANGER LES DOSSIERS DANS LE DRIVE » — Super Admin seul (Direction, 06/10).
 *
 * Le rattrapage des dossiers d'avant l'automatisme : chaque dossier du SUIVI (non verrouillé) reçoit
 * son dossier dans la catégorie Drive « Regulatory », organisé comme le modèle, puis toutes ses pièces
 * y sont rangées (par référence au blob : rien n'est recopié). Idempotent — le relancer n'ajoute que ce
 * qui manque. Borné dans le temps : l'écran rappelle l'action avec le curseur rendu jusqu'à la fin.
 */
export async function synchroniserDriveRegulatory(curseur?: string | null): Promise<ResultatRangementDrive> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  if (!(await espaceRegulatory())) {
    return { ok: false, error: `Catégorie Drive « ${NOM_ESPACE_REGULATORY} » introuvable : créez-la dans le Drive (nouvelle catégorie), réglez ses accès, puis relancez.` };
  }
  const depuis = typeof curseur === "string" && curseur ? curseur : null;
  const suivi = (apres: string | null): Prisma.RegulatoryProductWhereInput => ({ isLocked: false, ...(apres ? { id: { gt: apres } } : {}) });

  const debut = Date.now();
  const produits = await prisma.regulatoryProduct.findMany({ where: suivi(depuis), select: { id: true }, orderBy: { id: "asc" }, take: 500 });
  const total = { dossiers: 0, dossiersCrees: 0, fichiers: 0, versions: 0, dejaPresents: 0, sansFichier: 0 };
  let dernier = depuis;
  for (const p of produits) {
    if (total.dossiers > 0 && Date.now() - debut > BUDGET_MS) break;
    try {
      const r = await synchroniserDossierDrive(p.id, user.id);
      total.dossiers++;
      if (r.dossier.ok && r.dossier.cree) total.dossiersCrees++;
      total.fichiers += r.pieces.fichiersAjoutes;
      total.versions += r.pieces.versionsAjoutees;
      total.dejaPresents += r.pieces.dejaPresents;
      total.sansFichier += r.pieces.sansFichier;
    } catch (e) {
      console.error("[drive regulatory] rattrapage : dossier non rangé", { id: p.id }, e);
    }
    dernier = p.id;
  }
  const restants = await prisma.regulatoryProduct.count({ where: suivi(dernier) });

  if (total.dossiersCrees + total.fichiers + total.versions > 0) {
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: "*",
      summary: `Drive « ${NOM_ESPACE_REGULATORY} » : ${total.dossiersCrees} dossier(s) produit créé(s), ${total.fichiers} fichier(s) et ${total.versions} version(s) rangé(s) (${total.dossiers} dossier(s) parcourus)`,
    }).catch((e) => console.error("[drive regulatory] audit du rattrapage (non bloquant)", e));
  }
  revalidatePath("/drive");
  revalidatePath("/regulatory");

  const message = `${total.dossiers} dossier(s) parcouru(s) : ${total.dossiersCrees} dossier(s) Drive créé(s), ${total.fichiers} fichier(s) rangé(s)`
    + `${total.versions ? `, ${total.versions} nouvelle(s) version(s)` : ""}, ${total.dejaPresents} déjà en place`
    + `${total.sansFichier ? `, ${total.sansFichier} pièce(s) sans fichier stocké` : ""}.`
    + `${restants ? ` ${restants} dossier(s) restant(s).` : " Les dossiers verrouillés (pipeline) n'y entrent qu'à l'ouverture du cadenas."}`;
  return { ok: true, ...total, curseur: restants > 0 ? dernier : null, restants, message };
}
