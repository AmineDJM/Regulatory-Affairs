import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { runStorageSelfTest } from "@/lib/storage/self-test";

export const dynamic = "force-dynamic";

/**
 * TEST DE CONNEXION AU STOCKAGE OBJET — Super Admin uniquement.
 *
 * En POST, et réservé à l'administration : le test ÉCRIT dans le bucket (puis efface). Ce n'est
 * pas une lecture inoffensive qu'on laisse déclencher par un lien visité au hasard.
 *
 * La réponse ne contient aucun secret — `runStorageSelfTest` ne rend que l'hôte, le bucket et la
 * région. Le journal d'audit garde la trace de qui a lancé le test et de son issue.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!userCan(user, "ADMIN", "UPDATE")) return NextResponse.json({ error: "Réservé au Super Admin." }, { status: 403 });

  const report = await runStorageSelfTest();

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Administration",
    summary: `Test du stockage objet — ${report.ok ? "réussi" : "échoué"} (${report.config.provider}, bucket « ${report.config.bucket || "—"} »)`,
  });

  return NextResponse.json(report, { status: 200, headers: { "Cache-Control": "no-store" } });
}
