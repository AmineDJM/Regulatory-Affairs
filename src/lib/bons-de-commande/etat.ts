import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { getAppSettings } from "@/lib/settings";
import { portesDesBC, notifierSignatairesBCASigner } from "./aiguillage";
import { etapeBC, validationRequiseBC, type EtapeBC, type PorteBC } from "./regle";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉTAT D'UN BON DE COMMANDE, DE BOUT EN BOUT — une seule lecture (§118.149).
 *
 * « À signer » se demande à quatre endroits : la file du module « Bons de commande » (§118.176),
 * l'action qui signe, la fiche Legal du BC, et les décisions des centres qui doivent prévenir les
 * signataires. Quatre lectures de la même question finiraient par diverger — la file montrerait un
 * BC que l'action refuse de signer (§118.5). Elles passent toutes ici, qui compose les trois faits
 * de la règle pure : la PORTE (lue en lot par `portesDesBC`), le SEUIL en vigueur, et la
 * SIGNATURE et l'entrée dans le circuit, lues sur la pièce.
 *
 * En LOT : une file de cent BC fait quatre lectures, jamais cent (§118.102b).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EtatBC {
  id: string;
  reference: string | null;
  title: string;
  counterparty: string | null;
  createdById: string | null;
  montant: number | null;
  /** La porte d'un centre, telle que `portesDesBC` la lit — `null` : aucune. */
  porte: PorteBC | null;
  etape: EtapeBC;
  /** Le BC dépasse-t-il le seuil (ou son montant est-il inconnu) ? */
  validationRequise: boolean;
  /** Le seuil appliqué pour cette lecture. */
  seuil: number;
  /** Un BC annulé ne se valide ni ne se signe : les appelants l'écartent. */
  annule: boolean;
  signeLe: Date | null;
  signePar: { id: string; name: string } | null;
  /**
   * La dernière écriture de la pièce, lue en même temps que le reste : l'action de signature la
   * rejoue comme verrou — ce qui a été relu est ce qui est signé (§104.7).
   */
  majLe: Date;
}

export async function etatsDesBC(ids: readonly string[], opts: { seuil?: number } = {}): Promise<Map<string, EtatBC>> {
  const res = new Map<string, EtatBC>();
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return res;
  const docs = await prisma.legalDocument.findMany({
    where: { id: { in: uniques }, kind: "PURCHASE_ORDER" },
    select: {
      id: true, reference: true, title: true, counterparty: true, createdById: true, amount: true,
      status: true, signedAt: true, bcCircuitAt: true, updatedAt: true, signedBy: { select: { id: true, name: true } },
    },
  });
  if (docs.length === 0) return res;
  const [portes, seuil] = await Promise.all([
    portesDesBC(docs.map((d) => d.id)),
    opts.seuil !== undefined ? Promise.resolve(opts.seuil) : getAppSettings().then((s) => s.bcValidationThreshold),
  ]);
  for (const d of docs) {
    const montant = d.amount == null ? null : toNumber(d.amount);
    const porte = portes.get(d.id) ?? null;
    const validationRequise = validationRequiseBC(montant, seuil);
    res.set(d.id, {
      id: d.id, reference: d.reference, title: d.title, counterparty: d.counterparty, createdById: d.createdById,
      montant, porte, validationRequise, seuil,
      etape: etapeBC({ porte, validationRequise, signe: d.signedAt !== null, dansLeCircuit: d.bcCircuitAt !== null }),
      annule: d.status === "CANCELLED",
      signeLe: d.signedAt,
      signePar: d.signedBy ? { id: d.signedBy.id, name: d.signedBy.name } : null,
      majLe: d.updatedAt,
    });
  }
  return res;
}

/** L'état d'UN BC — `null` si la pièce n'existe pas ou n'est pas un bon de commande. */
export async function etatDuBC(id: string, opts: { seuil?: number } = {}): Promise<EtatBC | null> {
  return (await etatsDesBC([id], opts)).get(id) ?? null;
}

/**
 * APRÈS LA DÉCISION D'UN CENTRE : si le BC est désormais « à signer », ses signataires le sauront.
 *
 * Appelée par les deux centres quand ils VALIDENT un BC, et par le visa d'un poste Ad & Pro dont
 * la pièce existe déjà. Relit l'état plutôt que de le supposer : un BC validé mais annulé entre
 * temps, ou déjà signé, ne doit prévenir personne. Rend vrai quand la notification est partie.
 */
export async function signalerSiASigner(docId: string): Promise<boolean> {
  const etat = await etatDuBC(docId).catch(() => null);
  if (!etat || etat.annule || etat.etape !== "A_SIGNER") return false;
  await notifierSignatairesBCASigner({
    id: etat.id, reference: etat.reference, title: etat.title, counterparty: etat.counterparty,
    amount: etat.montant, createdById: etat.createdById,
  });
  return true;
}
