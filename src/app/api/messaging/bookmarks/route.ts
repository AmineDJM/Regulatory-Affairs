import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getBookmarks } from "@/lib/queries/messaging";

export const dynamic = "force-dynamic";

/** Messages enregistrés (favoris) de l'utilisateur. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "MESSAGING", "VIEW")) return NextResponse.json({ bookmarks: [] }, { status: 200 });
  const bookmarks = await getBookmarks(user.id);
  return NextResponse.json({ bookmarks }, { headers: { "Cache-Control": "private, no-store" } });
}
