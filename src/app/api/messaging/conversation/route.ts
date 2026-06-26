import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getConversationDetail } from "@/lib/queries/messaging";

export const dynamic = "force-dynamic";

/** Détail complet d'une conversation (en-tête, membres, réglages, messages) à l'ouverture. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ ok: false }, { status: 401 });
  if (!userCan(user, "MESSAGING", "VIEW")) return NextResponse.json({ ok: false }, { status: 403 });

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ ok: false }, { status: 400 });

  const detail = await getConversationDetail(user.id, conversationId);
  if (!detail) return NextResponse.json({ ok: false }, { status: 403 });

  return NextResponse.json({ ok: true, detail }, { headers: { "Cache-Control": "private, no-store" } });
}
