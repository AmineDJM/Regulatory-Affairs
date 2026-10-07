import { scriptAudience } from "@/lib/site-web/audience-script";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * LE SCRIPT DE MESURE D'AUDIENCE que le site public inclut (Direction, 07/10) :
 *
 *   <script src="https://<ERP>/api/site-web/v1/audience.js" defer></script>
 *
 * Public et statique : il ne lit rien, n'écrit rien. Mis en cache une heure.
 */
export async function GET(request: Request) {
  const repli = `${new URL(request.url).origin}/api/site-web/v1/audience`;
  return new Response(scriptAudience(repli), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
