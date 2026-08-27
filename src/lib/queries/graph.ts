import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE GRAPHE D'ENTREPRISE — la projection, pas une base de graphe.
 *
 * ── CE QUE C'EST ─────────────────────────────────────────────────────────────────────────
 *
 * « Qu'est-ce qui touche ce produit ? » — la question qu'on posait en cherchant du TEXTE dans
 * six modules, et à laquelle les clés étrangères posées aux lots 1 et 1b répondent EXACTEMENT.
 * Ce fichier ne fait que les parcourir et nommer chaque arête.
 *
 * ── POURQUOI PAS UNE BASE DE GRAPHE ──────────────────────────────────────────────────────
 *
 * Parce que le graphe EXISTE DÉJÀ : ce sont les relations du schéma. Le recopier dans Neo4j
 * créerait un second exemplaire à synchroniser, donc une source de vérité de plus, donc des
 * divergences — pour répondre à des questions qu'un `JOIN` traite en une milliseconde. La
 * contrainte de la mission le dit d'ailleurs en toutes lettres : pas de Neo4j obligatoire.
 *
 * ── LA RÈGLE QUI DÉFINIT CE FICHIER ──────────────────────────────────────────────────────
 *
 * ON NE TRAVERSE QUE DES ARÊTES DÉCLARÉES. Aucune arête n'est déduite d'une ressemblance de
 * nom, d'un libellé voisin ou d'un score. Une relation que personne n'a posée n'apparaît pas
 * ici — et c'est ce qui distingue une traversée d'une recherche : la première est vraie, la
 * seconde est probable.
 *
 * Corollaire pour le RETRIEVAL CIBLÉ : quand une arête existe, on la SUIT ; on ne va pas
 * chercher dans le texte ce que la base sait déjà. Le texte reste le recours pour ce qui n'a
 * pas d'arête — un courriel, une note, un document non rattaché.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les ancres qui portent de vraies arêtes aujourd'hui. La liste grandira avec le schéma. */
export type AncreType = "PRODUCT" | "PCH_TENDER" | "USER";

export interface Arete {
  /** Le nom métier de la relation — « porté par », « vendu à », « ligne de marché ». */
  relation: string;
  /** Le type de l'entité au bout. */
  vers: string;
  /** Combien il y en a. */
  nombre: number;
  /** Un échantillon lisible, borné — de quoi citer sans tout charger. */
  exemples: { id: string; libelle: string }[];
  /** Où cliquer, quand un écran existe. */
  lien?: string;
}

export interface Voisinage {
  ancre: { type: AncreType; id: string; libelle: string };
  aretes: Arete[];
  /** Le total des entités atteintes en UN saut. C'est la mesure de ce qu'on a évité de chercher. */
  totalVoisins: number;
  /** Ce que la traversée NE couvre pas — dit, pour qu'on sache quand chercher ailleurs. */
  horsGraphe: string[];
}

const ECHANTILLON = 5;

/** Une arête n'est rendue que si elle existe : un tableau de zéros n'apprend rien à personne. */
function arete(relation: string, vers: string, nombre: number, exemples: { id: string; libelle: string }[], lien?: string): Arete | null {
  if (nombre === 0) return null;
  return { relation, vers, nombre, exemples, ...(lien ? { lien } : {}) };
}

/**
 * LE VOISINAGE D'UN PRODUIT — tout ce que l'entreprise lui a explicitement rattaché.
 *
 * Chaque nombre vient d'un `count` sur une clé étrangère, chaque exemple d'un `take` borné :
 * la réponse est exacte sur les totaux et légère sur le détail, ce qui est la seule combinaison
 * utilisable dans une conversation.
 */
export async function voisinageProduit(productId: string): Promise<Voisinage | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, code: true, canonicalName: true },
  });
  if (!p) return null;

  const [
    nDossiers, dossiers, nPromo, promo, nBd, bd,
    nLignes, lignes, nVentes, ventes, nAffect, affect, nVisites, nAdpro, nFaits,
  ] = await Promise.all([
    prisma.regulatoryProduct.count({ where: { productId } }),
    prisma.regulatoryProduct.findMany({ where: { productId }, select: { id: true, reference: true, brandName: true }, take: ECHANTILLON }),
    prisma.promoProduct.count({ where: { productId } }),
    prisma.promoProduct.findMany({ where: { productId }, select: { id: true, name: true }, take: ECHANTILLON }),
    prisma.bdProduct.count({ where: { productId } }),
    prisma.bdProduct.findMany({ where: { productId }, select: { id: true, dci: true }, take: ECHANTILLON }),
    prisma.pchTenderLine.count({ where: { productId } }),
    prisma.pchTenderLine.findMany({
      where: { productId },
      select: { id: true, designation: true, tender: { select: { reference: true } } },
      take: ECHANTILLON,
    }),
    prisma.sale.count({ where: { productId } }),
    prisma.sale.findMany({ where: { productId }, select: { id: true, client: true, date: true }, orderBy: { date: "desc" }, take: ECHANTILLON }),
    prisma.productAssignment.count({ where: { productId } }),
    prisma.productAssignment.findMany({
      where: { productId },
      select: { id: true, role: true, user: { select: { name: true } } },
      take: ECHANTILLON,
    }),
    prisma.medicalVisitProduct.count({ where: { productId } }),
    prisma.adProProductAllocation.count({ where: { productId } }),
    // LES FAITS du registre d'événements. Ils ne sont pas une arête du schéma mais une arête du
    // TEMPS : « ce qui est arrivé à ce produit ». Les compter ici évite de se demander s'il faut
    // aussi aller voir la frise.
    prisma.businessEvent.count({ where: { entityType: "REGULATORY_PRODUCT", entityId: { in: (await prisma.regulatoryProduct.findMany({ where: { productId }, select: { id: true } })).map((d) => d.id) } } }),
  ]);

  const aretes = [
    arete("dossier réglementaire", "RegulatoryProduct", nDossiers,
      dossiers.map((d) => ({ id: d.id, libelle: d.brandName ? `${d.reference} — ${d.brandName}` : d.reference })), "/regulatory"),
    arete("profil promotion", "PromoProduct", nPromo, promo.map((x) => ({ id: x.id, libelle: x.name }))),
    arete("étude business development", "BdProduct", nBd, bd.map((x) => ({ id: x.id, libelle: x.dci }))),
    arete("ligne de marché PCH", "PchTenderLine", nLignes,
      lignes.map((l) => ({ id: l.id, libelle: `${l.tender.reference} — ${l.designation}` })), "/pch"),
    arete("vente", "Sale", nVentes,
      ventes.map((v) => ({ id: v.id, libelle: `${v.client} — ${v.date.toISOString().slice(0, 10)}` })), "/ventes"),
    arete("porté par", "User", nAffect,
      affect.map((a) => ({ id: a.id, libelle: `${a.user.name ?? "—"} (${a.role})` }))),
    arete("présenté en visite", "MedicalVisit", nVisites, []),
    arete("imputation Ad&Pro", "AdProItem", nAdpro, []),
    arete("fait enregistré", "BusinessEvent", nFaits, []),
  ].filter((a): a is Arete => a !== null);

  return {
    ancre: { type: "PRODUCT", id: p.id, libelle: `${p.code} — ${p.canonicalName}` },
    aretes,
    totalVoisins: aretes.reduce((n, a) => n + a.nombre, 0),
    // CE QUE LE GRAPHE NE VOIT PAS, dit explicitement : sans cette phrase, une traversée vide se
    // lirait « il n'y a rien », alors qu'elle veut dire « rien n'a été RATTACHÉ ».
    horsGraphe: [
      "les documents, courriels et notes qui parlent du produit sans lui être rattachés — ils se cherchent par le texte",
      "les ventes et visites saisies en libellé libre sans rapprochement au produit canonique",
    ],
  };
}

/** LE VOISINAGE D'UN MARCHÉ PCH — sa chaîne d'exécution, en un saut. */
export async function voisinageMarche(tenderId: string): Promise<Voisinage | null> {
  const t = await prisma.pchTender.findUnique({
    where: { id: tenderId },
    select: { id: true, reference: true, title: true },
  });
  if (!t) return null;

  const [nLignes, lignes, nBons, bons, nProduits] = await Promise.all([
    prisma.pchTenderLine.count({ where: { tenderId } }),
    prisma.pchTenderLine.findMany({ where: { tenderId }, select: { id: true, designation: true, status: true }, take: ECHANTILLON }),
    prisma.pchOrder.count({ where: { tenderId } }),
    prisma.pchOrder.findMany({ where: { tenderId }, select: { id: true, reference: true, status: true }, take: ECHANTILLON }),
    prisma.pchTenderLine.count({ where: { tenderId, productId: { not: null } } }),
  ]);

  const ligneIds = (await prisma.pchTenderLine.findMany({ where: { tenderId }, select: { id: true } })).map((l) => l.id);
  const nVentes = ligneIds.length ? await prisma.sale.count({ where: { tenderLineId: { in: ligneIds } } }) : 0;

  const aretes = [
    arete("ligne", "PchTenderLine", nLignes, lignes.map((l) => ({ id: l.id, libelle: `${l.designation} (${l.status})` }))),
    arete("bon de commande", "PchOrder", nBons, bons.map((o) => ({ id: o.id, libelle: `${o.reference ?? o.id} (${o.status})` }))),
    arete("produit canonique rattaché", "Product", nProduits, []),
    arete("vente rattachée", "Sale", nVentes, []),
  ].filter((a): a is Arete => a !== null);

  return {
    ancre: { type: "PCH_TENDER", id: t.id, libelle: t.title ? `${t.reference} — ${t.title}` : t.reference },
    aretes,
    totalVoisins: aretes.reduce((n, a) => n + a.nombre, 0),
    horsGraphe: [
      nProduits < nLignes
        ? `${nLignes - nProduits} ligne(s) sans produit canonique : elles ne remontent pas depuis un produit`
        : "toutes les lignes portent un produit canonique",
      "le dossier d'appel d'offres et ses pièces jointes se cherchent par le texte",
    ],
  };
}

/** LE VOISINAGE D'UNE PERSONNE — ce qu'elle porte, au sens des relations déclarées. */
export async function voisinagePersonne(userId: string): Promise<Voisinage | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!u) return null;

  const maintenant = new Date();
  const [nProduits, produits, nDossiers, nTaches, nFaits] = await Promise.all([
    prisma.productAssignment.count({ where: { userId } }),
    prisma.productAssignment.findMany({
      where: { userId },
      select: { id: true, role: true, endedAt: true, product: { select: { code: true, canonicalName: true } } },
      orderBy: { startedAt: "desc" }, take: ECHANTILLON,
    }),
    prisma.regulatoryProduct.count({ where: { responsibleId: userId } }),
    prisma.task.count({ where: { assignedToId: userId, status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.businessEvent.count({ where: { actorId: userId } }),
  ]);

  const aretes = [
    arete("porte le produit", "Product", nProduits,
      produits.map((a) => ({
        id: a.id,
        // L'AFFECTATION CLOSE EST MARQUÉE : « a porté » et « porte » ne se confondent pas, et
        // relancer quelqu'un sur un produit qu'il ne porte plus est une erreur visible.
        libelle: `${a.product.code} — ${a.product.canonicalName} (${a.role}${a.endedAt && a.endedAt <= maintenant ? ", terminée" : ""})`,
      }))),
    arete("responsable du dossier", "RegulatoryProduct", nDossiers, []),
    arete("tâche ouverte", "Task", nTaches, []),
    arete("auteur d'un fait", "BusinessEvent", nFaits, []),
  ].filter((a): a is Arete => a !== null);

  return {
    ancre: { type: "USER", id: u.id, libelle: u.name ?? u.email ?? u.id },
    aretes,
    totalVoisins: aretes.reduce((n, a) => n + a.nombre, 0),
    horsGraphe: [
      "le travail hors ERP — terrain, téléphone, réunions — n'a aucune arête et reste invisible ici",
    ],
  };
}

/** L'ancre demandée, quel que soit son type. Un seul point d'entrée pour l'appelant. */
export async function voisinage(type: AncreType, id: string): Promise<Voisinage | null> {
  switch (type) {
    case "PRODUCT": return voisinageProduit(id);
    case "PCH_TENDER": return voisinageMarche(id);
    case "USER": return voisinagePersonne(id);
  }
}
