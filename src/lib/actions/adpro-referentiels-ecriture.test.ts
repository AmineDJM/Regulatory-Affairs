import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { createConsultingContract } from "./consulting-actions";
import { createAdProOtherRequest } from "./ad-pro-other-actions";
import { createCongressRequest } from "./congress-request-actions";
import { getAdProCreateData } from "@/lib/queries/ad-pro";
import { getCongressDetail } from "@/lib/queries/congress";
import { AD_PRO_KINDS } from "@/lib/ad-pro/unified";
import { natureDesigneMedecinsEtProduits } from "@/lib/ad-pro/create-fields";
import { AVAILABLE_PRODUCT_STATUSES } from "@/lib/ad-pro/pickers";
import { CHAMPS_MEDECINS, CHAMPS_PRODUITS, MULTI_SEP } from "@/lib/ad-pro/pickers";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__adproref__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PRATICIEN, LE PRODUIT ET LA GAMME ARRIVENT EN BASE — par les VRAIES actions.
 *
 * Le formulaire propose ; c'est l'action qui écrit, et c'est elle qu'Adam poste aussi par le
 * chemin générique. Un banc qui se contenterait de vérifier la liste de champs confirmerait que
 * le menu existe et ne dirait RIEN de ce qui atterrit dans la colonne (§118.14, §118.49).
 *
 * LE DÉFAUT LE PLUS GRAVE QUE CE BANC FERME n'est pas l'absence de champ : le consulting et
 * « autre demande » posaient déjà un menu « Business Unit » OBLIGATOIRE, et ni le modèle ni
 * l'action ne l'avaient — le choix imposé au demandeur était JETÉ. Un champ requis sans effet
 * est pire qu'un champ absent : il fait croire que la dépense est rattachée (§118.140).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Ad & Pro — praticiens, produits et gamme écrits par les vraies actions", () => {
  let demandeurId = "", gammeId = "";

  beforeAll(async () => {
    /*
     * L'ACTEUR EST UN VRAI RÔLE DU MÉTIER, ET SON RÔLE EST CELUI DE LA BASE.
     *
     * Mesuré en écrivant ce banc : `getAccess(id, roleHint)` résout le rôle EN DIRECT depuis la
     * base (`userRow?.role ?? roleHint`) — l'indice passé en argument ne sert que de repli. Un
     * décor qui crée un délégué médical et passe « SUPER_ADMIN » obtient donc l'accès du
     * DÉLÉGUÉ, et le délégué n'a aucun droit sur le consulting : mes trois premiers cas se sont
     * fait refuser « Création réservée aux personnes habilitées » et j'ai d'abord cherché le
     * défaut dans le produit (§118.92 — qu'est-ce que le juge a réellement mesuré ?).
     *
     * On prend donc Direction Marketing, qui gère les SEPT natures du pôle : c'est l'acteur
     * réaliste de ces créations, et il n'a PAS la vue globale — une garde éprouvée avec un
     * Super Admin ne peut pas tomber (§118.104).
     */
    const dem = await prisma.user.create({
      data: { name: `${TAG}dem`, email: `${TAG}dem@t.dz`, role: "PRODUCT_MANAGER", passwordHash: "x" },
    });
    demandeurId = dem.id;
    const bu = await prisma.businessUnit.create({ data: { name: `${TAG}Onco`, isActive: true } });
    gammeId = bu.id;
    // UN MÉDECIN ET UN PRODUIT BIEN À NOUS : sans eux, le cas du chargeur ci-dessous
    // comparerait des listes VIDES et serait vrai quelle que soit la porte (§118.117).
    await prisma.medicalDoctor.create({ data: { name: `${TAG}Dr Test`, specialty: "Cardiologie" } });
    await prisma.regulatoryProduct.create({
      data: {
        reference: `${TAG}REF1`, dci: `${TAG}Molecule`, brandName: `${TAG}Nivolex`,
        status: AVAILABLE_PRODUCT_STATUSES[0] as never,
      },
    });
    ACTOR = await actorFor(demandeurId, "PRODUCT_MANAGER");
  });

  afterAll(async () => {
    await prisma.consultingTask.deleteMany({ where: { contract: { title: { startsWith: TAG } } } }).catch(() => {});
    await prisma.consultingContract.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.adProOtherRequest.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.congressInternational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.congressNational.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: demandeurId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: demandeurId } }).catch(() => {});
    await prisma.regulatoryProduct.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.medicalDoctor.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.businessUnit.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    ACTOR = null;
  });

  it("CONSULTING : deux praticiens, deux produits, une gamme — tout arrive en base", async () => {
    const fd = new FormData();
    fd.set("title", `${TAG}Accompagnement`);
    fd.set("counterparty", "Cabinet Reg&Co");
    fd.set("businessUnitId", gammeId);
    fd.append(CHAMPS_MEDECINS.coches, "Dr Amel Haddad");
    fd.append(CHAMPS_MEDECINS.coches, "Dr Karim Bensalem");
    fd.append(CHAMPS_PRODUITS.coches, "Nivolex (nivolumab)");
    fd.append(CHAMPS_PRODUITS.coches, "Trastuzex (trastuzumab)");
    const r = await createConsultingContract(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const c = await prisma.consultingContract.findFirstOrThrow({ where: { title: { startsWith: TAG } } });
    // Ce qui le ferait tomber : rendre `businessUnitId` à l'action sans l'écrire — c'est
    // EXACTEMENT l'état d'avant ce lot, et il était invisible.
    expect(c.businessUnitId).toBe(gammeId);
    expect(c.doctor).toBe(`Dr Amel Haddad${MULTI_SEP}Dr Karim Bensalem`);
    expect(c.product).toBe(`Nivolex (nivolumab)${MULTI_SEP}Trastuzex (trastuzumab)`);
  });

  it("CONSULTING : les deux champs sont FACULTATIFS — une demande sans praticien passe", async () => {
    // « On doit POUVOIR sélectionner » n'est pas « on doit sélectionner ». Un accompagnement
    // réglementaire n'a pas de praticien, et le refuser serait un refus à tort (§118.27).
    const fd = new FormData();
    fd.set("title", `${TAG}SansPraticien`);
    fd.set("counterparty", "Cabinet Juridis");
    const r = await createConsultingContract(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const c = await prisma.consultingContract.findFirstOrThrow({ where: { title: `${TAG}SansPraticien` } });
    // `null` et non une chaîne vide : la colonne reste VIDE, pas « renseignée avec rien ».
    expect(c.doctor).toBeNull();
    expect(c.product).toBeNull();
  });

  it("AUTRE DEMANDE : praticien, produit et gamme écrits", async () => {
    const fd = new FormData();
    fd.set("title", `${TAG}DépensePromo`);
    fd.set("description", "Une dépense de promotion qui n'entre dans aucune case.");
    fd.set("businessUnitId", gammeId);
    fd.append(CHAMPS_MEDECINS.coches, "Dr Amel Haddad");
    // Le REPLI en saisie libre : aucun produit coché, mais un nom tapé — il passe tel quel,
    // sinon une demande légitime attendrait qu'on peuple le référentiel.
    fd.set(CHAMPS_PRODUITS.libre, "Produit hors référentiel");
    const r = await createAdProOtherRequest(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const a = await prisma.adProOtherRequest.findFirstOrThrow({ where: { title: { startsWith: TAG } } });
    expect(a.businessUnitId).toBe(gammeId);
    expect(a.doctor).toBe("Dr Amel Haddad");
    expect(a.product).toBe("Produit hors référentiel");
  });

  it("PRISE EN CHARGE INTERNATIONALE : les produits vont dans `products`, la gamme est écrite", async () => {
    const fd = new FormData();
    fd.set("type", "INTL");
    fd.set("name", `${TAG}ECCMID`);
    fd.set("businessUnitId", gammeId);
    fd.set("specialty", "Infectiologie");
    fd.append(CHAMPS_PRODUITS.coches, "Nivolex (nivolumab)");
    fd.append("invitedDoctorIds", "doc-1");
    const r = await createCongressRequest(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const c = await prisma.congressInternational.findFirstOrThrow({ where: { name: { startsWith: TAG } } });
    expect(c.products).toBe("Nivolex (nivolumab)");
    // Le champ de gamme MANQUAIT sur ce formulaire alors que l'action le lisait déjà : les deux
    // prises en charge sortaient sans gamme, et leur dépense n'était rattachable à rien.
    expect(c.businessUnitId).toBe(gammeId);
    // Les médecins gardent leur mécanisme par RÉFÉRENCES — strictement mieux qu'un libellé.
    expect(c.invitedDoctorIds).toEqual(["doc-1"]);
  });

  it("LA FICHE RELIT les produits — sur les deux prises en charge", async () => {
    /*
     * UNE COLONNE QUE RIEN NE MONTRE EST DU CODE MORT (§118.14, §118.50), et c'est l'état où
     * `CongressInternational.products` a vécu depuis toujours : ni écrite, ni affichée.
     *
     * CE CAS EXISTE PARCE QU'UN SABOTAGE EST PASSÉ AU VERT. En faisant rendre `""` au lecteur de
     * la fiche, mes huit autres cas restaient tous verts : ils prouvaient l'ÉCRITURE et rien de
     * la RELECTURE. « Un sabotage qui passe ne dit pas que le code est bon, il dit que je ne
     * teste pas ce que je crois » (§118.111). Le demandeur aurait coché trois produits et ne les
     * aurait jamais revus.
     *
     * On passe par la VRAIE lecture, avec sa portée (`scopeCongressIntl`) : un accesseur privilégié
     * montrerait une ligne que la personne n'a pas le droit de voir (§118.81).
     */
    // CE CAS PORTE SON PROPRE DÉCOR : lire celui d'un cas voisin ferait dépendre le verdict de
    // l'ORDRE d'exécution, et c'est ainsi qu'on mesure le voisinage au lieu du produit (§118.92).
    const acteur = { id: demandeurId, role: "PRODUCT_MANAGER", access: (ACTOR as NonNullable<typeof ACTOR>).access } as never;
    const poser = async (type: "INTL" | "NATIONAL", nom: string, produit: string) => {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("name", nom);
      fd.set("businessUnitId", gammeId);
      fd.append(CHAMPS_PRODUITS.coches, produit);
      const r = await createCongressRequest(undefined, fd);
      expect(r.ok, r.ok === false ? r.error : "").toBe(true);
      return r.ok ? r.id! : "";
    };
    const idIntl = await poser("INTL", `${TAG}RelectureIntl`, "Nivolex (nivolumab)");
    const vueIntl = await getCongressDetail("INTL", acteur, idIntl);
    expect(vueIntl?.products, "la fiche internationale doit rendre les produits").toBe("Nivolex (nivolumab)");
    const idNat = await poser("NATIONAL", `${TAG}RelectureNat`, "Trastuzex (trastuzumab)");
    const vueNat = await getCongressDetail("NATIONAL", acteur, idNat);
    // L'AUTRE MOITIÉ : le national porte la colonne sous un AUTRE nom. Sans ce second cas, un
    // lecteur qui n'interrogerait que `products` passerait pour correct.
    expect(vueNat?.products, "la fiche nationale doit rendre les produits").toBe("Trastuzex (trastuzumab)");
  });

  it("LE CHARGEUR sert les référentiels aux SIX natures, et à aucune autre", async () => {
    /*
     * LE DÉFAUT QUE J'AI MOI-MÊME LAISSÉ AU LOT PRÉCÉDENT, mesuré ici par le VRAI chargeur.
     *
     * `getAdProCreateData(id, ["EVENT"])` rendait **0 médecin, 0 produit, 0 spécialité** : les
     * trois menus que la Direction venait d'exiger retombaient en saisie libre sur l'écran
     * Events et sur la fiche d'un événement, en silence, alors qu'ils marchaient depuis le
     * panneau d'Ad & Pro — qui, lui, passe aussi SPONSORING. Une porte gardée à côté d'une porte
     * ouverte (§118.71, §118.108).
     *
     * Ce qui le ferait tomber : revenir à une liste de natures écrite à la main dans le
     * chargeur. La sixième y serait oubliée, comme l'événement l'a été.
     */
    for (const k of AD_PRO_KINDS) {
      const d = await getAdProCreateData(demandeurId, [k.kind]);
      const attendu = natureDesigneMedecinsEtProduits(k.kind);
      expect(d.doctors.some((x) => x.name.startsWith(TAG)), `${k.kind} : médecins`).toBe(attendu);
      expect(d.products.some((x) => (x.brandName ?? "").startsWith(TAG)), `${k.kind} : produits`).toBe(attendu);
    }
    // LA PRÉMISSE : sans elle, « 0 partout » rendrait chaque comparaison vraie pour la mauvaise
    // raison, et le matériel promotionnel passerait pour correctement exclu.
    const promo = AD_PRO_KINDS.filter((k) => !natureDesigneMedecinsEtProduits(k.kind));
    expect(promo.map((k) => k.kind)).toEqual(["PROMO_MATERIAL"]);
  });

  it("PRISE EN CHARGE NATIONALE : les produits vont dans `promotedProducts`", async () => {
    // DEUX NOMS DE COLONNE POUR LE MÊME FAIT, sur deux modèles frères. Ce qui le ferait tomber :
    // écrire `products` des deux côtés — le typecheck l'attrape ici, et en production la colonne
    // du national resterait vide en silence.
    const fd = new FormData();
    fd.set("type", "NATIONAL");
    fd.set("name", `${TAG}JNCardio`);
    fd.set("businessUnitId", gammeId);
    fd.append(CHAMPS_PRODUITS.coches, "Trastuzex (trastuzumab)");
    const r = await createCongressRequest(undefined, fd);
    expect(r.ok, r.ok === false ? r.error : "").toBe(true);
    const c = await prisma.congressNational.findFirstOrThrow({ where: { name: { startsWith: TAG } } });
    expect(c.promotedProducts).toBe("Trastuzex (trastuzumab)");
    expect(c.businessUnitId).toBe(gammeId);
  });
});
