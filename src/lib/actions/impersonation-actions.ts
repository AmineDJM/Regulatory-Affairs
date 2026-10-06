"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { poserVueExacte, effacerVueExacte } from "@/lib/vue-exacte";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Démarre la « Vue exacte » : le Super Admin visualise l'OS comme l'utilisateur
 * cible. On lit la session RÉELLE via auth() (le JWT), jamais la session
 * éventuellement déjà impersonifiée.
 */
export async function startImpersonation(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const targetId = fdStr(formData, "userId");
  if (!targetId) return { ok: false, error: "Utilisateur manquant." };
  if (targetId === session.user.id) return { ok: false, error: "Vous êtes déjà connecté avec ce compte." };

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true, isActive: true } });
  if (!target || !target.isActive) return { ok: false, error: "Utilisateur introuvable ou inactif." };

  // Cookie de la vue + témoin lu par l'écran, posés ensemble (`vue-exacte.ts`) : un autre onglet ouvert
  // se recharge en entier au lieu de mêler deux personnes (`GardeIdentite`).
  poserVueExacte(targetId);
  await recordAudit({
    actorId: session.user.id, action: "LOGIN", module: "Administration",
    summary: `Vue exacte démarrée — ${target.name}`,
  });
  // PAS DE `redirect()` ICI (Direction, 06/10 : « je prends la peau de Leila, et c'est toujours Amine Djouamai qui
  // s'affiche en haut ; je dois tout rafraîchir ») : une redirection d'action est une navigation DOUCE — Next ne
  // recharge que la page, et garde la coque (barre du haut, menu, bandeau) rendue pour l'administrateur. Le bouton
  // recharge donc la page ENTIÈRE (`window.location`), coque comprise, rendue pour la personne visualisée.
  return { ok: true, message: "/mon-espace" };
}

/** Quitte la « Vue exacte ». Même raison : le bouton recharge toute la page (la coque redevient celle de l'administrateur). */
export async function stopImpersonation(): Promise<ActionResult> {
  const session = await auth();
  effacerVueExacte();
  if (session?.user?.id) {
    await recordAudit({ actorId: session.user.id, action: "LOGOUT", module: "Administration", summary: "Vue exacte terminée" });
  }
  return { ok: true, message: "/admin" };
}
