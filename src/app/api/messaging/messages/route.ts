import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { touchPresence } from "@/lib/messaging";
import { getThreadRefresh } from "@/lib/queries/messaging";
import { getTyping } from "@/lib/messaging-typing";

export const dynamic = "force-dynamic";

/** Rafraîchissement du fil actif (messages + présence + « en train d'écrire »). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ ok: false }, { status: 401 });
  if (!userCan(user, "MESSAGING", "VIEW")) return NextResponse.json({ ok: false }, { status: 403 });

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ ok: false }, { status: 400 });

  await touchPresence(user.id);
  const refresh = await getThreadRefresh(user.id, conversationId);
  if (!refresh.ok) return NextResponse.json({ ok: false }, { status: 403 });

  return NextResponse.json(
    { ...refresh, typing: getTyping(conversationId, user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
