import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { makeEvent, coalesce, EVENT_KINDS, type EventKind, type CapturedEvent } from "@/lib/replay/capture";

const NO_CONTENT = new NextResponse(null, { status: 204 });

/** Un lot raisonnable : au-delà, c'est un client qui déraille, pas une session de travail. */
const MAX_BATCH = 200;

/**
 * RÉCEPTION DES ÉVÉNEMENTS DE REJEU.
 *
 * Le navigateur envoie de petits lots (balise `sendBeacon`), l'utilisateur ne les attend jamais :
 * la route répond `204` quoi qu'il arrive. Un rejeu qui ferait échouer une page serait pire que
 * l'absence de rejeu.
 *
 * ⚠️ LE MASQUAGE EST REFAIT ICI, côté serveur. Le client masque déjà, mais on ne fait jamais
 * confiance à ce qui arrive du navigateur : un client modifié pourrait poster n'importe quoi, et
 * ce n'importe quoi serait relu par le support. `makeEvent` est la seule porte d'entrée.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NO_CONTENT;

  let body: { sessionId?: string; events?: unknown[] } = {};
  try {
    body = JSON.parse((await req.text()) || "{}");
  } catch {
    return NO_CONTENT;
  }

  const sessionId = String(body.sessionId ?? "").slice(0, 80);
  if (!sessionId || !Array.isArray(body.events) || body.events.length === 0) return NO_CONTENT;

  const clean: CapturedEvent[] = [];
  for (const raw of body.events.slice(0, MAX_BATCH)) {
    const e = raw as Record<string, unknown>;
    const kind = String(e.kind ?? "");
    if (!(EVENT_KINDS as readonly string[]).includes(kind)) continue;
    const made = makeEvent({
      kind: kind as EventKind,
      at: Number(e.at ?? 0),
      path: String(e.path ?? ""),
      label: e.label == null ? null : String(e.label),
      name: e.name == null ? null : String(e.name),
      type: e.type == null ? null : String(e.type),
      detail: e.detail == null ? null : String(e.detail),
    });
    if (made) clean.push(made);
  }
  if (clean.length === 0) return NO_CONTENT;

  await prisma.sessionEvent
    .createMany({
      data: coalesce(clean).map((e) => ({
        sessionId, userId: session.user.id,
        kind: e.kind, at: e.at, path: e.path, label: e.label, detail: e.detail,
      })),
    })
    // Le rejeu est un confort d'exploitation : il ne doit jamais faire échouer quoi que ce soit.
    .catch((err: unknown) => console.error("[replay] écriture impossible", err instanceof Error ? err.name : typeof err));

  return NO_CONTENT;
}
