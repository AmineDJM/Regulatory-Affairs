import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PCH 360 — un marché de bout en bout : soumission → attribution → commandes → livraison →
 * encaissement.
 *
 * ── LE PROBLÈME QUE CETTE LECTURE RÉSOUT ─────────────────────────────────────────────────
 *
 * « Où en est le marché X ? » n'a pas UNE réponse mais cinq, et elles ne disent pas la même
 * chose : ce qu'on a GAGNÉ n'est pas ce qui a été COMMANDÉ, qui n'est pas ce qui a été LIVRÉ,
 * qui n'est pas ce qui a été ENCAISSÉ. Confondre deux de ces montants, c'est annoncer un chiffre
 * d'affaires sur de l'argent qui n'arrivera peut-être jamais.
 *
 * Chaque montant porte donc ici son NOM et sa DÉFINITION. Aucun n'est additionné à un autre.
 *
 * ── LE PIÈGE DU DOUBLE COMPTE, ET COMMENT IL EST FERMÉ ───────────────────────────────────
 *
 * Un même euro peut apparaître DEUX FOIS dans l'ERP : une fois comme `PchOrder` (le bon de
 * commande PCH) et une fois comme `Sale` (la vente enregistrée par le commercial). Les
 * additionner doublerait le chiffre d'affaires du marché.
 *
 * Les deux sont donc rendus SÉPARÉMENT, jamais cumulés, et l'écart entre eux est CALCULÉ et
 * nommé : c'est un signal de saisie incomplète d'un côté ou de l'autre, pas une erreur de calcul.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const num = (v: unknown): number => (v === null || v === undefined ? 0 : toNumber(v));
const dec = (v: unknown): number | null => (v === null || v === undefined ? null : toNumber(v));
const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Un bon de commande LIVRÉ : livré, ou payé (on ne paie pas ce qu'on n'a pas reçu). */
const LIVRE = new Set(["DELIVERED", "PAID"]);
/** Un bon de commande ENCAISSÉ. `paymentDate` vaut preuve autant que le statut. */
const ENCAISSE = new Set(["PAID"]);
/** Un bon ANNULÉ ne compte dans aucun montant — ni commandé, ni livré, ni encaissé. */
const ANNULE = "CANCELLED";

export interface Pch360 {
  marche: {
    id: string; reference: string; titre: string | null; statut: string;
    client: string; fournisseur: string | null; entite: string | null;
    dateAttribution: string | null; valeurAnnoncee: number | null;
  };
  /** LA CAUTION — obligatoire, et son échéance est un risque à part entière. */
  caution: {
    montantDzd: number | null; deposee: boolean;
    debut: string | null; fin: string | null;
    joursAvantEcheance: number | null;
    alerte: string | null;
  };
  /** LES LIGNES du marché, avec leur produit canonique quand il est rattaché. */
  lignes: {
    id: string; designation: string; statut: string;
    quantiteUnites: number;
    prixUnitaireDzd: number | null; prixAttributionDzd: number | null;
    valeurAttribueeDzd: number | null;
    produit: { id: string; code: string; nom: string } | null;
    /** Le libellé texte historique, conservé — le marché fait foi juridiquement. */
    notreProduitTexte: string | null;
    unitesCommandees: number; nombreDeBons: number;
    tauxDeRealisationPct: number | null;
  }[];
  /**
   * LES CINQ MONTANTS, chacun avec sa définition. Ils ne s'additionnent pas : ils se comparent.
   */
  montants: {
    attribueDzd: number;
    commandeDzd: number;
    livreDzd: number;
    encaisseDzd: number;
    resteAEncaisserDzd: number;
    definitions: Record<string, string>;
  };
  /** Ce que les COMMERCIAUX ont enregistré en face — rendu à part, jamais additionné. */
  ventesEnregistrees: { nombre: number; chiffreAffairesDzd: number; ecartAvecCommandeDzd: number };
  execution: {
    nombreDeBons: number;
    bonsEnAttente: number;
    bonsLivres: number;
    bonsPayes: number;
    bonsAnnules: number;
    enRetardDArrivee: { reference: string; arriveePrevue: string | null; joursDeRetard: number }[];
  };
  /** Ce que la lecture ne sait PAS, dit plutôt que tu. */
  limites: string[];
}

/** Le marché de bout en bout, par identifiant ou par référence (« AO-2025-014 »). */
export async function pch360(idOuReference: string): Promise<Pch360 | null> {
  const clef = (idOuReference ?? "").trim();
  if (!clef) return null;

  const t = await prisma.pchTender.findFirst({
    where: { OR: [{ id: clef }, { reference: { equals: clef, mode: "insensitive" } }] },
    select: {
      id: true, reference: true, title: true, status: true, client: true,
      supplier: true, awardDate: true, value: true,
      cautionAmount: true, cautionDeposited: true, cautionStart: true, cautionEnd: true,
      company: { select: { shortName: true, name: true } },
      lines: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, designation: true, status: true, quantityUnits: true,
          unitPriceDzd: true, awardedUnitPriceDzd: true, ourProduct: true,
          product: { select: { id: true, code: true, canonicalName: true } },
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, lineId: true, reference: true, quantity: true, value: true, status: true,
          receivedDate: true, paymentDate: true, expectedArrival: true, arrivedDate: true,
        },
      },
    },
  });
  if (!t) return null;

  const now = new Date();
  const DAY = 86_400_000;

  // ── Les bons, ventilés par ligne et par état ──────────────────────────────────────────
  const parLigne = new Map<string, { unites: number; bons: number }>();
  let commande = 0, livre = 0, encaisse = 0;
  let enAttente = 0, livres = 0, payes = 0, annules = 0;
  const retards: Pch360["execution"]["enRetardDArrivee"] = [];

  for (const o of t.orders) {
    if (o.status === ANNULE) { annules++; continue; }
    const v = num(o.value);
    commande += v;
    if (LIVRE.has(o.status)) { livre += v; livres++; }
    // Le STATUT ou la DATE de paiement : l'un des deux suffit. Exiger les deux ferait
    // disparaître de l'encaissé un règlement daté que personne n'a pensé à re-cocher.
    if (ENCAISSE.has(o.status) || o.paymentDate !== null) { encaisse += v; payes++; }
    if (o.status === "PENDING" || o.status === "VALIDATED") enAttente++;

    if (o.lineId) {
      const cur = parLigne.get(o.lineId) ?? { unites: 0, bons: 0 };
      cur.unites += o.quantity;
      cur.bons += 1;
      parLigne.set(o.lineId, cur);
    }

    // EN RETARD D'ARRIVÉE : la date prévue est passée et la marchandise n'est pas arrivée.
    if (o.expectedArrival && !o.arrivedDate && o.expectedArrival < now) {
      retards.push({
        reference: o.reference ?? o.id,
        arriveePrevue: ymd(o.expectedArrival),
        joursDeRetard: Math.floor((now.getTime() - o.expectedArrival.getTime()) / DAY),
      });
    }
  }

  // ── L'ATTRIBUÉ : ce que les lignes GAGNÉES valent au prix d'attribution ────────────────
  // Une ligne gagnée sans prix d'attribution saisi ne compte PAS : inventer sa valeur au prix
  // proposé donnerait un montant plausible et faux, et personne ne saurait qu'il l'est.
  let attribue = 0;
  let gagneesSansPrix = 0;
  const lignes = t.lines.map((l) => {
    const gagnee = l.status === "WON";
    const pa = dec(l.awardedUnitPriceDzd);
    const valeur = gagnee && pa !== null ? Math.round(l.quantityUnits * pa) : null;
    if (valeur !== null) attribue += valeur;
    if (gagnee && pa === null) gagneesSansPrix++;

    const cmd = parLigne.get(l.id) ?? { unites: 0, bons: 0 };
    return {
      id: l.id, designation: l.designation, statut: l.status,
      quantiteUnites: l.quantityUnits,
      prixUnitaireDzd: dec(l.unitPriceDzd), prixAttributionDzd: pa,
      valeurAttribueeDzd: valeur,
      produit: l.product ? { id: l.product.id, code: l.product.code, nom: l.product.canonicalName } : null,
      notreProduitTexte: l.ourProduct,
      unitesCommandees: cmd.unites, nombreDeBons: cmd.bons,
      tauxDeRealisationPct: gagnee && l.quantityUnits > 0 ? Math.round((cmd.unites / l.quantityUnits) * 100) : null,
    };
  });

  // ── Ce que les commerciaux ont enregistré en face, SANS l'additionner aux bons ─────────
  const ligneIds = t.lines.map((l) => l.id);
  const ventes = ligneIds.length
    ? await prisma.sale.aggregate({
      where: { tenderLineId: { in: ligneIds } },
      _count: { _all: true }, _sum: { revenue: true },
    })
    : { _count: { _all: 0 }, _sum: { revenue: null } };
  const caVentes = num(ventes._sum.revenue);

  const joursCaution = t.cautionEnd ? Math.floor((t.cautionEnd.getTime() - now.getTime()) / DAY) : null;

  const limites: string[] = [];
  if (gagneesSansPrix > 0) {
    limites.push(`${gagneesSansPrix} ligne(s) gagnée(s) sans prix d'attribution saisi : leur valeur n'est PAS comptée dans l'attribué`);
  }
  const sansLigne = t.orders.filter((o) => !o.lineId && o.status !== ANNULE).length;
  if (sansLigne > 0) {
    limites.push(`${sansLigne} bon(s) de commande non rattaché(s) à une ligne : comptés dans les montants du marché, absents des taux de réalisation par ligne`);
  }
  const sansProduit = t.lines.filter((l) => !l.product).length;
  if (sansProduit > 0) {
    limites.push(`${sansProduit} ligne(s) sans produit canonique rattaché — le rapprochement n'est pas fait, ou nous ne portons pas ce produit`);
  }
  if (ventes._count._all === 0 && commande > 0) {
    limites.push("aucune vente enregistrée en face des bons de commande : la saisie commerciale est en retard, ou passe par un autre canal");
  }

  return {
    marche: {
      id: t.id, reference: t.reference, titre: t.title, statut: t.status,
      client: t.client, fournisseur: t.supplier,
      entite: t.company?.shortName ?? t.company?.name ?? null,
      dateAttribution: ymd(t.awardDate), valeurAnnoncee: dec(t.value),
    },
    caution: {
      montantDzd: dec(t.cautionAmount), deposee: t.cautionDeposited,
      debut: ymd(t.cautionStart), fin: ymd(t.cautionEnd),
      joursAvantEcheance: joursCaution,
      alerte: num(t.cautionAmount) > 0 && !t.cautionDeposited
        ? "caution NON DÉPOSÉE alors qu'un montant est prévu"
        : joursCaution !== null && joursCaution >= 0 && joursCaution <= 30
          ? `caution à échéance dans ${joursCaution} jour(s)`
          : joursCaution !== null && joursCaution < 0 && t.cautionDeposited
            ? `caution EXPIRÉE depuis ${-joursCaution} jour(s)`
            : null,
    },
    lignes,
    montants: {
      attribueDzd: attribue,
      commandeDzd: Math.round(commande),
      livreDzd: Math.round(livre),
      encaisseDzd: Math.round(encaisse),
      resteAEncaisserDzd: Math.round(commande - encaisse),
      definitions: {
        attribue: "somme des lignes GAGNÉES × prix d'attribution — la valeur du marché remporté, pas encore de l'argent",
        commande: "somme des bons de commande PCH non annulés — ce que la PCH a réellement commandé",
        livre: "bons de commande au statut LIVRÉ ou PAYÉ — la marchandise est partie",
        encaisse: "bons de commande PAYÉS ou portant une date de règlement — l'argent est arrivé",
        resteAEncaisser: "commandé − encaissé — la créance ouverte sur ce marché",
      },
    },
    ventesEnregistrees: {
      nombre: ventes._count._all,
      chiffreAffairesDzd: caVentes,
      // L'ÉCART EST UN SIGNAL, PAS UNE SOMME. Positif : des bons sans vente enregistrée.
      // Négatif : des ventes rattachées au marché sans bon de commande en face.
      ecartAvecCommandeDzd: Math.round(commande - caVentes),
    },
    execution: {
      nombreDeBons: t.orders.length,
      bonsEnAttente: enAttente, bonsLivres: livres, bonsPayes: payes, bonsAnnules: annules,
      enRetardDArrivee: retards.sort((a, b) => b.joursDeRetard - a.joursDeRetard),
    },
    limites,
  };
}

/**
 * LA POSITION D'UN PRODUIT SUR LES MARCHÉS PCH — l'autre sens de lecture.
 *
 * `pch360` répond « où en est ce marché ». Celle-ci répond « comment ce produit se comporte-t-il
 * sur les marchés », question qui traverse PLUSIEURS appels d'offres.
 */
export async function pchParProduit(productId: string): Promise<{
  lignes: number; gagnees: number; perdues: number; enCours: number;
  attribueDzd: number; commandeDzd: number;
  marches: { marcheId: string; reference: string; ligneId: string; statut: string; valeurAttribueeDzd: number | null }[];
} | null> {
  const lignes = await prisma.pchTenderLine.findMany({
    where: { productId },
    select: {
      id: true, status: true, quantityUnits: true, awardedUnitPriceDzd: true,
      tender: { select: { id: true, reference: true } },
    },
    take: 200,
  });
  if (lignes.length === 0) {
    return { lignes: 0, gagnees: 0, perdues: 0, enCours: 0, attribueDzd: 0, commandeDzd: 0, marches: [] };
  }

  const commandes = await prisma.pchOrder.aggregate({
    where: { lineId: { in: lignes.map((l) => l.id) }, status: { not: "CANCELLED" } },
    _sum: { value: true },
  });

  let attribue = 0;
  const marches = lignes.map((l) => {
    const pa = dec(l.awardedUnitPriceDzd);
    const valeur = l.status === "WON" && pa !== null ? Math.round(l.quantityUnits * pa) : null;
    if (valeur !== null) attribue += valeur;
    return {
      marcheId: l.tender.id, reference: l.tender.reference, ligneId: l.id,
      statut: l.status, valeurAttribueeDzd: valeur,
    };
  });

  return {
    lignes: lignes.length,
    gagnees: lignes.filter((l) => l.status === "WON").length,
    perdues: lignes.filter((l) => l.status === "LOST").length,
    enCours: lignes.filter((l) => l.status === "PENDING" || l.status === "QUOTED" || l.status === "SUBMITTED").length,
    attribueDzd: attribue,
    commandeDzd: num(commandes._sum.value),
    marches,
  };
}
