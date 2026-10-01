import { prisma } from "@/lib/prisma";
import { loadReportingLine } from "@/lib/departments";
import { subtreeOf, flattenTree } from "@/lib/hr/team-tree";
import { userCan, moduleScope, rolesWithModule, anyRoleFilter, getAccess, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere, getMyCompanies, companyOptions } from "@/lib/company";
import { cheffesMarketingActuelles } from "@/lib/queries/promo-circuit";
import { ROLES_DIRECTEUR_DES_OPERATIONS } from "@/lib/promo-material/validateurs";
import { familleQuantifiee, type PromoFamille } from "@/lib/promo/catalogue";
import {
  cleDetenteur, etatValidite, libelleArticleStock, KINDS_ANNULABLES, MAGASIN, type EtatValidite, type MovementKind, type NatureTransfert,
} from "@/lib/promo/stock";
import {
  peutAnnulerMouvement, peutEntrerAlaMain, peutGererArticles, peutVoirStockDe, tientLeMagasin, type FaitsStock,
} from "@/lib/promo/stock-acces";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE STOCK PROMOTIONNEL, TEL QUE CETTE PERSONNE A LE DROIT DE LE VOIR (§118.164).
 *
 * Les SOLDES se calculent en base (somme par article, lot et détenteur) — jamais en additionnant
 * une liste bornée. Le JOURNAL, lui, est borné, et le DIT : il montre les derniers mouvements et
 * compte ceux qu'il ne montre pas. Un solde exact à côté d'un historique tronqué en silence se
 * lirait comme un historique complet.
 *
 * Ce que la personne ne peut pas voir n'est pas CHARGÉ, pas seulement masqué : un délégué ne
 * reçoit dans sa page ni le magasin ni le stock d'un collègue.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** L'ÉQUIPE : l'arbre de l'organigramme sous la personne, plus les KAM des gammes qu'elle supervise. */
export async function equipeDe(userId: string): Promise<Set<string>> {
  const [me, gammes] = await Promise.all([
    prisma.employee.findUnique({ where: { userId }, select: { id: true } }),
    prisma.businessUnit.findMany({ where: { supervisorId: userId }, select: { id: true } }),
  ]);
  const ids = new Set<string>();
  if (me) {
    const { employees, departments } = await loadReportingLine();
    for (const n of flattenTree(subtreeOf(me.id, employees, departments))) if (n.userId) ids.add(n.userId);
  }
  if (gammes.length) {
    const kam = await prisma.salesRepProfile.findMany({ where: { businessUnitId: { in: gammes.map((g) => g.id) } }, select: { repId: true } });
    for (const k of kam) ids.add(k.repId);
  }
  ids.delete(userId);
  return ids;
}

/** LES FAITS d'une personne pour la règle du stock — établis une fois par requête. */
export async function faitsStock(user: SessionUser): Promise<FaitsStock> {
  const superAdmin = user.role === "SUPER_ADMIN";
  const roles = [user.role, user.secondaryRole ?? null];
  const [cheffes, equipe] = await Promise.all([cheffesMarketingActuelles(), equipeDe(user.id)]);
  return {
    userId: user.id,
    superAdmin,
    module: {
      voir: superAdmin || userCan(user, "PROMO_STOCK", "VIEW"),
      creer: superAdmin || userCan(user, "PROMO_STOCK", "CREATE"),
      modifier: superAdmin || userCan(user, "PROMO_STOCK", "UPDATE"),
    },
    vueGlobale: superAdmin || moduleScope(user, "PROMO_STOCK") === "ALL",
    gereLeMagasin: superAdmin || cheffes.includes(user.id),
    directeurDesOperations: roles.some((r) => r != null && (ROLES_DIRECTEUR_DES_OPERATIONS as readonly string[]).includes(r)),
    equipe,
  };
}

/**
 * QUI TIENT LE MAGASIN, pour le prévenir (un retour arrive, une demande attend, une réception
 * traîne) : la cheffe de la Direction Marketing lue sur l'organigramme, à défaut les Super Admins.
 * Une seule lecture — les actions et le rappel du battement prévenaient sinon deux listes.
 */
export async function gestionnairesDuMagasin(): Promise<string[]> {
  const cheffes = await cheffesMarketingActuelles();
  if (cheffes.length) return cheffes;
  const sa = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
  return sa.map((u) => u.id);
}

/** La personne peut-elle RECEVOIR du stock ? Il lui faut le module : sans lui, elle ne pourrait pas confirmer. */
export async function peutRecevoirDuStock(userId: string): Promise<{ ok: true; nom: string } | { ok: false; error: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, isActive: true } });
  if (!u || !u.isActive) return { ok: false, error: "Destinataire introuvable ou inactif." };
  const acces = await getAccess(u.id, u.role);
  if (u.role !== "SUPER_ADMIN" && !acces.modules.get("PROMO_STOCK")?.actions.has("VIEW")) {
    return { ok: false, error: `${u.name} n'a pas accès au stock promotionnel : il ne pourrait pas confirmer la réception. Un Super Admin lui ouvre le module dans Administration › Accès.` };
  }
  return { ok: true, nom: u.name };
}

/** Les personnes à qui l'on peut transférer : rôles porteurs du module, plus les accès donnés nommément. */
export async function destinatairesPossibles(): Promise<{ id: string; nom: string }[]> {
  const [parRole, parConsole, retires] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, ...anyRoleFilter(rolesWithModule("PROMO_STOCK")) }, select: { id: true, name: true } }),
    prisma.userAccess.findMany({ where: { module: "PROMO_STOCK", canView: true, user: { isActive: true } }, select: { user: { select: { id: true, name: true } } } }),
    prisma.userAccess.findMany({ where: { module: "PROMO_STOCK", canView: false }, select: { userId: true } }),
  ]);
  const exclus = new Set(retires.map((r) => r.userId));
  const tous = new Map<string, string>();
  for (const u of parRole) if (!exclus.has(u.id)) tous.set(u.id, u.name);
  for (const a of parConsole) tous.set(a.user.id, a.user.name);
  return [...tous].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export interface LotVue {
  id: string;
  numero: number;
  origine: string;
  recuLe: string;
  coutUnitaire: number | null;
  valableJusquau: string | null;
  libelle: string | null;
  etat: EtatValidite;
}

export interface SoldeVue {
  /** `null` = le magasin central. */
  detenteurId: string | null;
  quantite: number;
  parLot: { lotId: string; quantite: number }[];
}

export interface MouvementVue {
  id: string;
  kind: MovementKind;
  delta: number;
  detenteurId: string | null;
  lotNumero: number;
  motif: string | null;
  recipient: string | null;
  occurredAt: string;
  par: string | null;
  annule: boolean;
  annulable: boolean;
}

export interface ArticleVue {
  id: string;
  companyId: string | null;
  societe: string | null;
  catalogue: { id: string; reference: string; nom: string; famille: PromoFamille; unite: string };
  produits: { id: string; nom: string }[];
  libelle: string;
  location: string | null;
  alertThreshold: number | null;
  notes: string | null;
  isActive: boolean;
  lots: LotVue[];
  /** Les soldes que CETTE personne a le droit de voir, détenteur par détenteur. */
  soldes: SoldeVue[];
  /** Total visible (somme des soldes ci-dessus) ; `total` n'est rempli qu'en vue globale. */
  visible: number;
  total: number | null;
  enRoute: number;
  journal: MouvementVue[];
  /** Combien de mouvements visibles le journal ne montre pas. */
  journalNonAffiche: number;
}

export interface SupportVue {
  id: string;
  companyId: string | null;
  catalogue: { reference: string; nom: string };
  produits: string[];
  libelle: string;
  lien: string | null;
  valableJusquau: string | null;
  etat: EtatValidite;
  isActive: boolean;
  notes: string | null;
}

export interface TransfertVue {
  id: string;
  itemId: string;
  libelle: string;
  nature: NatureTransfert;
  deId: string | null;
  versId: string | null;
  quantite: number;
  quantiteRecue: number | null;
  statut: "EN_ROUTE" | "RECU" | "REFUSE" | "ANNULE";
  note: string | null;
  noteDecision: string | null;
  initiateurId: string;
  createdAt: string;
  decideLe: string | null;
}

export interface DemandeVue {
  id: string;
  itemId: string;
  libelle: string;
  demandeurId: string;
  quantite: number;
  note: string | null;
  statut: "OUVERTE" | "SERVIE" | "REFUSEE" | "ANNULEE";
  noteDecision: string | null;
  createdAt: string;
}

/**
 * LES FAITS, tels que l'écran les reçoit — l'équipe en liste plutôt qu'en ensemble (sérialisable).
 *
 * L'écran ne reçoit PAS des drapeaux « peut doter », « peut corriger » calculés ici : il reçoit les
 * FAITS et appelle les MÊMES prédicats purs que les actions (`promo/stock-acces.ts`). Deux listes
 * de droits — une pour l'écran, une pour l'action — finiraient par diverger, et le symptôme serait
 * un bouton que l'action refuse, ou une action ouverte que l'écran cache (§118.5, §118.71).
 */
export interface FaitsStockEcran extends Omit<FaitsStock, "equipe"> {
  equipe: string[];
}

export interface PageStock {
  moi: string;
  maintenant: string;
  faits: FaitsStockEcran;
  articles: ArticleVue[];
  supports: SupportVue[];
  transferts: TransfertVue[];
  demandes: DemandeVue[];
  personnes: Record<string, string>;
  equipe: { id: string; nom: string }[];
  destinataires: { id: string; nom: string }[];
  /** Pour les saisies du magasin et du Super Admin. */
  catalogue: { id: string; reference: string; nom: string; famille: PromoFamille; unite: string; exigeProduit: boolean }[];
  produitsOptions: { id: string; nom: string }[];
  societes: { value: string; label: string }[];
  /** Articles demandables (noms seulement — un délégué ne lit pas le solde du magasin). */
  demandables: { id: string; libelle: string }[];
}

const JOURNAL_PAR_ARTICLE = 40;

export async function chargerPageStock(user: SessionUser, maintenant = new Date()): Promise<PageStock> {
  const f = await faitsStock(user);
  const voirMagasin = peutVoirStockDe(f, null);

  // Les articles de la société (cloisonnement d'entité), actifs ou archivés.
  const items = await prisma.promoStockItem.findMany({
    where: await companyScopedWhere(user.id, {}),
    select: {
      id: true, companyId: true, company: { select: { name: true } }, location: true, alertThreshold: true, notes: true,
      isActive: true, lien: true, valableJusquau: true,
      catalogue: { select: { id: true, reference: true, nom: true, famille: true, unite: true } },
      produits: { select: { product: { select: { id: true, canonicalName: true } } } },
      lots: { select: { id: true, numero: true, origine: true, recuLe: true, coutUnitaire: true, valableJusquau: true, libelle: true }, orderBy: { numero: "asc" } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const itemIds = items.map((i) => i.id);

  // Quels détenteurs cette personne voit-elle ? `null` dans la liste = le magasin.
  const detenteursVisibles = (h: string | null): boolean => peutVoirStockDe(f, h);

  const [sommes, enRoute, transferts, demandes] = await Promise.all([
    itemIds.length
      ? prisma.promoStockMovement.groupBy({ by: ["itemId", "holderId", "lotId"], where: { itemId: { in: itemIds } }, _sum: { delta: true } })
      : Promise.resolve([] as { itemId: string; holderId: string | null; lotId: string; _sum: { delta: unknown } }[]),
    itemIds.length
      ? prisma.promoStockTransfer.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds }, statut: "EN_ROUTE" }, _sum: { quantite: true } })
      : Promise.resolve([] as { itemId: string; _sum: { quantite: unknown } }[]),
    itemIds.length
      ? prisma.promoStockTransfer.findMany({
          where: {
            itemId: { in: itemIds },
            OR: [{ statut: "EN_ROUTE" }, { decideLe: { gte: new Date(maintenant.getTime() - 30 * 86_400_000) } }],
          },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    itemIds.length
      ? prisma.promoStockRequest.findMany({
          where: { itemId: { in: itemIds }, OR: [{ statut: "OUVERTE" }, { updatedAt: { gte: new Date(maintenant.getTime() - 30 * 86_400_000) } }] },
          orderBy: { createdAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
  ]);

  const soldesParArticle = new Map<string, Map<string, SoldeVue>>();
  const totalParArticle = new Map<string, number>();
  for (const s of sommes) {
    const q = r3(num(s._sum.delta));
    totalParArticle.set(s.itemId, r3((totalParArticle.get(s.itemId) ?? 0) + q));
    if (!detenteursVisibles(s.holderId)) continue;
    const parDet = soldesParArticle.get(s.itemId) ?? new Map<string, SoldeVue>();
    const cle = cleDetenteur(s.holderId);
    const sv = parDet.get(cle) ?? { detenteurId: s.holderId, quantite: 0, parLot: [] };
    sv.quantite = r3(sv.quantite + q);
    if (q !== 0) sv.parLot.push({ lotId: s.lotId, quantite: q });
    parDet.set(cle, sv);
    soldesParArticle.set(s.itemId, parDet);
  }
  const enRouteParArticle = new Map(enRoute.map((e) => [e.itemId, r3(num(e._sum.quantite))]));

  // LE JOURNAL — borné, et il le dit. Un détenteur que la personne ne voit pas n'y figure pas.
  const visiblesFiltre = f.superAdmin || f.vueGlobale
    ? {}
    : { OR: [
        ...(voirMagasin ? [{ holderId: null }] : []),
        { holderId: { in: [user.id, ...f.equipe] } },
      ] };
  const [mouvements, compteJournal] = itemIds.length
    ? await Promise.all([
        prisma.promoStockMovement.findMany({
          where: { itemId: { in: itemIds }, ...visiblesFiltre },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: Math.min(4000, JOURNAL_PAR_ARTICLE * Math.max(1, itemIds.length)),
          select: {
            id: true, itemId: true, kind: true, delta: true, holderId: true, reason: true, recipient: true, occurredAt: true,
            createdById: true, lot: { select: { numero: true } }, annulation: { select: { id: true } },
          },
        }),
        prisma.promoStockMovement.groupBy({ by: ["itemId"], where: { itemId: { in: itemIds }, ...visiblesFiltre }, _count: { _all: true } }),
      ])
    : [[], []];
  const comptes = new Map(compteJournal.map((c) => [c.itemId, c._count._all]));
  const journalParArticle = new Map<string, MouvementVue[]>();
  const peutAnnuler = peutAnnulerMouvement(f);
  for (const m of mouvements) {
    const liste = journalParArticle.get(m.itemId) ?? [];
    if (liste.length >= JOURNAL_PAR_ARTICLE) continue;
    liste.push({
      id: m.id, kind: m.kind as MovementKind, delta: num(m.delta), detenteurId: m.holderId, lotNumero: m.lot.numero,
      motif: m.reason, recipient: m.recipient, occurredAt: m.occurredAt.toISOString(), par: m.createdById,
      annule: Boolean(m.annulation),
      // La MÊME liste que l'écrivain relit avant d'annuler : deux listes, et l'écran proposerait
      // « Annuler » sur un mouvement que l'action refuse (§118.5).
      annulable: peutAnnuler && !m.annulation && KINDS_ANNULABLES.includes(m.kind as MovementKind),
    });
    journalParArticle.set(m.itemId, liste);
  }

  const articles: ArticleVue[] = [];
  const supports: SupportVue[] = [];
  for (const it of items) {
    const produits = it.produits.map((p) => ({ id: p.product.id, nom: p.product.canonicalName }));
    const libelle = libelleArticleStock(it.catalogue.nom, produits.map((p) => p.nom));
    if (!familleQuantifiee(it.catalogue.famille)) {
      supports.push({
        id: it.id, companyId: it.companyId, catalogue: { reference: it.catalogue.reference, nom: it.catalogue.nom },
        produits: produits.map((p) => p.nom), libelle, lien: it.lien,
        valableJusquau: it.valableJusquau?.toISOString() ?? null, etat: etatValidite(it.valableJusquau, maintenant), isActive: it.isActive,
        notes: it.notes,
      });
      continue;
    }
    const soldes = [...(soldesParArticle.get(it.id)?.values() ?? [])];
    const visible = r3(soldes.reduce((a, s) => a + s.quantite, 0));
    const journal = journalParArticle.get(it.id) ?? [];
    articles.push({
      id: it.id, companyId: it.companyId, societe: it.company?.name ?? null,
      catalogue: it.catalogue, produits, libelle,
      location: it.location, alertThreshold: it.alertThreshold == null ? null : num(it.alertThreshold), notes: it.notes,
      isActive: it.isActive,
      lots: it.lots.map((l) => ({
        id: l.id, numero: l.numero, origine: l.origine, recuLe: l.recuLe.toISOString(),
        coutUnitaire: l.coutUnitaire == null ? null : num(l.coutUnitaire),
        valableJusquau: l.valableJusquau?.toISOString() ?? null, libelle: l.libelle, etat: etatValidite(l.valableJusquau, maintenant),
      })),
      soldes, visible,
      total: f.superAdmin || f.vueGlobale ? r3(totalParArticle.get(it.id) ?? 0) : null,
      enRoute: f.superAdmin || f.vueGlobale || voirMagasin ? enRouteParArticle.get(it.id) ?? 0 : 0,
      journal,
      journalNonAffiche: Math.max(0, (comptes.get(it.id) ?? 0) - journal.length),
    });
  }

  // Les transferts et demandes que cette personne a le droit de voir — ceux qui la concernent,
  // ceux de son équipe, ceux du magasin si elle le tient, tout en vue globale.
  const libelleDe = new Map([...articles.map((a) => [a.id, a.libelle] as const), ...supports.map((s) => [s.id, s.libelle] as const)]);
  const concerne = (ids: (string | null)[]) => f.superAdmin || f.vueGlobale
    || ids.some((id) => id === user.id || (id !== null && f.equipe.has(id)) || (id === null && voirMagasin));
  const transfertsVus: TransfertVue[] = transferts
    .filter((t) => concerne([t.deId, t.versId]) || t.initiateurId === user.id)
    .map((t) => ({
      id: t.id, itemId: t.itemId, libelle: libelleDe.get(t.itemId) ?? "Article", nature: t.nature,
      deId: t.deId, versId: t.versId, quantite: num(t.quantite), quantiteRecue: t.quantiteRecue == null ? null : num(t.quantiteRecue),
      statut: t.statut, note: t.note, noteDecision: t.noteDecision, initiateurId: t.initiateurId,
      createdAt: t.createdAt.toISOString(), decideLe: t.decideLe?.toISOString() ?? null,
    }));
  const demandesVues: DemandeVue[] = demandes
    .filter((d) => d.demandeurId === user.id || tientLeMagasin(f) || f.vueGlobale || f.equipe.has(d.demandeurId))
    .map((d) => ({
      id: d.id, itemId: d.itemId, libelle: libelleDe.get(d.itemId) ?? "Article", demandeurId: d.demandeurId,
      quantite: num(d.quantite), note: d.note, statut: d.statut, noteDecision: d.noteDecision, createdAt: d.createdAt.toISOString(),
    }));

  // Les noms, en un lot.
  const idsPersonnes = new Set<string>([user.id, ...f.equipe]);
  for (const a of articles) {
    for (const s of a.soldes) if (s.detenteurId) idsPersonnes.add(s.detenteurId);
    for (const m of a.journal) { if (m.detenteurId) idsPersonnes.add(m.detenteurId); if (m.par) idsPersonnes.add(m.par); }
  }
  for (const t of transfertsVus) { if (t.deId) idsPersonnes.add(t.deId); if (t.versId) idsPersonnes.add(t.versId); idsPersonnes.add(t.initiateurId); }
  for (const d of demandesVues) idsPersonnes.add(d.demandeurId);
  const [noms, destinataires, catalogue, produitsOptions, societes] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...idsPersonnes] } }, select: { id: true, name: true } }),
    f.module.modifier || f.superAdmin ? destinatairesPossibles() : Promise.resolve([]),
    peutEntrerAlaMain(f) || peutGererArticles(f)
      ? prisma.promoCatalogueArticle.findMany({ where: { actif: true }, select: { id: true, reference: true, nom: true, famille: true, unite: true, exigeProduit: true }, orderBy: { reference: "asc" } })
      : Promise.resolve([]),
    peutEntrerAlaMain(f) || peutGererArticles(f)
      ? prisma.product.findMany({ where: { isActive: true }, select: { id: true, canonicalName: true }, orderBy: { canonicalName: "asc" } })
      : Promise.resolve([]),
    peutEntrerAlaMain(f) || peutGererArticles(f) ? getMyCompanies(user.id).then(companyOptions) : Promise.resolve([]),
  ]);
  const personnes: Record<string, string> = Object.fromEntries(noms.map((n) => [n.id, n.name]));
  personnes[MAGASIN] = "Magasin central";

  return {
    moi: user.id,
    maintenant: maintenant.toISOString(),
    faits: { ...f, equipe: [...f.equipe] },
    articles,
    supports,
    transferts: transfertsVus,
    demandes: demandesVues,
    personnes,
    equipe: [...f.equipe].map((id) => ({ id, nom: personnes[id] ?? "Compte supprimé" })).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    destinataires,
    catalogue: catalogue.map((c) => ({ ...c, famille: c.famille as PromoFamille })),
    produitsOptions: produitsOptions.map((p) => ({ id: p.id, nom: p.canonicalName })),
    societes,
    demandables: articles.filter((a) => a.isActive).map((a) => ({ id: a.id, libelle: a.libelle })),
  };
}

/** L'article est-il dans le périmètre d'entité de la personne ? (garde des actions) */
export async function articleDansMonPerimetre(userId: string, itemId: string) {
  return prisma.promoStockItem.findFirst({
    where: await companyScopedWhere(userId, { id: itemId }),
    select: {
      id: true, companyId: true, isActive: true, name: true, unit: true,
      catalogue: { select: { nom: true, famille: true, unite: true, reference: true } },
      produits: { select: { product: { select: { canonicalName: true } } } },
    },
  });
}
