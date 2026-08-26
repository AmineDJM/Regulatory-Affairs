import { prisma } from "@/lib/prisma";
import {
  ensureCycle, createBusinessUnit, updateBusinessUnit, deleteBusinessUnit,
  createPromoProduct, updatePromoProduct, deletePromoProduct,
  saveForecast, saveSfeSettings, createSalesTeam, updateSalesTeam, deleteSalesTeam,
  saveRepProfile, deleteRepProfile, saveAssignment, deleteAssignment, carryForwardAssignments,
} from "@/lib/actions/sales-planning-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, fieldsOf, resolveOne, dzd } from "./helpers";
import { fold } from "./impl-regulatory";

/**
 * OPS VAGUE 6c — PLANNING FORCE DE VENTE (SFE) : business units, produits promus (canal
 * ville / hôpital), équipes, profils KAM, prévisions par produit et par CYCLE MENSUEL,
 * matrice d'affectations KAM × produit (0 visite sans note = retrait), report d'un cycle à
 * l'autre, paramètres SFE. Les « save » de l'écran sont des UPSERT à DÉFAUTS-PIÈGES (targetFte
 * absent → 0, fteBudget absent → 1, poids de position par défaut…) : chaque op relit l'existant
 * et le REJOUE (FUSION) pour qu'un champ non cité ne soit jamais écrasé. Par les ACTIONS
 * CANONIQUES.
 */

const MONTHS_FR: [string, number][] = [
  ["janvier", 1], ["fevrier", 2], ["mars", 3], ["avril", 4], ["mai", 5], ["juin", 6],
  ["juillet", 7], ["aout", 8], ["septembre", 9], ["octobre", 10], ["novembre", 11], ["decembre", 12],
];

/** « septembre 2026 », « 2026-09 » ou « 09/2026 » → {year, month}.
 *  Les formes numériques se lisent sur le texte BRUT (fold retire la ponctuation). */
function parseCycleMonth(raw: string): { year: number; month: number } | { error: string } {
  const t = raw.trim().toLowerCase();
  if (!t) return { error: "Précisez le mois du cycle (champ « date » — « septembre 2026 » ou 2026-09)." };
  const m = t.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})$/) ?? t.match(/^(\d{1,2})\s*[-/.]\s*(\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [year, month] = a > 12 ? [a, b] : [b, a];
    if (month >= 1 && month <= 12) return { year, month };
  }
  const q = fold(raw);
  const name = MONTHS_FR.find(([n]) => q.includes(n));
  const yearM = q.match(/(\d{4})/);
  if (name && yearM) return { year: Number(yearM[1]), month: name[1] };
  return { error: `Mois de cycle illisible : « ${raw} » — attendu « septembre 2026 » ou 2026-09.` };
}

const cycleLabel = (c: { year: number; month: number }) =>
  `${MONTHS_FR.find(([, n]) => n === c.month)?.[0] ?? c.month} ${c.year}`;

/** Le cycle EXISTANT s'il y est — sinon on annonce sa création et l'exécution l'assurera. */
async function findCycle(c: { year: number; month: number }): Promise<{ id: string | null; shown: string }> {
  const existing = await prisma.promoCycle.findUnique({ where: { year_month: { year: c.year, month: c.month } }, select: { id: true } });
  return { id: existing?.id ?? null, shown: existing ? cycleLabel(c) : `${cycleLabel(c)} (cycle créé à l'exécution)` };
}

const resolveBU = (raw: string) =>
  resolveOne(raw, "la business unit (champ « target » — son nom)",
    (q) => prisma.businessUnit.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (b) => b.name);

const resolvePromoProduct6 = (raw: string) =>
  resolveOne(raw, "le produit promu (champ « product » — son nom)",
    (q) => prisma.promoProduct.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (p) => p.name);

const resolveSalesTeam = (raw: string) =>
  resolveOne(raw, "l'équipe de vente (champ « target » — son nom)",
    (q) => prisma.salesTeam.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (t) => t.name);

async function planningUser(raw: string): Promise<{ id: string; name: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la personne (nom)." };
  const rows = await prisma.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, name: true }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun utilisateur actif « ${q} ».` };
  return { error: `Plusieurs personnes correspondent : ${rows.map((u) => u.name).join(", ")} — préciser.` };
}

const CHANNEL_FR = (v: string): "RETAIL" | "HOSPITAL" | "BOTH" | null => {
  const q = fold(v);
  if (!q) return null;
  if (/ville|officine|retail/.test(q)) return "RETAIL";
  if (/hopital|hospital/.test(q)) return "HOSPITAL";
  if (/deux|both|mixte/.test(q)) return "BOTH";
  return null;
};
const CHANNEL_SHOWN: Record<string, string> = { RETAIL: "Ville", HOSPITAL: "Hôpital", BOTH: "Ville + Hôpital" };

export const PLANNING_OPS_IMPL: Record<string, OpImpl> = {
  // ───────── Business units ─────────
  create_business_unit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez la business unit (champ « name »)." };
      let headId: string | null = null; let headShown: string | null = null;
      if (opStr(input, "person")) {
        const u = await planningUser(opStr(input, "person"));
        if ("error" in u) return u;
        headId = u.id; headShown = u.name;
      }
      return {
        title: `Créer la business unit « ${name} »`,
        fields: fieldsOf([["BU", name], ["Code", opStr(input, "reference") || null], ["Responsable", headShown]]),
        args: { name, code: opStr(input, "reference") || null, color: null, companyId: null, headId },
        successMessage: `BU « ${name} » créée.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(createBusinessUnit, args, "La création de la BU a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  update_business_unit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBU(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const cur = await prisma.businessUnit.findUnique({
        where: { id: hit.id }, select: { code: true, color: true, companyId: true, headId: true, isActive: true },
      });
      // FUSION : code, couleur, entité et responsable sont REMPLACÉS par l'action — rejoués.
      let headId = cur?.headId ?? null; let headShown = "(inchangé)";
      const p = opStr(input, "person");
      if (/^aucun/i.test(p)) { headId = null; headShown = "— (retiré)"; }
      else if (p) {
        const u = await planningUser(p);
        if ("error" in u) return u;
        headId = u.id; headShown = u.name;
      }
      return {
        title: `Modifier la BU « ${hit.name} »`,
        fields: fieldsOf([
          ["BU", opStr(input, "newName") ? `${hit.name} → ${opStr(input, "newName")}` : hit.name],
          ["Responsable", headShown],
          ["Le reste", "code, couleur et entité rejoués (FUSION)"],
        ]),
        args: {
          id: hit.id, name: opStr(input, "newName") || null,
          code: opStr(input, "reference") || cur?.code || null,
          color: cur?.color ?? null, companyId: cur?.companyId ?? null, headId,
          isActive: cur?.isActive === false ? null : "on",
        },
        successMessage: `BU « ${opStr(input, "newName") || hit.name} » modifiée.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(updateBusinessUnit, args, "La modification de la BU a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  delete_business_unit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveBU(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const [products, teams] = await Promise.all([
        prisma.promoProduct.count({ where: { businessUnitId: hit.id } }),
        prisma.salesTeam.count({ where: { businessUnitId: hit.id } }),
      ]);
      return {
        title: `Supprimer la BU « ${hit.name} »`,
        fields: [{ label: "BU", value: hit.name }, { label: "Rattachements", value: `${products} produit(s), ${teams} équipe(s)` }],
        warnings: ["Suppression définitive de la franchise — produits et équipes rattachés perdent leur BU."],
        args: { id: hit.id },
        successMessage: `BU « ${hit.name} » supprimée.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(deleteBusinessUnit, args, "La suppression de la BU a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  // ───────── Produits promus ─────────
  create_promo_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "product");
      if (!name) return { error: "Nommez le produit promu (champ « name »)." };
      const channel = CHANNEL_FR(opStr(input, "mode")) ?? "BOTH";
      let buId: string | null = null; let buShown: string | null = null;
      if (opStr(input, "target")) {
        const b = await resolveBU(opStr(input, "target"));
        if ("error" in b) return b;
        buId = b.id; buShown = b.name;
      }
      let managerId: string | null = null; let managerShown: string | null = null;
      if (opStr(input, "person")) {
        const u = await planningUser(opStr(input, "person"));
        if ("error" in u) return u;
        managerId = u.id; managerShown = u.name;
      }
      return {
        title: `Créer le produit promu « ${name} »`,
        fields: fieldsOf([
          ["Produit", name],
          ["Canal", CHANNEL_SHOWN[channel]],
          ["BU", buShown],
          ["Chef de produit", managerShown],
        ]),
        args: { name, code: opStr(input, "reference") || null, channel, businessUnitId: buId, managerId },
        successMessage: `Produit promu « ${name} » créé.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(createPromoProduct, args, "La création du produit a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  update_promo_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolvePromoProduct6(opStr(input, "product") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const cur = await prisma.promoProduct.findUnique({
        where: { id: hit.id }, select: { code: true, channel: true, businessUnitId: true, managerId: true, isActive: true },
      });
      // FUSION : canal (défaut-piège BOTH), code, BU et chef de produit sont REMPLACÉS — rejoués.
      const channel = CHANNEL_FR(opStr(input, "mode")) ?? cur?.channel ?? "BOTH";
      let buId = cur?.businessUnitId ?? null; let buShown = "(inchangée)";
      if (opStr(input, "target")) {
        const b = await resolveBU(opStr(input, "target"));
        if ("error" in b) return b;
        buId = b.id; buShown = b.name;
      }
      let managerId = cur?.managerId ?? null; let managerShown = "(inchangé)";
      const p = opStr(input, "person");
      if (/^aucun/i.test(p)) { managerId = null; managerShown = "— (retiré)"; }
      else if (p) {
        const u = await planningUser(p);
        if ("error" in u) return u;
        managerId = u.id; managerShown = u.name;
      }
      return {
        title: `Modifier le produit promu « ${hit.name} »`,
        fields: fieldsOf([
          ["Produit", opStr(input, "newName") ? `${hit.name} → ${opStr(input, "newName")}` : hit.name],
          ["Canal", CHANNEL_SHOWN[channel]],
          ["BU", buShown],
          ["Chef de produit", managerShown],
        ]),
        args: {
          id: hit.id, name: opStr(input, "newName") || null,
          code: opStr(input, "reference") || cur?.code || null,
          channel, businessUnitId: buId, managerId,
          isActive: cur?.isActive === false ? null : "on",
        },
        successMessage: `Produit « ${opStr(input, "newName") || hit.name} » modifié.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(updatePromoProduct, args, "La modification du produit a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  delete_promo_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolvePromoProduct6(opStr(input, "product") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const assignments = await prisma.promotionAssignment.count({ where: { productId: hit.id } });
      return {
        title: `Supprimer le produit promu « ${hit.name} »`,
        fields: [{ label: "Produit", value: hit.name }, { label: "Affectations emportées", value: String(assignments) }],
        warnings: ["Suppression définitive — les affectations KAM × produit de tous les cycles partent avec."],
        args: { id: hit.id },
        successMessage: `Produit « ${hit.name} » supprimé.`,
        revalidate: ["/planning/catalogue"],
      };
    },
    execute: (args) => runFd(deletePromoProduct, args, "La suppression du produit a été refusée.", { revalidate: ["/planning/catalogue"] }),
  },

  // ───────── Prévision par produit et par cycle ─────────
  save_forecast: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = parseCycleMonth(opStr(input, "date") || opStr(input, "label"));
      if ("error" in c) return c;
      const product = await resolvePromoProduct6(opStr(input, "product") || opStr(input, "name"));
      if ("error" in product) return product;
      const cycle = await findCycle(c);
      const existing = cycle.id
        ? await prisma.productForecast.findUnique({
            where: { cycleId_productId: { cycleId: cycle.id, productId: product.id } },
            select: { targetFte: true, coverageTargetPct: true, plannedVisits: true, budget: true, note: true },
          })
        : null;
      // FUSION : l'upsert REMPLACE (targetFte absent → 0 !) — l'existant est relu et rejoué.
      const val = (given: string, cur: number | null | undefined) =>
        given || (cur != null ? String(Number(cur)) : null);
      return {
        title: `Prévision ${product.name} — ${cycle.shown}`,
        fields: fieldsOf([
          ["Produit", product.name],
          ["Cycle", cycle.shown],
          ["FTE cible", val(opStr(input, "quantity"), existing?.targetFte != null ? Number(existing.targetFte) : null)],
          ["Couverture cible %", val(opStr(input, "threshold"), existing?.coverageTargetPct != null ? Number(existing.coverageTargetPct) : null)],
          ["Visites prévues", val(opStr(input, "visits"), existing?.plannedVisits != null ? Number(existing.plannedVisits) : null)],
          ["Budget", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : (existing?.budget != null ? `${dzd(Number(existing.budget))} (rejoué)` : null)],
        ]),
        args: {
          year: String(c.year), month: String(c.month), productId: product.id,
          targetFte: val(opStr(input, "quantity"), existing?.targetFte != null ? Number(existing.targetFte) : null),
          coverageTargetPct: val(opStr(input, "threshold"), existing?.coverageTargetPct != null ? Number(existing.coverageTargetPct) : null),
          plannedVisits: val(opStr(input, "visits"), existing?.plannedVisits != null ? Number(existing.plannedVisits) : null),
          budget: val(opStr(input, "amount"), existing?.budget != null ? Number(existing.budget) : null),
          note: opStr(input, "note") || existing?.note || null,
        },
        successMessage: `Prévision de ${product.name} enregistrée (${cycleLabel(c)}).`,
        revalidate: ["/planning"],
      };
    },
    async execute(args) {
      const cycle = await ensureCycle(Number(args.year), Number(args.month));
      if (!cycle) return { ok: false, error: "Cycle mensuel invalide." };
      const fd = new FormData();
      fd.set("cycleId", cycle.id);
      for (const [k, v] of Object.entries(args)) {
        if (v == null || k === "year" || k === "month") continue;
        fd.set(k, v);
      }
      const r = await saveForecast(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'enregistrement de la prévision a été refusé." };
      return { ok: true, revalidate: ["/planning"] };
    },
  },

  // ───────── Paramètres SFE ─────────
  save_sfe_settings: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const cur = await prisma.sfeSettings.findUnique({ where: { id: "global" } });
      const weights = (cur?.positionWeights ?? {}) as Record<string, number>;
      const cap = (cur?.capacity ?? {}) as Record<string, number>;
      const freq = (cur?.frequencyByTier ?? {}) as Record<string, number>;
      // FUSION : l'upsert réécrit TOUT avec des défauts (p1=1, 20 j/mois…) — l'existant est
      // relu et rejoué champ par champ ; seuls les champs donnés changent.
      const pick = (given: string, curV: number | undefined, def: number) =>
        given || String(curV ?? def);
      const args = {
        p1: pick(opStr(input, "p1"), weights["1"], 1),
        p2: pick(opStr(input, "p2"), weights["2"], 0.5),
        p3: pick(opStr(input, "p3"), weights["3"], 0.25),
        daysPerMonth: pick(opStr(input, "days"), cap.daysPerMonth, 20),
        visitsPerDay: pick(opStr(input, "visits"), cap.visitsPerDay, 7),
        fieldPct: pick(opStr(input, "threshold"), cap.fieldPct, 80),
        freq_VERY_HIGH: pick(opStr(input, "freqVeryHigh"), freq.VERY_HIGH, 3),
        freq_HIGH: pick(opStr(input, "freqHigh"), freq.HIGH, 2),
        freq_MEDIUM: pick(opStr(input, "freqMedium"), freq.MEDIUM, 1),
        freq_LOW: pick(opStr(input, "freqLow"), freq.LOW, 1),
        freq_VERY_LOW: pick(opStr(input, "freqVeryLow"), freq.VERY_LOW, 0),
      };
      return {
        title: "Paramètres SFE (globaux)",
        fields: [
          { label: "Poids de position", value: `P1 ${args.p1} · P2 ${args.p2} · P3 ${args.p3}` },
          { label: "Capacité", value: `${args.daysPerMonth} j/mois · ${args.visitsPerDay} visites/j · ${args.fieldPct} % terrain` },
          { label: "Fréquences par potentiel", value: `TH ${args.freq_VERY_HIGH} · H ${args.freq_HIGH} · M ${args.freq_MEDIUM} · B ${args.freq_LOW} · TB ${args.freq_VERY_LOW}` },
        ],
        warnings: ["Paramètres GLOBAUX du moteur SFE — tout champ non cité est rejoué à l'identique (FUSION)."],
        args,
        successMessage: "Paramètres SFE enregistrés.",
        revalidate: ["/planning/parametres"],
      };
    },
    execute: (args) => runFd(saveSfeSettings, args, "L'enregistrement des paramètres a été refusé.", { revalidate: ["/planning/parametres"] }),
  },

  // ───────── Équipes ─────────
  create_sales_team: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez l'équipe (champ « name »)." };
      let supervisorId: string | null = null; let supShown: string | null = null;
      if (opStr(input, "person")) {
        const u = await planningUser(opStr(input, "person"));
        if ("error" in u) return u;
        supervisorId = u.id; supShown = u.name;
      }
      let buId: string | null = null; let buShown: string | null = null;
      if (opStr(input, "target")) {
        const b = await resolveBU(opStr(input, "target"));
        if ("error" in b) return b;
        buId = b.id; buShown = b.name;
      }
      return {
        title: `Créer l'équipe de vente « ${name} »`,
        fields: fieldsOf([["Équipe", name], ["Superviseur", supShown], ["BU", buShown]]),
        args: { name, code: opStr(input, "reference") || null, color: null, supervisorId, businessUnitId: buId },
        successMessage: `Équipe « ${name} » créée.`,
        revalidate: ["/planning/equipes"],
      };
    },
    execute: (args) => runFd(createSalesTeam, args, "La création de l'équipe a été refusée.", { revalidate: ["/planning/equipes"] }),
  },

  update_sales_team: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveSalesTeam(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const cur = await prisma.salesTeam.findUnique({
        where: { id: hit.id }, select: { code: true, color: true, supervisorId: true, businessUnitId: true },
      });
      // FUSION : code, couleur, superviseur et BU REMPLACÉS — rejoués.
      let supervisorId = cur?.supervisorId ?? null; let supShown = "(inchangé)";
      const p = opStr(input, "person");
      if (/^aucun/i.test(p)) { supervisorId = null; supShown = "— (retiré)"; }
      else if (p) {
        const u = await planningUser(p);
        if ("error" in u) return u;
        supervisorId = u.id; supShown = u.name;
      }
      return {
        title: `Modifier l'équipe « ${hit.name} »`,
        fields: fieldsOf([
          ["Équipe", opStr(input, "newName") ? `${hit.name} → ${opStr(input, "newName")}` : hit.name],
          ["Superviseur", supShown],
          ["Le reste", "code, couleur et BU rejoués (FUSION)"],
        ]),
        args: {
          id: hit.id, name: opStr(input, "newName") || null,
          code: opStr(input, "reference") || cur?.code || null,
          color: cur?.color ?? null, supervisorId, businessUnitId: cur?.businessUnitId ?? null,
        },
        successMessage: `Équipe « ${opStr(input, "newName") || hit.name} » modifiée.`,
        revalidate: ["/planning/equipes"],
      };
    },
    execute: (args) => runFd(updateSalesTeam, args, "La modification de l'équipe a été refusée.", { revalidate: ["/planning/equipes"] }),
  },

  delete_sales_team: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const hit = await resolveSalesTeam(opStr(input, "target") || opStr(input, "name"));
      if ("error" in hit) return hit;
      const members = await prisma.salesRepProfile.count({ where: { teamId: hit.id } });
      return {
        title: `Supprimer l'équipe « ${hit.name} »`,
        fields: [{ label: "Équipe", value: hit.name }, { label: "KAM rattachés", value: String(members) }],
        warnings: ["Suppression définitive de l'équipe — les profils KAM perdent leur rattachement."],
        args: { id: hit.id },
        successMessage: `Équipe « ${hit.name} » supprimée.`,
        revalidate: ["/planning/equipes"],
      };
    },
    execute: (args) => runFd(deleteSalesTeam, args, "La suppression de l'équipe a été refusée.", { revalidate: ["/planning/equipes"] }),
  },

  // ───────── Profil KAM ─────────
  save_rep_profile: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const rep = await planningUser(opStr(input, "person") || opStr(input, "target"));
      if ("error" in rep) return rep;
      const cur = await prisma.salesRepProfile.findUnique({
        where: { repId: rep.id },
        select: { teamId: true, region: true, capDaysPerMonth: true, capVisitsPerDay: true, capFieldPct: true, fteBudget: true, seniority: true, isActive: true, note: true },
      });
      // FUSION : l'upsert REMPLACE tout (fteBudget absent → 1 !) — l'existant est relu et rejoué.
      let teamId = cur?.teamId ?? null; let teamShown = cur?.teamId ? "(inchangée)" : null;
      const teamRaw = opStr(input, "label");
      if (/^aucun/i.test(teamRaw)) { teamId = null; teamShown = "— (retirée)"; }
      else if (teamRaw) {
        const t = await resolveSalesTeam(teamRaw);
        if ("error" in t) return t;
        teamId = t.id; teamShown = t.name;
      }
      const num = (given: string, curV: number | null | undefined) => given || (curV != null ? String(Number(curV)) : null);
      return {
        title: `Profil KAM de ${rep.name}`,
        fields: fieldsOf([
          ["KAM", rep.name],
          ["Équipe", teamShown],
          ["Région", opStr(input, "location") || cur?.region || null],
          ["FTE budget", num(opStr(input, "quantity"), cur?.fteBudget != null ? Number(cur.fteBudget) : null) ?? "1 (défaut)"],
          ["Le reste", "capacités, séniorité et note rejouées (FUSION)"],
        ]),
        args: {
          repId: rep.id, teamId,
          region: opStr(input, "location") || cur?.region || null,
          capDaysPerMonth: num(opStr(input, "days"), cur?.capDaysPerMonth),
          capVisitsPerDay: num(opStr(input, "visits"), cur?.capVisitsPerDay),
          capFieldPct: num(opStr(input, "threshold"), cur?.capFieldPct),
          fteBudget: num(opStr(input, "quantity"), cur?.fteBudget != null ? Number(cur.fteBudget) : null),
          seniority: opStr(input, "mode") || cur?.seniority || null,
          isActive: cur?.isActive === false ? "off" : "on",
          note: opStr(input, "note") || cur?.note || null,
        },
        successMessage: `Profil KAM de ${rep.name} enregistré.`,
        revalidate: ["/planning/equipes"],
      };
    },
    execute: (args) => runFd(saveRepProfile, args, "L'enregistrement du profil a été refusé.", { revalidate: ["/planning/equipes"] }),
  },

  delete_rep_profile: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const rep = await planningUser(opStr(input, "person") || opStr(input, "target"));
      if ("error" in rep) return rep;
      return {
        title: `Retirer le profil KAM de ${rep.name}`,
        fields: [{ label: "KAM", value: rep.name }],
        warnings: ["Le profil (équipe, capacités, FTE) est retiré — la personne reste, ses affectations aussi."],
        args: { repId: rep.id },
        successMessage: `Profil KAM de ${rep.name} retiré.`,
        revalidate: ["/planning/equipes"],
      };
    },
    execute: (args) => runFd(deleteRepProfile, args, "Le retrait du profil a été refusé.", { revalidate: ["/planning/equipes"] }),
  },

  // ───────── Affectations KAM × produit ─────────
  save_assignment: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = parseCycleMonth(opStr(input, "date"));
      if ("error" in c) return c;
      const rep = await planningUser(opStr(input, "person"));
      if ("error" in rep) return rep;
      const product = await resolvePromoProduct6(opStr(input, "product") || opStr(input, "name"));
      if ("error" in product) return product;
      const cycle = await findCycle(c);
      const existing = cycle.id
        ? await prisma.promotionAssignment.findUnique({
            where: { cycleId_repId_productId: { cycleId: cycle.id, repId: rep.id, productId: product.id } },
            select: { position: true, plannedVisits: true, note: true },
          })
        : null;
      // FUSION : position absente → 1, visites absentes → 0 (= RETRAIT sans note !) — rejoués.
      const position = opStr(input, "mode") || (existing ? String(existing.position) : "1");
      const visits = opStr(input, "visits") || opStr(input, "quantity") || (existing ? String(existing.plannedVisits) : "0");
      const note = opStr(input, "note") || existing?.note || null;
      const willRemove = Number(visits) === 0 && !note;
      return {
        title: `${rep.name} × ${product.name} — ${cycle.shown}`,
        fields: fieldsOf([
          ["KAM", rep.name],
          ["Produit", product.name],
          ["Cycle", cycle.shown],
          ["Position", `P${position}`],
          ["Visites prévues", visits],
        ]),
        warnings: willRemove
          ? ["0 visite SANS note = l'affectation est RETIRÉE de la matrice (nettoyage voulu par l'écran)."]
          : ["La portée est revérifiée par l'action : on n'affecte que les KAM sous sa supervision."],
        args: { year: String(c.year), month: String(c.month), repId: rep.id, productId: product.id, position, plannedVisits: visits, note },
        successMessage: willRemove
          ? `Affectation ${rep.name} × ${product.name} retirée (${cycleLabel(c)}).`
          : `${rep.name} × ${product.name} : P${position}, ${visits} visite(s) (${cycleLabel(c)}).`,
        revalidate: ["/planning/affectations"],
      };
    },
    async execute(args) {
      const cycle = await ensureCycle(Number(args.year), Number(args.month));
      if (!cycle) return { ok: false, error: "Cycle mensuel invalide." };
      const fd = new FormData();
      fd.set("cycleId", cycle.id);
      for (const [k, v] of Object.entries(args)) {
        if (v == null || k === "year" || k === "month") continue;
        fd.set(k, v);
      }
      const r = await saveAssignment(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'affectation a été refusée." };
      return { ok: true, revalidate: ["/planning/affectations"] };
    },
  },

  delete_assignment: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const c = parseCycleMonth(opStr(input, "date"));
      if ("error" in c) return c;
      const rep = await planningUser(opStr(input, "person"));
      if ("error" in rep) return rep;
      const product = await resolvePromoProduct6(opStr(input, "product") || opStr(input, "name"));
      if ("error" in product) return product;
      const cycle = await findCycle(c);
      if (!cycle.id) return { error: `Aucun cycle ${cycleLabel(c)} — rien à retirer.` };
      return {
        title: `Retirer ${rep.name} × ${product.name} (${cycleLabel(c)})`,
        fields: [{ label: "Affectation", value: `${rep.name} × ${product.name} — ${cycleLabel(c)}` }],
        args: { cycleId: cycle.id, repId: rep.id, productId: product.id },
        successMessage: `Affectation retirée (${cycleLabel(c)}).`,
        revalidate: ["/planning/affectations"],
      };
    },
    execute: (args) => runFd(deleteAssignment, args, "Le retrait de l'affectation a été refusé.", { revalidate: ["/planning/affectations"] }),
  },

  carry_forward_assignments: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const from = parseCycleMonth(opStr(input, "date"));
      if ("error" in from) return from;
      const to = parseCycleMonth(opStr(input, "endDate") || opStr(input, "label"));
      if ("error" in to) return { error: "Précisez le cycle CIBLE (champ « endDate » — « octobre 2026 » ou 2026-10)." };
      const fromCycle = await findCycle(from);
      if (!fromCycle.id) return { error: `Aucun cycle source ${cycleLabel(from)}.` };
      const count = await prisma.promotionAssignment.count({ where: { cycleId: fromCycle.id } });
      const toCycle = await findCycle(to);
      return {
        title: `Reporter les affectations : ${cycleLabel(from)} → ${cycleLabel(to)}`,
        fields: [
          { label: "Source", value: `${cycleLabel(from)} — ${count} affectation(s)` },
          { label: "Cible", value: toCycle.shown },
        ],
        warnings: ["Le report NE TOUCHE PAS aux affectations déjà saisies sur le cycle cible (elles priment) — il ne fait que combler les cases vides."],
        args: { fromYear: String(from.year), fromMonth: String(from.month), toYear: String(to.year), toMonth: String(to.month) },
        successMessage: `Affectations de ${cycleLabel(from)} reportées vers ${cycleLabel(to)}.`,
        revalidate: ["/planning/affectations"],
      };
    },
    async execute(args) {
      const toCycle = await ensureCycle(Number(args.toYear), Number(args.toMonth));
      if (!toCycle) return { ok: false, error: "Cycle cible invalide." };
      const fd = new FormData();
      fd.set("toCycleId", toCycle.id);
      fd.set("fromYear", args.fromYear ?? "");
      fd.set("fromMonth", args.fromMonth ?? "");
      const r = await carryForwardAssignments(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le report a été refusé." };
      return { ok: true, revalidate: ["/planning/affectations"] };
    },
  },
};
