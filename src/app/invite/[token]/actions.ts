"use server";

import { redeemInvite } from "@/lib/user-invites";

/**
 * Action PUBLIQUE (pas de session) : le token à usage unique est l'autorisation. Toute la
 * vérification (existence, expiration, unicité de l'usage, force du mot de passe) vit dans
 * `redeemInvite` — rejouable sans effet une fois le lien consommé.
 */
export async function redeemInviteAction(token: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (typeof token !== "string" || token.length < 10 || typeof password !== "string") {
      return { ok: false, error: "Lien invalide." };
    }
    return await redeemInvite(token, password);
  } catch (err) {
    console.error("[invite] redeemInviteAction failed", err);
    return { ok: false, error: "Impossible d'enregistrer le mot de passe. Réessayez." };
  }
}
