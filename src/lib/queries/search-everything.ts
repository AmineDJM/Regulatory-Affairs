import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { sitsOnPaymentCentre } from "@/lib/payments/authorization";
import { platformScope } from "@/lib/company";
import { globalSearch } from "@/lib/queries/search";
import { toNumber } from "@/lib/utils";

/**
 * RECHERCHE FÉDÉRÉE « search_everything » — le geste réflexe du Chief of Staff.
 *
 * « Trouve-moi la facture de la fontaine d'eau », « le paiement 1028 », « pembro » : la personne
 * ne sait pas dans quel module la donnée vit, et elle n'a pas à le savoir. Cette recherche
 * interroge TOUTES les familles d'objets — celles de la recherche globale (palette ⌘K), plus
 * celles qu'elle ne couvrait pas (paiements, règlements, Legal, courriers, factures,
 * fournisseurs, établissements, lieux de stock, matériel promo, projets, calendrier, comptes).
 *
 * Trois règles, non négociables :
 *   • le RBAC d'abord : chaque famille est gardée par le MÊME droit que son écran, et les
 *     restrictions fines (lecteurs Legal, cloisonnement d'entité) s'appliquent — la recherche
 *     n'est pas une porte dérobée ;
 *   • la recherche globale existante n'est PAS dupliquée : on l'appelle, puis on la complète —
 *     une seule implémentation par famille ;
 *   • tolérance aux ACCENTS et aux FAUTES : chaque terme est aussi essayé sans ses accents, et
 *     quand la base le permet (extensions `unaccent` / `pg_trgm`), un second passage rattrape
 *     « fontaine » ↔ « Fontaïne » et « pembro » ↔ « Pembrolizumab » côté SQL. Sans extension,
 *     la recherche stricte reste entière — le repli est un bonus, jamais une dépendance.
 */

export interface EverythingHit {
  famille: string;
  titre: string;
  detail: string;
  reference?: string | null;
  statut?: string | null;
  date?: string | null;
  lien: string;
}

export interface EverythingResult {
  total: number;
  parFamille: Record<string, number>;
  resultats: EverythingHit[];
  note?: string;
}

// ─────────────────────────── Termes et variantes sans accent ───────────────────────────

export const strip = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function parseTerms(q: string): string[] {
  return q.trim().split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 6);
}

/**
 * ET des mots × OU des champs, chaque mot essayé AVEC et SANS accents (l'utilisateur tape
 * « ténofovir », la base porte « tenofovir » — et inversement le repli SQL couvre l'autre sens).
 */
export function matchOf(terms: string[], fields: string[]): Record<string, unknown>[] {
  return terms.map((t) => {
    const variants = strip(t) === t ? [t] : [t, strip(t)];
    return { OR: fields.flatMap((f) => variants.map((v) => ({ [f]: { contains: v, mode: "insensitive" } }))) };
  });
}

// ─────────────────────────── Repli SQL : unaccent + trigrammes ───────────────────────────

/**
 * Colonnes fouillables PAR TABLE — liste FERMÉE : les identifiants entrent dans du SQL brut,
 * ils ne viennent donc JAMAIS d'une entrée utilisateur. Seules les VALEURS sont liées en
 * paramètres.
 */
const FUZZY_TABLES: Record<string, readonly string[]> = {
  RegulatoryProduct: ["dci", "brandName", "reference", "therapeuticClass"],
  DriveNode: ["name"],
  LegalDocument: ["title", "reference", "counterparty"],
  MedicalDoctor: ["name", "institution"],
  MedicalInstitution: ["name", "city"],
  MailEntry: ["title", "reference", "sender", "recipient"],
  User: ["name", "title"],
  Employee: ["fullName", "position"],
  PaymentRequest: ["title", "reference", "payee"],
  ExpenseOrder: ["label", "reference", "beneficiary"],
  Invoice: ["title", "number", "recipient", "payer"],
  AdministrativeRequest: ["title", "reference"],
};

let sqlCaps: { unaccent: boolean; trgm: boolean } | null = null;

/** Les extensions sont-elles là ? Sondé UNE fois par processus — jamais bloquant. */
async function capabilities(): Promise<{ unaccent: boolean; trgm: boolean }> {
  if (sqlCaps) return sqlCaps;
  const [unaccent, trgm] = await Promise.all([
    prisma.$queryRaw`SELECT unaccent('é')`.then(() => true).catch(() => false),
    prisma.$queryRaw`SELECT similarity('a','a')`.then(() => true).catch(() => false),
  ]);
  sqlCaps = { unaccent, trgm };
  return sqlCaps;
}

/** Réinitialise la sonde (tests uniquement). */
export function resetSearchCapabilitiesProbe(): void {
  sqlCaps = null;
}

/**
 * Identifiants candidats d'une table, au-delà du LIKE strict : `unaccent` neutralise les
 * accents CÔTÉ BASE, et `pg_trgm` rattrape les fautes de frappe (similarité de trigrammes).
 * Ne renvoie que des `id` : l'appelant refait une VRAIE requête Prisma, AVEC le scope RBAC —
 * le SQL brut ne décide jamais de ce qui est visible.
 */
async function fuzzyIds(table: keyof typeof FUZZY_TABLES, terms: string[], limit = 30): Promise<string[]> {
  const caps = await capabilities();
  if (!caps.unaccent && !caps.trgm) return [];
  const columns = FUZZY_TABLES[table];
  if (!columns) return [];

  const values: string[] = [];
  const perTerm = terms.map((t) => {
    values.push(strip(t).toLowerCase());
    const p = `$${values.length}`;
    const perCol = columns.map((c) => {
      const col = caps.unaccent ? `unaccent(lower("${c}"))` : `lower("${c}")`;
      const like = `${col} LIKE '%' || ${p} || '%'`;
      // La similarité n'a de sens que sur un mot assez long — sur « bc » elle matche tout.
      const sim = caps.trgm && strip(t).length >= 4 ? ` OR similarity(${col}, ${p}) > 0.38` : "";
      return `(${like}${sim})`;
    });
    return `(${perCol.join(" OR ")})`;
  });

  const sql = `SELECT id FROM "${table}" WHERE ${perTerm.join(" AND ")} LIMIT ${limit}`;
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...values);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

// ─────────────────────────── Les familles complémentaires ───────────────────────────

const d10 = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

type Where = Record<string, unknown>;

/**
 * Fabrique le `where` d'une famille : scope RBAC + (LIKE strict OU identifiants du repli flou).
 * Le repli n'est demandé que si la famille est fouillable en SQL brut.
 */
async function familyWhere(
  table: keyof typeof FUZZY_TABLES | null,
  terms: string[],
  fields: string[],
  scope: Where[],
): Promise<Where> {
  const strict = { AND: [...scope, ...matchOf(terms, fields)] };
  if (!table) return strict;
  const ids = await fuzzyIds(table, terms);
  if (ids.length === 0) return strict;
  return { AND: [...scope, { OR: [{ AND: matchOf(terms, fields) }, { id: { in: ids } }] }] };
}

/** La recherche fédérée. `take` borne CHAQUE famille — pas le total. */
export async function searchEverything(user: SessionUser, q: string, take = 6): Promise<EverythingResult> {
  const terms = parseTerms(q);
  if (terms.length === 0) return { total: 0, parFamille: {}, resultats: [] };

  const entity = await platformScope(user.id);
  const global = hasGlobalView(user);
  const canFinances = userCan(user, "FINANCES", "VIEW");
  const canPayments = sitsOnPaymentCentre(user) || canFinances;

  // Les `where` à repli flou se préparent EN PARALLÈLE (chacun peut sonder le SQL), puis les
  // requêtes partent ensemble : la latence de la fédération est celle de la famille la plus
  // lente, pas la somme.
  const [wPayments, wOrders, wLegal, wMails, wInvoices, wInstitutions] = await Promise.all([
    familyWhere("PaymentRequest", terms, ["title", "reference", "payee"], [
      entity as Where,
      // Visibles du centre / des Finances ; sinon, uniquement les siennes.
      ...(canPayments ? [] : [{ requesterId: user.id }]),
    ]),
    familyWhere("ExpenseOrder", terms, ["label", "reference", "beneficiary"], [entity as Where]),
    familyWhere("LegalDocument", terms, ["title", "reference", "counterparty"], [
      entity as Where,
      // La restriction par LECTEURS s'applique aussi ici : un contrat restreint n'apparaît pas
      // dans une recherche de qui n'en est pas lecteur.
      ...(user.role === "SUPER_ADMIN" ? [] : [{
        OR: [{ readers: { none: {} } }, { readers: { some: { userId: user.id } } }, { createdById: user.id }],
      }]),
    ]),
    familyWhere("MailEntry", terms, ["title", "reference", "sender", "recipient"], [entity as Where]),
    familyWhere("Invoice", terms, ["title", "number", "recipient", "payer"], [entity as Where]),
    familyWhere("MedicalInstitution", terms, ["name", "city", "wilaya"], []),
  ]);

  const [
    base,
    payments, orders, legal, mails, invoices, suppliers, institutions, annexes, promos, projets, calendar, people,
  ] = await Promise.all([
    // 1) La recherche globale EXISTANTE (Regulatory, Drive, RH, tâches, congrès, discussions…).
    globalSearch(user, q, take).catch(() => []),

    // 2) Demandes de paiement.
    prisma.paymentRequest.findMany({
      where: wPayments as Prisma.PaymentRequestWhereInput,
      select: { id: true, reference: true, title: true, payee: true, status: true, amount: true, createdAt: true },
      take, orderBy: { createdAt: "desc" },
    }).catch(() => []),

    // 3) Règlements (ordres de dépense) — Finances ou siège du centre.
    canPayments
      ? prisma.expenseOrder.findMany({
          where: wOrders as Prisma.ExpenseOrderWhereInput,
          select: { id: true, reference: true, label: true, beneficiary: true, status: true, centralStatus: true, amount: true, createdAt: true },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 4) Legal.
    userCan(user, "LEGAL", "VIEW")
      ? prisma.legalDocument.findMany({
          where: wLegal as Prisma.LegalDocumentWhereInput,
          select: { id: true, reference: true, title: true, kind: true, counterparty: true, status: true, amount: true, endDate: true },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 5) Courriers (registre).
    userCan(user, "MAIL_REGISTER", "VIEW")
      ? prisma.mailEntry.findMany({
          where: wMails as Prisma.MailEntryWhereInput,
          select: { id: true, reference: true, title: true, direction: true, sender: true, recipient: true, sentAt: true, receivedAt: true },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 6) Factures (module Finances).
    canFinances
      ? prisma.invoice.findMany({
          where: wInvoices as Prisma.InvoiceWhereInput,
          select: { id: true, number: true, title: true, status: true, amount: true, dueDate: true },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 7) Fournisseurs (référentiel PCH / logistique).
    userCan(user, "PCH", "VIEW") || userCan(user, "LOGISTICS", "VIEW")
      ? prisma.supplier.findMany({
          where: { AND: matchOf(terms, ["name", "country", "contactEmail"]) } as Prisma.SupplierWhereInput,
          select: { id: true, name: true, country: true, active: true },
          take, orderBy: { name: "asc" },
        }).catch(() => [])
      : [],

    // 8) Établissements médicaux (annuaire).
    userCan(user, "MEDICAL", "VIEW")
      ? prisma.medicalInstitution.findMany({
          where: wInstitutions as Prisma.MedicalInstitutionWhereInput,
          select: { id: true, name: true, type: true, city: true, wilaya: true },
          take, orderBy: { name: "asc" },
        }).catch(() => [])
      : [],

    // 9) Lieux de stock (hôpitaux / annexes PCH du module Stocks).
    userCan(user, "STOCKS", "VIEW")
      ? prisma.stockAnnex.findMany({
          where: { AND: matchOf(terms, ["name"]) } as Prisma.StockAnnexWhereInput,
          select: { id: true, name: true, kind: true },
          take, orderBy: { name: "asc" },
        }).catch(() => [])
      : [],

    // 10) Matériel promotionnel.
    userCan(user, "PROMO_MATERIAL", "VIEW")
      ? prisma.promoMaterial.findMany({
          where: { AND: [entity as Where, ...matchOf(terms, ["title", "reference", "chosenAgency"])] } as Prisma.PromoMaterialWhereInput,
          select: { id: true, reference: true, title: true, status: true, circuitState: true },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 11) Projets (dossiers délégués) — participants seulement, sauf vue globale.
    userCan(user, "DOSSIERS", "VIEW")
      ? prisma.dossier.findMany({
          where: {
            AND: [
              ...(global ? [] : [{
                OR: [{ createdById: user.id }, { assignedToId: user.id }, { participantIds: { has: user.id } }],
              }]),
              ...matchOf(terms, ["title", "reference", "description"]),
            ],
          } as Prisma.DossierWhereInput,
          select: { id: true, reference: true, title: true, status: true, assignedTo: { select: { name: true } } },
          take, orderBy: { createdAt: "desc" },
        }).catch(() => [])
      : [],

    // 12) Calendrier — ses rendez-vous (organisés ou invités) ; tout, en vue globale.
    prisma.calendarEvent.findMany({
      where: {
        AND: [
          global ? {} : { OR: [{ organizerId: user.id }, { invitees: { some: { userId: user.id } } }] },
          ...matchOf(terms, ["title", "location", "description"]),
        ],
      } as Prisma.CalendarEventWhereInput,
      select: { id: true, title: true, startAt: true, location: true, organizer: { select: { name: true } } },
      take, orderBy: { startAt: "desc" },
    }).catch(() => []),

    // 13) Les personnes (annuaire interne) — par nom OU par fonction.
    prisma.user.findMany({
      where: { AND: [{ isActive: true }, ...matchOf(terms, ["name", "title"])] } as Prisma.UserWhereInput,
      select: { id: true, name: true, title: true, department: { select: { name: true } } },
      take, orderBy: { name: "asc" },
    }).catch(() => []),
  ]);

  const hits: EverythingHit[] = [];
  for (const r of base) {
    hits.push({ famille: r.group, titre: r.title, detail: r.subtitle, lien: r.href });
  }
  for (const r of payments) {
    hits.push({
      famille: "Demandes de paiement", titre: `${r.reference} — ${r.title}`,
      detail: `${r.payee} · ${Math.round(toNumber(r.amount)).toLocaleString("fr-FR")} DZD`,
      reference: r.reference, statut: r.status, date: d10(r.createdAt), lien: `/validations/paiements/${r.id}`,
    });
  }
  for (const r of orders) {
    hits.push({
      famille: "Règlements", titre: `${r.reference} — ${r.label}`,
      detail: `${r.beneficiary ?? "—"} · ${Math.round(toNumber(r.amount)).toLocaleString("fr-FR")} DZD`,
      reference: r.reference, statut: r.centralStatus ?? r.status, date: d10(r.createdAt), lien: "/centre-de-paiement",
    });
  }
  for (const r of legal) {
    hits.push({
      famille: "Legal", titre: r.title,
      detail: [r.kind, r.counterparty].filter(Boolean).join(" · "),
      reference: r.reference, statut: r.status, date: d10(r.endDate), lien: `/legal/${r.id}`,
    });
  }
  for (const r of mails) {
    hits.push({
      famille: "Courriers", titre: r.title,
      detail: r.direction === "OUTGOING" ? `Départ → ${r.recipient ?? "—"}` : `Arrivée ← ${r.sender ?? "—"}`,
      reference: r.reference, date: d10(r.sentAt ?? r.receivedAt), lien: "/courriers",
    });
  }
  for (const r of invoices) {
    hits.push({
      famille: "Factures", titre: r.title,
      detail: `${r.number ?? "sans n°"} · ${r.amount != null ? Math.round(toNumber(r.amount)).toLocaleString("fr-FR") + " DZD" : "—"}`,
      reference: r.number, statut: r.status, date: d10(r.dueDate), lien: "/finances/factures",
    });
  }
  for (const r of suppliers) {
    hits.push({ famille: "Fournisseurs", titre: r.name, detail: r.country ?? "", statut: r.active ? "actif" : "inactif", lien: "/pch" });
  }
  for (const r of institutions) {
    hits.push({ famille: "Établissements", titre: r.name, detail: [r.type, r.city ?? r.wilaya].filter(Boolean).join(" · "), lien: "/medical" });
  }
  for (const r of annexes) {
    hits.push({ famille: "Lieux de stock", titre: r.name, detail: r.kind === "ANNEX" ? "Annexe PCH" : "Hôpital", lien: "/stocks" });
  }
  for (const r of promos) {
    hits.push({
      famille: "Matériel promotionnel", titre: `${r.reference} — ${r.title}`,
      reference: r.reference, statut: r.circuitState ?? r.status, detail: "", lien: `/promo-material/${r.id}`,
    });
  }
  for (const r of projets) {
    hits.push({
      famille: "Projets", titre: `${r.reference} — ${r.title}`,
      detail: r.assignedTo?.name ? `Responsable : ${r.assignedTo.name}` : "",
      reference: r.reference, statut: r.status, lien: `/dossiers/${r.id}`,
    });
  }
  for (const r of calendar) {
    hits.push({
      famille: "Calendrier", titre: r.title,
      detail: [r.organizer.name, r.location].filter(Boolean).join(" · "),
      date: d10(r.startAt), lien: "/calendar",
    });
  }
  for (const r of people) {
    hits.push({
      famille: "Personnes", titre: r.name,
      detail: [r.title, r.department?.name].filter(Boolean).join(" · "), lien: "/search",
    });
  }

  const parFamille: Record<string, number> = {};
  for (const h of hits) parFamille[h.famille] = (parFamille[h.famille] ?? 0) + 1;

  return {
    total: hits.length,
    parFamille,
    resultats: hits,
    note: hits.length === 0
      ? "Aucun résultat. Essayer un synonyme (nom commercial ↔ DCI), un fragment plus court, ou une autre orthographe."
      : undefined,
  };
}
