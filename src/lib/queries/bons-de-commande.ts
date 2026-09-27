import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { companyScopedWhere } from "@/lib/company";
import { legalReaderWhere } from "@/lib/lecteurs/legal";
import { legalViewScope } from "@/lib/legal/invoices";
import { getAppSettings } from "@/lib/settings";
import { etatsDesBC } from "@/lib/bons-de-commande/etat";
import type { EtapeBC, PorteBC } from "@/lib/bons-de-commande/regle";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * FINANCES › BONS DE COMMANDE — la file de ce que les Finances doivent SIGNER (§118.149).
 *
 * « Mets un sous-module spécial sous Finances : Bons de commande — les bons de commande à signer
 * de leur part. Si un BC se retrouve là-bas, c'est qu'il doit être signé. » La file ne contient
 * donc QUE des BC « à signer » : validés par leur centre, ou sous le seuil de validation. Un BC
 * qui attend encore un centre n'y est pas — il n'est pas à signer, il est à valider — mais il est
 * COMPTÉ, pour que les Finances sachent ce qui arrive.
 *
 * ── QUI VOIT QUOI ────────────────────────────────────────────────────────────────────────────
 *
 * Exactement ce que l'écran Legal montre à la même personne : la même portée (`legalViewScope` —
 * un financier voit la chaîne d'achat), la même entité (`companyScopedWhere`) et les mêmes
 * LECTEURS DÉSIGNÉS (`legalReaderWhere`). Une file qui montrerait un BC restreint à quelqu'un
 * qui n'en est pas lecteur lui en révélerait le titre, la partie en face et le montant (§118.71).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Qui SIGNE un bon de commande : les Finances — le droit de modifier dans leur module. */
export function peutSignerBC(user: Pick<CurrentUser, "role" | "access">): boolean {
  return userCan(user as CurrentUser, "FINANCES", "UPDATE");
}

/** Le refus, écrit une fois : l'écran et l'action disent la même phrase. */
export const REFUS_SIGNATURE_BC =
  "La signature d'un bon de commande revient aux Finances (droit de modification du module Finances).";

/**
 * LES BC QUE CETTE PERSONNE A LE DROIT DE LIRE — `null` : aucun. La même clause que la liste
 * Legal, réduite aux bons de commande ; l'action de signature la rejoue sur la pièce visée.
 */
export async function bcVisiblesWhere(user: CurrentUser): Promise<Prisma.LegalDocumentWhereInput | null> {
  const portee = legalViewScope({
    onLegal: userCan(user, "LEGAL", "VIEW"),
    onFinances: userCan(user, "FINANCES", "VIEW"),
  });
  if (portee === "NONE") return null;
  const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  return companyScopedWhere(user.id, {
    kind: "PURCHASE_ORDER",
    ...(readerScope ? { AND: [readerScope] } : {}),
  } as Prisma.LegalDocumentWhereInput);
}

export interface LigneBCFinances {
  id: string;
  reference: string | null;
  title: string;
  counterparty: string | null;
  montant: number | null;
  societe: string | null;
  creePar: string | null;
  creeLe: string;
  driveNodeId: string | null;
  etape: EtapeBC;
  porte: PorteBC | null;
  validationRequise: boolean;
  signeLe: string | null;
  signePar: string | null;
}

export interface FileBCFinances {
  aSigner: LigneBCFinances[];
  signes: LigneBCFinances[];
  /** BC du circuit qui attendent encore un centre — comptés, pas listés : ils ne sont pas à signer. */
  enValidation: number;
  seuil: number;
  /** Vrai quand la file a été bornée : l'écran le dit au lieu de se croire exhaustif. */
  tronquee: boolean;
}

/** Au-delà, la file se dirait exhaustive sans l'être : on borne, et on le DIT (§118.60). */
const PLAFOND_FILE = 200;

export async function fileBonsDeCommande(user: CurrentUser, opts: { signesRecents?: number } = {}): Promise<FileBCFinances | null> {
  const visibles = await bcVisiblesWhere(user);
  if (!visibles) return null;
  const select = {
    id: true, reference: true, title: true, counterparty: true, createdAt: true, driveNodeId: true,
    company: { select: { name: true, shortName: true } },
    createdBy: { select: { name: true } },
  } as const;

  const [enVol, signesDocs] = await Promise.all([
    // EN VOL : dans le circuit, pas encore signés, pas annulés.
    prisma.legalDocument.findMany({
      where: { AND: [visibles, { signedAt: null, bcCircuitAt: { not: null }, status: { notIn: ["CANCELLED", "RENEWED"] } }] },
      select, orderBy: { createdAt: "asc" }, take: PLAFOND_FILE,
    }),
    prisma.legalDocument.findMany({
      where: { AND: [visibles, { signedAt: { not: null }, signedById: { not: null } }] },
      select, orderBy: { signedAt: "desc" }, take: opts.signesRecents ?? 20,
    }),
  ]);

  const seuil = (await getAppSettings()).bcValidationThreshold;
  const etats = await etatsDesBC([...enVol, ...signesDocs].map((d) => d.id), { seuil });
  const ligne = (d: (typeof enVol)[number]): LigneBCFinances | null => {
    const e = etats.get(d.id);
    if (!e) return null;
    return {
      id: d.id, reference: d.reference, title: d.title, counterparty: d.counterparty, montant: e.montant,
      societe: d.company ? (d.company.shortName || d.company.name) : null,
      creePar: d.createdBy?.name ?? null, creeLe: d.createdAt.toISOString(), driveNodeId: d.driveNodeId,
      etape: e.etape, porte: e.porte, validationRequise: e.validationRequise,
      signeLe: e.signeLe?.toISOString() ?? null, signePar: e.signePar?.name ?? null,
    };
  };
  const lignesEnVol = enVol.map(ligne).filter((l): l is LigneBCFinances => l !== null);
  return {
    aSigner: lignesEnVol.filter((l) => l.etape === "A_SIGNER"),
    signes: signesDocs.map(ligne).filter((l): l is LigneBCFinances => l !== null),
    enValidation: lignesEnVol.filter((l) => l.etape === "A_VALIDER" || l.etape === "A_REVOIR" || l.etape === "SANS_PORTE").length,
    seuil,
    tronquee: enVol.length >= PLAFOND_FILE,
  };
}
