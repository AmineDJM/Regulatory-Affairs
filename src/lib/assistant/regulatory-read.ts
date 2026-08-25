import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { regulatoryVisibleWhere } from "@/lib/queries/regulatory-rows";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { REGULATORY_STATUS } from "@/lib/labels";
import { resolveOrg, coreTokens } from "@/lib/assistant/entity-normalize";
import type { PowerTool } from "@/lib/assistant/power-tools";

/**
 * LECTURES REGULATORY CANONIQUES DU CHIEF OF STAFF — la réponse à la panne réelle :
 * « Combien de dossiers Amel gère ? » → « 141 » (tous les produits ACCESSIBLES).
 *
 * GÉRER ≠ POUVOIR VOIR. La colonne « Chargé du dossier » de l'écran (responsibleId) est LA
 * définition de l'assignation directe ; `assignedUsers` n'est qu'un droit de lecture ligne à
 * ligne, et le pipeline entier n'est le portefeuille de personne. Ces outils comptent donc,
 * SÉPARÉMENT et en le disant :
 *   • dossiers dont la personne est RESPONSABLE (elle les « gère ») ;
 *   • dossiers où elle ASSISTE (assistantId) ;
 *   • dossiers auxquels elle a simplement ACCÈS (à ne JAMAIS présenter comme gérés).
 *
 * Le périmètre est CELUI DE L'ÉCRAN (`regulatoryVisibleWhere`) : le Chief ne contredit pas le
 * tableau Regulatory, il lit la même clause. La fraîcheur est dite (données relues à l'instant).
 */

const st = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

const statusLabel = (s: string): string => REGULATORY_STATUS[s]?.label ?? s;

/** L'étape LOGIQUE d'un dossier depuis son workflow JSON — « TERMINÉ » quand tout est fait. */
export function dossierStageLabel(workflow: unknown): { etape: string; avancement: string } {
  const p = regProgress((workflow ?? null) as RegWorkflowState | null);
  return {
    etape: p.current ? `${p.current.n}. ${p.current.label}` : (p.done === p.total ? "TERMINÉ (processus complet)" : "—"),
    avancement: `${p.done}/${p.total}`,
  };
}

export interface AssigneeLoad {
  total: number;
  parStatut: Record<string, number>;
  enRetardCible: number;
  liste: {
    reference: string; produit: string; statut: string; etape: string;
    avancement: string; responsableDepuis?: string | null; cible: string | null;
  }[];
}

/**
 * LA CHARGE DIRECTE d'une personne — le décompte partagé par `employee_360` et
 * `regulatory_workload` (une seule définition, jamais deux). `where` = périmètre écran de
 * l'APPELANT : on ne révèle pas à quelqu'un plus que son propre tableau.
 */
export async function assigneeRegulatoryLoad(
  responsibleId: string,
  visibleWhere: Record<string, unknown>,
  cap = 15,
): Promise<AssigneeLoad> {
  const now = new Date();
  const rows = await prisma.regulatoryProduct.findMany({
    where: { AND: [visibleWhere, { responsibleId }] },
    select: {
      reference: true, dci: true, brandName: true, status: true, workflow: true,
      targetDate: true, targetSubmissionDate: true, updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const parStatut: Record<string, number> = {};
  let late = 0;
  for (const r of rows) {
    const label = statusLabel(r.status);
    parStatut[label] = (parStatut[label] ?? 0) + 1;
    const target = r.targetDate ?? r.targetSubmissionDate;
    if (target && target < now && r.status !== "DECISION_OBTAINED" && r.status !== "CLOSED") late += 1;
  }
  return {
    total: rows.length,
    parStatut,
    enRetardCible: late,
    liste: rows.slice(0, cap).map((r) => {
      const stage = dossierStageLabel(r.workflow);
      return {
        reference: r.reference,
        produit: r.brandName ? `${r.dci} (${r.brandName})` : r.dci,
        statut: statusLabel(r.status),
        etape: stage.etape,
        avancement: stage.avancement,
        cible: (r.targetDate ?? r.targetSubmissionDate)?.toISOString().slice(0, 10) ?? null,
      };
    }),
  };
}

/** Résout un nom de personne vers des comptes (User) — candidats explicites si ambigu. */
async function resolveUserByName(name: string): Promise<{ id: string; name: string }[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true, name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 6,
  });
  if (users.length) return users;
  // Le registre RH connaît parfois un nom que le compte n'affiche pas (nom complet vs abrégé).
  const emps = await prisma.employee.findMany({
    where: { fullName: { contains: name, mode: "insensitive" }, user: { isNot: null } },
    select: { user: { select: { id: true, name: true } } },
    take: 6,
  });
  return emps.flatMap((e) => (e.user ? [{ id: e.user.id, name: e.user.name }] : []));
}

export const REGULATORY_READ_TOOLS: PowerTool[] = [
  // ───────────────────────── CHARGE PAR PERSONNE (assignation DIRECTE) ─────────────────────────
  {
    def: {
      name: "regulatory_workload",
      description:
        "CHARGE REGULATORY par personne — répond à « combien de dossiers gère X ? » et « qui porte quoi ? » avec la SEULE " +
        "définition correcte : les dossiers dont la personne est RESPONSABLE DÉSIGNÉE (colonne « Chargé du dossier » de l'écran). " +
        "Sépare explicitement : gérés (responsable) / assiste (assistante) / simple ACCÈS (jamais comptés comme gérés). " +
        "Sans `person` : la répartition de TOUTE l'équipe (dossiers directs par personne + non assignés) — la matière de " +
        "« est-ce que Regulatory est surchargé ? ». Périmètre = votre écran Regulatory, relu à l'instant.",
      input_schema: {
        type: "object",
        properties: {
          person: { type: "string", description: "Nom (ou fragment) de la personne. Omettre pour la vue d'équipe." },
        },
      },
    },
    allowed: (u) => userCan(u, "REGULATORY", "VIEW"),
    label: "Charge Regulatory (assignations directes)",
    run: async (input, user) => {
      const visible = await regulatoryVisibleWhere(user);
      const person = st(input, "person");
      const now = new Date().toISOString();

      if (!person) {
        // VUE D'ÉQUIPE : répartition des dossiers par RESPONSABLE désigné, dans le périmètre.
        const grouped = await prisma.regulatoryProduct.groupBy({
          by: ["responsibleId"],
          where: visible as never,
          _count: { _all: true },
        });
        const ids = grouped.map((g) => g.responsibleId).filter((x): x is string => Boolean(x));
        const users = ids.length
          ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
          : [];
        const nameOf = new Map(users.map((u2) => [u2.id, u2.name]));
        const open = await prisma.regulatoryProduct.groupBy({
          by: ["responsibleId"],
          where: { AND: [visible as never, { status: { notIn: ["DECISION_OBTAINED", "CLOSED"] } }] },
          _count: { _all: true },
        });
        const openOf = new Map(open.map((g) => [g.responsibleId ?? "∅", g._count._all]));
        const rows = grouped
          .map((g) => ({
            personne: g.responsibleId ? nameOf.get(g.responsibleId) ?? "compte inconnu" : "NON ASSIGNÉ",
            dossiersGeres: g._count._all,
            dontOuverts: openOf.get(g.responsibleId ?? "∅") ?? 0,
          }))
          .sort((a, b) => b.dossiersGeres - a.dossiersGeres);
        return JSON.stringify({
          definition: "dossiers GÉRÉS = responsable DÉSIGNÉ du dossier (colonne « Chargé du dossier ») — jamais le simple accès",
          repartition: rows,
          fraicheur: { source: "table Regulatory (périmètre de votre écran)", luLe: now },
        });
      }

      const candidates = await resolveUserByName(person);
      if (!candidates.length) return `Aucune personne active « ${person} » (comptes et registre RH consultés).`;
      if (candidates.length > 1 && new Set(candidates.map((c) => c.id)).size > 1) {
        return JSON.stringify({
          ambigu: `${candidates.length} personnes correspondent — préciser le nom.`,
          candidats: candidates.map((c) => c.name),
        });
      }

      const target = candidates[0];
      const [load, assistantOn, accessOnly] = await Promise.all([
        assigneeRegulatoryLoad(target.id, visible as Record<string, unknown>),
        prisma.regulatoryProduct.count({ where: { AND: [visible as never, { assistantId: target.id }] } }),
        prisma.regulatoryProduct.count({
          where: {
            AND: [
              visible as never,
              { assignedUsers: { some: { id: target.id } } },
              // « not » Prisma exclut les NULL : un dossier SANS responsable est bien un accès
              // sans responsabilité — l'OR avec null les garde.
              { OR: [{ responsibleId: null }, { responsibleId: { not: target.id } }] },
              { OR: [{ assistantId: null }, { assistantId: { not: target.id } }] },
            ],
          },
        }),
      ]);

      return JSON.stringify({
        personne: target.name,
        dossiersGeresDirectement: {
          definition: "dossiers dont elle est RESPONSABLE DÉSIGNÉE (colonne « Chargé du dossier » de l'écran)",
          total: load.total,
          parStatut: load.parStatut,
          enRetardSurCible: load.enRetardCible,
          liste: load.liste,
        },
        assisteSur: assistantOn,
        accesSansResponsabilite: {
          total: accessOnly,
          regle: "ACCÈS ≠ GESTION — ne JAMAIS présenter ces dossiers comme « gérés » par la personne",
        },
        fraicheur: { source: "table Regulatory (périmètre de votre écran)", luLe: new Date().toISOString() },
      });
    },
  },

  // ───────────────────────── PORTEFEUILLE PAR PARTENAIRE ─────────────────────────
  {
    def: {
      name: "regulatory_portfolio",
      description:
        "PORTEFEUILLE REGULATORY d'un PARTENAIRE / laboratoire — « les produits Kwality et leurs statuts », « et SD ? ». " +
        "Résout le nom contre les partenaires RÉELS de la base (graphies, acronymes : « SD » ↔ « S.D. Pharmaceuticals ») " +
        "avec un score — en cas d'ambiguïté réelle, les candidats sont listés au lieu d'un choix silencieux. " +
        "Renvoie les dossiers du partenaire (statut, étape, avancement, responsable) dans le périmètre de votre écran.",
      input_schema: {
        type: "object",
        properties: {
          partner: { type: "string", description: "Nom du partenaire / laboratoire (même approximatif ou en sigle)." },
        },
        required: ["partner"],
      },
    },
    allowed: (u) => userCan(u, "REGULATORY", "VIEW"),
    label: "Portefeuille Regulatory par partenaire",
    run: async (input, user) => {
      const partner = st(input, "partner");
      if (partner.length < 2) return "Donnez le nom du partenaire.";
      const visible = await regulatoryVisibleWhere(user);

      // Les partenaires RÉELS du périmètre — la résolution se fait contre EUX, pas dans le vide.
      const distinct = await prisma.regulatoryProduct.findMany({
        where: { AND: [visible as never, { partnerLab: { not: null } }] },
        select: { partnerLab: true },
        distinct: ["partnerLab"],
        take: 400,
      });
      const values = distinct.map((d) => d.partnerLab).filter((x): x is string => Boolean(x && x.trim()));
      if (!values.length) {
        return JSON.stringify({
          reponse: "Aucun partenaire renseigné sur les dossiers de votre périmètre.",
          couverture: { source: "champ « Laboratoire partenaire » de la table Regulatory", luLe: new Date().toISOString() },
        });
      }

      const resolution = resolveOrg(partner, values);
      if (resolution.kind === "none") {
        return JSON.stringify({
          reponse: `Aucun partenaire ne correspond à « ${partner} » dans votre périmètre.`,
          partenairesExistants: values.slice(0, 12).sort(),
          consigne: "Vérifier l'orthographe ou choisir dans la liste — ne pas conclure « aucune trace » au-delà de ce champ sans chercher ailleurs (search_everything, find_documents).",
        });
      }
      if (resolution.kind === "ambiguous") {
        return JSON.stringify({
          ambigu: `Plusieurs partenaires plausibles pour « ${partner} » — préciser.`,
          candidats: resolution.candidates.map((c) => ({ nom: c.value, score: Math.round(c.score * 100) / 100, pourquoi: c.why })),
        });
      }

      // DECISIVE : toutes les graphies du MÊME partenaire (même cœur de nom) sont incluses.
      const best = resolution.best!;
      const core = coreTokens(best.value).join(" ");
      const matched = values.filter((v) => coreTokens(v).join(" ") === core);
      const rows = await prisma.regulatoryProduct.findMany({
        where: { AND: [visible as never, { partnerLab: { in: matched } }] },
        select: {
          id: true, reference: true, dci: true, brandName: true, dosage: true, dosageUnit: true,
          pharmaceuticalForm: true, status: true, workflow: true, targetDate: true,
          company: { select: { shortName: true, name: true } },
          responsible: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 60,
      });
      const parStatut: Record<string, number> = {};
      for (const r of rows) parStatut[statusLabel(r.status)] = (parStatut[statusLabel(r.status)] ?? 0) + 1;

      return JSON.stringify({
        partenaire: {
          demande: partner,
          resolu: best.value,
          graphiesIncluses: matched,
          confiance: { score: Math.round(best.score * 100) / 100, pourquoi: best.why },
        },
        total: rows.length,
        parStatut,
        dossiers: rows.slice(0, 40).map((r) => {
          const stage = dossierStageLabel(r.workflow);
          return {
            reference: r.reference,
            produit: r.brandName ? `${r.dci} (${r.brandName})` : r.dci,
            dosage: r.dosage ? `${r.dosage}${r.dosageUnit ? ` ${r.dosageUnit}` : ""}` : null,
            forme: r.pharmaceuticalForm,
            entite: r.company?.shortName ?? r.company?.name ?? null,
            statut: statusLabel(r.status),
            etape: stage.etape,
            avancement: stage.avancement,
            responsable: r.responsible?.name ?? "non assigné",
            cible: r.targetDate?.toISOString().slice(0, 10) ?? null,
            lien: `/regulatory/${r.id}`,
          };
        }),
        fraicheur: { source: "table Regulatory (périmètre de votre écran)", luLe: new Date().toISOString() },
      });
    },
  },
];
