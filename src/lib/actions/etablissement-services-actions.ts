"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { peutAnnuaire } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { cleDeService, lireNomsDeServices, nomDeService, LONGUEUR_MAX_SERVICE, SERVICES_MAX_PAR_AJOUT } from "@/lib/annuaires/services";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SERVICES D'UN ÉTABLISSEMENT — ajouter, renommer, supprimer (§118.172).
 *
 * « Pour chaque établissement hospitalier, on doit pouvoir renseigner les services qu'il a,
 * ajouter ou supprimer ces services » (décision de la Direction, 01/10).
 *
 * ── LA PORTE ────────────────────────────────────────────────────────────────────────────────
 *
 * Les services FONT PARTIE de l'établissement : les tenir, c'est MODIFIER l'établissement — la
 * porte est celle de la modification de l'annuaire des établissements (`peutAnnuaire(…,
 * "UPDATE")`), la même que l'écran. Pas de porte à part pour la suppression : retirer un service
 * ne supprime ni l'hôpital ni ses praticiens, et une seconde règle aurait fini par diverger de la
 * première (§118.5).
 *
 * ── CE QUE LA SUPPRESSION EMPORTE ───────────────────────────────────────────────────────────
 *
 * Les praticiens du service RESTENT, rattachés à l'établissement, sans service (`SetNull`). Les
 * secteurs qui le choisissaient nommément le perdent (cascade) — un lien qui n'a plus aucun
 * service ne s'élargit jamais en « tous les services » (`annuaires/services.ts`). Les deux comptes
 * sont rendus dans la phrase, et l'écran les montre AVANT le clic.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const CHEMINS = ["/annuaires/etablissements", "/annuaires/medecins", "/annuaires/pharmaciens", "/medical", "/planning/business-units"];
const rafraichir = () => { for (const c of CHEMINS) revalidatePath(c); };

const estDoublon = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * AJOUTER UN OU PLUSIEURS SERVICES — une liste collée (« Cardiologie, Oncologie ; Pneumologie »,
 * ou une par ligne) se lit d'un trait. Ce qui existe déjà est DIT et laissé tel quel ; rien n'est
 * coupé en silence.
 */
export async function ajouterServicesEtablissement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutAnnuaire(user, "ETABLISSEMENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const institutionId = fdStr(formData, "institutionId");
  if (!institutionId) return { ok: false, error: "Établissement introuvable." };
  const etablissement = await prisma.medicalInstitution.findUnique({
    where: { id: institutionId },
    select: { name: true, services: { select: { name: true } } },
  });
  if (!etablissement) return { ok: false, error: "Établissement introuvable." };

  const lus = lireNomsDeServices(fdStr(formData, "noms") ?? "");
  if (lus.tropLongs.length > 0) {
    return { ok: false, error: `Un nom de service tient en ${LONGUEUR_MAX_SERVICE} caractères au plus : « ${lus.tropLongs[0].slice(0, 40)}… » est trop long.` };
  }
  if (lus.noms.length === 0) return { ok: false, error: "Écrivez le nom du service à ajouter (plusieurs : séparez-les par des virgules ou des retours à la ligne)." };
  if (lus.noms.length > SERVICES_MAX_PAR_AJOUT) {
    return { ok: false, error: `${lus.noms.length} services d'un coup : c'est plus que les ${SERVICES_MAX_PAR_AJOUT} qu'un ajout accepte — vérifiez la liste collée.` };
  }

  // CE QUI EXISTE DÉJÀ, sans égard à la casse ni aux accents : on ne le recrée pas.
  const existants = new Map(etablissement.services.map((s) => [cleDeService(s.name), s.name]));
  const nouveaux = lus.noms.filter((n) => !existants.has(cleDeService(n)));
  const dejaLa = lus.noms.filter((n) => existants.has(cleDeService(n))).map((n) => existants.get(cleDeService(n))!);

  // `skipDuplicates` couvre la course de deux ajouts simultanés : l'index d'unicité (insensible à
  // la casse) refuse le second, et rien ne casse.
  const cree = nouveaux.length > 0
    ? await prisma.medicalInstitutionService.createMany({
        data: nouveaux.map((name) => ({ institutionId, name, createdById: user.id })),
        skipDuplicates: true,
      })
    : { count: 0 };

  if (cree.count > 0) {
    await recordAudit({
      actorId: user.id, action: "CREATE", module: "Annuaires",
      summary: `Établissement « ${etablissement.name} » — ${cree.count} service(s) ajouté(s) : ${nouveaux.slice(0, 8).join(", ")}${nouveaux.length > 8 ? "…" : ""}`,
    });
    rafraichir();
  }
  const phrases = [
    cree.count > 0 ? `${cree.count} service(s) ajouté(s) à « ${etablissement.name} ».` : `Aucun service ajouté à « ${etablissement.name} ».`,
    dejaLa.length > 0 ? `Déjà présent(s) : ${dejaLa.join(", ")}.` : null,
    lus.repetes.length > 0 ? `Répété(s) dans la saisie, ajouté(s) une fois : ${lus.repetes.join(", ")}.` : null,
    cree.count < nouveaux.length ? `${nouveaux.length - cree.count} venaient d'être ajouté(s) par quelqu'un d'autre.` : null,
  ].filter(Boolean);
  return { ok: true, message: phrases.join(" ") };
}

/** RENOMMER UN SERVICE — ses praticiens et ses secteurs le suivent : c'est la même ligne. */
export async function renommerServiceEtablissement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutAnnuaire(user, "ETABLISSEMENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Service introuvable." };
  const nom = nomDeService(fdStr(formData, "name") ?? "");
  if (nom === null) return { ok: false, error: "Le nom du service ne peut pas être vide." };
  if (nom.length > LONGUEUR_MAX_SERVICE) return { ok: false, error: `Un nom de service tient en ${LONGUEUR_MAX_SERVICE} caractères au plus.` };
  const service = await prisma.medicalInstitutionService.findUnique({
    where: { id },
    select: { name: true, institutionId: true, institution: { select: { name: true, services: { select: { id: true, name: true } } } } },
  });
  if (!service) return { ok: false, error: "Service introuvable." };
  if (service.name === nom) return { ok: true, message: "Nom inchangé." };
  const homonyme = service.institution.services.find((s) => s.id !== id && cleDeService(s.name) === cleDeService(nom));
  if (homonyme) return { ok: false, error: `« ${service.institution.name} » a déjà un service « ${homonyme.name} ».` };
  try {
    await prisma.medicalInstitutionService.update({ where: { id }, data: { name: nom } });
  } catch (e) {
    if (estDoublon(e)) return { ok: false, error: `« ${service.institution.name} » a déjà un service « ${nom} ».` };
    throw e;
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Annuaires",
    summary: `Établissement « ${service.institution.name} » — service « ${service.name} » renommé « ${nom} »`,
  });
  rafraichir();
  return { ok: true, message: `Service renommé « ${nom} ».` };
}

/**
 * SUPPRIMER UN SERVICE. Les praticiens restent (sans service), les secteurs qui le choisissaient
 * le perdent — la phrase dit combien, l'écran l'a dit avant le clic.
 */
export async function supprimerServiceEtablissement(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutAnnuaire(user, "ETABLISSEMENTS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Service introuvable." };
  const service = await prisma.medicalInstitutionService.findUnique({
    where: { id },
    select: { name: true, institution: { select: { name: true } }, _count: { select: { doctors: true, secteurs: true } } },
  });
  if (!service) return { ok: false, error: "Ce service n'existe plus." };
  await prisma.medicalInstitutionService.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Annuaires",
    summary: `Établissement « ${service.institution.name} » — service « ${service.name} » supprimé `
      + `(${service._count.doctors} praticien(s) sans service, ${service._count.secteurs} secteur(s) le perdent)`,
  });
  rafraichir();
  const suites = [
    service._count.doctors > 0 ? `${service._count.doctors} praticien(s) restent rattachés à l'établissement, sans service` : null,
    service._count.secteurs > 0 ? `${service._count.secteurs} secteur(s) ne le couvrent plus` : null,
  ].filter(Boolean);
  return { ok: true, message: `Service « ${service.name} » supprimé${suites.length ? ` — ${suites.join(" ; ")}` : ""}.` };
}
