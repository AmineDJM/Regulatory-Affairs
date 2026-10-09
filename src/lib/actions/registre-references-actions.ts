"use server";

import { requireUser } from "@/lib/session";
import { fdStr } from "@/lib/actions/types";
import { anneeDuRegistre, registreDe, verifierReferenceLibre } from "@/lib/references/registre-serveur";

/**
 * LE REGISTRE COMMUN DES RÉFÉRENCES NNN/DG/AAAA (Direction, 10/2026) — la vérification EN DIRECT du champ « Référence » des
 * formulaires de génération (bon de commande, ordre de mission, demande de devis, pièce de la fabrique) : bon format, bonne
 * année, numéro encore libre pour la société — tous documents confondus. Lecture seule : rien n'est réservé ; la génération
 * revérifie sous verrou au moment d'attribuer.
 */
export type VerificationReference = { ok: true; reference: string | null } | { ok: false; error: string };

export async function verifierReferenceRegistre(formData: FormData): Promise<VerificationReference> {
  await requireUser();
  const societeId = fdStr(formData, "societeId");
  const saisie = fdStr(formData, "reference");
  if (!societeId) return { ok: false, error: "Société non précisée." };
  if (!saisie) return { ok: false, error: "La référence est obligatoire." };
  // L'année du DOCUMENT quand le formulaire la donne (une pièce de la fabrique datée), sinon l'année en cours.
  const voulue = Number(fdStr(formData, "annee"));
  const annee = Number.isInteger(voulue) && voulue >= 2000 && voulue <= 2100 ? voulue : anneeDuRegistre();
  // Une société hors registre garde sa numérotation : rien à vérifier ici.
  if (!(await registreDe(societeId, annee)).actif) return { ok: true, reference: null };
  const r = await verifierReferenceLibre(societeId, saisie, annee);
  return r.ok ? { ok: true, reference: r.reference } : { ok: false, error: r.motif };
}
