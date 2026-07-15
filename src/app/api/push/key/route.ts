import { NextResponse } from "next/server";
import { vapidPublicKey, pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Clé publique VAPID (non secrète) + état d'activation, pour l'abonnement client. */
export async function GET() {
  const [enabled, publicKey] = await Promise.all([pushConfigured(), vapidPublicKey()]);
  return NextResponse.json({ enabled, publicKey });
}
