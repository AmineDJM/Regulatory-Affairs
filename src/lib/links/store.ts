import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { canAccessEntity, ENTITY_MODULE } from "@/lib/entity-access";
import { recordAudit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/session";
import {
  LINK_TYPE_LABELS, canonicalPair, isLinkType, linkHref, otherSide, validateLink, type LinkType,
} from "./graph";

/**
 * LE REGISTRE DES LIENS D'AFFAIRE — l'unique chemin d'écriture et de lecture.
 *
 * `graph.ts` dit CE QUI peut se relier (le flux) ; ce module-ci dit QUI a le droit de le faire et
 * COMMENT c'est écrit. La séparation n'est pas cosmétique : le flux est une règle métier pure,
 * testable sans base ; les droits demandent la session, Prisma et le cloisonnement par entité.
 *
 * Trois invariants tenus ici, et nulle part ailleurs :
 *
 * 1. **La paire est rangée avant d'être écrite** (`canonicalPair`). Relier A à B puis B à A ne
 *    produit qu'UNE ligne — l'unicité en base suffit, sans code de déduplication.
 * 2. **Les deux bouts sont vérifiés avec les droits du lieur.** Relier un objet qu'on ne peut pas
 *    voir servirait à en deviner l'existence ; et il faut pouvoir MODIFIER au moins l'un des deux,
 *    sinon un simple lecteur écrirait dans le dossier des autres.
 * 3. **Les libellés sont PHOTOGRAPHIÉS.** La fiche d'un marché affiche ses courriers sans
 *    re-résoudre chaque cible — et un objet renommé garde le libellé qu'il avait au moment du
 *    lien, ce que le journal d'audit suppose.
 */

export interface LinkRow {
  id: string;
  fromType: EntityType;
  fromId: string;
  fromLabel: string | null;
  toType: EntityType;
  toId: string;
  toLabel: string | null;
  createdAt: Date;
}

const ROW_SELECT = {
  id: true, fromType: true, fromId: true, fromLabel: true,
  toType: true, toId: true, toLabel: true, createdAt: true,
} as const;

/** Le libellé d'une cible — résolu ICI, jamais confié au formulaire (il se réécrit). */
export async function linkLabel(type: LinkType, id: string): Promise<string | null> {
  switch (type) {
    case "PCH_TENDER": {
      const t = await prisma.pchTender.findUnique({ where: { id }, select: { reference: true, title: true } });
      return t ? `${t.reference}${t.title ? ` — ${t.title}` : ""}` : null;
    }
    case "PCH_ORDER": {
      const o = await prisma.pchOrder.findUnique({ where: { id }, select: { reference: true, tender: { select: { reference: true } } } });
      return o ? `BC ${o.reference ?? "s/n"} — ${o.tender.reference}` : null;
    }
    // INVOICE et LEGAL_DOCUMENT désignent la MÊME table : une facture est un document légal de
    // nature « facture ». Chaque nature ne résout donc QUE la sienne — sans ce contrôle, la même
    // pièce serait reliable sous deux natures, et le même couple donnerait deux enregistrements.
    case "INVOICE": {
      const f = await prisma.legalDocument.findUnique({ where: { id }, select: { kind: true, reference: true, title: true } });
      return f && f.kind === "INVOICE" ? `Facture ${f.reference ? `${f.reference} — ` : ""}${f.title}` : null;
    }
    case "LEGAL_DOCUMENT": {
      const d = await prisma.legalDocument.findUnique({ where: { id }, select: { kind: true, title: true, reference: true } });
      return d && d.kind !== "INVOICE" ? `${d.reference ? `${d.reference} — ` : ""}${d.title}` : null;
    }
    case "REGULATORY_PRODUCT": {
      const r = await prisma.regulatoryProduct.findUnique({ where: { id }, select: { reference: true, dci: true } });
      return r ? `${r.reference} — ${r.dci}` : null;
    }
    case "MAIL_ENTRY": {
      const m = await prisma.mailEntry.findUnique({ where: { id }, select: { reference: true, title: true } });
      return m ? `${m.reference ? `${m.reference} — ` : ""}${m.title}` : null;
    }
  }
}

/** Tous les liens d'UN objet — des deux côtés de la paire, l'écran ne sait pas où il est rangé. */
export async function linksOf(self: { type: LinkType; id: string }): Promise<LinkRow[]> {
  return prisma.entityLink.findMany({
    where: {
      OR: [
        { fromType: self.type as EntityType, fromId: self.id },
        { toType: self.type as EntityType, toId: self.id },
      ],
    },
    select: ROW_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

/** Les liens de PLUSIEURS objets de même nature — une requête, pas une par ligne de tableau. */
export async function linksOfMany(type: LinkType, ids: string[]): Promise<LinkRow[]> {
  if (ids.length === 0) return [];
  return prisma.entityLink.findMany({
    where: {
      OR: [
        { fromType: type as EntityType, fromId: { in: ids } },
        { toType: type as EntityType, toId: { in: ids } },
      ],
    },
    select: ROW_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export interface LinkedView {
  id: string;
  type: string;
  typeLabel: string;
  label: string;
  href: string | null;
}

/**
 * LES LIENS D'UN OBJET, PRÊTS À AFFICHER : l'autre bout, son libellé, et où il mène.
 *
 * Les bons de commande n'ont pas de fiche à eux — leur marché est résolu EN LOT ici, jamais dans
 * une boucle de rendu : une fiche à quinze liens ferait quinze requêtes.
 */
export async function linkedViews(self: { type: LinkType; id: string }, rows: LinkRow[]): Promise<LinkedView[]> {
  const autres = rows.map((r) => otherSide(r, self));
  const bonIds = autres.filter((a) => a.type === "PCH_ORDER").map((a) => a.id);
  const marcheDuBon = new Map<string, string>(
    (bonIds.length
      ? await prisma.pchOrder.findMany({ where: { id: { in: bonIds } }, select: { id: true, tenderId: true } })
      : []
    ).map((o) => [o.id, o.tenderId]),
  );
  return rows.map((r, i) => {
    const a = autres[i];
    const type = isLinkType(a.type) ? a.type : null;
    return {
      id: r.id,
      type: a.type,
      typeLabel: type ? LINK_TYPE_LABELS[type] : a.type,
      label: a.label ?? a.id,
      href: type ? linkHref(type, a.id, { orderTenderId: marcheDuBon.get(a.id) ?? null }) : null,
    };
  });
}

/** `ends` porte les deux bouts du lien — l'appelant rafraîchit les deux fiches sans les redemander. */
export type LinkResult =
  | { ok: true; id: string; ends: { type: string; id: string }[] }
  | { ok: false; error: string };

/**
 * LE DROIT DE RELIER : voir les deux bouts, et pouvoir modifier AU MOINS un des deux.
 *
 * Exiger la modification des deux fermerait le geste le plus courant — l'agent du courrier relie
 * un pli à un marché qu'il ne fait que consulter. N'exiger que la vue laisserait un lecteur écrire
 * dans le dossier d'autrui. Le lien s'écrit donc depuis un objet dont on est responsable, vers un
 * objet qu'on a le droit de voir.
 */
async function droitDeRelier(
  user: CurrentUser,
  x: { type: LinkType; id: string },
  y: { type: LinkType; id: string },
): Promise<string | null> {
  for (const c of [x, y]) {
    if (!(await canAccessEntity(user, c.type as EntityType, c.id, "VIEW"))) {
      return `Vous n'avez pas accès à ${LINK_TYPE_LABELS[c.type].toLowerCase()} visé par ce lien.`;
    }
  }
  const peutEcrire = userCan(user, ENTITY_MODULE[x.type as EntityType], "UPDATE")
    || userCan(user, ENTITY_MODULE[y.type as EntityType], "UPDATE");
  if (!peutEcrire) {
    return "Relier deux objets suppose d'être responsable d'au moins l'un des deux — vous n'avez qu'un droit de lecture ici.";
  }
  return null;
}

/**
 * POSER UN LIEN. Refuse en NOMMANT ce qui bloque : le flux (`validateLink`), les droits, ou
 * l'existence de la cible. Reposer un lien existant n'est pas une erreur — c'est le même fait,
 * et le libellé est rafraîchi au passage.
 */
export async function addLink(
  user: CurrentUser,
  xRaw: { type: string; id: string },
  yRaw: { type: string; id: string },
): Promise<LinkResult> {
  const verdict = validateLink(xRaw, yRaw);
  if (!verdict.ok) return { ok: false, error: verdict.error };
  // `validateLink` a déjà prouvé que les deux natures participent au graphe.
  const x = { type: xRaw.type as LinkType, id: xRaw.id };
  const y = { type: yRaw.type as LinkType, id: yRaw.id };

  const refus = await droitDeRelier(user, x, y);
  if (refus) return { ok: false, error: refus };

  const [labelX, labelY] = await Promise.all([linkLabel(x.type, x.id), linkLabel(y.type, y.id)]);
  if (!labelX) return { ok: false, error: `${LINK_TYPE_LABELS[x.type]} introuvable.` };
  if (!labelY) return { ok: false, error: `${LINK_TYPE_LABELS[y.type]} introuvable.` };

  const paire = canonicalPair(x, y);
  const libelles = paire.fromId === x.id && paire.fromType === x.type
    ? { fromLabel: labelX, toLabel: labelY }
    : { fromLabel: labelY, toLabel: labelX };

  const lien = await prisma.entityLink.upsert({
    where: {
      fromType_fromId_toType_toId: {
        fromType: paire.fromType as EntityType, fromId: paire.fromId,
        toType: paire.toType as EntityType, toId: paire.toId,
      },
    },
    update: libelles,
    create: {
      fromType: paire.fromType as EntityType, fromId: paire.fromId,
      toType: paire.toType as EntityType, toId: paire.toId,
      ...libelles,
      createdById: user.id,
    },
    select: { id: true },
  });

  // DEUX ENTRÉES AU JOURNAL, une par bout : celui qui relit l'historique d'un contrat doit y voir
  // le bon qu'on lui a rattaché, sans avoir à deviner que la trace est du côté du bon.
  await Promise.all([
    recordAudit({
      actorId: user.id, action: "UPDATE", module: ENTITY_MODULE[x.type as EntityType],
      entityType: x.type as EntityType, entityId: x.id,
      summary: `Relié à ${LINK_TYPE_LABELS[y.type].toLowerCase()} « ${labelY} »`,
    }),
    recordAudit({
      actorId: user.id, action: "UPDATE", module: ENTITY_MODULE[y.type as EntityType],
      entityType: y.type as EntityType, entityId: y.id,
      summary: `Relié à ${LINK_TYPE_LABELS[x.type].toLowerCase()} « ${labelX} »`,
    }),
  ]);
  return { ok: true, id: lien.id, ends: [x, y] };
}

/** RETIRER UN LIEN — les deux objets restent, seul le fil entre eux disparaît. */
export async function removeLink(user: CurrentUser, id: string): Promise<LinkResult> {
  const lien = await prisma.entityLink.findUnique({ where: { id }, select: ROW_SELECT });
  if (!lien) return { ok: false, error: "Lien introuvable." };
  if (!isLinkType(lien.fromType) || !isLinkType(lien.toType)) {
    return { ok: false, error: "Ce lien porte un type d'objet hors du graphe." };
  }
  const x = { type: lien.fromType as LinkType, id: lien.fromId };
  const y = { type: lien.toType as LinkType, id: lien.toId };
  const refus = await droitDeRelier(user, x, y);
  if (refus) return { ok: false, error: refus };

  await prisma.entityLink.delete({ where: { id } });
  await Promise.all([
    recordAudit({
      actorId: user.id, action: "UPDATE", module: ENTITY_MODULE[lien.fromType],
      entityType: lien.fromType, entityId: lien.fromId,
      summary: `Lien retiré : ${lien.toLabel ?? lien.toId}`,
    }),
    recordAudit({
      actorId: user.id, action: "UPDATE", module: ENTITY_MODULE[lien.toType],
      entityType: lien.toType, entityId: lien.toId,
      summary: `Lien retiré : ${lien.fromLabel ?? lien.fromId}`,
    }),
  ]);
  return { ok: true, id, ends: [x, y] };
}

/**
 * RAFRAÎCHIR LES LIBELLÉS D'UN OBJET RENOMMÉ.
 *
 * Les libellés sont photographiés pour que la fiche d'un marché affiche ses courriers sans
 * re-résoudre chaque cible. Mais CORRIGER la référence d'un marché n'est pas renommer un autre
 * objet : la photo devient fausse, et l'utilisateur lit une référence qui n'existe plus. Les
 * corrections d'identité appellent donc ce rafraîchissement — les autres champs, non.
 *
 * Renvoie le nombre de liens remis à jour (0 si l'objet n'est relié à rien).
 */
export async function refreshLinkLabels(type: LinkType, id: string): Promise<number> {
  const label = await linkLabel(type, id);
  if (!label) return 0;
  const [depart, arrivee] = await Promise.all([
    prisma.entityLink.updateMany({ where: { fromType: type as EntityType, fromId: id }, data: { fromLabel: label } }),
    prisma.entityLink.updateMany({ where: { toType: type as EntityType, toId: id }, data: { toLabel: label } }),
  ]);
  return depart.count + arrivee.count;
}

/** Les écrans à rafraîchir après un lien — les deux bouts, jamais un seul. */
export function linkRevalidatePaths(rows: { type: string; id: string }[]): string[] {
  const paths = new Set<string>();
  for (const r of rows) {
    if (!isLinkType(r.type)) continue;
    // Le bon de commande n'a pas de fiche : c'est le tableau des marchés qui le montre.
    const p = r.type === "PCH_ORDER" ? "/pch" : linkHref(r.type, r.id);
    if (p) paths.add(p);
  }
  return [...paths];
}
