import { NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/api/openapi";

/**
 * La spécification, servie par l'application elle-même — donc toujours celle des routes qui
 * tournent. Publique et sans clé : une spécification est faite pour être lue AVANT d'avoir une
 * clé, et elle ne contient aucune donnée d'entreprise.
 */
export function GET(req: Request) {
  const base = new URL(req.url).origin;
  return NextResponse.json(buildOpenApi(base), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
