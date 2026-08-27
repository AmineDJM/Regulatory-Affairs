import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES MODÈLES OPÉRATIONNELS — le vrai fichier de l'entreprise, jamais un format inventé (§80-83).
 *
 * ── LE PROBLÈME ──────────────────────────────────────────────────────────────────────────
 *
 * Adam sait fabriquer un bon de commande. Le problème est qu'il en fabrique UN, alors que
 * l'entreprise en a un — avec son en-tête, sa numérotation, ses mentions légales, son ordre de
 * colonnes. Un document « correct » mais qui ne ressemble pas aux autres est un document qu'il
 * faut refaire, et Adam a alors coûté du temps au lieu d'en faire gagner.
 *
 * ── LA RÈGLE QUI GOUVERNE CE FICHIER : PAS D'APPRENTISSAGE SILENCIEUX (§82) ──────────────
 *
 * Ce qu'Adam a OBSERVÉ n'est pas ce qu'un humain a APPROUVÉ, et seul l'approuvé fait autorité.
 * Quatre états, et le passage de l'un à l'autre est explicite :
 *
 *   OBSERVED   — « j'ai vu ce fichier ». Aucune autorité, aucune conséquence.
 *   CANDIDATE  — « je pense que c'est LE format ». Proposé, pas décidé.
 *   APPROVED   — un humain a tranché. UN SEUL par type et par propriétaire.
 *   DEPRECATED — l'entreprise a changé de format ; l'ancien reste, pour lire l'historique.
 *
 * Sans cette discipline, un document mal rangé lu un mardi deviendrait « le modèle », et tous
 * les bons de commande suivants seraient faux — sans que personne ne l'ait décidé, ni remarqué.
 *
 * ── POURQUOI UN SEUL APPROUVÉ PAR TYPE ───────────────────────────────────────────────────
 *
 * Parce que « trois formats historiques » redeviendraient trois vérités concurrentes, et qu'il
 * faudrait alors CHOISIR à chaque fabrication — c'est-à-dire deviner. La contrainte est portée
 * par la base (index unique partiel), pas par ce fichier : une règle tenue par du code se
 * contourne, une règle tenue par Postgres, non.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les documents opérationnels de l'entreprise, nommés. */
export const TYPES_MODELE = [
  "PURCHASE_ORDER", "INVOICE", "QUOTATION", "PAYMENT_REQUEST",
  "EXPENSE_REPORT", "REGULATORY_LETTER", "CONTRACT", "MEETING_MINUTES",
] as const;
export type TypeModele = (typeof TYPES_MODELE)[number];

export const LIBELLE_TYPE: Record<TypeModele, string> = {
  PURCHASE_ORDER: "bon de commande",
  INVOICE: "facture",
  QUOTATION: "devis",
  PAYMENT_REQUEST: "demande de paiement",
  EXPENSE_REPORT: "note de frais",
  REGULATORY_LETTER: "courrier réglementaire",
  CONTRACT: "contrat",
  MEETING_MINUTES: "compte rendu de réunion",
};

export const ETATS_MODELE = ["OBSERVED", "CANDIDATE", "APPROVED", "DEPRECATED"] as const;
export type EtatModele = (typeof ETATS_MODELE)[number];

/**
 * LES PASSAGES AUTORISÉS.
 *
 * Deux absences valent une lecture. `OBSERVED → APPROVED` n'existe pas : on ne promeut pas ce
 * qu'on a simplement vu, il faut d'abord le PROPOSER, ce qui donne à l'humain quelque chose à
 * regarder. Et `APPROVED → CANDIDATE` n'existe pas non plus : on ne rétrograde pas une décision,
 * on la déprécie et on en approuve une autre — l'historique reste lisible.
 */
export const TRANSITIONS_MODELE: Record<EtatModele, readonly EtatModele[]> = {
  OBSERVED: ["CANDIDATE", "DEPRECATED"],
  CANDIDATE: ["APPROVED", "OBSERVED", "DEPRECATED"],
  APPROVED: ["DEPRECATED"],
  DEPRECATED: [],
};

export function passageAutorise(de: EtatModele, vers: EtatModele): boolean {
  return de === vers || TRANSITIONS_MODELE[de].includes(vers);
}

/**
 * ADAM A VU UN FICHIER — et il ne se passe rien d'autre.
 *
 * `fileHash` sert d'identité : revoir le même fichier ne crée pas une seconde observation.
 * Sans cela, un dossier Drive parcouru chaque nuit produirait mille observations du même bon
 * de commande, et la liste des candidats deviendrait illisible.
 */
export async function observer(opts: {
  ownerId: string;
  type: TypeModele;
  name: string;
  driveNodeId?: string | null;
  fileName?: string | null;
  fileHash?: string | null;
  structure?: Record<string, unknown>;
  note?: string;
}): Promise<string> {
  if (opts.fileHash) {
    const deja = await prisma.operationalTemplate.findFirst({
      where: { ownerId: opts.ownerId, type: opts.type, fileHash: opts.fileHash },
      select: { id: true },
    });
    if (deja) return deja.id;
  }

  const t = await prisma.operationalTemplate.create({
    data: {
      ownerId: opts.ownerId,
      type: opts.type,
      name: opts.name,
      state: "OBSERVED",
      driveNodeId: opts.driveNodeId ?? null,
      fileName: opts.fileName ?? null,
      fileHash: opts.fileHash ?? null,
      structure: (opts.structure ?? {}) as never,
      note: opts.note ?? null,
    },
    select: { id: true },
  });
  return t.id;
}

/** Adam PROPOSE : « je pense que c'est le format ». Toujours révocable, jamais suffisant. */
export async function proposer(templateId: string, pourquoi: string): Promise<boolean> {
  return changerEtat(templateId, "CANDIDATE", { note: pourquoi });
}

/**
 * UN HUMAIN TRANCHE.
 *
 * `approvedById` est obligatoire, et c'est le point : sans lui, on ne pourrait pas distinguer
 * « approuvé par la direction » de « promu tout seul un mardi ». C'est exactement la
 * distinction que §82 demande de rendre impossible à effacer.
 *
 * L'ancien approuvé est déprécié dans le même mouvement — la base refuserait deux approuvés du
 * même type, et il vaut mieux le faire explicitement que de découvrir l'erreur d'unicité.
 */
export async function approuver(templateId: string, approvedById: string): Promise<boolean> {
  const t = await prisma.operationalTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, ownerId: true, type: true, state: true },
  });
  if (!t || !passageAutorise(t.state as EtatModele, "APPROVED")) return false;

  await prisma.operationalTemplate.updateMany({
    where: { ownerId: t.ownerId, type: t.type, state: "APPROVED", id: { not: templateId } },
    data: { state: "DEPRECATED" },
  });

  await prisma.operationalTemplate.update({
    where: { id: templateId },
    data: { state: "APPROVED", approvedById, approvedAt: new Date() },
  });
  return true;
}

/** L'entreprise a changé de format. L'ancien reste, pour lire l'historique. */
export async function deprecier(templateId: string): Promise<boolean> {
  return changerEtat(templateId, "DEPRECATED");
}

async function changerEtat(
  templateId: string,
  vers: EtatModele,
  extra: { note?: string } = {},
): Promise<boolean> {
  const t = await prisma.operationalTemplate.findUnique({
    where: { id: templateId }, select: { state: true },
  });
  if (!t || !passageAutorise(t.state as EtatModele, vers)) return false;
  await prisma.operationalTemplate.update({
    where: { id: templateId },
    data: { state: vers, ...(extra.note ? { note: extra.note } : {}) },
  });
  return true;
}

/**
 * LE MODÈLE QUI FAIT AUTORITÉ — ou rien.
 *
 * Rend `null` quand aucun modèle n'est approuvé, et c'est délibéré : un candidat rendu ici
 * serait utilisé comme s'il était validé, ce qui viderait toute la mécanique de son sens. La
 * bonne réponse à « je n'ai pas de modèle approuvé » est de le DIRE — le §81 en fait d'ailleurs
 * une cause d'échec à part entière (`MISSING_TEMPLATE`), avec sa propre échelle de recours.
 */
export async function modeleFaisantAutorite(ownerId: string, type: TypeModele) {
  return prisma.operationalTemplate.findFirst({
    where: { ownerId, type, state: "APPROVED" },
    select: {
      id: true, name: true, driveNodeId: true, fileName: true,
      structure: true, rules: true, destinationFolderId: true, approvedAt: true,
    },
  });
}

/** Ce qu'Adam propose à la validation — la file d'attente de l'humain. */
export async function candidats(ownerId: string) {
  return prisma.operationalTemplate.findMany({
    where: { ownerId, state: "CANDIDATE" },
    select: { id: true, type: true, name: true, fileName: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Compte l'usage — sert à repérer un modèle approuvé que plus personne n'utilise. */
export async function noterUsage(templateId: string): Promise<void> {
  await prisma.operationalTemplate.updateMany({
    where: { id: templateId, state: "APPROVED" },
    data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}
