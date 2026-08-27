import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { resolveProductMention } from "@/lib/products/resolve";
import type { ProductMatch } from "@/lib/products/identity";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * PRODUIT 360 — tout ce que l'entreprise sait d'un produit, en UNE lecture.
 *
 * ── POURQUOI CE FICHIER EST UNE FAÇADE (`queries/`) ET PAS UN MODULE MÉTIER ───────────────
 *
 * Un produit traverse tous les métiers : le dossier réglementaire, les marchés PCH, les ventes,
 * la promotion, les visites, le portefeuille de la force de vente. Une lecture qui les réunit
 * TRAVERSE les domaines par construction — c'est exactement la définition d'une façade L2
 * (`src/platform/domains.ts`). La poser dans `products/` ferait du domaine « regulatory » un
 * importateur de la finance et de l'Ad&Pro, c'est-à-dire ajouterait le couplage que le cliquet
 * d'architecture existe pour empêcher.
 *
 * ── CE QUE CETTE LECTURE REMPLACE ────────────────────────────────────────────────────────
 *
 * Avant : « quel est le bilan du produit X ? » demandait à Adam d'appeler product_360 (le
 * dossier), puis de chercher les ventes par TEXTE, puis les marchés par TEXTE, puis les dépenses
 * — quatre à six allers-retours modèle, dont plusieurs rapprochements faits AU JUGÉ par un LLM
 * sur des libellés qui ne s'écrivent pas pareil d'un module à l'autre.
 *
 * Maintenant : une clé étrangère, une requête, zéro rapprochement. Le LLM ne refait pas ce que
 * la base sait déjà.
 *
 * ── CE QUE CETTE LECTURE NE FAIT PAS ─────────────────────────────────────────────────────
 *
 * Elle ne calcule AUCUN indicateur nommé (chiffre d'affaires attribué, encaissé, contribution).
 * Elle ASSEMBLE. Les indicateurs sont définis une seule fois dans la couche métriques, qui les
 * calcule à partir de ces mêmes lignes — pour qu'un même mot désigne partout le même calcul.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const num = (v: unknown): number => (v === null || v === undefined ? 0 : toNumber(v));
const dec = (v: unknown): number | null => (v === null || v === undefined ? null : toNumber(v));
const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

/**
 * PLAFONDS DE LECTURE. Un produit très vendu peut porter des milliers de lignes ; les remonter
 * toutes ferait payer la latence à toutes les questions pour servir la plus rare. Les agrégats
 * (montants, quantités) sont calculés EN BASE sur la totalité — seul le DÉTAIL est borné, et le
 * fait d'être tronqué est DIT dans la réponse plutôt que passé sous silence.
 */
const DETAIL_CAP = 50;

export interface Produit360 {
  produit: {
    id: string;
    code: string;
    nom: string;
    dci: string;
    dosage: string | null;
    forme: string | null;
    conditionnement: string | null;
    canal: string;
    cycleDeVie: string;
    actif: boolean;
    entite: string | null;
    alias: string[];
  };
  /** Les PROFILS métier du même produit — ce que chaque module en dit. */
  profils: {
    reglementaire: {
      id: string; reference: string; nomCommercial: string | null; statut: string;
      priorite: string; chargeDuDossier: string | null;
      cibleDepot: string | null; cibleEnregistrement: string | null;
    }[];
    promotion: { id: string; nom: string; actif: boolean | null }[];
    businessDevelopment: { id: string; dci: string; nomCommercial: string | null; sourcing: string }[];
  };
  /** QUI PORTE CE PRODUIT — et pour quelle part de son temps. */
  portefeuille: {
    personne: string; role: string; territoire: string | null;
    depuis: string | null; jusquA: string | null; quotitePct: number | null; enCours: boolean;
  }[];
  /** LES MARCHÉS PCH où ce produit est nommé. */
  marches: {
    ligneId: string; marche: string; marcheId: string; designation: string;
    statut: string; quantiteUnites: number;
    prixUnitaireDzd: number | null; prixAttributionDzd: number | null;
  }[];
  /** LES VENTES — agrégats calculés en base, détail borné. */
  ventes: {
    nombre: number;
    quantiteTotale: number;
    chiffreAffairesDzd: number;
    parStatutDeReglement: { statut: string; nombre: number; montantDzd: number }[];
    parStatutDeLivraison: { statut: string; nombre: number; montantDzd: number }[];
    premiere: string | null;
    derniere: string | null;
    detail: { id: string; date: string | null; client: string; quantite: number; montantDzd: number; reglement: string; livraison: string }[];
    detailTronque: boolean;
  };
  /** L'INVESTISSEMENT PROMOTIONNEL imputé à ce produit. */
  investissementAdPro: {
    nombreDePostes: number;
    montantImputeDzd: number;
    detail: { itemId: string; poste: string; partPct: number | null; montantDzd: number | null; statut: string }[];
    detailTronque: boolean;
    /** Les postes dont la part n'a PAS été saisie — leur montant n'est imputé nulle part. */
    postesSansPart: number;
  };
  /** L'ACTIVITÉ TERRAIN — visites où le produit a été présenté. */
  terrain: { nombreDeVisites: number; derniereVisite: string | null; parDelegue: { delegue: string; visites: number }[] };
  /** Ce que la lecture N'A PAS PU voir, dit explicitement. */
  limites: string[];
}

/** Les identifiants d'une résolution ambiguë, pour que l'appelant puisse POSER la question. */
export interface Produit360Ambigu {
  ambigu: true;
  message: string;
  candidats: { id: string; code: string; nom: string; dosage: string | null; forme: string | null }[];
}

export type Produit360Result = Produit360 | Produit360Ambigu | null;

/** L'ambiguïté est une RÉPONSE, pas un échec — l'appelant la pose à l'humain. */
export function estAmbigu(r: Produit360Result): r is Produit360Ambigu {
  return r !== null && "ambigu" in r;
}

/**
 * LA VUE 360 D'UN PRODUIT, par mention (référence, alias, DCI + dosage…) ou par identifiant.
 *
 * Rend `null` quand rien ne correspond, un objet `ambigu` quand PLUSIEURS produits correspondent
 * au même degré de certitude. Trancher à la place de l'humain sur un dosage, c'est présenter en
 * réunion le chiffre d'affaires du 40 mg sous le nom du 100 mg.
 */
export async function produit360(mention: string): Promise<Produit360Result> {
  const brut = (mention ?? "").trim();
  if (brut.length < 2) return null;

  let id = "";
  // Un identifiant direct court-circuite la résolution — l'appelant sait déjà de quoi il parle.
  const direct = await prisma.product.findUnique({ where: { id: brut }, select: { id: true } });
  if (direct) {
    id = direct.id;
  } else {
    const matches: ProductMatch[] = await resolveProductMention(brut);
    if (matches.length === 0) return null;
    const certains = matches.filter((m) => m.certain);
    const retenus = certains.length > 0 ? certains : matches;
    if (retenus.length > 1) {
      return {
        ambigu: true,
        message: `${retenus.length} produits correspondent à « ${brut} » — préciser le dosage, la forme ou la référence.`,
        candidats: retenus.map((m) => ({
          id: m.product.id, code: m.product.code, nom: m.product.canonicalName,
          dosage: m.product.dosage ?? null, forme: m.product.form ?? null,
        })),
      };
    }
    id = retenus[0].product.id;
  }

  return produit360ParId(id);
}

/** La vue 360 d'un produit DÉJÀ résolu. C'est ici que tout le travail de lecture se fait. */
export async function produit360ParId(productId: string): Promise<Produit360 | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true, code: true, canonicalName: true, dci: true, dosage: true, dosageUnit: true,
      form: true, packaging: true, channel: true, lifecycle: true, isActive: true,
      company: { select: { shortName: true, name: true } },
      aliases: { select: { label: true }, take: 30 },
      regulatoryProfiles: {
        select: {
          id: true, reference: true, brandName: true, status: true, priority: true,
          targetSubmissionDate: true, targetDate: true,
          responsible: { select: { name: true } },
        },
        take: 20,
      },
      promoProfiles: { select: { id: true, name: true, isActive: true }, take: 20 },
      // `sourcing` (TO_STUDY, …) est le statut d'un produit à l'étude côté Business Development —
      // `BdProduct` n'a pas de champ `status`.
      bdProfiles: { select: { id: true, dci: true, brandName: true, sourcing: true }, take: 20 },
      assignments: {
        select: {
          role: true, territory: true, startedAt: true, endedAt: true, allocationPct: true,
          user: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 40,
      },
      tenderLines: {
        select: {
          id: true, designation: true, status: true, quantityUnits: true,
          unitPriceDzd: true, awardedUnitPriceDzd: true,
          tender: { select: { id: true, reference: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: DETAIL_CAP,
      },
    },
  });
  if (!p) return null;

  // LES AGRÉGATS SONT CALCULÉS EN BASE, sur la TOTALITÉ des lignes. Additionner en mémoire les
  // 50 lignes remontées donnerait un chiffre d'affaires FAUX dès le 51ᵉ enregistrement, et faux
  // sans le dire — le pire des deux mondes.
  const [
    ventesTotal, ventesParReglement, ventesParLivraison, ventesBornes, ventesDetail,
    adproTotal, adproDetail, adproSansPart, visitesTotal, visitesDetail,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: { productId }, _count: { _all: true }, _sum: { quantity: true, revenue: true } }),
    prisma.sale.groupBy({ by: ["paymentStatus"], where: { productId }, _count: { _all: true }, _sum: { revenue: true } }),
    prisma.sale.groupBy({ by: ["deliveryStatus"], where: { productId }, _count: { _all: true }, _sum: { revenue: true } }),
    prisma.sale.aggregate({ where: { productId }, _min: { date: true }, _max: { date: true } }),
    prisma.sale.findMany({
      where: { productId },
      select: { id: true, date: true, client: true, quantity: true, revenue: true, paymentStatus: true, deliveryStatus: true },
      orderBy: { date: "desc" }, take: DETAIL_CAP,
    }),
    prisma.adProProductAllocation.aggregate({ where: { productId }, _count: { _all: true }, _sum: { amountAllocated: true } }),
    prisma.adProProductAllocation.findMany({
      where: { productId },
      select: {
        itemId: true, sharePct: true, amountAllocated: true,
        item: { select: { label: true, status: true, amountGranted: true, amountEstimated: true } },
      },
      orderBy: { createdAt: "desc" }, take: DETAIL_CAP,
    }),
    prisma.adProProductAllocation.count({ where: { productId, sharePct: null, amountAllocated: null } }),
    prisma.medicalVisitProduct.count({ where: { productId } }),
    prisma.medicalVisitProduct.findMany({
      where: { productId },
      select: { visit: { select: { date: true, delegate: { select: { name: true } } } } },
      orderBy: { visit: { date: "desc" } }, take: 200,
    }),
  ]);

  const now = new Date();

  const parDelegue = new Map<string, number>();
  for (const v of visitesDetail) {
    const nom = v.visit.delegate?.name ?? "non renseigné";
    parDelegue.set(nom, (parDelegue.get(nom) ?? 0) + 1);
  }

  const limites: string[] = [];
  if (ventesTotal._count._all > DETAIL_CAP) {
    limites.push(`ventes : ${ventesTotal._count._all} lignes au total, les ${DETAIL_CAP} plus récentes sont détaillées — les totaux, eux, portent sur la totalité`);
  }
  if (adproSansPart > 0) {
    limites.push(`${adproSansPart} imputation(s) Ad&Pro sans part ni montant saisis : leur dépense n'est comptée nulle part`);
  }
  if (visitesTotal > 200) {
    limites.push(`visites : ${visitesTotal} au total, la répartition par délégué porte sur les 200 plus récentes`);
  }
  if (p.regulatoryProfiles.length === 0) {
    limites.push("aucun dossier réglementaire rattaché — le produit peut être à l'étude, ou son dossier non encore rapproché");
  }

  return {
    produit: {
      id: p.id, code: p.code, nom: p.canonicalName, dci: p.dci,
      dosage: p.dosage ? `${p.dosage} ${p.dosageUnit ?? ""}`.trim() : null,
      forme: p.form, conditionnement: p.packaging,
      canal: p.channel, cycleDeVie: p.lifecycle, actif: p.isActive,
      entite: p.company?.shortName ?? p.company?.name ?? null,
      alias: p.aliases.map((a) => a.label),
    },
    profils: {
      reglementaire: p.regulatoryProfiles.map((r) => ({
        id: r.id, reference: r.reference, nomCommercial: r.brandName,
        statut: r.status, priorite: r.priority,
        chargeDuDossier: r.responsible?.name ?? null,
        cibleDepot: ymd(r.targetSubmissionDate), cibleEnregistrement: ymd(r.targetDate),
      })),
      promotion: p.promoProfiles.map((x) => ({ id: x.id, nom: x.name, actif: x.isActive })),
      businessDevelopment: p.bdProfiles.map((x) => ({ id: x.id, dci: x.dci, nomCommercial: x.brandName, sourcing: x.sourcing })),
    },
    portefeuille: p.assignments.map((a) => ({
      personne: a.user.name ?? "—", role: a.role, territoire: a.territory,
      depuis: ymd(a.startedAt), jusquA: ymd(a.endedAt),
      quotitePct: dec(a.allocationPct),
      // « En cours » se DÉDUIT des dates, il ne se stocke pas : un drapeau qu'il faut penser à
      // retourner finit toujours par mentir.
      enCours: a.startedAt <= now && (a.endedAt === null || a.endedAt > now),
    })),
    marches: p.tenderLines.map((l) => ({
      ligneId: l.id, marche: l.tender.title ?? l.tender.reference, marcheId: l.tender.id,
      designation: l.designation, statut: l.status, quantiteUnites: l.quantityUnits,
      prixUnitaireDzd: dec(l.unitPriceDzd), prixAttributionDzd: dec(l.awardedUnitPriceDzd),
    })),
    ventes: {
      nombre: ventesTotal._count._all,
      quantiteTotale: ventesTotal._sum.quantity ?? 0,
      chiffreAffairesDzd: num(ventesTotal._sum.revenue),
      parStatutDeReglement: ventesParReglement.map((g) => ({
        statut: g.paymentStatus, nombre: g._count._all, montantDzd: num(g._sum.revenue),
      })),
      parStatutDeLivraison: ventesParLivraison.map((g) => ({
        statut: g.deliveryStatus, nombre: g._count._all, montantDzd: num(g._sum.revenue),
      })),
      premiere: ymd(ventesBornes._min.date), derniere: ymd(ventesBornes._max.date),
      detail: ventesDetail.map((s) => ({
        id: s.id, date: ymd(s.date), client: s.client, quantite: s.quantity,
        montantDzd: num(s.revenue), reglement: s.paymentStatus, livraison: s.deliveryStatus,
      })),
      detailTronque: ventesTotal._count._all > DETAIL_CAP,
    },
    investissementAdPro: {
      nombreDePostes: adproTotal._count._all,
      montantImputeDzd: num(adproTotal._sum.amountAllocated),
      detail: adproDetail.map((a) => ({
        itemId: a.itemId, poste: a.item.label,
        partPct: dec(a.sharePct),
        // LE MONTANT IMPUTÉ, dans l'ordre de fiabilité : montant saisi directement, sinon la
        // PART appliquée au montant ACCORDÉ. Jamais sur l'estimation seule — une estimation
        // n'est pas une dépense, et l'afficher comme telle gonflerait le coût d'un produit avec
        // de l'argent que personne n'a engagé.
        montantDzd: a.amountAllocated !== null
          ? num(a.amountAllocated)
          : (a.sharePct !== null && a.item.amountGranted !== null
            ? Math.round(num(a.item.amountGranted) * (num(a.sharePct) / 100))
            : null),
        statut: a.item.status,
      })),
      detailTronque: adproTotal._count._all > DETAIL_CAP,
      postesSansPart: adproSansPart,
    },
    terrain: {
      nombreDeVisites: visitesTotal,
      derniereVisite: ymd(visitesDetail[0]?.visit.date ?? null),
      parDelegue: [...parDelegue.entries()]
        .map(([delegue, visites]) => ({ delegue, visites }))
        .sort((a, b) => b.visites - a.visites),
    },
    limites,
  };
}
