import { prisma } from "@/lib/prisma";
import { clausePanelDuKam } from "@/lib/rbac";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES PANELS DE PLUSIEURS KAM, ET QUI COUVRE UN PRATICIEN — par la MÊME clause (§118.179).
 *
 * Le panel d'un KAM s'écrit UNE fois (`clausePanelDuKam`, `rbac.ts`) : secteur ∪ rattachement.
 * Ce module ne le réécrit pas en mémoire — une seconde écriture de la règle (un `lienCouvre` d'un
 * côté, une clause de l'autre) divergerait sur le premier cas que personne n'a pensé à tester, et
 * le cockpit compterait un panel que la fiche n'ouvre pas. Il pose donc la clause, KAM par KAM.
 *
 * Le coût est borné et dit : une requête par KAM, en parallèle — une force de vente se compte en
 * dizaines, pas en milliers. Si elle passait la centaine, c'est ici, et ici seulement, qu'il
 * faudrait regrouper.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PraticienDuPanel {
  id: string;
  potential: string;
}

/** Le panel de chaque KAM demandé — une entrée par KAM, vide quand il n'a personne. */
export async function panelsDesKams(repIds: readonly string[]): Promise<Map<string, PraticienDuPanel[]>> {
  const ids = [...new Set(repIds)];
  const lus = await Promise.all(ids.map((repId) =>
    prisma.medicalDoctor.findMany({ where: clausePanelDuKam(repId), select: { id: true, potential: true } })));
  return new Map(ids.map((repId, i) => [repId, lus[i].map((d) => ({ id: d.id, potential: String(d.potential) }))]));
}

export interface KamQuiCouvre {
  id: string;
  name: string;
}

/**
 * QUI COUVRE CES PRATICIENS — les KAM dont le panel les contient, par la clause du panel.
 *
 * Les candidats sont les personnes affectées à un secteur ACTIF (un KAM sans secteur ne couvre
 * que ses rattachés, que l'appelant connaît déjà par `delegateId`), comptes actifs seulement :
 * on ne nomme pas, et on ne prévient pas, quelqu'un qui a quitté l'entreprise.
 */
export async function kamsQuiCouvrent(doctorIds: readonly string[]): Promise<Map<string, KamQuiCouvre[]>> {
  const out = new Map<string, KamQuiCouvre[]>(doctorIds.map((id) => [id, []]));
  if (doctorIds.length === 0) return out;
  const affectes = await prisma.salesSectorRep.findMany({
    where: { sector: { isActive: true }, rep: { isActive: true } },
    select: { rep: { select: { id: true, name: true } } },
    distinct: ["repId"],
  });
  const lus = await Promise.all(affectes.map((a) =>
    prisma.medicalDoctor.findMany({ where: { AND: [{ id: { in: [...doctorIds] } }, clausePanelDuKam(a.rep.id)] }, select: { id: true } })));
  affectes.forEach((a, i) => {
    for (const d of lus[i]) out.get(d.id)?.push({ id: a.rep.id, name: a.rep.name });
  });
  for (const liste of out.values()) liste.sort((x, y) => x.name.localeCompare(y.name, "fr"));
  return out;
}
