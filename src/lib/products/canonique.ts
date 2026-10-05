import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  identityKey, manquesIdentite, nomCanonique, type ProductIdentity, type TraitIdentite,
} from "./identity";
import { collisionSur, ensureProduct, retrouverParIdentite } from "./resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PRODUIT CANONIQUE BRANCHÉ — un dossier à l'identité complète rejoint SON produit.
 *
 * ── LE DÉFAUT QU'ON FERME (§118.178) ─────────────────────────────────────────────────────
 *
 * `Product` existait, avec sa clé d'identité, sa résolution par degrés et ses profils — et RIEN
 * dans l'application ne le créait ni ne le liait : seul un script manuel le faisait. Base de
 * travail : zéro produit canonique pour vingt-neuf dossiers réels. Tout ce qui devait s'appuyer
 * sur lui — les produits d'une Business Unit qu'un délégué rapporte en visite, la 360° d'Adam,
 * le graphe — tournait à vide, et le dirait encore le jour où l'on chercherait « Raltégravir ».
 *
 * ── LA RÈGLE : DÉTERMINISTE, OU RIEN ─────────────────────────────────────────────────────
 *
 * Un dossier rejoint un produit sur sa CLÉ D'IDENTITÉ COMPLÈTE (`manquesIdentite` vide), et sur
 * rien d'autre : ni ressemblance de nom, ni score. Sans dosage, sans unité, sans forme ou sans
 * conditionnement, il reste SANS produit — et l'on dit ce qui manque. Rattacher au jugé, c'est
 * écrire dans l'ERP une relation que personne n'a décidée, et découvrir six mois plus tard
 * qu'un 500 mg pointe sur un 1 g dans un chiffre déjà présenté en réunion.
 *
 * ── QUAND L'IDENTITÉ D'UN DOSSIER CHANGE ─────────────────────────────────────────────────
 *
 * Le lien SUIT la donnée. Trois issues, dans cet ordre :
 *   1. un produit porte DÉJÀ la nouvelle identité → le dossier le rejoint ;
 *   2. sinon, si l'ancien produit n'a PAS d'autre dossier → il est CORRIGÉ sur place : c'était
 *      une coquille, et ce qui s'appuyait sur lui (visites, produits de BU) suit la correction au
 *      lieu de rester sur un produit orphelin ;
 *   3. sinon (l'ancien produit sert d'autres dossiers) → un produit est créé pour la nouvelle
 *      identité, et l'ancien reste celui des autres.
 * Une identité qui devient INCOMPLÈTE ne défait rien : une donnée manquante ne désigne rien, et
 * certainement pas « ce n'est plus ce produit ». Un champ vidé par erreur ne détruit pas un lien
 * juste.
 *
 * ── LES PROFILS HÉRITIERS ────────────────────────────────────────────────────────────────
 *
 * Un produit de BU ou de BD qui pointe sur ce dossier et n'a pas de produit (ou avait l'ANCIEN)
 * le tenait du dossier : il le suit. Celui qu'une personne a lié à un AUTRE produit garde son
 * lien — on ne défait pas une décision humaine par effet de bord.
 *
 * Ce module ne vérifie AUCUN droit : il est appelé par des actions qui ont déjà vérifié le leur
 * (créer, modifier un dossier ; rattacher un produit de BU), et le rattachement global est
 * réservé au Super Admin par son action. Il ne lit ni n'écrit la session.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce qu'est devenu le lien d'un dossier — chaque issue a sa phrase à l'écran. */
export type Rattachement =
  /** Identité incomplète : rien n'est rattaché, rien n'est défait. `produitId` = le lien existant. */
  | { etat: "INCOMPLET"; manques: TraitIdentite[]; produitId: string | null }
  | { etat: "DEJA"; produitId: string; code: string }
  | { etat: "RATTACHE"; produitId: string; code: string; cree: boolean; ancienProduitId: string | null; profilsSuivis: number }
  /** L'ancien produit, seul à porter ce dossier, a été corrigé sur place. */
  | { etat: "CORRIGE"; produitId: string; code: string; profilsSuivis: number }
  | { etat: "INTROUVABLE" };

const SELECT_DOSSIER = {
  id: true, reference: true, dci: true, dosage: true, dosageUnit: true, pharmaceuticalForm: true,
  packaging: true, channel: true, companyId: true, status: true, productId: true,
  canonicalProduct: {
    select: {
      id: true, code: true, identityKey: true, canonicalName: true,
      dci: true, dosage: true, dosageUnit: true, form: true, packaging: true,
    },
  },
} as const;

/** Le tuple d'identité d'un dossier — la forme du menu des dossiers, telle quelle. */
export function tupleDuDossier(d: { dci: string; dosage: string | null; dosageUnit: string | null; pharmaceuticalForm: string | null; packaging: string | null }): ProductIdentity {
  return { dci: d.dci, dosage: d.dosage, dosageUnit: d.dosageUnit, form: d.pharmaceuticalForm, packaging: d.packaging };
}

/**
 * LE CYCLE DE VIE QUE LES DOSSIERS PROUVENT. Une décision OBTENUE prouve un enregistrement ;
 * tout le reste — présoumission, dépôt, attente ANPP — décrit un produit à l'étude. Le dérivé ne
 * touche jamais « commercialisé » ni « arrêté » : ce sont des décisions humaines, qu'aucun statut
 * de dossier ne contredit.
 */
export function cycleDeVieDerive(statuts: readonly string[], actuel: string): string {
  if (actuel !== "STUDY" && actuel !== "REGISTERED") return actuel;
  return statuts.includes("DECISION_OBTAINED") ? "REGISTERED" : "STUDY";
}

/** Recalcule le cycle de vie d'un produit d'après TOUS ses dossiers. */
export async function synchroniserCycleDeVie(productId: string): Promise<void> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { lifecycle: true, regulatoryProfiles: { select: { status: true } } },
  });
  if (!p) return;
  const voulu = cycleDeVieDerive(p.regulatoryProfiles.map((d) => d.status), p.lifecycle);
  if (voulu !== p.lifecycle) await prisma.product.update({ where: { id: productId }, data: { lifecycle: voulu } });
}

/**
 * LES PROFILS QUI HÉRITAIENT DU PRODUIT DU DOSSIER LE SUIVENT — ceux sans produit, et ceux qui
 * portaient l'ANCIEN produit du dossier. Rend le nombre de profils déplacés.
 */
export async function suivreLeDossier(dossierId: string, ancien: string | null, nouveau: string): Promise<number> {
  const heritiers = {
    regulatoryProductId: dossierId,
    OR: [{ productId: null }, ...(ancien && ancien !== nouveau ? [{ productId: ancien }] : [])],
  };
  const [promo, bd] = await Promise.all([
    prisma.promoProduct.updateMany({ where: heritiers, data: { productId: nouveau } }),
    prisma.bdProduct.updateMany({ where: heritiers, data: { productId: nouveau } }),
  ]);
  return promo.count + bd.count;
}

/** Les noms qu'un produit portait sans qu'une personne les ait choisis — ceux qu'on peut refaire. */
function nomAutomatique(nom: string, t: ProductIdentity): boolean {
  const ancienDefaut = [t.dci, t.dosage, t.dosageUnit].filter(Boolean).join(" ").trim();
  return nom === nomCanonique(t) || nom === ancienDefaut || nom === t.dci;
}

/**
 * RATTACHE UN DOSSIER À SON PRODUIT CANONIQUE — appelé à la création et à chaque modification
 * du dossier, et par le rattachement global. Idempotent : rappelé sur un dossier déjà juste, il
 * rend `DEJA` sans rien écrire.
 */
export async function rattacherDossier(dossierId: string, opts: { acteurId?: string | null } = {}): Promise<Rattachement> {
  const d = await prisma.regulatoryProduct.findUnique({ where: { id: dossierId }, select: SELECT_DOSSIER });
  if (!d) return { etat: "INTROUVABLE" };

  const tuple = tupleDuDossier(d);
  const manques = manquesIdentite(tuple);
  if (manques.length) return { etat: "INCOMPLET", manques, produitId: d.productId };

  const cle = identityKey(tuple);
  const actuel = d.canonicalProduct;

  // DÉJÀ JUSTE — y compris quand la clé stockée vient d'une version précédente de la fonction :
  // c'est l'identité du produit qui compte, la clé n'en est que l'index.
  if (actuel && identityKey(actuel) === cle) {
    if (actuel.identityKey !== cle) await retrouverParIdentite(cle, actuel.dci);
    await synchroniserCycleDeVie(actuel.id);
    return { etat: "DEJA", produitId: actuel.id, code: actuel.code };
  }

  // 1. UN PRODUIT PORTE DÉJÀ CETTE IDENTITÉ.
  let cible = await retrouverParIdentite(cle, tuple.dci);
  let cree = false;

  // 2. L'ANCIEN PRODUIT, SEUL À PORTER CE DOSSIER, SE CORRIGE SUR PLACE.
  if (!cible && actuel) {
    const autresDossiers = await prisma.regulatoryProduct.count({ where: { productId: actuel.id, id: { not: d.id } } });
    if (autresDossiers === 0) {
      try {
        await prisma.product.update({
          where: { id: actuel.id },
          data: {
            dci: tuple.dci.trim(), dosage: tuple.dosage ?? null, dosageUnit: tuple.dosageUnit ?? null,
            form: tuple.form ?? null, packaging: tuple.packaging ?? null, identityKey: cle,
            ...(nomAutomatique(actuel.canonicalName, actuel) ? { canonicalName: nomCanonique(tuple) } : {}),
          },
        });
        const profilsSuivis = await suivreLeDossier(d.id, actuel.id, actuel.id);
        await synchroniserCycleDeVie(actuel.id);
        await recordAudit({
          actorId: opts.acteurId ?? null, action: "UPDATE", module: "Regulatory",
          entityType: "PRODUCT", entityId: actuel.id,
          summary: `Produit ${actuel.code} corrigé d'après le dossier ${d.reference} — ${nomCanonique(actuel)} → ${nomCanonique(tuple)}`,
        });
        return { etat: "CORRIGE", produitId: actuel.id, code: actuel.code, profilsSuivis };
      } catch (e) {
        // Un autre écrivain a posé cette identité entre-temps : on la rejoint (issue 1). Toute
        // autre erreur remonte — l'avaler rendrait « corrigé » ce qui n'a rien écrit.
        if (!collisionSur(e, "identityKey")) throw e;
        cible = await retrouverParIdentite(cle, tuple.dci);
      }
    }
  }

  // 3. CRÉER le produit de cette identité.
  if (!cible) {
    const p = await ensureProduct({
      ...tuple,
      channel: d.channel,
      companyId: d.companyId,
      lifecycle: d.status === "DECISION_OBTAINED" ? "REGISTERED" : "STUDY",
    });
    if (!p) return { etat: "INCOMPLET", manques: ["DCI"], produitId: d.productId };
    cible = { id: p.id, code: p.code };
    cree = p.created;
  }

  const ancienProduitId = d.productId;
  if (ancienProduitId !== cible.id) {
    await prisma.regulatoryProduct.update({ where: { id: d.id }, data: { productId: cible.id } });
  }
  const profilsSuivis = await suivreLeDossier(d.id, ancienProduitId, cible.id);
  await synchroniserCycleDeVie(cible.id);

  await recordAudit({
    actorId: opts.acteurId ?? null, action: cree ? "CREATE" : "UPDATE", module: "Regulatory",
    entityType: "PRODUCT", entityId: cible.id,
    summary: cree
      ? `Produit ${cible.code} créé d'après le dossier ${d.reference} — ${nomCanonique(tuple)}`
      : `Dossier ${d.reference} rattaché au produit ${cible.code}${ancienProduitId ? " (son identité a changé)" : ""}`,
  });

  return { etat: "RATTACHE", produitId: cible.id, code: cible.code, cree, ancienProduitId, profilsSuivis };
}

/**
 * LA PHRASE QUE L'ÉCRAN AJOUTE APRÈS UN ENREGISTREMENT DE DOSSIER — vide quand il n'y a rien à
 * dire. Un produit retrouvé en silence est le cas normal ; une identité incomplète se DIT, sinon
 * personne ne saura pourquoi ce dossier n'apparaît dans aucune Business Unit.
 */
export function phraseRattachement(r: Rattachement, phraseManques: (m: readonly TraitIdentite[]) => string): string | null {
  switch (r.etat) {
    case "INCOMPLET":
      return r.produitId
        ? null
        : `Produit canonique en attente : il manque ${phraseManques(r.manques)} pour identifier ce produit sans le confondre avec un autre.`;
    case "RATTACHE":
      return r.cree ? `Produit canonique ${r.code} créé.` : `Rattaché au produit canonique ${r.code}.`;
    case "CORRIGE":
      return `Produit canonique ${r.code} mis à jour.`;
    default:
      return null;
  }
}

// ─────────────────────────── Le rattachement de l'existant ───────────────────────────

/** Un dossier qu'on ne rattache pas seul, et pourquoi. */
export interface DossierIncomplet { id: string; reference: string; dci: string; manques: TraitIdentite[] }

/** Deux produits (ou plus) qui portent la MÊME identité — des doublons qu'une personne réunit. */
export interface ConflitIdentite { cle: string; produits: { id: string; code: string; canonicalName: string }[] }

export interface BilanRattachement {
  /** `true` : rien n'a été écrit — c'est ce que l'écran montre AVANT le clic. */
  simulation: boolean;
  /** Produits dont la clé, écrite par une version précédente, est remise à jour. */
  clesMisesAJour: number;
  conflits: ConflitIdentite[];
  dossiers: {
    total: number;
    deja: number;
    /** Rejoindraient (ou ont rejoint) un produit existant. */
    rattaches: number;
    /** Créeraient (ou ont créé) leur produit. */
    crees: number;
    /** Leur produit a été corrigé sur place, ou serait déplacé — leur identité a changé. */
    corriges: number;
    incomplets: DossierIncomplet[];
  };
  /** Produits de BU et de BD qui héritent (ou hériteraient) du produit de leur dossier. */
  profilsSuivis: number;
  /** Produits de BU sans dossier ni produit : seule une personne sait à quoi les rattacher. */
  promoSansProduit: { id: string; name: string }[];
}

/**
 * RATTACHE TOUT L'EXISTANT — ou dit ce que ce serait (`appliquer: false`, le défaut).
 *
 * C'est le geste d'UNE fois : les dossiers créés avant ce lot n'ont pas de produit, et les
 * nouveaux en reçoivent un à leur enregistrement. La simulation est le DÉFAUT pour la même raison
 * que le script qu'elle remplace : un rattachement de masse qui écrit sans qu'on l'ait vu est une
 * migration de données déguisée. Réservé au Super Admin par son action — il touche tous les
 * dossiers, y compris ceux qu'aucun autre rôle ne voit.
 */
export async function rattacherTout(opts: {
  appliquer: boolean;
  acteurId?: string | null;
  /**
   * Borner le geste à ces dossiers (et aux produits qu'ils portent). L'écran ne s'en sert pas — il
   * rattache tout ; un banc, si : dans une base partagée, rattacher TOUT écrirait sur les données
   * des autres bancs qui tournent au même moment (§118.132).
   */
  perimetre?: { dossierIds: string[] };
}): Promise<BilanRattachement> {
  const appliquer = opts.appliquer;
  const borne = opts.perimetre?.dossierIds ?? null;
  const bilan: BilanRattachement = {
    simulation: !appliquer, clesMisesAJour: 0, conflits: [],
    dossiers: { total: 0, deja: 0, rattaches: 0, crees: 0, corriges: 0, incomplets: [] },
    profilsSuivis: 0, promoSansProduit: [],
  };

  // 1. LES CLÉS PÉRIMÉES — recalculées depuis le tuple stocké, qui fait foi.
  const produits = await prisma.product.findMany({
    where: borne ? { regulatoryProfiles: { some: { id: { in: borne } } } } : undefined,
    select: { id: true, code: true, canonicalName: true, identityKey: true, dci: true, dosage: true, dosageUnit: true, form: true, packaging: true },
  });
  const parCle = new Map<string, typeof produits>();
  for (const p of produits) {
    const k = identityKey(p);
    if (!k) continue;
    parCle.set(k, [...(parCle.get(k) ?? []), p]);
  }
  for (const [cle, groupe] of parCle) {
    if (groupe.length > 1) {
      bilan.conflits.push({ cle, produits: groupe.map((p) => ({ id: p.id, code: p.code, canonicalName: p.canonicalName })) });
      continue;
    }
    const p = groupe[0];
    if (p.identityKey === cle) continue;
    bilan.clesMisesAJour++;
    if (appliquer) await retrouverParIdentite(cle, p.dci);
  }

  // 2. LES DOSSIERS.
  const dossiers = await prisma.regulatoryProduct.findMany({
    where: borne ? { id: { in: borne } } : undefined,
    select: {
      id: true, reference: true, dci: true, dosage: true, dosageUnit: true, pharmaceuticalForm: true, packaging: true,
      productId: true, canonicalProduct: { select: { dci: true, dosage: true, dosageUnit: true, form: true, packaging: true } },
    },
    orderBy: { reference: "asc" },
  });
  bilan.dossiers.total = dossiers.length;
  // Ce que la simulation tient pour existant : les clés des produits, puis celles qu'elle « crée ».
  const clesConnues = new Set(parCle.keys());
  // Les dossiers que la simulation rattacherait : leurs profils hériteraient aussi.
  const rattachesEnSimulation: string[] = [];
  for (const d of dossiers) {
    const tuple = tupleDuDossier(d);
    const manques = manquesIdentite(tuple);
    if (manques.length) {
      if (!d.productId) bilan.dossiers.incomplets.push({ id: d.id, reference: d.reference, dci: d.dci, manques });
      else bilan.dossiers.deja++;
      continue;
    }
    if (appliquer) {
      const r = await rattacherDossier(d.id, { acteurId: opts.acteurId ?? null });
      if (r.etat === "DEJA") bilan.dossiers.deja++;
      else if (r.etat === "CORRIGE") { bilan.dossiers.corriges++; bilan.profilsSuivis += r.profilsSuivis; }
      else if (r.etat === "RATTACHE") {
        if (r.ancienProduitId) bilan.dossiers.corriges++;
        else if (r.cree) bilan.dossiers.crees++;
        else bilan.dossiers.rattaches++;
        bilan.profilsSuivis += r.profilsSuivis;
      }
      continue;
    }
    const cle = identityKey(tuple);
    if (d.canonicalProduct && identityKey(d.canonicalProduct) === cle) { bilan.dossiers.deja++; continue; }
    if (d.productId) { bilan.dossiers.corriges++; continue; }
    if (clesConnues.has(cle)) bilan.dossiers.rattaches++;
    else { bilan.dossiers.crees++; clesConnues.add(cle); }
    rattachesEnSimulation.push(d.id);
  }

  // 3. LES PROFILS QUI POINTENT SUR UN DOSSIER RATTACHÉ, SANS PRODUIT.
  const orphelinsHeritiers = async () => {
    const dossierVise = borne ? { in: borne } : { not: null };
    const [promo, bd] = await Promise.all([
      prisma.promoProduct.findMany({ where: { productId: null, regulatoryProductId: dossierVise }, select: { id: true, regulatoryProduct: { select: { id: true, productId: true } } } }),
      prisma.bdProduct.findMany({ where: { productId: null, regulatoryProductId: dossierVise }, select: { id: true, regulatoryProduct: { select: { id: true, productId: true } } } }),
    ]);
    return [...promo, ...bd].filter((p) => p.regulatoryProduct?.productId);
  };
  const heritiers = await orphelinsHeritiers();
  if (appliquer) {
    const dossiersVus = new Set<string>();
    for (const h of heritiers) {
      const dossier = h.regulatoryProduct!;
      if (dossiersVus.has(dossier.id)) continue;
      dossiersVus.add(dossier.id);
      bilan.profilsSuivis += await suivreLeDossier(dossier.id, null, dossier.productId!);
    }
  } else {
    const [promo, bd] = await Promise.all([
      prisma.promoProduct.count({ where: { productId: null, regulatoryProductId: { in: rattachesEnSimulation } } }),
      prisma.bdProduct.count({ where: { productId: null, regulatoryProductId: { in: rattachesEnSimulation } } }),
    ]);
    bilan.profilsSuivis += heritiers.length + promo + bd;
  }

  bilan.promoSansProduit = borne ? [] : await prisma.promoProduct.findMany({
    where: { productId: null, regulatoryProductId: null, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (appliquer) {
    await recordAudit({
      actorId: opts.acteurId ?? null, action: "UPDATE", module: "Regulatory",
      summary: `Produits canoniques rattachés — ${bilan.dossiers.crees} créés, ${bilan.dossiers.rattaches} rattachés, `
        + `${bilan.dossiers.corriges} corrigés, ${bilan.dossiers.incomplets.length} dossiers incomplets, `
        + `${bilan.profilsSuivis} profils suivis, ${bilan.clesMisesAJour} clés mises à jour`,
    });
  }
  return bilan;
}
