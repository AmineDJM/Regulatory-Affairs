"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { lireQuantite } from "@/lib/besoins-services/regles";
import { droitBesoin, ecrireBesoin } from "@/lib/besoins-services/service";

/**
 * LES BESOINS ANNUELS DES SERVICES, depuis le Marketing cockpit (« Prévisions des services ») — saisir ou corriger le
 * besoin qu'un décideur a annoncé, le retirer. Le KAM le fait aussi depuis son rapport de visite (`rapporterVisite`).
 *
 * Le service se DÉDUIT du décideur (son établissement, son service dans l'annuaire) : on ne choisit pas un service à la
 * main, on choisit qui l'a annoncé. Droit : `droitBesoin` — la Direction Marketing, le chef de produit et la Direction
 * pour tous ; le KAM pour les décideurs de son panel.
 */

const PATH = "/marketing-cockpit";
const REFUS = "Saisir un besoin est réservé à la Direction Marketing, au chef de produit, à la Direction, et au KAM pour les décideurs de son panel.";

export async function enregistrerBesoinService(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const q = lireQuantite(fdStr(formData, "quantite"));
  if (!q.ok) return { ok: false, error: q.error };
  if (q.valeur === null) return { ok: false, error: "Indiquez le nombre de boîtes annoncé." };
  const note = fdStr(formData, "note");

  // CORRIGER UNE LIGNE EXISTANTE : la quantité et la note — le service, le produit et l'année restent.
  if (id) {
    const l = await prisma.besoinAnnuelService.findUnique({ where: { id }, select: { id: true, decideurId: true, productId: true, institutionId: true, serviceId: true, annee: true } });
    if (!l) return { ok: false, error: "Ligne introuvable — rechargez l'écran." };
    if (!(await droitBesoin(user, l.decideurId))) return { ok: false, error: REFUS };
    await prisma.$transaction((tx) => ecrireBesoin(tx, { ...l, quantite: q.valeur!, note: note ?? null, auteurId: user.id }));
    await recordAudit({ actorId: user.id, action: "UPDATE", module: "Marketing cockpit", summary: `Besoin annuel ${l.annee} corrigé : ${q.valeur} boîtes` });
    revalidatePath(PATH);
    return { ok: true, id: l.id };
  }

  const productId = fdStr(formData, "productId");
  const decideurId = fdStr(formData, "decideurId");
  const annee = Number(fdStr(formData, "annee"));
  if (!productId) return { ok: false, error: "Choisissez le produit." };
  if (!decideurId) return { ok: false, error: "Choisissez le décideur qui a annoncé ce besoin." };
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) return { ok: false, error: "Année invalide." };
  const [produit, doc] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { id: true, canonicalName: true } }),
    prisma.medicalDoctor.findUnique({ where: { id: decideurId }, select: { id: true, name: true, institutionId: true, serviceId: true } }),
  ]);
  if (!produit) return { ok: false, error: "Produit introuvable." };
  if (!doc) return { ok: false, error: "Praticien introuvable." };
  if (!doc.institutionId) return { ok: false, error: `${doc.name} n'est rattaché à aucun établissement dans l'annuaire : le besoin n'a pas de service où se ranger.` };
  if (!(await droitBesoin(user, doc.id))) return { ok: false, error: REFUS };

  const ligneId = await prisma.$transaction((tx) => ecrireBesoin(tx, {
    productId, institutionId: doc.institutionId!, serviceId: doc.serviceId ?? null, annee, quantite: q.valeur!,
    decideurId: doc.id, note: note ?? null, auteurId: user.id,
  }));
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Marketing cockpit",
    summary: `Besoin annuel ${annee} — ${produit.canonicalName} : ${q.valeur} boîtes (annoncé par ${doc.name})`,
  });
  revalidatePath(PATH);
  return { ok: true, id: ligneId };
}

export async function retirerBesoinService(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const l = await prisma.besoinAnnuelService.findUnique({ where: { id }, select: { id: true, decideurId: true, annee: true, quantite: true } });
  if (!l) return { ok: false, error: "Ligne introuvable — rechargez l'écran." };
  if (!(await droitBesoin(user, l.decideurId))) return { ok: false, error: REFUS };
  await prisma.besoinAnnuelService.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Marketing cockpit", summary: `Besoin annuel ${l.annee} retiré (${l.quantite} boîtes)` });
  revalidatePath(PATH);
  return { ok: true };
}
