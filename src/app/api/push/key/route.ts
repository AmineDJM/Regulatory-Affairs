import { NextResponse } from "next/server";
import { vapidPublicKey, pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Clé publique VAPID (non secrète) + état d'activation, pour l'abonnement client. */
export async function GET() {
  return NextResponse.json({ enabled: pushConfigured(), publicKey: vapidPublicKey() });
}
