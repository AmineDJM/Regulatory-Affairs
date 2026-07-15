import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Compteur de notifications non lues — sondé côté client pour la sonnerie de rappel. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ unread: 0 }, { status: 200 });
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });
}
