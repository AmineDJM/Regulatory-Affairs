import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessConversation } from "@/lib/messaging";
import { setTyping } from "@/lib/messaging-typing";

export const dynamic = "force-dynamic";

const NO_CONTENT = new NextResponse(null, { status: 204 });

/** Signale que l'utilisateur est en train d'écrire dans une conversation. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !userCan(user, "MESSAGING", "CREATE")) return NO_CONTENT;

  let conversationId: string | null = null;
  try {
    const body = JSON.parse((await req.text()) || "{}");
    conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  } catch {
    return NO_CONTENT;
  }
  if (!conversationId) return NO_CONTENT;
  if (!(await canAccessConversation(user.id, conversationId))) return NO_CONTENT;

  setTyping(conversationId, user.id);
  return NO_CONTENT;
}
