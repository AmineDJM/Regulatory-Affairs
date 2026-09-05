/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MESSAGERIE — LA PART PURE, celle que le NAVIGATEUR a le droit d'importer.
 *
 * `messaging.ts` est un module SERVEUR : il lit la base, signe des pièces jointes et, depuis
 * qu'il écrit les messages directs, inscrit des faits au registre — ce qui tire, à dix modules
 * de distance, le push VAPID (`web-push` → `net`, `tls`). Un composant `"use client"` qui
 * l'importait pour un simple libellé de statut faisait échouer le build de production :
 * « Module not found: Can't resolve 'net' ». Le typecheck ne le voit pas, le build en cache
 * non plus ; le serveur de déploiement, lui, part d'un dossier vide et dit non.
 *
 * Ce fichier n'importe RIEN. Il porte la présence, les statuts et l'aperçu — des fonctions et
 * des constantes. `messaging.ts` les réexporte pour le serveur ; les composants client viennent
 * ici, et `client-bundle-guard.test.ts` s'assure qu'ils n'aillent jamais plus loin.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Présence dérivée du dernier battement de cœur (heartbeat) de l'utilisateur. */
export type Presence = "online" | "away" | "offline";

export function presenceOf(lastSeenAt: Date | string | null | undefined): Presence {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 90_000) return "online"; // moins de 1 min 30
  if (diff < 10 * 60_000) return "away"; // moins de 10 min
  return "offline";
}

export const PRESENCE_LABEL: Record<Presence, string> = {
  online: "En ligne",
  away: "Absent",
  offline: "Hors ligne",
};

/** Statut de messagerie choisi manuellement (façon Teams). */
export type ChatStatus = "AVAILABLE" | "BUSY" | "DND" | "BRB" | "AWAY" | "OFFLINE";
export const CHAT_STATUSES: ChatStatus[] = ["AVAILABLE", "BUSY", "DND", "BRB", "AWAY", "OFFLINE"];
export const CHAT_STATUS_LABEL: Record<ChatStatus, string> = {
  AVAILABLE: "Disponible",
  BUSY: "Occupé",
  DND: "Ne pas déranger",
  BRB: "De retour bientôt",
  AWAY: "Absent",
  OFFLINE: "Hors ligne",
};
/** Valide et normalise un statut manuel reçu du client (ou null pour « automatique »). */
export function normalizeChatStatus(raw: string | null | undefined): ChatStatus | null {
  return raw && (CHAT_STATUSES as string[]).includes(raw) ? (raw as ChatStatus) : null;
}

/** Tronque un corps de message pour un aperçu (liste, citation, notification). */
export function preview(body: string, kind: string, hasAttachment: boolean, max = 90): string {
  if (kind === "FILE" || (!body && hasAttachment)) return "📎 Pièce jointe";
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean && hasAttachment) return "📎 Pièce jointe";
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}
