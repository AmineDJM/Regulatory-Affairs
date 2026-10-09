import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { reécriteLienNotification } from "@/lib/notifications/lien-actuel";

export const dynamic = "force-dynamic";

/**
 * Compteur de notifications non lues (sonnerie de rappel) + notifications **pop-up** non lues
 * (grande fenêtre centrée) à afficher / accuser réception. Sondé côté client.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ unread: 0, popups: [] }, { status: 200 });

  const [unread, popups] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.notification.findMany({
      where: { userId: user.id, isRead: false, popup: true },
      select: { id: true, title: true, body: true, link: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  // Le lien ACTUEL : une pop-up d'hier peut porter l'adresse d'un module déplacé depuis.
  const aJour = popups.map((p) => ({ ...p, link: reécriteLienNotification(p.link) }));
  return NextResponse.json({ unread, popups: aJour }, { headers: { "Cache-Control": "private, no-store" } });
}
