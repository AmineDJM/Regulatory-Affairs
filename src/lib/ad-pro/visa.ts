import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { toNumber } from "@/lib/utils";
import { porteDgRequise } from "@/lib/seuils/ad-pro";
import { type EtatVisa, visaAutoriseAAvancer, motifBlocageVisa } from "./centre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE VISA DU CENTRE — poser la porte, la lire, la lever.
 *
 * Les cinq natures qui portent une étape de circuit (`dg`, `REVIEW_DG`) n'ont RIEN à faire ici :
 * leur porte est déjà leur état. Ce module ne sert que le consulting et les « autres demandes »,
 * qui n'en avaient aucune — mesuré sur leurs machines à états, rien n'y consultait le seuil.
 *
 * Il n'emporte AUCUNE permission : `siegeAuCentreAdPro` reste chez ses appelants. Y glisser une
 * garde en ferait une seconde vérité en retard sur `centre.ts` (§118.119a).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Le seuil en vigueur. Une lecture qui échoue rend `null` — donc AUCUNE porte, jamais un blocage. */
export async function seuilAdProEnVigueur(): Promise<number | null> {
  const s = await getAppSettings().catch(() => null);
  const v = s?.adProDgThreshold;
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * POSER LA PORTE SI LE MONTANT L'EXIGE — appelée à la SOUMISSION, pas à la création.
 *
 * Pourquoi à la soumission : un brouillon change de montant jusqu'à la dernière minute, et poser
 * la porte sur un chiffre provisoire ferait arbitrer le centre sur une demande que son auteur
 * n'a pas encore envoyée. C'est le moment où le demandeur DIT « voilà ma demande » qui compte.
 *
 * IDEMPOTENTE par la clé d'unicité `(entityType, entityId)` : repasser par la porte retrouve le
 * visa existant au lieu d'en créer un second. Et elle ne RÉOUVRE jamais un visa déjà tranché —
 * une resoumission après refus ne doit pas effacer la décision du centre ; c'est au centre de la
 * revoir. Rendre `APPROVED` sur un visa refusé serait le faux succès le plus coûteux du lot.
 *
 * Le seuil est FIGÉ dans le visa : sans lui, baisser le seuil rendrait la décision passée
 * inexplicable (§118.41).
 */
export async function poserVisaAdPro(
  entityType: EntityType,
  entityId: string,
  montant: number | null,
): Promise<EtatVisa | null> {
  const existant = await lireVisaAdPro(entityType, entityId);
  if (existant != null) return existant;

  const seuil = await seuilAdProEnVigueur();
  if (!porteDgRequise(montant, seuil)) return null;

  await prisma.adProGateVisa.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: {
      entityType, entityId, status: "PENDING",
      threshold: seuil as number,
      amount: montant != null && montant > 0 ? montant : null,
    },
    // Course entre deux soumissions simultanées : le second passage ne touche à rien.
    //
    // DEUX GARDES POUR UNE SEULE PROPRIÉTÉ, et c'est voulu — avec sa raison MESURÉE (§118.116).
    // Le retour anticipé ci-dessus évite une lecture de réglage inutile et rend l'état VRAI ;
    // ce `update: {}` protège l'entrelacement où deux soumissions se croisent avant que l'une
    // ait vu la ligne de l'autre. Le banc de sabotage l'a montré : retirée SEULE, chacune laisse
    // l'autre debout et le banc reste vert ; retirées ENSEMBLE, le banc tombe. Ce n'est donc pas
    // une redondance adossée à une affirmation fausse — c'est deux causes distinctes, chacune
    // avec son cas.
    update: {},
  });
  return "PENDING";
}

/**
 * RETIRER UNE PORTE QUI ATTEND — jamais une décision prise.
 *
 * Quand la demande quitte le périmètre du centre (un contrat de consulting transféré aux RH,
 * §118.150), ce qui attendait n'a plus d'objet : le centre de la promotion n'arbitre pas un
 * contrat qui ne relève plus d'elle. Une décision déjà RENDUE, elle, reste — c'est de l'histoire,
 * pas une attente. Rend le nombre de portes retirées, pour que l'appelant le DISE.
 */
export async function retirerVisaEnAttente(entityType: EntityType, entityId: string): Promise<number> {
  const r = await prisma.adProGateVisa.deleteMany({ where: { entityType, entityId, status: "PENDING" } });
  return r.count;
}

export async function lireVisaAdPro(
  entityType: EntityType,
  entityId: string,
): Promise<EtatVisa | null> {
  const v = await prisma.adProGateVisa
    .findUnique({ where: { entityType_entityId: { entityType, entityId } }, select: { status: true } })
    .catch(() => null);
  if (!v) return null;
  return lireEtatVisa(v.status);
}

/** La lecture d'un statut de visa — un statut inconnu ATTEND, le sens sûr (§118.16). */
export function lireEtatVisa(status: string): EtatVisa {
  return status === "APPROVED" || status === "REFUSED" || status === "CHANGES_REQUESTED" ? status : "PENDING";
}

/** Le visa tel que la FICHE le montre : l'état, le motif, qui et quand. `null` = aucune porte. */
export async function lireVisaDetail(
  entityType: EntityType,
  entityId: string,
): Promise<{ etat: EtatVisa; note: string | null; decidedAt: Date | null; decideur: string | null } | null> {
  const v = await prisma.adProGateVisa
    .findUnique({
      where: { entityType_entityId: { entityType, entityId } },
      select: { status: true, note: true, decidedAt: true, decidedBy: { select: { name: true } } },
    })
    .catch(() => null);
  if (!v) return null;
  return { etat: lireEtatVisa(v.status), note: v.note, decidedAt: v.decidedAt, decideur: v.decidedBy?.name ?? null };
}

/**
 * LE MONTANT QUE LE SEUIL COMPARE, relu sur la fiche — à la resoumission, la demande corrigée peut
 * avoir changé de montant, et c'est ce montant-là que le centre doit voir (§118.187 : un accord ne
 * couvre pas plus que ce qu'il a vu). `null` = non renseigné, ou une nature sans visa.
 */
export async function montantPourLeVisa(entityType: EntityType, entityId: string): Promise<number | null> {
  const brut = entityType === "CONSULTING_CONTRACT"
    ? (await prisma.consultingContract.findUnique({ where: { id: entityId }, select: { amount: true } }).catch(() => null))?.amount
    : entityType === "AD_PRO_OTHER"
      ? (await prisma.adProOtherRequest.findUnique({ where: { id: entityId }, select: { amount: true } }).catch(() => null))?.amount
      : null;
  return brut == null ? null : toNumber(brut);
}

/**
 * LA GARDE QUE LES DEUX NATURES APPELLENT AVANT DE TRANCHER.
 *
 * Rend le MOTIF quand ça bloque, `null` quand ça passe — la forme d'un refus qui nomme sa raison
 * (§118.30). Un visa ABSENT laisse passer : sans quoi toutes les demandes déjà en base, créées
 * avant ce lot, se seraient arrêtées net au déploiement sans que personne ait rien décidé.
 */
export async function blocageCentreAdPro(
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  const visa = await lireVisaAdPro(entityType, entityId);
  return visaAutoriseAAvancer(visa) ? null : motifBlocageVisa(visa);
}
