import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { legalReaderWhere } from "@/lib/lecteurs/legal";
import {
  AO_STATUTS_CLOS, LIGNE_STATUTS_CLOS,
} from "@/lib/pch/rattachement-produit";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « CE PRODUIT EST-IL DÉJÀ ENGAGÉ AILLEURS ? » — la question au moment où elle compte.
 *
 * ── POURQUOI CETTE LECTURE EXISTE ────────────────────────────────────────────────────────
 *
 * La Direction énonce une cardinalité : un produit est lié à UN SEUL appel d'offres, donc un
 * seul marché PCH. `lib/pch/rattachement-produit.ts` sait la LIRE sur un produit ; encore
 * fallait-il que quelqu'un la VOIE au moment de décider — sinon c'est une vue parfaite que rien
 * n'affiche (§118.50).
 *
 * Le moment, c'est la préparation d'une offre : on chiffre un lot, et la seule chose qu'on ne
 * peut pas deviner est que ce produit court déjà sur un AUTRE marché. Une fois l'offre déposée,
 * la contradiction existe et coûte une négociation ; avant, elle coûte un clic.
 *
 * ── UNE REQUÊTE POUR TOUT L'ÉCRAN, PAS UNE PAR LIGNE ─────────────────────────────────────
 *
 * Un AO porte couramment cinquante lots. Une lecture par ligne ferait cinquante allers-retours
 * pour afficher un tableau — le défaut mesuré des décors de test (§118.102b), à l'échelle d'un
 * écran que l'on ouvre tous les jours. On charge donc les engagements de TOUS les produits de
 * l'AO en deux requêtes, et l'écran lit une table.
 *
 * ── LE CÔTÉ CONTRAT PASSE PAR LA PORTE DE LEGAL ──────────────────────────────────────────
 *
 * Un marché PCH est une pièce `LegalDocument`. Quelqu'un qui a le module PCH sans avoir Legal
 * ne doit pas apprendre ici le titre d'un contrat confidentiel : la garde est `legalReaderWhere`
 * composée au droit de MODULE, exactement comme les pièces liées d'Ad & Pro (§118.109, §118.71).
 * Sans le module Legal, le côté contrat n'est pas seulement masqué — il n'est pas CHARGÉ.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EngagementAilleurs {
  /** Les AUTRES appels d'offres vivants où ce produit est engagé. */
  autresAo: { aoId: string; reference: string; titre: string | null }[];
  /** Les marchés PCH où il figure — vide si la personne n'a pas le droit de les lire. */
  marches: { contratId: string; titre: string; reference: string | null }[];
  /**
   * Le côté contrat A-T-IL ÉTÉ REGARDÉ ? Faux quand la personne n'a pas Legal. Sans ce
   * témoin, une liste vide se lirait « aucun marché », alors qu'elle dit « je n'ai pas
   * regardé » — la confusion exacte que ce dépôt ferme partout (§118.57b).
   */
  marchesLus: boolean;
}

export type EngagementsParProduit = Map<string, EngagementAilleurs>;

/**
 * LES ENGAGEMENTS AILLEURS des produits d'un appel d'offres — `productId` → ce qu'on a trouvé.
 *
 * Un produit absent de la table n'a AUCUN engagement ailleurs. Une ligne d'AO sans produit
 * canonique n'y figure pas non plus : sans identité, on ne peut rien rapprocher, et rapprocher
 * par ressemblance de libellé est précisément ce que l'entité `Product` existe pour éviter.
 */
export async function loadEngagementsAilleurs(
  user: SessionUser,
  tenderId: string,
  productIds: readonly string[],
): Promise<EngagementsParProduit> {
  const table: EngagementsParProduit = new Map();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return table;

  const peutLireLegal = userCan(user, "LEGAL", "VIEW");
  const filtreLecteur = legalReaderWhere({
    viewerId: user.id,
    isSuperAdmin: user.role === "SUPER_ADMIN",
  });

  const [lignesAilleurs, lignesMarche] = await Promise.all([
    // LES AUTRES AO VIVANTS. « Vivant » se lit sur les DEUX axes, avec les mêmes vocabulaires
    // fermés que le module pur : un AO terminé ou un lot perdu n'engage plus rien, et le
    // signaler ferait de chaque produit reconduit une alerte permanente (§118.32).
    prisma.pchTenderLine.findMany({
      where: {
        productId: { in: ids },
        tenderId: { not: tenderId },
        status: { notIn: [...LIGNE_STATUTS_CLOS] as never[] },
        tender: { status: { notIn: [...AO_STATUTS_CLOS] as never[] } },
      },
      select: { productId: true, tender: { select: { id: true, reference: true, title: true } } },
      take: 300,
    }),
    peutLireLegal
      ? prisma.pchContractLine.findMany({
        where: {
          productId: { in: ids },
          ...(filtreLecteur ? { contract: filtreLecteur } : {}),
        },
        select: { productId: true, contract: { select: { id: true, title: true, reference: true } } },
        take: 300,
      })
      : Promise.resolve([]),
  ]);

  const entree = (pid: string): EngagementAilleurs => {
    const e = table.get(pid) ?? { autresAo: [], marches: [], marchesLus: peutLireLegal };
    table.set(pid, e);
    return e;
  };

  for (const l of lignesAilleurs) {
    if (!l.productId) continue;
    const e = entree(l.productId);
    // DÉDOUBLONNÉ PAR MARCHÉ : un même AO peut porter deux lots du même produit (deux dosages),
    // et l'annoncer deux fois ferait croire à deux engagements (§118.51 : le dénominateur).
    if (!e.autresAo.some((a) => a.aoId === l.tender.id)) {
      e.autresAo.push({ aoId: l.tender.id, reference: l.tender.reference, titre: l.tender.title });
    }
  }
  for (const l of lignesMarche) {
    if (!l.productId) continue;
    const e = entree(l.productId);
    if (!e.marches.some((m) => m.contratId === l.contract.id)) {
      e.marches.push({ contratId: l.contract.id, titre: l.contract.title, reference: l.contract.reference });
    }
  }
  return table;
}

/**
 * LA PHRASE À AFFICHER, ou `null` quand il n'y a rien à dire.
 *
 * Elle NOMME les pièces — une réserve qui dit « déjà engagé ailleurs » sans dire OÙ oblige à
 * chercher soi-même, ce qui est le défaut d'un refus qui nomme la faute sans le remède
 * (§118.30). Et elle se TAIT quand tout est en règle : une réserve permanente devient du bruit,
 * et on cesse de la lire au moment où elle compte (§118.32).
 */
export function reserveEngagement(e: EngagementAilleurs | undefined): string | null {
  if (!e) return null;
  const bouts: string[] = [];
  if (e.autresAo.length > 0) {
    bouts.push(`déjà engagé sur ${e.autresAo.length === 1 ? "l'AO" : "les AO"} ${e.autresAo.map((a) => a.reference).join(", ")}`);
  }
  if (e.marches.length > 0) {
    bouts.push(`sous marché ${e.marches.map((m) => m.reference ?? m.titre).join(", ")}`);
  }
  if (bouts.length === 0) return null;
  return `Un produit est lié à un seul AO : celui-ci est ${bouts.join(" et ")}.`
    + (e.marchesLus ? "" : " (les marchés PCH n'ont pas été consultés — module Legal absent.)");
}
