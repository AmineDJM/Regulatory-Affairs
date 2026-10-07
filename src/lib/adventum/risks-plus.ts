import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { chargerBase, chargerBusCockpit, chargerDepenses } from "@/lib/marketing-cockpit/donnees";
import { couvertureFrequence, estCible, repartitionDepenses } from "@/lib/marketing-cockpit/calculs";
import { dossiersHorsDelai } from "@/lib/queries/process-intelligence";
import { formatJours } from "@/lib/process/mining";
import type { Risk, RiskLevel } from "./risks";
import type { RiskThresholds } from "./risk-thresholds";

/**
 * ADVENTUM BRAIN — LES DÉTECTEURS AJOUTÉS PAR LA REFONTE (07/10).
 *
 * Même doctrine que `risks.ts` : chaque détecteur lit des données RÉELLES et rend des Risk Cards avec un geste
 * proposé. La DÉCISION (« est-ce un risque, de quel niveau ? ») est une fonction pure exportée et testée ; la lecture
 * l'entoure. `import type` seulement depuis `risks.ts` : ce fichier est chargé par lui.
 */

const DAY = 86_400_000;
const jours = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);
const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Algiers" });
const pct = (x: number) => `${Math.round(x * 100)} %`;

async function premierActif(role: "LOGISTICS_MANAGER" | "FINANCE_BUDGET_MANAGER") {
  return prisma.user.findFirst({ where: { role, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ───────────────────────────── 1. Stock vs AO attribués ─────────────────────────────

/** Reste à livrer (boîtes quand le conditionnement est connu) face au dernier stock connu. */
export function risqueStockAo(p: { resteALivrer: number; stock: number | null; commandeEnCours: boolean }): RiskLevel | null {
  if (p.resteALivrer <= 0) return null;
  const stock = p.stock ?? 0;
  if (stock >= p.resteALivrer) return null;
  if (stock <= 0) return p.commandeEnCours ? "high" : "critical";
  const couverture = stock / p.resteALivrer;
  if (p.commandeEnCours) return couverture < 0.5 ? "medium" : null;
  return couverture < 0.5 ? "critical" : "high";
}

async function stockVsAoRisks(): Promise<Risk[]> {
  const lignes = await prisma.pchTenderLine.findMany({
    where: { status: "WON", ourProductId: { not: null }, tender: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } } },
    select: {
      id: true, designation: true, quantityUnits: true, awardedQuantityUnits: true, unitsPerBox: true, ourProductId: true, ourProduct: true,
      tender: { select: { id: true, reference: true } },
      orderLines: { select: { deliveryLines: { select: { quantityUnits: true, delivery: { select: { deliveredAt: true } } } } } },
    },
    take: 300,
  });
  if (!lignes.length) return [];
  const produits = [...new Set(lignes.map((l) => l.ourProductId!))];
  const [etats, commandes, logistique] = await Promise.all([
    prisma.stockSnapshot.findMany({ where: { productId: { in: produits }, scope: "PCH" }, orderBy: { date: "desc" }, select: { productId: true, quantity: true, date: true } }),
    prisma.logisticsOrder.findMany({ where: { status: { notIn: ["DELIVERED"] } }, select: { product: true } }),
    premierActif("LOGISTICS_MANAGER"),
  ]);
  const stock = new Map<string, { q: number; date: Date }>();
  for (const e of etats) if (!stock.has(e.productId)) stock.set(e.productId, { q: e.quantity, date: e.date });

  // Une ligne par produit : on additionne ce qui reste à livrer sur tous les AO attribués.
  const parProduit = new Map<string, { nom: string; reste: number; aos: { id: string; reference: string }[] }>();
  for (const l of lignes) {
    const attribue = l.awardedQuantityUnits ?? l.quantityUnits;
    const livre = l.orderLines.flatMap((o) => o.deliveryLines).filter((d) => d.delivery.deliveredAt).reduce((s, d) => s + d.quantityUnits, 0);
    const resteUnites = Math.max(0, attribue - livre);
    const reste = l.unitsPerBox && l.unitsPerBox > 0 ? Math.ceil(resteUnites / l.unitsPerBox) : resteUnites;
    if (reste <= 0) continue;
    const p = parProduit.get(l.ourProductId!) ?? { nom: l.ourProduct || l.designation, reste: 0, aos: [] };
    p.reste += reste;
    if (!p.aos.some((a) => a.id === l.tender.id)) p.aos.push({ id: l.tender.id, reference: l.tender.reference });
    parProduit.set(l.ourProductId!, p);
  }
  const out: Risk[] = [];
  for (const [productId, p] of parProduit) {
    const s = stock.get(productId) ?? null;
    const nomBas = p.nom.toLowerCase();
    const enCours = commandes.some((c) => c.product && (c.product.toLowerCase().includes(nomBas) || nomBas.includes(c.product.toLowerCase())));
    const level = risqueStockAo({ resteALivrer: p.reste, stock: s?.q ?? null, commandeEnCours: enCours });
    if (!level) continue;
    const ao = p.aos[0];
    out.push({
      id: `stock-ao-${productId}`, level, category: "PCH", module: "PCH · Stock",
      title: `Stock ${p.nom} vs AO attribué`, object: p.nom,
      impact: "Livraisons d'un marché attribué exposées : pénalités, image auprès de la PCH.",
      owner: "Logistique", deadline: null, ageDays: null,
      probableCause: enCours ? "Une commande fournisseur est en cours mais ne couvre peut-être pas le reste à livrer." : "Aucune commande fournisseur en cours pour ce produit.",
      recommendation: enCours ? "Vérifier la date d'arrivée de la commande en cours." : "Lancer une commande fournisseur.",
      evidence: [
        `Reste à livrer : ${p.reste.toLocaleString("fr-FR")} (${p.aos.map((a) => a.reference).join(", ")})`,
        s ? `Dernier stock connu : ${s.q.toLocaleString("fr-FR")} au ${fmt(s.date)}` : "Aucun état de stock enregistré",
        enCours ? "Commande fournisseur en cours" : "Aucune commande fournisseur en cours",
      ],
      href: `/pch/${ao.id}`, at: new Date().toISOString(),
      actions: [
        { label: "Créer une tâche Logistique", icon: "ListChecks", payload: { kind: "task", title: `Commande fournisseur : ${p.nom} (reste à livrer ${p.reste})`, assigneeId: logistique?.id, priority: level === "critical" ? "CRITICAL" : "HIGH", module: "Logistique" } },
        { label: "Prévenir la Logistique", icon: "Bell", payload: { kind: "notify", userId: logistique?.id, role: logistique ? undefined : "LOGISTICS_MANAGER", title: "Stock insuffisant pour un AO attribué", body: `${p.nom} — reste à livrer ${p.reste}`, link: `/pch/${ao.id}` } },
        { label: "Ouvrir l'AO", icon: "ExternalLink", href: `/pch/${ao.id}` },
      ],
    });
  }
  return out;
}

// ───────────────────────────── 2. Recrutement validé non diffusé ─────────────────────────────

/** Jours depuis la validation, si l'offre n'est publiée sur AUCUN canal au-delà du seuil. */
export function recrutementNonDiffuse(p: { valideLe: Date | null; canauxPublies: number; now: Date; seuilJours: number }): number | null {
  if (!p.valideLe || p.canauxPublies > 0) return null;
  const j = jours(p.valideLe, p.now);
  return j >= p.seuilJours ? j : null;
}

async function recrutementNonDiffuseRisks(th: RiskThresholds): Promise<Risk[]> {
  const now = new Date();
  const reqs = await prisma.recruitmentRequest.findMany({
    where: { stage: "SOURCING" },
    select: {
      id: true, reference: true, position: true, updatedAt: true,
      approvals: { select: { decidedAt: true } },
      channelPosts: { select: { status: true } },
      jobPosting: { select: { id: true } },
    },
  });
  const out: Risk[] = [];
  for (const r of reqs) {
    const valideLe = r.approvals.map((a) => a.decidedAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? r.updatedAt;
    const publies = r.channelPosts.filter((p) => p.status === "PUBLIE").length;
    const j = recrutementNonDiffuse({ valideLe, canauxPublies: publies, now, seuilJours: th.recruitmentUnpublishedDays });
    if (j === null) continue;
    out.push({
      id: `rec-diffusion-${r.id}`, level: j >= th.recruitmentUnpublishedDays * 3 ? "high" : "medium", category: "HR", module: "Recrutement",
      title: "Recrutement validé non diffusé", object: `${r.reference} — ${r.position}`,
      impact: "Le poste validé n'attire aucun candidat tant que l'offre n'est publiée nulle part.",
      owner: "RH", deadline: null, ageDays: j,
      probableCause: r.channelPosts.length ? "Annonces préparées mais jamais publiées." : "Aucun canal de diffusion choisi.",
      recommendation: "Créer une tâche pour les RH : publier l'offre.",
      evidence: [`Validé le ${fmt(valideLe)} (${j} j)`, `${r.channelPosts.length} canal·aux préparé·s, aucun publié`],
      href: `/recrutement/${r.id}`, at: valideLe.toISOString(),
      actions: [
        // Pas de rôle « RH » dans la plateforme : la personne se choisit à la prise en charge.
        { label: "Créer une tâche pour les RH", icon: "ListChecks", payload: { kind: "task", title: `Publier l'offre ${r.reference} — ${r.position}`, assigneeId: null, priority: "HIGH", module: "Recrutement" } },
        { label: "Ouvrir le recrutement", icon: "ExternalLink", href: `/recrutement/${r.id}` },
      ],
    });
  }
  return out;
}

// ───────────────────────────── 3. Couverture terrain + 4. Ad & Pro sur C/D ─────────────────────────────

/** Couverture des cibles H·A·B sous le seuil, une fois au moins la moitié du cycle écoulée. */
export function couvertureBasse(p: { taux: number | null; cibles: number; seuilPct: number; partCycle: number }): RiskLevel | null {
  if (p.taux === null || p.cibles < 5 || p.partCycle < 0.5) return null;
  if (p.taux * 100 >= p.seuilPct) return null;
  return p.taux * 100 < p.seuilPct / 2 ? "high" : "medium";
}

/** Part du budget congrès + événements nominatif allant à des médecins C ou D, au-delà du maximum. */
export function partCDExcessive(part: number | null, maxPct: number): RiskLevel | null {
  if (part === null || part * 100 <= maxPct) return null;
  return part * 100 >= Math.min(100, maxPct * 2) ? "high" : "medium";
}

async function superAdminSession(): Promise<SessionUser | null> {
  const sa = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true }, select: { id: true } });
  if (!sa) return null;
  return { id: sa.id, role: "SUPER_ADMIN", access: await getAccess(sa.id, "SUPER_ADMIN") };
}

async function terrainRisks(th: RiskThresholds): Promise<Risk[]> {
  const user = await superAdminSession();
  if (!user) return [];
  const now = new Date();
  const bus = (await chargerBusCockpit()).filter((b) => b.strategieId);
  const out: Risk[] = [];
  for (const bu of bus.slice(0, 12)) {
    const base = await chargerBase(user, bu, null, now);
    const cov = couvertureFrequence(base.praticiens);
    const duree = base.cycle.fin.getTime() - base.cycle.debut.getTime();
    const partCycle = duree > 0 ? (now.getTime() - base.cycle.debut.getTime()) / duree : 0;
    const lv = couvertureBasse({ taux: cov.taux, cibles: cov.cibles, seuilPct: th.fieldCoverageMinPct, partCycle });
    if (lv) {
      out.push({
        id: `couverture-${bu.id}`, level: lv, category: "FIELD", module: "Force de vente",
        title: `Couverture des cibles H·A·B basse — BU ${bu.nom}`, object: `BU ${bu.nom}`,
        impact: "Les médecins à fort potentiel ne sont pas vus à la fréquence requise.",
        owner: "Direction commerciale", deadline: base.cycle.fin.toISOString(), ageDays: null,
        probableCause: "Visites en retard sur le plan du cycle.",
        recommendation: "Revoir les plans de tournée avec les KAM de la BU.",
        evidence: [`${cov.tenues} cible(s) sur ${cov.cibles} vues à fréquence (${pct(cov.taux ?? 0)}, seuil ${th.fieldCoverageMinPct} %)`, `${base.cycle.libelle} : ${pct(Math.min(1, partCycle))} du cycle écoulé`],
        href: `/marketing-cockpit?bu=${bu.id}`, at: now.toISOString(),
        actions: [
          { label: "Prévenir la Direction commerciale", icon: "Bell", payload: { kind: "notify", role: "NATIONAL_SALES", title: "Couverture des cibles basse", body: `BU ${bu.nom} — ${pct(cov.taux ?? 0)} des cibles vues à fréquence`, link: `/marketing-cockpit?bu=${bu.id}` } },
          { label: "Ouvrir le cockpit", icon: "ExternalLink", href: `/marketing-cockpit?bu=${bu.id}` },
        ],
      });
    }
    const depenses = await chargerDepenses(base, bu, null, now);
    const rep = repartitionDepenses(depenses, base.praticiens.filter((p) => estCible(p.lettre)).length);
    const lvCD = partCDExcessive(rep.partCDCongresEvenements, th.adproCdMaxPct);
    if (lvCD) {
      out.push({
        id: `adpro-cd-${bu.id}`, level: lvCD, category: "BUDGET", module: "Ad & Pro",
        title: `Budget Ad & Pro sur des médecins C/D — BU ${bu.nom}`, object: `BU ${bu.nom}`,
        impact: "L'argent des congrès et événements va à des médecins à faible potentiel ou faible affinité.",
        owner: "Direction Marketing", deadline: null, ageDays: null,
        probableCause: "Demandes nominatives accordées hors cibles H·A·B.",
        recommendation: "Revoir les critères d'accord des prises en charge avec la Direction Marketing.",
        evidence: [`${pct(rep.partCDCongresEvenements ?? 0)} du budget congrès et événements nominatif sur des C et D (maximum ${th.adproCdMaxPct} %)`, "Dépenses nominatives, 12 mois"],
        href: `/marketing-cockpit?vue=investissements&bu=${bu.id}`, at: now.toISOString(),
        actions: [
          { label: "Prévenir la Direction Marketing", icon: "Bell", payload: { kind: "notify", role: "PRODUCT_MANAGER", title: "Budget Ad & Pro hors cibles", body: `BU ${bu.nom} — ${pct(rep.partCDCongresEvenements ?? 0)} sur des C/D`, link: `/marketing-cockpit?vue=investissements&bu=${bu.id}` } },
          { label: "Ouvrir les investissements", icon: "ExternalLink", href: `/marketing-cockpit?vue=investissements&bu=${bu.id}` },
        ],
      });
    }
  }
  return out;
}

// ───────────────────────────── 5. BC non signé ─────────────────────────────

export function bcEnRetard(p: { entreLe: Date | null; signe: boolean; renvoye: boolean; now: Date; seuilJours: number }): number | null {
  if (!p.entreLe || p.signe || p.renvoye) return null;
  const j = jours(p.entreLe, p.now);
  return j >= p.seuilJours ? j : null;
}

async function bcNonSigneRisks(th: RiskThresholds): Promise<Risk[]> {
  const now = new Date();
  const bcs = await prisma.legalDocument.findMany({
    where: { kind: "PURCHASE_ORDER", bcCircuitAt: { not: null }, signedAt: null, signatureReturnedAt: null, status: "ACTIVE" },
    select: { id: true, reference: true, title: true, bcCircuitAt: true },
    take: 100,
  });
  const finance = await premierActif("FINANCE_BUDGET_MANAGER");
  const out: Risk[] = [];
  for (const b of bcs) {
    const j = bcEnRetard({ entreLe: b.bcCircuitAt, signe: false, renvoye: false, now, seuilJours: th.bcUnsignedDays });
    if (j === null) continue;
    const nom = b.reference ? `${b.reference} — ${b.title}` : b.title;
    out.push({
      id: `bc-${b.id}`, level: j >= th.bcUnsignedDays * 2 ? "high" : "medium", category: "FINANCE", module: "Ad & Pro · Bons de commande",
      title: "BC non signé", object: nom,
      impact: "Le fournisseur ne démarre pas sans bon de commande signé.",
      owner: "Finances", deadline: null, ageDays: j,
      probableCause: "Signature des Finances (ou validation du centre) en attente.",
      recommendation: finance ? `Relancer ${finance.name} (Finances).` : "Relancer les Finances.",
      evidence: [`Entré dans le circuit de signature le ${fmt(b.bcCircuitAt!)} (${j} j)`],
      href: `/legal/${b.id}`, at: b.bcCircuitAt!.toISOString(),
      actions: [
        { label: finance ? `Relancer ${finance.name}` : "Relancer les Finances", icon: "Bell", payload: { kind: "notify", userId: finance?.id, role: finance ? undefined : "FINANCE_BUDGET_MANAGER", title: "Bon de commande à signer", body: `${nom} — depuis ${j} j`, link: `/legal/${b.id}` } },
        { label: "Ouvrir le BC", icon: "ExternalLink", href: `/legal/${b.id}` },
      ],
    });
  }
  return out;
}

// ───────────────────────────── 6. Plan de tournée non validé ─────────────────────────────

/** Jours avant le début (négatif = déjà commencé) si le plan n'est pas validé à l'approche de sa période. */
export function planNonValide(p: { statut: string; debut: Date; fin: Date; now: Date; avanceJours: number }): number | null {
  if (p.statut === "APPROVED") return null;
  if (p.fin.getTime() < p.now.getTime()) return null;
  const avant = Math.ceil((p.debut.getTime() - p.now.getTime()) / DAY);
  return avant <= p.avanceJours ? avant : null;
}

async function planTourneeRisks(th: RiskThresholds): Promise<Risk[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + (th.tourPlanLeadDays + 1) * DAY);
  const plans = await prisma.tourPlan.findMany({
    where: { status: { not: "APPROVED" }, periodStart: { lte: horizon }, periodEnd: { gte: now } },
    select: { id: true, status: true, periodStart: true, periodEnd: true, repId: true, reviewerId: true, escalatedToId: true, rep: { select: { name: true } }, reviewer: { select: { name: true } } },
    take: 200,
  });
  const out: Risk[] = [];
  for (const p of plans) {
    const avant = planNonValide({ statut: p.status, debut: p.periodStart, fin: p.periodEnd, now, avanceJours: th.tourPlanLeadDays });
    if (avant === null) continue;
    const chezValideur = p.status === "SUBMITTED" || p.status === "ESCALATED";
    const cibleId = chezValideur ? (p.status === "ESCALATED" ? p.escalatedToId : p.reviewerId) ?? null : p.repId;
    const chez = chezValideur ? p.reviewer?.name ?? "Le N+1" : p.rep.name;
    out.push({
      id: `plan-${p.id}`, level: avant <= 0 ? "high" : "medium", category: "FIELD", module: "Force de vente",
      title: "Plan de tournée non validé", object: `${p.rep.name} — ${fmt(p.periodStart)} → ${fmt(p.periodEnd)}`,
      impact: "Le KAM démarre sa période sans plan validé.",
      owner: chez, deadline: p.periodStart.toISOString(), ageDays: avant < 0 ? -avant : null,
      probableCause: chezValideur ? "Plan soumis, décision du valideur en attente." : "Plan non soumis (ou à corriger).",
      recommendation: chezValideur ? `Relancer ${chez} pour la validation.` : `Relancer ${p.rep.name} pour soumettre son plan.`,
      evidence: [avant <= 0 ? `Période commencée depuis ${-avant} j` : `Début dans ${avant} j`, `État : ${p.status}`],
      href: "/medical/plan-de-tournee", at: p.periodStart.toISOString(),
      actions: [
        cibleId
          ? { label: `Relancer ${chez}`, icon: "Bell", payload: { kind: "notify", userId: cibleId, title: chezValideur ? "Plan de tournée à valider" : "Plan de tournée à soumettre", body: `${p.rep.name} — période du ${fmt(p.periodStart)}`, link: "/medical/plan-de-tournee" } }
          : { label: "Prévenir la Direction commerciale", icon: "Bell", payload: { kind: "notify", role: "NATIONAL_SALES", title: "Plan de tournée non validé", body: `${p.rep.name} — période du ${fmt(p.periodStart)}`, link: "/medical/plan-de-tournee" } },
        { label: "Ouvrir les plans", icon: "ExternalLink", href: "/medical/plan-de-tournee" },
      ],
    });
  }
  return out;
}

// ───────────────────────────── 7. Coût IA qui dérape ─────────────────────────────

/** Rapport coût des dernières 24 h / moyenne quotidienne des 7 jours précédents, s'il dépasse le seuil. */
export function deriveCoutIa(p: { jour: number; moyenne7: number; seuilPct: number; plancherUsd?: number }): number | null {
  const plancher = p.plancherUsd ?? 0.5;
  if (p.jour < plancher) return null;
  if (p.moyenne7 <= 0) return null;
  const ratio = p.jour / p.moyenne7;
  return ratio >= 1 + p.seuilPct / 100 ? ratio : null;
}

async function coutIaRisks(th: RiskThresholds): Promise<Risk[]> {
  const now = new Date();
  const hier = new Date(now.getTime() - DAY);
  const semaine = new Date(now.getTime() - 8 * DAY);
  const [jour, avant, parUsage] = await Promise.all([
    prisma.modelCallLog.aggregate({ where: { at: { gte: hier } }, _sum: { costUsd: true } }),
    prisma.modelCallLog.aggregate({ where: { at: { gte: semaine, lt: hier } }, _sum: { costUsd: true } }),
    prisma.modelCallLog.groupBy({ by: ["feature"], where: { at: { gte: hier } }, _sum: { costUsd: true } }),
  ]);
  const j = Number(jour._sum.costUsd ?? 0);
  const m = Number(avant._sum.costUsd ?? 0) / 7;
  const ratio = deriveCoutIa({ jour: j, moyenne7: m, seuilPct: th.aiCostDriftPct });
  if (ratio === null) return [];
  const top = [...parUsage].sort((a, b) => Number(b._sum.costUsd ?? 0) - Number(a._sum.costUsd ?? 0))[0];
  const usd = (x: number) => `${x.toFixed(2).replace(".", ",")} $`;
  return [{
    id: `ia-cout-${now.toISOString().slice(0, 10)}`, level: ratio >= 3 ? "high" : "medium", category: "AI", module: "Contrôle de l'IA",
    title: "Coût IA qui dérape", object: `${usd(j)} sur 24 h`,
    impact: "Dépense IA au-dessus de son rythme habituel.",
    owner: "Super Admin", deadline: null, ageDays: null,
    probableCause: top?.feature ? `Usage le plus coûteux : ${top.feature} (${usd(Number(top._sum.costUsd ?? 0))}).` : "Hausse du volume d'appels.",
    recommendation: "Vérifier l'usage le plus coûteux dans Contrôle de l'IA.",
    evidence: [`24 h : ${usd(j)}`, `Moyenne des 7 jours précédents : ${usd(m)} / jour`, `× ${ratio.toFixed(1).replace(".", ",")}`],
    href: "/admin/ai", at: now.toISOString(),
    actions: [{ label: "Ouvrir Contrôle de l'IA", icon: "ExternalLink", href: "/admin/ai" }],
  }];
}

// ───────────────────────────── 8. Étape de circuit au-delà de son délai ─────────────────────────────

async function delaiEtapeRisks(): Promise<Risk[]> {
  const hors = await dossiersHorsDelai();
  return hors.slice(0, 40).map(({ circuit, circuitLabel, item }) => ({
    id: `sla-${circuit}-${item.id}`, level: (item.days >= item.limitDays * 2 ? "high" : "medium") as RiskLevel,
    category: "VALIDATION", module: circuitLabel,
    title: `Délai dépassé — ${item.stepLabel}`, object: item.label,
    impact: "Le dossier attend au-delà du délai fixé pour son étape.",
    owner: item.stepLabel, deadline: null, ageDays: Math.floor(item.days),
    probableCause: `À l'étape « ${item.stepLabel} » depuis ${formatJours(item.days)} (délai ${item.limitDays} j).`,
    recommendation: "Ouvrir le dossier et relancer la personne de l'étape.",
    evidence: [`Étape : ${item.stepLabel}`, `En attente depuis ${formatJours(item.days)}`, `Délai fixé : ${item.limitDays} j`],
    href: item.href, at: new Date().toISOString(),
    actions: item.href ? [{ label: "Ouvrir le dossier", icon: "ExternalLink", href: item.href }] : [],
  }));
}

export const DETECTEURS_PLUS: ((th: RiskThresholds) => Promise<Risk[]>)[] = [
  () => stockVsAoRisks(),
  recrutementNonDiffuseRisks,
  terrainRisks,
  bcNonSigneRisks,
  planTourneeRisks,
  coutIaRisks,
  () => delaiEtapeRisks(),
];
