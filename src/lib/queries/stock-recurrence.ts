import { prisma } from "@/lib/prisma";
import { decrireRecurrence, type StatutRecurrence } from "@/lib/stocks/recurrence";
import { estRecurrenceStock } from "@/lib/stocks/recurrence";
import type { Recurrence } from "@/lib/scheduler/contract";

/**
 * LES RÉCURRENCES DE DEMANDE D'ÉTAT DE STOCK, telles que l'écran les lit.
 *
 * `cadence` est la MÊME phrase que celle du formulaire (`decrireRecurrence`) : deux façons de
 * dire « tous les lundis à 8 h » finiraient par ne pas dire la même chose, et la personne ne
 * saurait plus laquelle est la vraie (§118.5).
 *
 * `runCount` et `lastRunAt` sont là parce qu'une récurrence sans preuve de passage est une
 * promesse : le seul moyen de savoir qu'elle FONCTIONNE est de voir qu'elle a déjà servi.
 */
export interface RecurrenceStockDTO {
  id: string;
  name: string;
  assigneeId: string;
  assigneeName: string;
  note: string | null;
  recurrence: string;
  hourLocal: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  status: StatutRecurrence;
  /** La phrase lisible — « Le 1er de chaque mois à 08 h ». */
  cadence: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  runCount: number;
  hospitalIds: string[];
  hospitalNames: string[];
  /** L'auteur n'existe plus : la récurrence ne peut plus partir, et l'écran doit le DIRE. */
  sansAuteur: boolean;
}

/**
 * LE SELECT ET LE MAPPEUR, ÉCRITS UNE FOIS.
 *
 * La liste de l'écran et la lecture d'UNE ligne (celle qu'Adam relit avant de proposer une
 * modification) doivent rendre exactement la même chose. Deux lectures de la même ligne finissent
 * par en dire deux choses (§118.5), et le symptôme serait une carte de confirmation qui annonce
 * une cadence que la liste affiche autrement.
 */
const SELECT = {
  id: true, name: true, note: true, recurrence: true, hourLocal: true,
  dayOfWeek: true, dayOfMonth: true, status: true, nextRunAt: true, lastRunAt: true,
  runCount: true, createdById: true,
  assignee: { select: { id: true, name: true } },
  hospitals: { select: { annex: { select: { id: true, name: true } } } },
} as const;

type LigneRecurrence = {
  id: string; name: string; note: string | null; recurrence: string; hourLocal: number;
  dayOfWeek: number | null; dayOfMonth: number | null; status: string;
  nextRunAt: Date; lastRunAt: Date | null; runCount: number; createdById: string | null;
  assignee: { id: string; name: string };
  hospitals: { annex: { id: string; name: string } }[];
};

function enDto(r: LigneRecurrence): RecurrenceStockDTO {
  // LES DEUX LISTES SORTENT DU MÊME TRI, une seule fois.
  //
  // La relation n'a pas d'ordre déclaré : Postgres rend ses lignes comme il veut. Trier les NOMS
  // et laisser les IDENTIFIANTS dans l'ordre de la base donnait deux listes du même ensemble dans
  // deux ordres différents — inoffensif tant que personne ne les apparie par rang, et un piège
  // posé pour le premier appelant qui le fera : il afficherait le nom d'un hôpital à côté de
  // l'identifiant d'un autre, c'est-à-dire agirait sur la mauvaise ligne (§104.7). L'ordre est
  // décidé ICI, et `hospitalIds[i]` désigne `hospitalNames[i]`.
  const hopitaux = [...r.hospitals]
    .map((h) => h.annex)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return {
    id: r.id,
    name: r.name,
    assigneeId: r.assignee.id,
    assigneeName: r.assignee.name,
    note: r.note,
    recurrence: r.recurrence,
    hourLocal: r.hourLocal,
    dayOfWeek: r.dayOfWeek,
    dayOfMonth: r.dayOfMonth,
    status: (r.status === "PAUSED" ? "PAUSED" : "ACTIVE") as StatutRecurrence,
    // UNE CADENCE ILLISIBLE LE DIT au lieu d'afficher une phrase inventée : le déclenchement la
    // mettra en pause, et l'écran doit expliquer pourquoi plutôt que de rassurer.
    cadence: estRecurrenceStock(r.recurrence)
      ? decrireRecurrence({
        recurrence: r.recurrence as Recurrence,
        hourLocal: r.hourLocal, dayOfWeek: r.dayOfWeek, dayOfMonth: r.dayOfMonth,
      })
      : `Cadence illisible (« ${r.recurrence} ») — à corriger`,
    nextRunAt: r.nextRunAt,
    lastRunAt: r.lastRunAt,
    runCount: r.runCount,
    hospitalIds: hopitaux.map((h) => h.id),
    hospitalNames: hopitaux.map((h) => h.name),
    sansAuteur: r.createdById === null,
  };
}

export async function loadRecurrencesStock(): Promise<RecurrenceStockDTO[]> {
  const rows = await prisma.stockRequestRecurrence.findMany({
    select: SELECT,
    orderBy: [{ status: "asc" }, { nextRunAt: "asc" }],
    take: 200,
  });
  return rows.map(enDto);
}

/** UNE récurrence, lue comme l'écran la lit. `null` si elle n'existe pas. */
export async function loadRecurrenceStock(id: string): Promise<RecurrenceStockDTO | null> {
  if (!id) return null;
  const r = await prisma.stockRequestRecurrence.findUnique({ where: { id }, select: SELECT });
  return r ? enDto(r) : null;
}
