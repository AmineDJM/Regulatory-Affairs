import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { touchPresence } from "@/lib/messaging";
import { getSync } from "@/lib/queries/messaging";

export const dynamic = "force-dynamic";

/** Polling de la liste des conversations + badge de non-lus, et heartbeat de présence. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 200 });
  if (!userCan(user, "MESSAGING", "VIEW")) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 200 });

  await touchPresence(user.id);
  const payload = await getSync(user.id);
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
