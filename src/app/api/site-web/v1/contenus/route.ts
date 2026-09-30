import { NextResponse } from "next/server";
import { authentifierLeSite } from "@/lib/site-web/entrant";
import { reveillerFile } from "@/lib/site-web/file";
import { voulusDepuisLaBase } from "@/lib/site-web/contenus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * CE QUE L'ERP VEUT QUE LE SITE DÉTIENNE (§118.159) — relu par le SITE à son démarrage.
 *
 * Un site hébergé sans disque persistant perd tout ce qu'on lui a poussé à chaque redémarrage (et
 * le plan gratuit de Render redémarre à chaque mise en veille). Il se RECHARGE donc lui-même ici :
 * les mêmes corps que ceux que la file lui envoie (`corpsOffre`, `corpsArticle`), recalculés depuis
 * les contenus — jamais relus dans la file. Un contenu que le contrat du site refuserait n'y figure
 * pas ; une suppression non plus : on ne donne au site que ce qu'il doit AVOIR.
 *
 * Authentifié par la clé du site (`authentifierLeSite`), hors session — voir `auth.config.ts`.
 */
export async function GET(request: Request) {
  const auth = await authentifierLeSite(request.headers, null);
  if (!auth.ok) return NextResponse.json({ error: auth.erreur }, { status: auth.statut });
  // Le site vient d'employer la clé EN ATTENTE : il l'a donc, et elle est désormais active. Les
  // envois qui attendaient (ou que l'ancienne clé faisait refuser) repartent sans attendre.
  if (auth.source === "ATTENTE_PROMUE") reveillerFile(0);

  const voulus = await voulusDepuisLaBase();
  const jobs = voulus
    .filter((v) => v.nature === "JOB" && v.operation === "PUT" && v.corps)
    .map((v) => ({ externalId: v.externalId, ...v.corps }));
  const posts = voulus
    .filter((v) => v.nature === "POST" && v.operation === "PUT" && v.corps)
    .map((v) => ({ externalId: v.externalId, ...v.corps }));
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), count: jobs.length + posts.length, jobs, posts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
