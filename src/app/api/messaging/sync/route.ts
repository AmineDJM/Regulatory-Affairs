import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { touchPresence } from "@/lib/messaging";
import { getSync } from "@/lib/queries/messaging";
import { runScheduledJobs } from "@/lib/scheduled";

export const dynamic = "force-dynamic";

/** Polling de la liste des conversations + badge de non-lus, et heartbeat de présence. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 200 });
  if (!userCan(user, "MESSAGING", "VIEW")) return NextResponse.json({ conversations: [], totalUnread: 0 }, { status: 200 });

  // Tâches périodiques (rappels de réunion…) — débouncées à 1×/min, sans cron externe.
  void runScheduledJobs();

  await touchPresence(user.id);
  const payload = await getSync(user.id);
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
