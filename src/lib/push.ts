import webpush from "web-push";
import { prisma } from "./prisma";

/**
 * Notifications **push** (Web Push / PWA) — serveur uniquement.
 *
 * **Inerte** tant que `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` ne sont pas définis
 * (comme OnlyOffice) : aucune erreur, on n'envoie simplement rien. La clé privée
 * n'est jamais exposée au navigateur ; la clé publique est servie via `/api/push/key`.
 */

function keys() {
  return { pub: process.env.VAPID_PUBLIC_KEY || "", priv: process.env.VAPID_PRIVATE_KEY || "" };
}

export function pushConfigured(): boolean {
  const { pub, priv } = keys();
  return Boolean(pub && priv);
}
export function vapidPublicKey(): string {
  return keys().pub;
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!pushConfigured()) return false;
  if (!vapidReady) {
    const { pub, priv } = keys();
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@adventum.dz", pub, priv);
    vapidReady = true;
  }
  return true;
}

export interface PushPayload { title: string; body?: string; url?: string }

/** Pousse une notification à tous les appareils d'un utilisateur (best-effort). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapid()) return;
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;
    const data = JSON.stringify({ title: payload.title, body: payload.body ?? "", url: payload.url ?? "/" });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
        } catch (e) {
          // 404 / 410 = abonnement expiré → on le supprime.
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }),
    );
  } catch (err) {
    console.error("[push] send failed", err);
  }
}
