import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR, getCurrentUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { deleteFileByKey } from "@/lib/storage";
import { createPromoMaterial } from "./promo-material-actions";
import { validatePromoStep } from "./promo-circuit-actions";
import { demanderDevisPromo, enregistrerDevisPromo, supprimerDevisPromo, terminerRetranscriptionPromo } from "./promo-devis-actions";
import { formatDzd } from "@/lib/promo-material/devis";
import type { ActionResult } from "./types";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__pdcourse__${Date.now().toString(36)}`;
const ETAPE_CHANGEE = "Ce dossier vient de changer d'étape — rechargez la fiche.";

async function actorFor(id: string): Promise<CurrentUser> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  const access = await getAccess(id, u.role);
  return { id, name: u.name, email: u.email, role: u.role, secondaryRole: u.secondaryRole, access, mustChangePassword: false };
}
const form = (fields: Record<string, string | string[]>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) for (const x of v) fd.append(k, x); else fd.set(k, v);
  }
  return fd;
};
const pdf = (nom: string) => new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, nom.length])], nom, { type: "application/pdf" });
const err = (r: ActionResult) => (r.ok ? "" : r.error ?? "");
function reussi(r: ActionResult, quoi: string): ActionResult {
  if (!r.ok) throw new Error(`${quoi} : ${r.error}`);
  return r;
}
const etat = (id: string) => prisma.promoMaterial.findUniqueOrThrow({ where: { id }, select: { circuitState: true, status: true } });
/** Les pièces du dossier, et les binaires rangés sous sa clé : ce qu'un geste refusé ne doit pas laisser derrière lui. */
const pieces = async (id: string) => ({
  documents: (await prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: id }, select: { id: true }, orderBy: { id: "asc" } })).map((d) => d.id),
  binaires: await prisma.storedFile.count({ where: { key: { startsWith: `PROMO_MATERIAL/${id}/` } } }),
});
const lignesDe = (quoteId: string) =>
  prisma.promoQuoteLine.findMany({ where: { quoteId }, orderBy: { position: "asc" }, select: { id: true, unitPrice: true, selected: true } })
    .then((ls) => ls.map((l) => ({ id: l.id, prix: Number(l.unitPrice), retenue: l.selected })));
const avisAuDemandeur = (userId: string, id: string) =>
  prisma.notification.count({ where: { userId, link: `/promo-material/${id}`, title: "Devis retranscrits — à vous de choisir" } });

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES DEVIS DU MATÉRIEL PROMOTIONNEL, SOUS COURSE — par les VRAIS points d'entrée, avec une
 * assistante et un demandeur SANS vue globale (§118.104).
 *
 * La retranscription vérifiait l'étape à la LECTURE et écrivait sans condition, scan compris
 * entre les deux : une correction tardive recréait des lignes non retenues sous le choix du
 * demandeur, ou écrivait des prix dans un dossier passé au choix, validé ou annulé ; un devis se
 * retirait sous les yeux de qui choisissait ; et la fin de la retranscription contrôlait des
 * devis qu'une correction pouvait changer avant sa bascule. Et le total HT imprimé, présenté
 * comme le contrôle de la retranscription, pouvait simplement ne pas être saisi.
 *
 *   cp    chef de produit (le demandeur)         dir   sa directrice marketing (valide la demande)
 *   ops   Direction des opérations (organigramme) asst  assistante de direction (retranscrit)
 *
 * Chaque course est JOUÉE, jamais espérée (§118.65) : la transaction du banc verrouille la ligne du
 * dossier, lance le geste, attend qu'il soit bloqué PAR ELLE, écrit elle-même le changement
 * concurrent, puis relâche.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Matériel promotionnel — la retranscription sous course, et le total imprimé exigé", () => {
  const u: Record<string, string> = {};
  let companyId = "", fourA = "", fourB = "", catCarnet = "";
  let debutBanc = new Date();

  beforeAll(async () => {
    debutBanc = new Date(Date.now() - 1_000);
    const mk = async (k: string, role: SessionUser["role"]) => {
      u[k] = (await prisma.user.create({ data: { name: `${TAG} ${k}`, email: `${TAG}${k}@t.dz`, role, passwordHash: "x" } })).id;
    };
    await Promise.all([mk("ops", "DIRECTION"), mk("dir", "PRODUCT_MANAGER"), mk("cp", "MEDICAL_PROMOTION_MANAGER"), mk("asst", "DIRECTION_ASSISTANT")]);
    companyId = (await prisma.company.create({ data: { name: `${TAG} Pharma`, shortName: TAG.slice(0, 12), color: "#1B7F79" } })).id;
    // L'ORGANIGRAMME : la directrice du chef de produit est celle qui valide sa demande (§118.152).
    const emp: Record<string, string> = {};
    const e = async (k: string, managerKey: string | null) => {
      emp[k] = (await prisma.employee.create({ data: { fullName: `${TAG} ${k}`, userId: u[k], managerId: managerKey ? emp[managerKey] : null, companyId } })).id;
    };
    await e("ops", null);
    await e("dir", "ops");
    await Promise.all([e("cp", "dir"), e("asst", null)]);
    const vague = await Promise.all([
      prisma.companyContact.create({ data: { name: `${TAG} Imprimerie Atlas`, address: "Zone industrielle", city: "Alger", companyId: null }, select: { id: true } }),
      prisma.companyContact.create({ data: { name: `${TAG} Imprimerie Tell`, address: "Rue 5", city: "Blida", companyId: null }, select: { id: true } }),
      prisma.promoCatalogueArticle.create({ data: { reference: `${TAG}-CARNET`, nom: `${TAG} Carnet bilan`, famille: "CONSOMMABLE" }, select: { id: true } }),
    ]);
    [fourA, fourB, catCarnet] = vague.map((r) => r.id);
  }, 60_000);

  afterAll(async () => {
    // Le miroir Drive des devis ENREGISTRÉS part en arrière-plan : on attend qu'il se taise avant de
    // ranger, sinon il recréerait des nœuds après le nettoyage et les comptes ne partiraient plus.
    const ids = Object.values(u);
    for (let i = 0, avant = -1; i < 20; i += 1) {
      const n = await prisma.driveNode.count({ where: { ownerId: { in: ids } } });
      if (n === avant) break;
      avant = n;
      await new Promise((r) => setTimeout(r, 250));
    }
    const pmIds = (await prisma.promoMaterial.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } })).map((p) => p.id);
    const demandes = (await prisma.administrativeRequest.findMany({ where: { linkedEntityType: "PROMO_MATERIAL", linkedEntityId: { in: pmIds } }, select: { id: true } })).map((d) => d.id);
    await prisma.comment.deleteMany({ where: { OR: [{ entityType: "PROMO_MATERIAL", entityId: { in: pmIds } }, { entityType: "ADMIN_REQUEST", entityId: { in: demandes } }] } }).catch(() => {});
    await prisma.promoMaterial.updateMany({ where: { id: { in: pmIds } }, data: { adminRequestId: null } }).catch(() => {});
    await prisma.administrativeRequest.deleteMany({ where: { id: { in: demandes } } }).catch(() => {});
    await prisma.promoMaterial.deleteMany({ where: { id: { in: pmIds } } }).catch(() => {});
    // Les pièces ET leurs binaires : retirer la ligne seule laisserait le blob compté (§118.159).
    const docs = await prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: { in: pmIds } }, select: { id: true, fileKey: true } }).catch(() => []);
    await prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } }).catch(() => {});
    for (const d of docs) if (d.fileKey) await deleteFileByKey(d.fileKey).catch(() => {});
    await prisma.promoCatalogueArticle.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.companyContact.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    // Les avis au RÔLE (tout le secrétariat, aucune assistante n'étant nommée) atteignent des comptes qui ne
    // sont pas les nôtres : retirés par le lien, BORNÉS à ce banc (`createdAt` passe par l'index, §118.175).
    await prisma.notification.deleteMany({ where: { link: { in: pmIds.map((id) => `/promo-material/${id}`) }, createdAt: { gte: debutBanc } } }).catch(() => {});
    await prisma.fileVersion.deleteMany({ where: { node: { ownerId: { in: ids } } } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids }, type: "FILE" } }).catch(() => {});
    await prisma.driveNode.deleteMany({ where: { ownerId: { in: ids } } }).catch(() => {});
    await prisma.employee.updateMany({ where: { fullName: { startsWith: TAG } }, data: { managerId: null } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { fullName: { startsWith: TAG } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});
    await prisma.userAccess.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  }, 60_000);

  const comme = async (k: string) => { ACTOR = await actorFor(u[k]!); };

  /** Un dossier de cp à l'étape « devis demandés » : demande validée par sa directrice, devis demandés. */
  async function auxDevisDemandes(titre: string): Promise<string> {
    await comme("cp");
    const r = await createPromoMaterial(undefined, form({
      title: `${TAG} ${titre}`,
      lignes: JSON.stringify([{ catalogueId: catCarnet, quantite: "500", actions: ["IMPRESSION"], commentaire: "A5" }]),
    }));
    if (!r.ok) throw new Error(r.error);
    const id = r.id!;
    await comme("dir");
    reussi(await validatePromoStep(form({ id })), "valider la demande");
    await comme("cp");
    reussi(await demanderDevisPromo(form({ promoMaterialId: id })), "demander les devis");
    return id;
  }
  const articleDe = async (id: string) => (await prisma.promoRequestItem.findFirstOrThrow({ where: { promoMaterialId: id } })).id;
  /** Le formulaire de l'éditeur, tel que l'écran l'envoie : 500 carnets au prix donné, total imprimé facultatif. */
  async function formulaireDevis(id: string, opts: { fournisseur: string; prix: string; total?: string | null; quoteId?: string; scan?: string }): Promise<FormData> {
    const fd = form({
      promoMaterialId: id, supplierId: opts.fournisseur, reference: "D-1", tvaRate: "19",
      ligneReference: ["Carnet A5"], ligneQuantite: ["500"], lignePrix: [opts.prix], ligneAction: ["IMPRESSION"], ligneArticle: [await articleDe(id)],
    });
    if (opts.total !== null) fd.set("announcedTotal", opts.total ?? String(500 * Number(opts.prix)));
    if (opts.quoteId) fd.set("quoteId", opts.quoteId);
    if (opts.scan) fd.set("scan", pdf(opts.scan));
    return fd;
  }
  /** Un devis complet, retranscrit par l'assistante : lignes, total imprimé juste, scan. */
  async function devisComplet(id: string, fournisseur = fourA): Promise<string> {
    await comme("asst");
    const r = reussi(await enregistrerDevisPromo(await formulaireDevis(id, { fournisseur, prix: "100", scan: `${TAG}-devis.pdf` })), "retranscrire un devis");
    return r.id!;
  }

  /**
   * LA COURSE FORCÉE (§118.164e). Un verrou de LIGNE sur le seul dossier visé laisse le geste LIRE et le bloque
   * à sa première écriture — et `pg_blocking_pids` dit qu'il est bloqué PAR NOUS : un verrou de table, ou un
   * filtre sur le texte des requêtes, compterait aussi les gestes des autres fichiers de la suite, et la
   * barrière s'ouvrirait avant que le nôtre y soit (§118.65, §118.193). Puis le détenteur écrit lui-même le
   * changement concurrent, et relâche. Un échec de barrière dit ce que faisaient les sessions.
   */
  async function pendantQueLeGesteAttend<T>(dossierId: string, lancer: () => Promise<T>, entretemps: (tx: Prisma.TransactionClient) => Promise<unknown>): Promise<T> {
    let geste!: Promise<T>;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PromoMaterial" WHERE id = ${dossierId} FOR UPDATE`;
      geste = lancer();
      geste.catch(() => undefined);
      const debut = Date.now();
      for (;;) {
        await tx.$executeRawUnsafe("SELECT pg_stat_clear_snapshot()");
        const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND pg_backend_pid() = ANY(pg_blocking_pids(pid))`;
        if (n >= 1) break;
        if (Date.now() - debut > 15_000) {
          await tx.$executeRawUnsafe("SELECT pg_stat_clear_snapshot()");
          const vues = await tx.$queryRaw<{ etat: string | null; attente: string; requete: string }[]>`
            SELECT state AS etat, coalesce(wait_event_type, '') || ':' || coalesce(wait_event, '') AS attente, left(query, 90) AS requete
            FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()`;
          throw new Error(`le geste n'a pas atteint la barrière — ${JSON.stringify(vues)}`);
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      await entretemps(tx);
    }, { timeout: 30_000 });
    return geste;
  }

  it("PRÉMISSES : l'assistante et le demandeur n'ont pas la vue globale — une garde éprouvée avec elle ne pourrait pas tomber (§118.104)", async () => {
    expect(hasGlobalView((await actorFor(u.asst!)).role)).toBe(false);
    expect(hasGlobalView((await actorFor(u.cp!)).role)).toBe(false);
    const id = await auxDevisDemandes("Prémisse");
    expect((await etat(id)).circuitState).toBe("QUOTE_REQUESTED");
  });

  it("LE TOTAL IMPRIMÉ EST EXIGÉ POUR TERMINER : enregistrer sans lui passe, terminer le refuse en nommant le devis ; corrigé, la fin passe", async () => {
    const id = await auxDevisDemandes("Total imprimé");
    await comme("asst");
    // ENREGISTRER reste permissif : on pose les lignes avant d'avoir le papier sous les yeux.
    const sans = reussi(await enregistrerDevisPromo(await formulaireDevis(id, { fournisseur: fourA, prix: "100", total: null, scan: `${TAG}-atlas.pdf` })), "enregistrer sans total");
    const scanAtlas = (await prisma.promoQuote.findUniqueOrThrow({ where: { id: sans.id! } })).documentId;
    expect(scanAtlas).not.toBeNull();
    // TERMINER, non : le contrôle à un dinar près ne se saute plus en laissant le champ vide.
    const refus = await terminerRetranscriptionPromo(form({ promoMaterialId: id }));
    expect(err(refus)).toMatch(new RegExp(`^Retranscription incomplète : « ${TAG} Imprimerie Atlas » : saisissez le total HT imprimé sur le devis`));
    expect((await etat(id)).circuitState).toBe("QUOTE_REQUESTED");
    expect(await avisAuDemandeur(u.cp!, id)).toBe(0);

    // CORRIGÉ SANS NOUVEAU SCAN : le total entre, et la pièce du devis n'est PAS réécrite — sa valeur lue au
    // début du geste pouvait être périmée, et la réécrire détacherait le scan (§118.152c).
    reussi(await enregistrerDevisPromo(await formulaireDevis(id, { fournisseur: fourA, prix: "100", quoteId: sans.id! })), "corriger avec le total");
    expect((await prisma.promoQuote.findUniqueOrThrow({ where: { id: sans.id! } })).documentId, "le scan reste celui du devis").toBe(scanAtlas);
    // CORRIGÉ AVEC UN NOUVEAU SCAN, sans course : le nouveau est gardé, l'ancien reste dans les pièces du dossier.
    reussi(await enregistrerDevisPromo(await formulaireDevis(id, { fournisseur: fourA, prix: "100", quoteId: sans.id!, scan: `${TAG}-atlas-v2.pdf` })), "corriger avec un nouveau scan");
    const nouveau = (await prisma.promoQuote.findUniqueOrThrow({ where: { id: sans.id! } })).documentId;
    expect(nouveau).not.toBe(scanAtlas);
    expect((await pieces(id)).documents).toEqual(expect.arrayContaining([scanAtlas, nouveau]));

    reussi(await terminerRetranscriptionPromo(form({ promoMaterialId: id })), "terminer avec le total");
    expect((await etat(id)).circuitState).toBe("REVIEW_REQUESTER");
    expect(await avisAuDemandeur(u.cp!, id)).toBe(1);
  }, 60_000);

  it("UNE CORRECTION BLOQUÉE ENTRE SA LECTURE ET SON ÉCRITURE, pendant que le dossier passe au choix : refusée — le choix du demandeur intact, aucun scan orphelin", async () => {
    const id = await auxDevisDemandes("Correction croisée");
    const quoteId = await devisComplet(id);
    const avant = { lignes: await lignesDe(quoteId), pieces: await pieces(id), scan: (await prisma.promoQuote.findUniqueOrThrow({ where: { id: quoteId } })).documentId };
    await comme("asst");
    const fd = await formulaireDevis(id, { fournisseur: fourA, prix: "90", quoteId, scan: `${TAG}-tardif.pdf` });
    const r = await pendantQueLeGesteAttend(id, () => enregistrerDevisPromo(fd), async (tx) => {
      // La fin de la retranscription et le choix du demandeur passent pendant que la correction attend.
      await tx.promoMaterial.update({ where: { id }, data: { circuitState: "REVIEW_REQUESTER" } });
      await tx.promoQuoteLine.updateMany({ where: { quoteId }, data: { selected: true } });
    });
    expect(err(r)).toBe(`${ETAPE_CHANGEE} Rien n'a été enregistré, pas même le scan joint.`);
    expect(await lignesDe(quoteId), "les lignes ne sont pas recréées : le choix du demandeur tient").toEqual(avant.lignes.map((l) => ({ ...l, retenue: true })));
    expect((await prisma.promoQuote.findUniqueOrThrow({ where: { id: quoteId } })).documentId).toBe(avant.scan);
    expect(await pieces(id), "le scan déposé par le geste refusé est retiré — ligne ET binaire").toEqual(avant.pieces);
    expect((await etat(id)).circuitState).toBe("REVIEW_REQUESTER");
  }, 60_000);

  it("UNE CORRECTION DONT LE DEVIS EST RETIRÉ PENDANT QU'ELLE ATTEND : refusée, rien n'est recréé, et son scan ne reste pas", async () => {
    const id = await auxDevisDemandes("Devis retiré pendant la correction");
    const quoteId = await devisComplet(id);
    const avant = await pieces(id);
    await comme("asst");
    const fd = await formulaireDevis(id, { fournisseur: fourA, prix: "90", quoteId, scan: `${TAG}-retire.pdf` });
    const r = await pendantQueLeGesteAttend(id, () => enregistrerDevisPromo(fd), (tx) => tx.promoQuote.delete({ where: { id: quoteId } }));
    expect(err(r)).toBe("Ce devis vient d'être retiré du dossier — rechargez la fiche. Rien n'a été enregistré, pas même le scan joint.");
    expect(await prisma.promoQuote.count({ where: { promoMaterialId: id } }), "le devis retiré n'est pas recréé").toBe(0);
    expect(await pieces(id)).toEqual(avant);
  }, 60_000);

  it("UNE CORRECTION DONT L'ARTICLE RATTACHÉ EST RETIRÉ PENDANT QU'ELLE ATTEND : refusée en le disant, pas en erreur technique", async () => {
    const id = await auxDevisDemandes("Article retiré pendant la correction");
    const quoteId = await devisComplet(id);
    const avant = await pieces(id);
    const lignes = (await lignesDe(quoteId)).map((l) => ({ id: l.id, prix: l.prix }));
    const article = await articleDe(id);
    await comme("asst");
    const fd = await formulaireDevis(id, { fournisseur: fourA, prix: "90", quoteId, scan: `${TAG}-article.pdf` });
    const r = await pendantQueLeGesteAttend(id, () => enregistrerDevisPromo(fd), (tx) => tx.promoRequestItem.delete({ where: { id: article } }));
    expect(err(r)).toMatch(/^Un article demandé auquel une ligne est rattachée vient d'être retiré du dossier — rechargez la fiche\./);
    expect((await lignesDe(quoteId)).map((l) => ({ id: l.id, prix: l.prix }))).toEqual(lignes);
    expect(await pieces(id)).toEqual(avant);
  }, 60_000);

  it("UN DEVIS RETIRÉ PENDANT QUE LE DOSSIER EST ANNULÉ : refusé, le devis reste", async () => {
    const id = await auxDevisDemandes("Retrait croisé");
    const quoteId = await devisComplet(id);
    await comme("asst");
    const r = await pendantQueLeGesteAttend(id, () => supprimerDevisPromo(form({ promoMaterialId: id, quoteId })),
      (tx) => tx.promoMaterial.update({ where: { id }, data: { status: "CANCELLED", circuitState: "REFUSED" } }));
    expect(err(r)).toBe(ETAPE_CHANGEE);
    expect(await prisma.promoQuote.count({ where: { id: quoteId } }), "le devis d'un dossier qui a quitté la retranscription ne se retire plus").toBe(1);
    expect(await etat(id)).toEqual({ circuitState: "REFUSED", status: "CANCELLED" });
  }, 60_000);

  it("UN DEVIS RETIRÉ DEUX FOIS (deux onglets) : le second clic le dit, au lieu d'annoncer un retrait qu'il n'a pas fait", async () => {
    const id = await auxDevisDemandes("Double retrait");
    const quoteId = await devisComplet(id);
    await comme("asst");
    const r = await pendantQueLeGesteAttend(id, () => supprimerDevisPromo(form({ promoMaterialId: id, quoteId })), (tx) => tx.promoQuote.delete({ where: { id: quoteId } }));
    expect(err(r)).toBe("Ce devis vient d'être retiré du dossier — rechargez la fiche.");
    expect((await etat(id)).circuitState).toBe("QUOTE_REQUESTED");
  }, 60_000);

  it("LA FIN DE LA RETRANSCRIPTION LIT LES DEVIS SOUS LE VERROU : une correction passée pendant qu'elle attend est vue — la fin est refusée", async () => {
    const id = await auxDevisDemandes("Fin croisée — devis");
    const quoteId = await devisComplet(id);
    await comme("asst");
    const r = await pendantQueLeGesteAttend(id, () => terminerRetranscriptionPromo(form({ promoMaterialId: id })),
      // Une correction fait passer le carnet de 100 à 120 DZD pendant que la fin attend : 60 000 HT pour 50 000 imprimés.
      (tx) => tx.promoQuoteLine.updateMany({ where: { quoteId }, data: { unitPrice: 120 } }));
    expect(err(r)).toMatch(/^Retranscription incomplète : /);
    // La phrase lue à sa source (`formatDzd`) : retapée ici, elle divergerait au premier séparateur de milliers (§118.120).
    expect(err(r)).toContain(`les lignes font ${formatDzd(60_000)} HT, le devis annonce ${formatDzd(50_000)}`);
    expect((await etat(id)).circuitState, "la fin n'est pas déclarée sur des devis qu'elle n'a pas contrôlés").toBe("QUOTE_REQUESTED");
    expect(await avisAuDemandeur(u.cp!, id)).toBe(0);
  }, 60_000);

  it("LA FIN DE LA RETRANSCRIPTION RELIT L'ÉTAPE SOUS LE VERROU : un dossier annulé pendant qu'elle attend ne repasse pas au choix", async () => {
    const id = await auxDevisDemandes("Fin croisée — annulation");
    await devisComplet(id);
    await comme("asst");
    const r = await pendantQueLeGesteAttend(id, () => terminerRetranscriptionPromo(form({ promoMaterialId: id })),
      (tx) => tx.promoMaterial.update({ where: { id }, data: { status: "CANCELLED", circuitState: "REFUSED" } }));
    expect(err(r), "l'état d'abord : un dossier annulé ne se fait pas répondre « incomplète »").toBe(ETAPE_CHANGEE);
    expect(await etat(id)).toEqual({ circuitState: "REFUSED", status: "CANCELLED" });
    expect(await avisAuDemandeur(u.cp!, id)).toBe(0);
  }, 60_000);

  it("UN DEVIS NEUF ET UNE CORRECTION SANS COURSE : rien n'est refusé — la garde ne coûte rien au cas ordinaire", async () => {
    const id = await auxDevisDemandes("Cas ordinaire");
    const a = await devisComplet(id, fourA);
    const b = await devisComplet(id, fourB);
    const rangs = (await prisma.promoQuote.findMany({ where: { promoMaterialId: id }, orderBy: { position: "asc" }, select: { id: true, position: true } }));
    expect(rangs).toEqual([{ id: a, position: 0 }, { id: b, position: 1 }]);
    await comme("asst");
    reussi(await supprimerDevisPromo(form({ promoMaterialId: id, quoteId: b })), "retirer le second devis");
    reussi(await terminerRetranscriptionPromo(form({ promoMaterialId: id })), "terminer");
    expect((await etat(id)).circuitState).toBe("REVIEW_REQUESTER");
  }, 60_000);
});
