import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { getActionCenter } from "@/lib/queries/action-center";
import { getComptaData } from "@/lib/queries/compta";
import { getRhData } from "@/lib/queries/hr";
import { getUpcomingEvents } from "@/lib/calendar";
import { detectExecutiveAlerts, type ExecutiveAlert } from "@/lib/assistant/proactive";
import { buildSimpleDocx, type SimplePara } from "@/lib/regulatory/intelligence/docgen/build-docx";
import { depositBufferToDrive } from "@/lib/assistant/exports";
import { chainOf, type ChainDoc } from "@/lib/legal/chain";

/**
 * LE PILOTAGE PROACTIF — trois gestes :
 *   • `executive_alerts` : ce qui CLOCHE, détecté sans qu'on le demande (paiement en souffrance,
 *     validation qui dort, facture sans BC, contrat expirant, stock épuisé…) ;
 *   • `executive_brief` : LE POINT — décisions en attente, urgences, finance, RH, réunions,
 *     risques — assemblé en parallèle depuis les MÊMES requêtes que les pages ;
 *   • `create_report` : le RAPPORT CONSOLIDÉ d'un dossier (« regroupe-moi tout sur le contrat X »)
 *     — un vrai .docx déposé dans le Drive, pas un pavé de chat qui se perd.
 */

const EXEC = (u: CurrentUser): boolean => u.role === "SUPER_ADMIN" || u.role === "DIRECTION";

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

const dzd = (n: number): number => Math.round(n);

const frDate = (d: Date | null | undefined): string => {
  if (!d) return "—";
  const alg = new Date(d.getTime() + 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(alg.getUTCDate())}/${p(alg.getUTCMonth() + 1)}/${alg.getUTCFullYear()} ${p(alg.getUTCHours())}:${p(alg.getUTCMinutes())}`;
};

export const EXECUTIVE_BRIEF_TOOLS: PowerTool[] = [
  {
    def: {
      name: "executive_alerts",
      description:
        "Les SIGNAUX D'ALERTE détectés automatiquement dans l'ERP : paiement bloqué au centre, validation en souffrance, tâche " +
        "critique en retard, facture sans BC chaîné, BC sans facture, contrat expirant sous 30 j, dossier Regulatory sans activité, " +
        "stock épuisé, demande de paiement sans décision. Chaque signal porte sa criticité (CRITICAL > IMPORTANT > WATCH > INFO), " +
        "sa preuve (référence, âge en jours) et son lien. À utiliser pour « qu'est-ce qui cloche ? », « où sont les risques ? », " +
        "« sur quoi dois-je me concentrer ? » (croiser avec les décisions en attente).",
      input_schema: {
        type: "object",
        properties: {
          min_criticality: { type: "string", enum: ["CRITICAL", "IMPORTANT", "WATCH", "INFO"], description: "Ne remonter que les signaux au moins aussi graves (défaut : WATCH)." },
        },
      },
    },
    allowed: EXEC,
    label: "Signaux d'alerte détectés",
    run: async (input, user) => {
      const min = str(input, "min_criticality") || "WATCH";
      const rank: Record<string, number> = { CRITICAL: 0, IMPORTANT: 1, WATCH: 2, INFO: 3 };
      const threshold = rank[min] ?? 2;
      const alerts = await detectExecutiveAlerts(user);
      const kept = alerts.filter((a) => rank[a.criticite] <= threshold);
      if (kept.length === 0) return "Aucun signal au-dessus de ce seuil — rien ne cloche sur les détecteurs.";
      return JSON.stringify({
        seuil: min,
        signaux: kept,
        note: "Criticité calculée sur des seuils simples (âge, priorité, niveau) — les détails portent l'âge exact.",
      });
    },
  },

  {
    def: {
      name: "executive_brief",
      description:
        "LE POINT EXÉCUTIF (« fais-moi mon point ») — tout en un appel, assemblé en parallèle : À DÉCIDER (validations, paiements " +
        "au centre), URGENT/RISQUES (signaux d'alerte), FINANCE (mois en cours, à régler, retards), RH (effectif, masse salariale, " +
        "congés en attente), RÉUNIONS (prochains rendez-vous). Restituer en sections courtes et chiffrées, chaque ligne avec sa " +
        "référence et son lien. Pour un point QUOTIDIEN automatique : plan_reminder DAILY à l'heure voulue avec link=/chief-of-staff.",
      input_schema: { type: "object", properties: {} },
    },
    allowed: EXEC,
    label: "Point exécutif assemblé",
    run: async (_input, user) => {
      const entity = await platformScope(user.id);
      const [center, centreOrders, alerts, events, compta, rh] = await Promise.all([
        getActionCenter(user).catch(() => ({ items: [] as { title: string; subtitle?: string | null; module: string; statusLabel: string; deadline?: string | null; href: string }[] })),
        prisma.expenseOrder.findMany({
          where: { AND: [entity, { centralStatus: "AWAITING" }] },
          select: { reference: true, label: true, amount: true, beneficiary: true, createdAt: true },
          orderBy: { createdAt: "asc" }, take: 10,
        }),
        detectExecutiveAlerts(user).catch(() => [] as ExecutiveAlert[]),
        getUpcomingEvents(user, 5).catch(() => []),
        userCan(user, "FINANCES", "VIEW") ? getComptaData(user.id).catch(() => null) : Promise.resolve(null),
        userCan(user, "RH", "VIEW") ? getRhData(user.id).catch(() => null) : Promise.resolve(null),
      ]);

      const centreTotal = centreOrders.reduce((s, o) => s + toNumber(o.amount), 0);
      return JSON.stringify({
        aDecider: {
          paiementsAuCentre: {
            nombre: centreOrders.length,
            totalDzd: dzd(centreTotal),
            liste: centreOrders.map((o) => ({ reference: o.reference, objet: o.label, beneficiaire: o.beneficiary, montantDzd: dzd(toNumber(o.amount)) })),
            lien: "/centre-de-paiement",
          },
          fileDeDecisions: center.items.slice(0, 10).map((i) => ({
            titre: i.title, detail: i.subtitle, module: i.module, statut: i.statusLabel,
            echeance: i.deadline ? i.deadline.slice(0, 10) : null, lien: i.href,
          })),
        },
        risques: alerts.slice(0, 12),
        reunions: events.map((e) => ({ titre: e.title, jour: e.ymd, heure: e.timeLabel || "journée entière", organisateur: e.organizerName, lien: "/calendar" })),
        finance: compta ? {
          recettesDuMoisDzd: dzd(compta.recettesMois), depensesDuMoisDzd: dzd(compta.depensesMois),
          resultatDuMoisDzd: dzd(compta.resultatMois), aEncaisserDzd: dzd(compta.aEncaisser),
          aReglerDzd: dzd(compta.aReglerOrders), aReglerNombre: compta.aReglerCount,
          enRetard: { nombre: compta.enRetardCount, montantDzd: dzd(compta.enRetardMontant) },
          lien: "/finances",
        } : "module Finances non ouvert à ce compte",
        rh: rh ? {
          effectifActif: rh.stats.active, masseSalarialeDzd: dzd(rh.stats.masseSalariale),
          congesEnAttente: rh.stats.pending, avancesEnAttente: rh.stats.advances,
          contratsExpirantSous60j: rh.contractsExpiring.length, lien: "/rh",
        } : "module RH non ouvert à ce compte",
      });
    },
  },

  {
    def: {
      name: "create_report",
      description:
        "GÉNÈRE un RAPPORT CONSOLIDÉ (.docx, déposé dans le Drive personnel, dossier « Rapports IA ») sur un dossier : " +
        "« regroupe-moi tout sur le contrat X et fais-moi un rapport ». `reference` = référence ou fragment de titre d'une pièce " +
        "Legal, d'une demande de paiement ou d'un règlement. Le rapport rassemble : fiche, chaîne devis→BC→facture→règlement, " +
        "validateurs et dates, pièces jointes, timeline complète. Après l'appel, donner le NOM du fichier et le LIEN Drive.",
      input_schema: {
        type: "object",
        properties: {
          reference: { type: "string", description: "Référence (ou fragment de titre) du dossier à consolider." },
          title: { type: "string", description: "Titre du rapport (optionnel — défaut : « Rapport — <dossier> »)." },
        },
        required: ["reference"],
      },
    },
    allowed: EXEC,
    label: "Rapport consolidé généré",
    run: async (input, user) => {
      const ref = str(input, "reference");
      if (ref.length < 2) return "Donnez la référence du dossier à consolider.";

      // Le rapport suit LES MÊMES pistes qu'inspect_record : Legal d'abord (la chaîne y vit),
      // puis demande de paiement, puis règlement. On consolide — on n'invente rien.
      const paras: SimplePara[] = [];
      const H1 = (t: string) => paras.push({ text: t, bold: true, size: 32 });
      const H2 = (t: string) => paras.push({ text: t, bold: true, size: 26 });
      const P = (t: string) => paras.push({ text: t });

      let subject: string | null = null;

      const legal = await prisma.legalDocument.findFirst({
        where: {
          AND: [
            { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
            ...(user.role === "SUPER_ADMIN" ? [] : [{
              OR: [{ readers: { none: {} } }, { readers: { some: { userId: user.id } } }, { createdById: user.id }],
            }]),
          ],
        },
        select: { id: true, title: true, reference: true, kind: true, counterparty: true, amount: true, startDate: true, endDate: true, status: true, chainFromId: true, expenseOrderId: true, notes: true },
      });

      if (legal) {
        subject = `${legal.reference ?? legal.kind} — ${legal.title}`;
        H1(str(input, "title") || `Rapport — ${subject}`);
        P(`Généré le ${frDate(new Date())} (heure d'Alger) par ${user.name}, via My Chief of Staff.`);
        H2("Fiche");
        P(`Nature : ${legal.kind} · Statut : ${legal.status}`);
        if (legal.counterparty) P(`Partie : ${legal.counterparty}`);
        if (legal.amount != null) P(`Montant : ${Math.round(toNumber(legal.amount)).toLocaleString("fr-FR")} DZD`);
        if (legal.startDate || legal.endDate) P(`Période : ${legal.startDate?.toISOString().slice(0, 10) ?? "—"} → ${legal.endDate?.toISOString().slice(0, 10) ?? "—"}`);
        if (legal.notes) P(`Notes : ${legal.notes}`);

        // La chaîne d'achat — même parcours borné qu'inspect_record.
        const byId = new Map<string, { id: string; kind: string; title: string; reference: string | null; chainFromId: string | null; amount: unknown }>();
        byId.set(legal.id, { ...legal });
        const select = { id: true, kind: true, title: true, reference: true, chainFromId: true, amount: true } as const;
        for (let hop = 0; hop < 8; hop += 1) {
          const wanted = [...byId.values()].map((r) => r.chainFromId).filter((x): x is string => Boolean(x) && !byId.has(x!));
          const children = await prisma.legalDocument.findMany({
            where: { OR: [{ id: { in: wanted.length ? wanted : ["-"] } }, { chainFromId: { in: [...byId.keys()] } }], id: { notIn: [...byId.keys()] } },
            select,
          });
          if (children.length === 0) break;
          for (const c of children) byId.set(c.id, c);
        }
        const chain = chainOf([...byId.values()].map((r) => ({ id: r.id, kind: r.kind, chainFromId: r.chainFromId })) as ChainDoc[], legal.id);
        if (chain.length > 1) {
          H2("Chaîne d'achat (devis → BC → facture)");
          for (const link of chain) {
            const row = byId.get(link.id)!;
            P(`• ${row.kind} ${row.reference ?? ""} — ${row.title}${row.amount != null ? ` (${Math.round(toNumber(row.amount as never)).toLocaleString("fr-FR")} DZD)` : ""}`);
          }
        }

        const [validators, docs, audit, settlement] = await Promise.all([
          prisma.validationRequest.findMany({
            where: { entityType: "LEGAL_DOCUMENT", entityId: legal.id },
            select: { reference: true, steps: { select: { status: true, decidedAt: true, validator: { select: { name: true } } }, orderBy: { order: "asc" } } },
          }),
          prisma.document.findMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: legal.id }, select: { name: true, createdAt: true, uploadedBy: { select: { name: true } } }, take: 30 }),
          prisma.auditLog.findMany({ where: { entityType: "LEGAL_DOCUMENT", entityId: legal.id }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }),
          legal.expenseOrderId
            ? prisma.expenseOrder.findUnique({ where: { id: legal.expenseOrderId }, select: { reference: true, status: true, centralStatus: true, paidDate: true, amount: true } })
            : Promise.resolve(null),
        ]);
        if (validators.length) {
          H2("Validateurs");
          for (const v of validators) for (const s of v.steps) P(`• ${s.validator.name} — ${s.status}${s.decidedAt ? ` le ${frDate(s.decidedAt)}` : " (en attente)"} (${v.reference})`);
        }
        if (settlement) {
          H2("Règlement");
          P(`${settlement.reference} — ${settlement.status} · Centre : ${settlement.centralStatus ?? "—"} · Payé : ${settlement.paidDate ? frDate(settlement.paidDate) : "pas encore"} · ${Math.round(toNumber(settlement.amount)).toLocaleString("fr-FR")} DZD`);
        }
        if (docs.length) {
          H2("Pièces jointes");
          for (const d of docs) P(`• ${d.name}${d.uploadedBy ? ` (déposée par ${d.uploadedBy.name}` : " ("}${d.uploadedBy ? ", " : ""}${frDate(d.createdAt)})`);
        }
        if (audit.length) {
          H2("Timeline");
          for (const h of audit) P(`${frDate(h.createdAt)} — ${h.summary ?? h.action}${h.actor ? ` (${h.actor.name})` : ""}`);
        }
      }

      if (!subject) {
        const pay = await prisma.paymentRequest.findFirst({
          where: { OR: [{ reference: { equals: ref, mode: "insensitive" } }, { title: { contains: ref, mode: "insensitive" } }] },
          include: { pieces: { select: { kind: true, status: true, note: true } } },
        });
        if (pay) {
          subject = `${pay.reference} — ${pay.title}`;
          H1(str(input, "title") || `Rapport — ${subject}`);
          P(`Généré le ${frDate(new Date())} (heure d'Alger) par ${user.name}, via My Chief of Staff.`);
          H2("Fiche");
          P(`Bénéficiaire : ${pay.payee} · Montant : ${Math.round(toNumber(pay.amount)).toLocaleString("fr-FR")} DZD · Statut : ${pay.status}`);
          if (pay.dueDate) P(`Échéance convenue : ${pay.dueDate.toISOString().slice(0, 10)}`);
          if (pay.pieces.length) {
            H2("Pièces du dossier");
            for (const p of pay.pieces) P(`• ${p.kind} — ${p.status}${p.note ? ` (${p.note})` : ""}`);
          }
          const [validators, order, audit] = await Promise.all([
            prisma.validationRequest.findMany({
              where: { entityType: "PAYMENT_REQUEST", entityId: pay.id },
              select: { reference: true, steps: { select: { status: true, decidedAt: true, validator: { select: { name: true } } }, orderBy: { order: "asc" } } },
            }),
            pay.expenseOrderId
              ? prisma.expenseOrder.findUnique({ where: { id: pay.expenseOrderId }, select: { reference: true, status: true, centralStatus: true, paidDate: true } })
              : Promise.resolve(null),
            prisma.auditLog.findMany({ where: { entityType: "PAYMENT_REQUEST", entityId: pay.id }, include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 60 }),
          ]);
          if (validators.length) {
            H2("Validateurs");
            for (const v of validators) for (const s of v.steps) P(`• ${s.validator.name} — ${s.status}${s.decidedAt ? ` le ${frDate(s.decidedAt)}` : " (en attente)"} (${v.reference})`);
          }
          if (order) {
            H2("Règlement");
            P(`${order.reference} — ${order.status} · Centre : ${order.centralStatus ?? "—"} · Payé : ${order.paidDate ? frDate(order.paidDate) : "pas encore"}`);
          }
          if (audit.length) {
            H2("Timeline");
            for (const h of audit) P(`${frDate(h.createdAt)} — ${h.summary ?? h.action}${h.actor ? ` (${h.actor.name})` : ""}`);
          }
        }
      }

      if (!subject) {
        return `Aucune pièce Legal ni demande de paiement ne porte « ${ref} » — vérifier la référence avec search_everything ou inspect_record avant de générer un rapport.`;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const safe = subject.replace(/[^\p{L}\p{N} .\-—]/gu, "").slice(0, 60).trim() || "dossier";
      const filename = `rapport-${safe}-${stamp}.docx`;
      const data = buildSimpleDocx(paras);
      const { nodeId } = await depositBufferToDrive(user.id, {
        folder: "Rapports IA", filename, data,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        category: "Rapport",
      });
      await recordAudit({
        actorId: user.id, action: "CREATE", module: "Assistant IA",
        summary: `Rapport consolidé « ${subject} » généré via le Chief of Staff → Drive / ${filename}`,
      }).catch(() => undefined);
      return JSON.stringify({
        fichier: filename,
        dossier: subject,
        emplacement: "Drive personnel, dossier « Rapports IA »",
        lien: `/drive/${nodeId}`,
        contenu: "Fiche, chaîne d'achat, validateurs, règlement, pièces, timeline.",
      });
    },
  },
];
