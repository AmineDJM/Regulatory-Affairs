import type { PowerTool } from "@/lib/assistant/power-tools";
import type { CurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { platformScope } from "@/lib/company";
import { searchEverything } from "@/lib/queries/search-everything";
import { getCalendarEvents, getUpcomingEvents, algiersInputToUtc, algiersYmd, algiersTime } from "@/lib/calendar";
import { toNumber } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/labels";

/**
 * LES LECTURES TRANSVERSES du Chief of Staff — calendrier, stocks, hôpitaux, paie, courriers,
 * agrégats financiers, fiche employé, et la recherche fédérée `search_everything`.
 *
 * La règle d'ouverture n'est PAS « réservé au PDG » : chaque outil s'ouvre par le DROIT qui
 * ouvre l'écran correspondant (`userCan`), comme tous les power tools. Le PDG et le Super Admin
 * les ont tous ; un compte à qui l'on ouvre les Stocks gagne l'outil stocks — sans toucher au
 * code. Seul `find_free_slot` regarde l'agenda D'AUTRES personnes : il reste aux comptes à vue
 * globale, car aucun écran ne montre l'agenda d'autrui à un compte ordinaire.
 */

const EXEC = (u: CurrentUser): boolean => u.role === "SUPER_ADMIN" || u.role === "DIRECTION";

const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

const num = (input: Record<string, unknown>, key: string): number | null => {
  const v = input[key];
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const dzd = (n: number): string => `${Math.round(n).toLocaleString("fr-FR")} DZD`;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const EXECUTIVE_READ_TOOLS: PowerTool[] = [
  // ───────────────────────── RECHERCHE FÉDÉRÉE ─────────────────────────
  {
    def: {
      name: "search_everything",
      description:
        "RECHERCHE FÉDÉRÉE dans TOUT l'ERP en un appel : produits, dossiers, personnes, tâches, demandes de paiement, règlements, " +
        "documents Legal (devis/BC/factures/contrats), courriers, factures, fournisseurs, hôpitaux, lieux de stock, matériel promo, " +
        "projets, Drive, calendrier, congrès… Tolère les accents et les petites fautes. " +
        "À utiliser EN PREMIER dès que l'on cherche « la facture de… », « le paiement 1028 », « le contrat X » sans savoir où c'est rangé. " +
        "Si un terme ne donne rien, réessayer avec un SYNONYME (nom commercial ↔ DCI, ex. « Keytruda » ↔ « pembrolizumab ») ou un fragment plus court.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Ce que l'on cherche — mots du nom, référence, personne, montant approximatif en toutes lettres…" } },
        required: ["query"],
      },
    },
    allowed: () => true,
    label: "Recherche fédérée effectuée",
    run: async (input, user) => {
      const q = str(input, "query");
      if (q.length < 2) return "Donnez au moins deux caractères.";
      const out = await searchEverything(user, q);
      return JSON.stringify(out);
    },
  },

  // ───────────────────────── CALENDRIER ─────────────────────────
  {
    def: {
      name: "read_calendar",
      description:
        "Lit le CALENDRIER : prochains rendez-vous et réunions (titre, date/heure d'Alger, lieu, organisateur, invités, lien visio). " +
        "`date` (AAAA-MM-JJ) pour un jour précis, sinon les prochains événements. " +
        "À utiliser pour « quelle est ma prochaine réunion ? », « qu'ai-je demain ? », « qui participe ? ».",
      input_schema: {
        type: "object",
        properties: {
          date: { type: "string", description: "Jour précis AAAA-MM-JJ (heure d'Alger). Omettre pour les prochains événements." },
          limit: { type: "number", description: "Nombre maximum d'événements (défaut 8, max 20)." },
        },
      },
    },
    allowed: (u) => userCan(u, "WORKSPACE", "VIEW"),
    label: "Calendrier consulté",
    run: async (input, user) => {
      const date = str(input, "date");
      const limit = Math.min(Math.max(num(input, "limit") ?? 8, 1), 20);
      let events;
      if (date && YMD_RE.test(date)) {
        const from = algiersInputToUtc(`${date}T00:00`);
        if (!from) return "Date illisible (AAAA-MM-JJ).";
        events = await getCalendarEvents(user, from, new Date(from.getTime() + 86_400_000));
      } else {
        events = await getUpcomingEvents(user, limit);
      }
      if (events.length === 0) return date ? `Aucun événement le ${date}.` : "Aucun événement à venir.";
      return JSON.stringify(events.slice(0, limit).map((e) => ({
        titre: e.title, jour: e.ymd, heure: e.timeLabel || "journée entière",
        lieu: e.location, organisateur: e.organizerName,
        invites: e.invitees.map((i) => `${i.name} (${i.status})`),
        visio: e.meetLink, lien: "/calendar",
      })));
    },
  },

  {
    def: {
      name: "find_free_slot",
      description:
        "Cherche un CRÉNEAU LIBRE COMMUN pour plusieurs personnes un jour donné (heures de bureau 08:00–18:00, heure d'Alger), " +
        "en regardant leurs rendez-vous existants. À utiliser pour « trouve une heure demain avec Amel et Khaled ». " +
        "Renvoie les créneaux libres du jour et les occupations qui les bordent. Ensuite : create_calendar_event pour réserver.",
      input_schema: {
        type: "object",
        properties: {
          names: { type: "string", description: "Noms des personnes, séparés par des virgules (l'utilisateur courant est inclus d'office)." },
          date: { type: "string", description: "Jour AAAA-MM-JJ (heure d'Alger)." },
          duration_min: { type: "number", description: "Durée souhaitée en minutes (défaut 60)." },
        },
        required: ["names", "date"],
      },
    },
    // Regarder l'agenda D'AUTRES personnes est un geste de pilotage : aucun écran ne l'offre à
    // un compte ordinaire, l'outil non plus.
    allowed: (u) => EXEC(u) || hasGlobalView(u),
    label: "Disponibilités croisées",
    run: async (input, user) => {
      const date = str(input, "date");
      if (!YMD_RE.test(date)) return "Date illisible (AAAA-MM-JJ).";
      const duration = Math.min(Math.max(num(input, "duration_min") ?? 60, 15), 480);
      const names = str(input, "names").split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) return "Donnez au moins un nom.";

      const people: { id: string; name: string }[] = [{ id: user.id, name: `${user.name} (vous)` }];
      const missing: string[] = [];
      for (const n of names) {
        const u = await prisma.user.findFirst({
          where: { isActive: true, OR: [{ name: { contains: n, mode: "insensitive" } }, { title: { contains: n, mode: "insensitive" } }] },
          select: { id: true, name: true },
        });
        if (u && !people.some((p) => p.id === u.id)) people.push(u);
        else if (!u) missing.push(n);
      }
      if (missing.length) return `Introuvable dans l'annuaire : ${missing.join(", ")}. Vérifier avec search_people.`;

      const dayStart = algiersInputToUtc(`${date}T08:00`)!;
      const dayEnd = algiersInputToUtc(`${date}T18:00`)!;
      const busy = await prisma.calendarEvent.findMany({
        where: {
          AND: [
            { OR: [{ organizerId: { in: people.map((p) => p.id) } }, { invitees: { some: { userId: { in: people.map((p) => p.id) } } } }] },
            { startAt: { lt: dayEnd } },
            { OR: [{ endAt: { gt: dayStart } }, { endAt: null, startAt: { gte: dayStart } }] },
          ],
        },
        select: { title: true, startAt: true, endAt: true, allDay: true, organizer: { select: { name: true } } },
        orderBy: { startAt: "asc" },
      });

      // Un événement sans fin bloque une heure ; une journée entière bloque le jour.
      const blocks = busy.map((b) => ({
        de: b.allDay ? dayStart : b.startAt,
        a: b.allDay ? dayEnd : (b.endAt ?? new Date(b.startAt.getTime() + 3_600_000)),
        titre: b.title, organisateur: b.organizer.name,
      })).sort((a, b) => a.de.getTime() - b.de.getTime());

      const free: { de: Date; a: Date }[] = [];
      let cursor = dayStart;
      for (const b of blocks) {
        if (b.de.getTime() > cursor.getTime()) free.push({ de: cursor, a: b.de });
        if (b.a.getTime() > cursor.getTime()) cursor = b.a;
      }
      if (cursor.getTime() < dayEnd.getTime()) free.push({ de: cursor, a: dayEnd });
      const fitting = free.filter((s) => s.a.getTime() - s.de.getTime() >= duration * 60_000);

      return JSON.stringify({
        jour: date, personnes: people.map((p) => p.name), dureeMin: duration,
        creneauxLibres: fitting.map((s) => `${algiersTime(s.de)} → ${algiersTime(s.a)}`),
        occupations: blocks.map((b) => ({ de: algiersTime(b.de), a: algiersTime(b.a), titre: b.titre, par: b.organisateur })),
        note: fitting.length === 0 ? "Aucun créneau commun assez long ce jour-là — proposer un autre jour." : undefined,
      });
    },
  },

  // ───────────────────────── STOCKS ─────────────────────────
  {
    def: {
      name: "read_stock",
      description:
        "Lit les STOCKS (relevés datés « à cette date, il reste X ») : dernier niveau connu par produit et par lieu (PCH centrale, " +
        "hôpitaux, annexes PCH), avec la date du relevé. `product` filtre sur un produit ; `low_threshold` remonte les stocks " +
        "CRITIQUES (niveau ≤ seuil). À utiliser pour « combien reste-t-il de X ? », « quels stocks sont critiques ? », « dernier état à l'hôpital Y ».",
      input_schema: {
        type: "object",
        properties: {
          product: { type: "string", description: "Nom commercial ou DCI (fragment). Omettre pour tous les produits." },
          location: { type: "string", description: "Nom d'un hôpital / d'une annexe, ou « PCH » (fragment). Optionnel." },
          low_threshold: { type: "number", description: "Ne remonter QUE les niveaux ≤ ce seuil (stocks critiques)." },
        },
      },
    },
    allowed: (u) => userCan(u, "STOCKS", "VIEW"),
    label: "Stocks consultés",
    run: async (input, user) => {
      const product = str(input, "product");
      const location = str(input, "location");
      const lowThreshold = num(input, "low_threshold");

      const snaps = await prisma.stockSnapshot.findMany({
        where: {
          AND: [
            await platformScope(user.id),
            product
              ? { product: { OR: [{ brandName: { contains: product, mode: "insensitive" } }, { dci: { contains: product, mode: "insensitive" } }] } }
              : {},
          ],
        },
        select: {
          scope: true, annexId: true, date: true, quantity: true,
          product: { select: { brandName: true, dci: true, id: true } },
          annex: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 4000,
      });
      if (snaps.length === 0) return product ? `Aucun relevé de stock pour « ${product} ».` : "Aucun relevé de stock.";

      // Dernier relevé par (produit × lieu) — les relevés arrivent triés du plus récent.
      const seen = new Map<string, { produit: string; lieu: string; quantite: number; releveLe: string }>();
      for (const s of snaps) {
        const lieu = s.scope === "PCH" ? "PCH (centrale)" : s.annex?.name ?? "Hôpital";
        if (location && !lieu.toLowerCase().includes(location.toLowerCase())) continue;
        const key = `${s.product.id}|${lieu}`;
        if (!seen.has(key)) {
          seen.set(key, {
            produit: s.product.brandName?.trim() || s.product.dci,
            lieu, quantite: s.quantity, releveLe: s.date.toISOString().slice(0, 10),
          });
        }
      }
      let rows = [...seen.values()];
      if (lowThreshold != null) rows = rows.filter((r) => r.quantite <= lowThreshold);
      rows.sort((a, b) => a.quantite - b.quantite);
      if (rows.length === 0) {
        return lowThreshold != null
          ? `Aucun stock ≤ ${lowThreshold} — rien de critique sur les derniers relevés.`
          : "Aucun relevé ne correspond à ces filtres.";
      }
      return JSON.stringify({
        note: "Niveaux = DERNIER RELEVÉ daté par produit et par lieu (pas un temps réel).",
        niveaux: rows.slice(0, 60), lien: "/stocks",
      });
    },
  },

  // ───────────────────────── HÔPITAUX / ÉTABLISSEMENTS ─────────────────────────
  {
    def: {
      name: "search_hospitals",
      description:
        "Cherche un HÔPITAL / ÉTABLISSEMENT dans les deux référentiels : l'annuaire médical (établissements : CHU, EPH, cliniques… " +
        "avec ville, wilaya, praticiens rattachés) et la liste des lieux de stock (hôpitaux et annexes PCH du module Stocks). " +
        "À utiliser avant create_hospital (éviter un doublon) et pour « quels hôpitaux à Alger ? ».",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Nom (fragment), ville ou wilaya." } },
        required: ["query"],
      },
    },
    allowed: (u) => userCan(u, "MEDICAL", "VIEW") || userCan(u, "STOCKS", "VIEW"),
    label: "Établissements consultés",
    run: async (input, user) => {
      const q = str(input, "query");
      if (q.length < 2) return "Donnez au moins deux caractères.";
      const [institutions, annexes] = await Promise.all([
        userCan(user, "MEDICAL", "VIEW")
          ? prisma.medicalInstitution.findMany({
              where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { wilaya: { contains: q, mode: "insensitive" } }] },
              select: { id: true, name: true, type: true, sector: true, city: true, wilaya: true, isActive: true, _count: { select: { doctors: true } } },
              take: 15, orderBy: { name: "asc" },
            })
          : [],
        userCan(user, "STOCKS", "VIEW")
          ? prisma.stockAnnex.findMany({
              where: { name: { contains: q, mode: "insensitive" } },
              select: { id: true, name: true, kind: true },
              take: 15, orderBy: { name: "asc" },
            })
          : [],
      ]);
      if (institutions.length === 0 && annexes.length === 0) return `Aucun établissement « ${q} » — ni dans l'annuaire médical, ni dans les lieux de stock.`;
      return JSON.stringify({
        annuaireMedical: institutions.map((i) => ({
          id: i.id, nom: i.name, type: i.type, secteur: i.sector,
          ville: i.city ?? i.wilaya, praticiens: i._count.doctors, actif: i.isActive, lien: "/medical",
        })),
        lieuxDeStock: annexes.map((a) => ({ id: a.id, nom: a.name, nature: a.kind === "ANNEX" ? "Annexe PCH" : "Hôpital", lien: "/stocks" })),
      });
    },
  },

  // ───────────────────────── RH : FICHE + PAIE ─────────────────────────
  {
    def: {
      name: "read_employee",
      description:
        "Lit la FICHE RH d'un employé : poste, département, responsable (N+1), type et dates de contrat, date d'embauche, " +
        "solde de congés, statut. SANS les rémunérations (utiliser read_payroll). " +
        "À utiliser pour « qui est le N+1 de X ? », « quand finit le contrat de Y ? », « quel est son solde de congés ? ».",
      input_schema: {
        type: "object",
        properties: { name: { type: "string", description: "Nom (ou fragment) de l'employé." } },
        required: ["name"],
      },
    },
    allowed: (u) => userCan(u, "RH", "VIEW"),
    label: "Fiche RH consultée",
    run: async (input, _user) => {
      const name = str(input, "name");
      if (name.length < 2) return "Donnez le nom de l'employé.";
      const emp = await prisma.employee.findFirst({
        where: { fullName: { contains: name, mode: "insensitive" } },
        select: {
          id: true, fullName: true, position: true, isActive: true, hireDate: true,
          contractType: true, contractStart: true, contractEnd: true, leaveBalanceDays: true,
          departmentRef: { select: { name: true } }, manager: { select: { fullName: true } },
          company: { select: { shortName: true, name: true } },
          user: { select: { role: true } },
        },
      });
      if (!emp) return `Aucun employé « ${name} » dans le registre RH.`;
      return JSON.stringify({
        nom: emp.fullName, poste: emp.position, actif: emp.isActive,
        departement: emp.departmentRef?.name ?? null,
        responsable: emp.manager?.fullName ?? null,
        entite: emp.company?.shortName ?? emp.company?.name ?? null,
        role: emp.user ? ROLE_LABELS[emp.user.role] ?? emp.user.role : null,
        embaucheLe: emp.hireDate?.toISOString().slice(0, 10) ?? null,
        contrat: emp.contractType,
        contratDu: emp.contractStart?.toISOString().slice(0, 10) ?? null,
        contratAu: emp.contractEnd?.toISOString().slice(0, 10) ?? "indéterminé / non renseigné",
        soldeCongesJours: Number(emp.leaveBalanceDays),
        lien: `/rh/${emp.id}`,
      });
    },
  },

  {
    def: {
      name: "read_payroll",
      description:
        "Lit la PAIE (données confidentielles, réservées aux détenteurs du module RH) : " +
        "avec `name`, le salaire actuel d'une personne (base, net, coût employeur) et ses 6 derniers mois de paie ; " +
        "avec `month` (AAAA-MM), la masse salariale de ce mois (somme des coûts employeur) et le nombre de salariés payés. " +
        "À utiliser AVANT toute modification de salaire (update_salary) : la carte doit montrer l'AVANT.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom de l'employé (détail individuel)." },
          month: { type: "string", description: "Mois AAAA-MM (masse salariale du mois)." },
        },
      },
    },
    allowed: (u) => userCan(u, "RH", "VIEW"),
    label: "Paie consultée",
    run: async (input, _user) => {
      const name = str(input, "name");
      const month = str(input, "month");

      if (name) {
        const emp = await prisma.employee.findFirst({
          where: { fullName: { contains: name, mode: "insensitive" } },
          select: {
            id: true, fullName: true, position: true,
            baseSalary: true, netToPay: true, grossSalary: true, employerCost: true,
            payrolls: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 6, select: { year: true, month: true, net: true, gross: true, employerCost: true, status: true, paidDate: true } },
          },
        });
        if (!emp) return `Aucun employé « ${name} » dans le registre RH.`;
        return JSON.stringify({
          nom: emp.fullName, poste: emp.position,
          ficheActuelle: {
            salaireDeBaseDzd: Math.round(toNumber(emp.baseSalary)),
            netAPayerDzd: emp.netToPay != null ? Math.round(toNumber(emp.netToPay)) : null,
            brutDzd: emp.grossSalary != null ? Math.round(toNumber(emp.grossSalary)) : null,
            coutEmployeurDzd: emp.employerCost != null ? Math.round(toNumber(emp.employerCost)) : null,
          },
          derniersMois: emp.payrolls.map((p) => ({
            mois: `${p.year}-${String(p.month).padStart(2, "0")}`,
            netDzd: Math.round(toNumber(p.net)),
            coutEmployeurDzd: p.employerCost != null ? Math.round(toNumber(p.employerCost)) : Math.round(toNumber(p.gross)),
            statut: p.status, payeLe: p.paidDate?.toISOString().slice(0, 10) ?? null,
          })),
          confidentialite: "Données de paie — à ne restituer qu'à ce détenteur du module RH, jamais en diffusion.",
          lien: `/rh/${emp.id}`,
        });
      }

      if (month) {
        if (!YM_RE.test(month)) return "Mois illisible (AAAA-MM).";
        const [y, m] = month.split("-").map(Number);
        const entries = await prisma.payrollEntry.findMany({
          where: { year: y, month: m },
          select: { employerCost: true, gross: true, net: true, status: true },
        });
        if (entries.length === 0) return `Aucune ligne de paie sur ${month}.`;
        const masse = entries.reduce((s, e) => s + (e.employerCost != null ? toNumber(e.employerCost) : toNumber(e.gross)), 0);
        const net = entries.reduce((s, e) => s + toNumber(e.net), 0);
        const sansCout = entries.filter((e) => e.employerCost == null).length;
        return JSON.stringify({
          mois: month, salaries: entries.length,
          masseSalarialeDzd: Math.round(masse),
          totalNetDzd: Math.round(net),
          payes: entries.filter((e) => e.status === "PAID").length,
          precision: sansCout > 0 ? `${sansCout} ligne(s) sans coût employeur : le brut a servi de repli pour celles-ci.` : undefined,
          lien: "/rh/paie",
        });
      }

      return "Donnez `name` (détail d'une personne) ou `month` (masse salariale d'un mois).";
    },
  },

  // ───────────────────────── COURRIERS ─────────────────────────
  {
    def: {
      name: "search_courriers",
      description:
        "Cherche dans le REGISTRE DES COURRIERS (départs et arrivées) : objet, référence de chrono, expéditeur, destinataire, " +
        "dates (départ / arrivée / accusé de réception), pièces jointes. " +
        "À utiliser pour « retrouve le courrier envoyé au ministère », « a-t-on reçu l'accusé ? ».",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Objet, référence, expéditeur ou destinataire (fragment)." },
          direction: { type: "string", enum: ["OUTGOING", "INCOMING"], description: "Départ (OUTGOING) ou arrivée (INCOMING). Optionnel." },
          month: { type: "string", description: "Mois AAAA-MM (date de départ ou d'arrivée). Optionnel." },
        },
      },
    },
    allowed: (u) => userCan(u, "MAIL_REGISTER", "VIEW"),
    label: "Registre des courriers consulté",
    run: async (input, user) => {
      const q = str(input, "query");
      const direction = str(input, "direction");
      const month = str(input, "month");
      const monthRange = YM_RE.test(month)
        ? { gte: new Date(`${month}-01T00:00:00Z`), lt: new Date(new Date(`${month}-01T00:00:00Z`).setUTCMonth(new Date(`${month}-01T00:00:00Z`).getUTCMonth() + 1)) }
        : null;

      const rows = await prisma.mailEntry.findMany({
        where: {
          AND: [
            await platformScope(user.id),
            q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { sender: { contains: q, mode: "insensitive" } }, { recipient: { contains: q, mode: "insensitive" } }] } : {},
            direction === "OUTGOING" || direction === "INCOMING" ? { direction } : {},
            monthRange ? { OR: [{ sentAt: monthRange }, { receivedAt: monthRange }] } : {},
          ],
        },
        select: {
          id: true, reference: true, title: true, direction: true, sender: true, recipient: true,
          sentAt: true, receivedAt: true, acknowledgedAt: true, carrier: true,
          concernedUser: { select: { name: true } }, department: { select: { name: true } },
          pieces: { select: { id: true } }, driveNodeId: true,
        },
        take: 20, orderBy: { createdAt: "desc" },
      });
      if (rows.length === 0) return "Aucun courrier ne correspond à ces critères dans le registre.";
      return JSON.stringify(rows.map((r) => ({
        id: r.id, reference: r.reference, objet: r.title,
        sens: r.direction === "OUTGOING" ? "Départ" : "Arrivée",
        expediteur: r.sender, destinataire: r.recipient,
        parti: r.sentAt?.toISOString().slice(0, 10) ?? null,
        arrive: r.receivedAt?.toISOString().slice(0, 10) ?? null,
        accuseLe: r.acknowledgedAt?.toISOString().slice(0, 10) ?? "pas d'accusé",
        porteur: r.carrier,
        concerne: [r.concernedUser?.name, r.department?.name].filter(Boolean).join(" · ") || null,
        pieces: r.pieces.length + (r.driveNodeId ? 1 : 0),
        lien: "/courriers",
      })));
    },
  },

  // ───────────────────────── AGRÉGATS FINANCIERS ─────────────────────────
  {
    def: {
      name: "finance_totals",
      description:
        "AGRÈGE les écritures financières CÔTÉ BASE (jamais additionner des lignes à la main) : total payé / encaissé sur une " +
        "période, filtré par bénéficiaire (`counterparty`, fragment) et/ou catégorie, avec détail mensuel. `compare_from`/`compare_to` " +
        "ajoutent une seconde période pour un ÉCART (ex. « ce trimestre vs le précédent »). " +
        "À utiliser pour « combien avons-nous payé à X depuis janvier ? », « dépenses fournisseurs du mois vs le mois dernier ». " +
        "Catégories : RECETTE, SALAIRE, LOYER, VOYAGE, EVENEMENT, BUREAUTIQUE, FOURNISSEUR, CHARGES, IMPOT, BANQUE, AUTRE…",
      input_schema: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["OUT", "IN"], description: "OUT = décaissements (défaut), IN = encaissements." },
          counterparty: { type: "string", description: "Bénéficiaire / client (fragment du nom). Optionnel." },
          category: { type: "string", description: "Catégorie exacte (ex. FOURNISSEUR, SALAIRE). Optionnel." },
          from: { type: "string", description: "Début AAAA-MM-JJ (défaut : 1er janvier de l'année en cours)." },
          to: { type: "string", description: "Fin AAAA-MM-JJ incluse (défaut : aujourd'hui)." },
          compare_from: { type: "string", description: "Début de la période de comparaison (optionnel)." },
          compare_to: { type: "string", description: "Fin de la période de comparaison (optionnel)." },
        },
      },
    },
    allowed: (u) => userCan(u, "FINANCES", "VIEW"),
    label: "Agrégats financiers calculés",
    run: async (input, user) => {
      const direction = str(input, "direction") === "IN" ? "IN" : "OUT";
      const counterparty = str(input, "counterparty");
      const category = str(input, "category").toUpperCase();
      const year = new Date().getUTCFullYear();
      const from = YMD_RE.test(str(input, "from")) ? new Date(`${str(input, "from")}T00:00:00Z`) : new Date(Date.UTC(year, 0, 1));
      const to = YMD_RE.test(str(input, "to")) ? new Date(new Date(`${str(input, "to")}T00:00:00Z`).getTime() + 86_400_000) : new Date();
      const entity = await platformScope(user.id);

      const sumPeriod = async (a: Date, b: Date) => {
        const rows = await prisma.financeTransaction.findMany({
          where: {
            AND: [
              entity,
              { direction, status: "SETTLED", date: { gte: a, lt: b } },
              counterparty ? { counterparty: { contains: counterparty, mode: "insensitive" } } : {},
              category ? { category: category as never } : {},
            ],
          },
          select: { amount: true, date: true, category: true, counterparty: true, label: true, reference: true },
          take: 5000, orderBy: { date: "asc" },
        });
        const total = rows.reduce((s, r) => s + toNumber(r.amount), 0);
        const parMois = new Map<string, number>();
        for (const r of rows) {
          const k = r.date.toISOString().slice(0, 7);
          parMois.set(k, (parMois.get(k) ?? 0) + toNumber(r.amount));
        }
        return { rows, total, parMois };
      };

      const p1 = await sumPeriod(from, to);
      const out: Record<string, unknown> = {
        sens: direction === "OUT" ? "décaissements" : "encaissements",
        filtre: [counterparty ? `bénéficiaire ≈ « ${counterparty} »` : null, category || null].filter(Boolean).join(" · ") || "toutes écritures",
        periode: { du: from.toISOString().slice(0, 10), au: new Date(to.getTime() - 86_400_000).toISOString().slice(0, 10) },
        totalDzd: Math.round(p1.total),
        ecritures: p1.rows.length,
        parMois: [...p1.parMois.entries()].map(([mois, m]) => ({ mois, totalDzd: Math.round(m) })),
        dernieresEcritures: p1.rows.slice(-8).reverse().map((r) => ({
          reference: r.reference, libelle: r.label, beneficiaire: r.counterparty,
          date: r.date.toISOString().slice(0, 10), montant: dzd(toNumber(r.amount)),
        })),
        lien: "/finances",
      };

      const cFrom = str(input, "compare_from");
      const cTo = str(input, "compare_to");
      if (YMD_RE.test(cFrom) && YMD_RE.test(cTo)) {
        const a = new Date(`${cFrom}T00:00:00Z`);
        const b = new Date(new Date(`${cTo}T00:00:00Z`).getTime() + 86_400_000);
        const p2 = await sumPeriod(a, b);
        const ecart = p1.total - p2.total;
        out.comparaison = {
          periode: { du: cFrom, au: cTo },
          totalDzd: Math.round(p2.total),
          ecartDzd: Math.round(ecart),
          ecartPct: p2.total > 0 ? Math.round((ecart / p2.total) * 1000) / 10 : null,
        };
      }
      return JSON.stringify(out);
    },
  },
];
