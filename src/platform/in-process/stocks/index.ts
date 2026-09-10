import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PORT DES STOCKS — ce par quoi Adam atteint les récurrences de demande d'état de stock.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * Même raison, au mot près, que le port du plan de tournée : brancher les ops directement sur
 * `@/lib/actions/*`, `@/lib/queries/*` et `@/lib/prisma` fait franchir la frontière Adam ↔ ERP,
 * et `boundary.test.ts` la tient à marge ZÉRO. §118.114 a mesuré ce que coûte l'autre issue :
 * relever le plafond est une ligne, et c'est admettre qu'Adam connaît le dossier `actions/` de
 * l'ERP et le nom de ses tables — alors que tout le contrat de plateforme existe pour l'en
 * empêcher. Le remède est celui que le message d'échec nomme.
 *
 * ── LA LIGNE DE PARTAGE : LA TABLE ICI, LA POLITIQUE LÀ-BAS ──────────────────────────────
 *
 * Les recherches ci-dessous portent du savoir d'ERP — QUELLE table, QUELLES colonnes, et
 * comment on ÉTIQUETTE une ligne pour un humain. Ce qui reste chez Adam
 * (`ops/impl-stock-recurrence.ts`) est la POLITIQUE de résolution : exact → unique → ambiguïté
 * LISTÉE, jamais « le premier des quatre » (§104.7). La faire descendre ici la dupliquerait, et
 * deux résolutions du même nom finissent par choisir différemment (§118.5).
 *
 * ── CE QUE CE PORT N'AJOUTE PAS ──────────────────────────────────────────────────────────
 *
 * Aucune vérification de droits. Les quatre server actions réexportées revalident TOUT
 * (`canRequestStockState`, la même porte que la demande ponctuelle) : le port rejoue le clic de
 * l'écran, il n'ouvre pas une porte à côté (§118.74). Y glisser une seconde garde en ferait une
 * vérité qui prend du retard, et c'est la version en retard qui serait la faille.
 *
 * Et il ne réexporte PAS `prisma`. Une porte qui rend l'accès brut à la base ne serait pas un
 * port, ce serait la frontière contournée par le fichier qui a pour rôle de la tenir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ── LES DÉCISIONS PURES ───────────────────────────────────────────────────────────────────
// Mailles admises, défauts, libellés, phrase d'aperçu. Module PUR testé à part
// (`stocks/recurrence.test.ts`) : le port ne fait que le rendre atteignable sans traverser.
export {
  HEURE_DEFAUT, RECURRENCES_STOCK, RECURRENCE_STOCK_DEFAUT, STATUT_RECURRENCE_LABELS,
  apercuRecurrence, decrireRecurrence, estRecurrenceStock, estStatutRecurrence, libelleRecurrence,
  type StatutRecurrence,
} from "@/lib/stocks/recurrence";

// ── LES ÉCRITURES ─────────────────────────────────────────────────────────────────────────
// Les server actions de l'écran, telles quelles.
export {
  createStockRecurrence, updateStockRecurrence, setStockRecurrenceStatus, deleteStockRecurrence,
} from "@/lib/actions/stock-recurrence-actions";

// ── LA LECTURE D'UNE LIGNE ────────────────────────────────────────────────────────────────
/**
 * LA RÉCURRENCE TELLE QU'ELLE EST AUJOURD'HUI — le MÊME lecteur que celui de l'écran.
 *
 * L'action de mise à jour réécrit la ligne ENTIÈRE : sans relire l'existant pour le REJOUER,
 * « change la cadence » effacerait les hôpitaux, le destinataire et la précision. Et c'est
 * `loadRecurrenceStock` — pas une seconde requête — parce que deux lectures de la même ligne
 * finissent par en dire deux choses, et le symptôme serait une carte de confirmation qui annonce
 * une cadence que la liste affiche autrement (§118.5).
 */
export { loadRecurrenceStock as lireRecurrenceStock, type RecurrenceStockDTO } from "@/lib/queries/stock-recurrence";

/** Une ligne candidate : son identifiant, et l'étiquette qu'un humain lit. */
export interface CandidatStock {
  id: string;
  label: string;
}

const CANDIDATS_MAX = 6;

/**
 * LES PERSONNES À QUI UNE DEMANDE PEUT ÊTRE ADRESSÉE — les comptes ACTIFS, comme à l'écran.
 *
 * L'écran offre `prisma.user.findMany({ isActive: true })` : reproduire exactement ce périmètre
 * est ce qui garantit qu'Adam ne propose pas un destinataire que le formulaire refuserait, et
 * surtout qu'il n'en propose pas un que le formulaire n'offre PAS (§118.85 : la carte montre ce
 * qui sera fait). Un compte désactivé recevrait une réquisition mensuelle que personne ne lit.
 */
export async function chercherKamStock(q: string): Promise<CandidatStock[]> {
  const rows = await prisma.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, name: true }, take: CANDIDATS_MAX,
  });
  return rows.map((u) => ({ id: u.id, label: u.name }));
}

/**
 * LES HÔPITAUX — et JAMAIS les annexes PCH.
 *
 * `StockAnnex` porte les trois genres de lieux (`kind`), et le filtre `kind: { not: "ANNEX" }`
 * est le MÊME que celui de `hopitauxValides` dans l'action. Sans lui, « ajoute l'annexe de
 * Blida » passerait la carte de confirmation et se ferait refuser à l'exécution : un geste offert
 * puis retiré, alors que la garde doit être AVANT (§118.83).
 */
export async function chercherHopitalStock(q: string): Promise<CandidatStock[]> {
  const rows = await prisma.stockAnnex.findMany({
    where: { name: { contains: q, mode: "insensitive" }, kind: { not: "ANNEX" } },
    select: { id: true, name: true }, take: CANDIDATS_MAX,
  });
  return rows.map((a) => ({ id: a.id, label: a.name }));
}

/**
 * LES RÉCURRENCES dont le nom contient la saisie.
 *
 * L'étiquette porte la CADENCE et la personne, pas seulement le nom : deux récurrences peuvent
 * s'appeler « Relevé mensuel » pour deux KAM, et une liste d'ambiguïté qui afficherait deux fois
 * le même mot ne lèverait rien (§104.7).
 */
export async function chercherRecurrenceStock(q: string): Promise<CandidatStock[]> {
  const rows = await prisma.stockRequestRecurrence.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, assignee: { select: { name: true } } },
    orderBy: { nextRunAt: "asc" }, take: CANDIDATS_MAX,
  });
  return rows.map((r) => ({ id: r.id, label: `${r.name} (${r.assignee.name})` }));
}
