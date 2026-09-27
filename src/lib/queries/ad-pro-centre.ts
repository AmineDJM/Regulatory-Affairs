import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { SLUG_DG } from "@/lib/workflow/parcours";
import { AD_PRO_KINDS, AD_PRO_ENTITY_TYPE, type AdProKind } from "@/lib/ad-pro/unified";
import { FORME_PORTE, type LigneCentre } from "@/lib/ad-pro/centre";
import { ITEM_KIND_LABELS } from "@/lib/ad-pro-items";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI ATTEND LE CENTRE DE VALIDATION AD & PRO — une LENTILLE, pas un registre.
 *
 * Rien n'est recopié dans une table de synthèse : l'état du circuit EST l'état du centre. Une
 * copie diverge au premier changement, et l'on se retrouve avec deux réponses à « le Directeur
 * Général a-t-il validé ? » sans savoir laquelle croire (§118.5). Trois lectures, une par forme
 * de porte, et chacune lit la source qui fait foi :
 *
 *   • `ETAPE_CIRCUIT` → `WorkflowInstance.currentSlug = 'dg'` (les quatre circuits configurables) ;
 *   • `ETAPE_PROMO`   → `PromoMaterial.circuitState = 'REVIEW_DG'` ;
 *   • `VISA_CENTRE`   → `AdProGateVisa.status = 'PENDING'` (consulting, autres demandes) ;
 *   • les BONS DE COMMANDE (§118.148), quel que soit leur montant : la demande de BC d'un poste
 *     (`AdProItem.orderStage = 'REQUESTED'`), la pièce BC du registre Legal née d'Ad & Pro
 *     (`AdProGateVisa` sur `LEGAL_DOCUMENT`), et le BC d'un dossier de matériel promotionnel de
 *     l'ancien parcours (`status = 'BC_FINANCE_REVIEW'`).
 *
 * ── POURQUOI AUCUNE CLAUSE DE PORTÉE, et c'est une décision ─────────────────────────────────
 *
 * Les autres lectures Ad & Pro filtrent par société et par module, à raison. Ici non, et le
 * raisonnement est celui du centre de paiement : le siège (`siegeAuCentreAdPro`) est la garde, et
 * ses deux titulaires ont par construction la portée la plus large — le Super Admin a TOUS les
 * modules, la Direction Générale a le pôle Ad & Pro entier. Une clause de portée n'ajouterait
 * donc AUCUNE protection, et elle pourrait CACHER à l'arbitre une demande de 5 M DZD : le défaut
 * exact que ce centre existe pour fermer. La garde est à l'entrée de l'écran, pas dans la requête.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** entityType → nature, dérivé du registre canonique. Une table écrite à la main divergerait. */
const NATURE_PAR_ENTITE = new Map<string, AdProKind>(
  (Object.entries(AD_PRO_ENTITY_TYPE) as [AdProKind, EntityType][]).map(([k, e]) => [e, k]),
);

const FICHE = new Map<AdProKind, { label: string; href: string }>(
  AD_PRO_KINDS.map((k) => [k.kind, { label: k.label, href: k.href }]),
);

const lien = (kind: AdProKind, id: string) => `${FICHE.get(kind)?.href ?? "/ad-pro"}/${id}`;

/** Intitulé lisible : la référence quand elle existe, sinon le nom — jamais un `cuid` nu. */
const intitule = (ref: string | null, nom: string | null, secours: string): string => {
  const n = (nom ?? "").trim();
  if (ref && n) return `${ref} — ${n}`;
  return ref ?? (n || secours);
};

/** Le parent d'un poste, lu sur ses colonnes — exactement une est renseignée (`trainingId` dort). */
const PARENT_DU_POSTE = [
  ["sponsoringId", "SPONSORING"],
  ["congressNationalId", "CONGRESS_NATIONAL"],
  ["congressInternationalId", "CONGRESS_INTERNATIONAL"],
  ["eventId", "EVENT"],
] as const;

export async function demandesAuCentreAdPro(): Promise<LigneCentre[]> {
  const [instances, promos, visas, postes, promosBC] = await Promise.all([
    prisma.workflowInstance.findMany({
      where: { currentSlug: SLUG_DG, status: "IN_PROGRESS" },
      select: { entityType: true, entityId: true, amount: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 300,
    }).catch(() => []),
    prisma.promoMaterial.findMany({
      where: { circuitState: "REVIEW_DG" },
      select: { id: true, reference: true, title: true, chosenAmount: true, amount: true, updatedAt: true, requesterId: true },
      orderBy: { updatedAt: "asc" },
      take: 300,
    }).catch(() => []),
    prisma.adProGateVisa.findMany({
      where: { status: "PENDING" },
      select: { entityType: true, entityId: true, amount: true, threshold: true, createdAt: true, note: true },
      orderBy: { createdAt: "asc" },
      take: 300,
    }).catch(() => []),
    // LES BONS DE COMMANDE (§118.148) — la demande de BC d'un POSTE, visée ici.
    prisma.adProItem.findMany({
      where: { orderStage: "REQUESTED" },
      select: {
        id: true, kind: true, label: true, supplier: true, amountGranted: true, orderNote: true,
        orderRequestedAt: true, orderRequestedById: true, updatedAt: true,
        sponsoringId: true, congressNationalId: true, congressInternationalId: true, eventId: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 300,
    }).catch(() => []),
    // Le BC d'un dossier de matériel promotionnel de l'ANCIEN parcours, qui attendait les Finances.
    prisma.promoMaterial.findMany({
      where: { status: "BC_FINANCE_REVIEW", circuitState: null },
      select: { id: true, reference: true, title: true, chosenAmount: true, amount: true, bcReference: true, chosenAgency: true, updatedAt: true, requesterId: true },
      orderBy: { updatedAt: "asc" },
      take: 300,
    }).catch(() => []),
  ]);

  // Le seuil FIGÉ du visa fait foi pour sa ligne ; pour les deux autres formes, c'est le réglage
  // du jour — leur porte n'archive pas le seuil qui l'a ouverte, et l'inventer serait pire que
  // de rendre celui qui est en vigueur (§118.16).
  const reglage = await prisma.appSetting
    .findUnique({ where: { id: "global" }, select: { adProDgThreshold: true } })
    .catch(() => null);
  const seuilDuJour = reglage ? toNumber(reglage.adProDgThreshold) : null;

  const lignes: LigneCentre[] = [];

  // ── 1. LES QUATRE CIRCUITS CONFIGURABLES ───────────────────────────────────────────────────
  // Les intitulés sont relus PAR TYPE, en un lot chacun : une lecture par instance ferait
  // trois cents allers-retours sur un écran qu'on ouvre dix fois par jour (§118.102b).
  const parType = new Map<string, string[]>();
  for (const i of instances) {
    parType.set(i.entityType, [...(parType.get(i.entityType) ?? []), i.entityId]);
  }
  const [spons, intl, natio, evts] = await Promise.all([
    prisma.sponsoringRequest.findMany({
      where: { id: { in: parType.get("SPONSORING") ?? [] } },
      select: { id: true, reference: true, institution: true, requesterId: true },
    }).catch(() => []),
    prisma.congressInternational.findMany({
      where: { id: { in: parType.get("CONGRESS_INTERNATIONAL") ?? [] } },
      select: { id: true, name: true, requesterId: true },
    }).catch(() => []),
    prisma.congressNational.findMany({
      where: { id: { in: parType.get("CONGRESS_NATIONAL") ?? [] } },
      select: { id: true, name: true, requesterId: true },
    }).catch(() => []),
    prisma.event.findMany({
      where: { id: { in: parType.get("EVENT") ?? [] } },
      select: { id: true, name: true, requesterId: true },
    }).catch(() => []),
  ]);
  // Les opérations des POSTES dont le BC attend : leur référence et leur nom, par type, en lot.
  const opsDesPostes = new Map<string, string[]>();
  for (const p of postes) {
    for (const [col, type] of PARENT_DU_POSTE) {
      const id = p[col];
      if (id) opsDesPostes.set(type, [...(opsDesPostes.get(type) ?? []), id]);
    }
  }
  const [sponsPostes, intlPostes, natioPostes, evtsPostes] = await Promise.all([
    opsDesPostes.get("SPONSORING")?.length
      ? prisma.sponsoringRequest.findMany({ where: { id: { in: opsDesPostes.get("SPONSORING")! } }, select: { id: true, reference: true, institution: true } }).catch(() => [])
      : [],
    opsDesPostes.get("CONGRESS_INTERNATIONAL")?.length
      ? prisma.congressInternational.findMany({ where: { id: { in: opsDesPostes.get("CONGRESS_INTERNATIONAL")! } }, select: { id: true, name: true } }).catch(() => [])
      : [],
    opsDesPostes.get("CONGRESS_NATIONAL")?.length
      ? prisma.congressNational.findMany({ where: { id: { in: opsDesPostes.get("CONGRESS_NATIONAL")! } }, select: { id: true, name: true } }).catch(() => [])
      : [],
    opsDesPostes.get("EVENT")?.length
      ? prisma.event.findMany({ where: { id: { in: opsDesPostes.get("EVENT")! } }, select: { id: true, name: true } }).catch(() => [])
      : [],
  ]);
  const OPERATION = new Map<string, string>();
  for (const r of sponsPostes) OPERATION.set(`SPONSORING:${r.id}`, intitule(r.reference, r.institution, "Sponsoring"));
  for (const r of intlPostes) OPERATION.set(`CONGRESS_INTERNATIONAL:${r.id}`, r.name);
  for (const r of natioPostes) OPERATION.set(`CONGRESS_NATIONAL:${r.id}`, r.name);
  for (const r of evtsPostes) OPERATION.set(`EVENT:${r.id}`, r.name);

  // Les BC du registre Legal nés d'Ad & Pro, dont le visa attend.
  const idsBCLegal = visas.filter((v) => v.entityType === "LEGAL_DOCUMENT").map((v) => v.entityId);
  const bcLegaux = idsBCLegal.length
    ? await prisma.legalDocument.findMany({
        where: { id: { in: idsBCLegal } },
        select: { id: true, reference: true, title: true, counterparty: true, amount: true, createdById: true, sourceType: true, notes: true },
      }).catch(() => [])
    : [];

  // ── LES NOMS EN UN SEUL LOT ────────────────────────────────────────────────────────────────
  // Les cinq modèles ne portent pas de relation `requester` — seulement `requesterId`. Six
  // relations séparées feraient six fois le même travail, et l'écran n'a besoin que d'un nom
  // (§118.102b). C'est exactement ce que fait `getAdProRequests` : on ne réinvente pas sa façon.
  const idsVisaTous = visas.map((v) => v.entityId);
  const [contrats, autres] = await Promise.all([
    prisma.consultingContract.findMany({
      where: { id: { in: idsVisaTous } },
      select: { id: true, reference: true, title: true, requesterId: true },
    }).catch(() => []),
    prisma.adProOtherRequest.findMany({
      where: { id: { in: idsVisaTous } },
      select: { id: true, reference: true, title: true, requesterId: true },
    }).catch(() => []),
  ]);

  const idsPersonnes = [...new Set([
    ...spons.map((r) => r.requesterId), ...intl.map((r) => r.requesterId),
    ...natio.map((r) => r.requesterId), ...evts.map((r) => r.requesterId),
    ...promos.map((r) => r.requesterId), ...contrats.map((r) => r.requesterId),
    ...autres.map((r) => r.requesterId),
    ...postes.map((r) => r.orderRequestedById), ...bcLegaux.map((r) => r.createdById),
    ...promosBC.map((r) => r.requesterId),
  ].filter((x): x is string => Boolean(x)))];
  const personnes = idsPersonnes.length
    ? await prisma.user.findMany({ where: { id: { in: idsPersonnes } }, select: { id: true, name: true } }).catch(() => [])
    : [];
  const NOMS = new Map(personnes.map((u) => [u.id, u.name]));
  /** Le nom du demandeur, ou `null`. Jamais un identifiant : un `cuid` à l'écran ne dit rien. */
  const nomDe = (id: string | null): string | null => (id ? NOMS.get(id) ?? null : null);

  const fiches = new Map<string, { ref: string | null; nom: string | null; par: string | null }>();
  for (const r of spons) fiches.set(`SPONSORING:${r.id}`, { ref: r.reference, nom: r.institution, par: nomDe(r.requesterId) });
  for (const r of intl) fiches.set(`CONGRESS_INTERNATIONAL:${r.id}`, { ref: null, nom: r.name, par: nomDe(r.requesterId) });
  for (const r of natio) fiches.set(`CONGRESS_NATIONAL:${r.id}`, { ref: null, nom: r.name, par: nomDe(r.requesterId) });
  for (const r of evts) fiches.set(`EVENT:${r.id}`, { ref: null, nom: r.name, par: nomDe(r.requesterId) });

  for (const i of instances) {
    const kind = NATURE_PAR_ENTITE.get(i.entityType);
    // Une instance dont le type n'est PAS une nature Ad & Pro n'a rien à faire ici : l'étape
    // `dg` n'existe que dans ces circuits, mais l'ignorer en silence serait fabriquer une ligne
    // qu'on ne sait pas nommer. On l'écarte, sans deviner.
    if (!kind || FORME_PORTE[kind] !== "ETAPE_CIRCUIT") continue;
    const f = fiches.get(`${i.entityType}:${i.entityId}`);
    lignes.push({
      kind,
      entityType: i.entityType,
      entityId: i.entityId,
      reference: f?.ref ?? null,
      intitule: intitule(f?.ref ?? null, f?.nom ?? null, FICHE.get(kind)?.label ?? "Demande"),
      demandeur: f?.par ?? null,
      montant: i.amount == null ? null : toNumber(i.amount),
      seuil: seuilDuJour,
      forme: "ETAPE_CIRCUIT",
      depuis: (i.updatedAt ?? i.createdAt).toISOString(),
      href: lien(kind, i.entityId),
    });
  }

  // ── 2. LE MATÉRIEL PROMOTIONNEL ────────────────────────────────────────────────────────────
  for (const p of promos) {
    // Le devis RETENU fait foi ; à défaut le budget global. C'est la lecture de `contexteCircuit`,
    // et elle doit être la même ici : deux lectures du montant engagé finiraient par différer, et
    // l'écran afficherait un chiffre que la porte n'a pas utilisé (§118.5).
    const m = p.chosenAmount ?? p.amount;
    lignes.push({
      kind: "PROMO_MATERIAL",
      entityType: "PROMO_MATERIAL",
      entityId: p.id,
      reference: p.reference,
      intitule: intitule(p.reference, p.title, "Matériel promotionnel"),
      demandeur: nomDe(p.requesterId),
      montant: m == null ? null : toNumber(m),
      seuil: seuilDuJour,
      forme: "ETAPE_PROMO",
      depuis: p.updatedAt.toISOString(),
      href: lien("PROMO_MATERIAL", p.id),
    });
  }

  // ── 3. LES DEUX NATURES À VISA ─────────────────────────────────────────────────────────────
  const fichesVisa = new Map<string, { ref: string | null; nom: string | null; par: string | null }>();
  for (const c of contrats) fichesVisa.set(`CONSULTING_CONTRACT:${c.id}`, { ref: c.reference, nom: c.title, par: nomDe(c.requesterId) });
  for (const o of autres) fichesVisa.set(`AD_PRO_OTHER:${o.id}`, { ref: o.reference, nom: o.title, par: nomDe(o.requesterId) });

  for (const v of visas) {
    const kind = NATURE_PAR_ENTITE.get(v.entityType);
    if (!kind || FORME_PORTE[kind] !== "VISA_CENTRE") continue;
    const f = fichesVisa.get(`${v.entityType}:${v.entityId}`);
    // Un visa dont la demande a été SUPPRIMÉE n'est pas une ligne : l'afficher donnerait un
    // arbitrage à rendre sur un dossier qui n'existe plus, et le clic échouerait après coup.
    if (!f) continue;
    lignes.push({
      kind,
      entityType: v.entityType,
      entityId: v.entityId,
      reference: f.ref,
      intitule: intitule(f.ref, f.nom, FICHE.get(kind)?.label ?? "Demande"),
      demandeur: f.par,
      montant: v.amount == null ? null : toNumber(v.amount),
      seuil: v.threshold == null ? null : toNumber(v.threshold),
      forme: "VISA_CENTRE",
      depuis: v.createdAt.toISOString(),
      href: lien(kind, v.entityId),
    });
  }

  // ── 4. LES BONS DE COMMANDE (§118.148) — tous, quel que soit leur montant ──────────────────
  //
  // « Concernant les BC, ils doivent tous passer soit par le centre de validation Ad&Pro si la
  // demande est depuis Ad&Pro, soit par le centre de validation normal. » Pas de seuil ici : la
  // colonne `seuil` reste vide, et l'écran le dit.
  for (const p of postes) {
    const parent = PARENT_DU_POSTE.find(([col]) => p[col]);
    if (!parent) continue; // un poste sans opération (formation dormante) n'est pas une ligne d'Ad & Pro
    const [col, type] = parent;
    const opId = p[col] as string;
    const kind = NATURE_PAR_ENTITE.get(type) ?? null;
    const operation = OPERATION.get(`${type}:${opId}`) ?? (kind ? FICHE.get(kind)?.label : null) ?? "Opération";
    lignes.push({
      kind,
      entityType: "AD_PRO_ITEM",
      entityId: p.id,
      reference: null,
      intitule: `BC — ${ITEM_KIND_LABELS[p.kind]} « ${p.label} »${p.supplier ? ` · ${p.supplier}` : ""} — ${operation}`,
      demandeur: nomDe(p.orderRequestedById),
      montant: p.amountGranted == null ? null : toNumber(p.amountGranted),
      seuil: null,
      forme: "BC_POSTE",
      depuis: (p.orderRequestedAt ?? p.updatedAt).toISOString(),
      href: kind ? lien(kind, opId) : "/ad-pro",
      detail: p.orderNote,
    });
  }

  for (const d of bcLegaux) {
    const v = visas.find((x) => x.entityType === "LEGAL_DOCUMENT" && x.entityId === d.id);
    if (!v) continue;
    const kind = d.sourceType ? NATURE_PAR_ENTITE.get(d.sourceType) ?? null : null;
    lignes.push({
      kind,
      entityType: "LEGAL_DOCUMENT",
      entityId: d.id,
      reference: d.reference,
      intitule: `BC — ${intitule(d.reference, d.counterparty ?? d.title, "Bon de commande")}`,
      demandeur: nomDe(d.createdById),
      montant: d.amount == null ? null : toNumber(d.amount),
      seuil: null,
      forme: "BC_LEGAL",
      depuis: v.createdAt.toISOString(),
      href: `/legal/${d.id}`,
      // Une réouverture (montant relevé, correction demandée) porte sa raison dans la note du visa.
      detail: v.note,
    });
  }

  for (const p of promosBC) {
    const m = p.chosenAmount ?? p.amount;
    lignes.push({
      kind: "PROMO_MATERIAL",
      entityType: "PROMO_MATERIAL",
      entityId: p.id,
      reference: p.reference,
      intitule: `BC${p.bcReference ? ` ${p.bcReference}` : ""} — ${intitule(p.reference, p.title, "Matériel promotionnel")}${p.chosenAgency ? ` · ${p.chosenAgency}` : ""}`,
      demandeur: nomDe(p.requesterId),
      montant: m == null ? null : toNumber(m),
      seuil: null,
      forme: "BC_PROMO",
      depuis: p.updatedAt.toISOString(),
      href: lien("PROMO_MATERIAL", p.id),
    });
  }

  return lignes;
}
